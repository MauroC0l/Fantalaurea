-- Timed challenges (ADR 0020): bonus actions open for a few minutes, created and edited by the
-- admin or by players the admin allowed; points to everyone in time, or only to the first N.

alter table public.evening_settings add column challenges_enabled boolean not null default true;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  -- null = the admin
  creator_id uuid references public.players on delete cascade,
  title text not null check (char_length(title) between 2 and 40),
  description text not null default '' check (char_length(description) <= 300),
  points integer not null check (points between 1 and 100),
  -- null = everyone who completes it in time
  winners_limit integer check (winners_limit between 1 and 50),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.challenge_completions (
  challenge_id uuid not null references public.challenges on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (challenge_id, player_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_completions enable row level security;
revoke all on public.challenges, public.challenge_completions from anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Switch
-- ---------------------------------------------------------------------------------------

create or replace function public.features(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return (select jsonb_build_object('actions', actions_enabled, 'chat', chat_enabled, 'feed', feed_enabled,
                                    'leaderboard', leaderboard_enabled, 'polls', polls_enabled,
                                    'challenges', challenges_enabled)
          from evening_settings);
end;
$$;

create or replace function public.admin_set_feature(p_token uuid, p_feature text, p_enabled boolean) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  if p_feature not in ('actions', 'chat', 'feed', 'leaderboard', 'polls', 'challenges') or p_enabled is null then
    return 'rejected';
  end if;
  update evening_settings set
    actions_enabled = case when p_feature = 'actions' then p_enabled else actions_enabled end,
    chat_enabled = case when p_feature = 'chat' then p_enabled else chat_enabled end,
    feed_enabled = case when p_feature = 'feed' then p_enabled else feed_enabled end,
    leaderboard_enabled = case when p_feature = 'leaderboard' then p_enabled else leaderboard_enabled end,
    polls_enabled = case when p_feature = 'polls' then p_enabled else polls_enabled end,
    challenges_enabled = case when p_feature = 'challenges' then p_enabled else challenges_enabled end
  where true;
  return 'ok';
end;
$$;

create function public.challenges_enabled() returns boolean
language sql stable security definer set search_path = public
as $$ select challenges_enabled from evening_settings $$;

create or replace function public.svc_reset_evening() returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_photos uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_photos from (
    select photo_id as id from all_completions where photo_id is not null
    union all select photo_id from posts
    union all select avatar_id from players where avatar_id is not null
  ) photos;
  delete from polls where true;
  delete from challenges where true;
  delete from players where true;
  delete from admin_access_log where true;
  update evening_settings set secret_word = generate_secret_word(), updated_at = now() where true;
  return v_photos;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Points: a completion counts if it came among the first `winners_limit` (or always)
-- ---------------------------------------------------------------------------------------

create function public.challenge_points_of(p_player uuid) returns bigint
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(ranked.points), 0) from (
    select c.points, cc.player_id, c.winners_limit,
           row_number() over (partition by cc.challenge_id order by cc.completed_at) as rank
    from challenge_completions cc join challenges c on c.id = cc.challenge_id
  ) ranked
  where ranked.player_id = p_player and ranked.rank <= coalesce(ranked.winners_limit, 2147483647)
$$;

create function public.challenges_done_by(p_player uuid) returns bigint
language sql stable security definer set search_path = public
as $$ select count(*) from challenge_completions where player_id = p_player $$;

create or replace function public.participants(p_token uuid)
returns table (id uuid, nickname text, real_name text, avatar_id uuid, actions_done bigint, points bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return query
    with shared as (
      select count(*) as done, coalesce(sum(a.points), 0) as points
      from shared_completions s join actions a on a.id = s.action_id
    )
    select p.id, p.nickname, p.real_name, p.avatar_id,
      (select count(*) from player_completions c where c.player_id = p.id) + shared.done + challenges_done_by(p.id),
      coalesce((select sum(a.points) from player_completions c join actions a on a.id = c.action_id
                where c.player_id = p.id), 0) + shared.points + challenge_points_of(p.id)
    from players p cross join shared
    where p.blocked_at is null
    order by p.created_at;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------------------

create function public.can_manage_challenge(p_token uuid, c public.challenges) returns boolean
language sql stable security definer set search_path = public
as $$ select is_admin(p_token) or (c.creator_id is not null and c.creator_id = player_of(p_token)) $$;

/** Running challenges first (ending soonest first), then the finished ones. */
create function public.challenges(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  perform require_session(p_token);
  return coalesce((
    select jsonb_agg(item order by (item->>'ended')::boolean, item->>'endsAt')
    from (
      select jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'description', c.description,
        'points', c.points,
        'winnersLimit', c.winners_limit,
        'startsAt', c.starts_at,
        'endsAt', c.ends_at,
        'ended', c.ends_at <= now(),
        'creator', case when c.creator_id is null then null
                        else (select jsonb_build_object('id', p.id, 'nickname', p.nickname) from players p where p.id = c.creator_id) end,
        'canManage', can_manage_challenge(p_token, c),
        'completions', (select count(*) from challenge_completions cc where cc.challenge_id = c.id),
        'mine', (select jsonb_build_object('at', r.completed_at, 'rank', r.rank) from (
                   select cc.player_id, cc.completed_at, row_number() over (order by cc.completed_at) as rank
                   from challenge_completions cc where cc.challenge_id = c.id) r
                 where r.player_id = v_me),
        'winners', coalesce((
          select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatarId', p.avatar_id,
                                              'at', w.completed_at) order by w.completed_at)
          from (select cc.player_id, cc.completed_at from challenge_completions cc
                where cc.challenge_id = c.id order by cc.completed_at limit coalesce(c.winners_limit, 50)) w
          join players p on p.id = w.player_id and p.blocked_at is null), '[]'::jsonb)
      ) as item
      from challenges c
      where c.creator_id is null or not is_blocked(c.creator_id)
    ) listed
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------------------

create function public.may_create_challenges(p_token uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin(p_token) or coalesce((select can_create_challenges from players where id = player_of(p_token)), false)
$$;

-- Returns {"status": "ok", "challengeId"} or {"status": "unauthorized" | "forbidden" | "rejected" | "disabled"}.
create function public.create_challenge(
  p_token uuid, p_title text, p_description text, p_points integer, p_duration_minutes integer, p_winners_limit integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if player_of(p_token) is null and not is_admin(p_token) then return jsonb_build_object('status', 'unauthorized'); end if;
  if not challenges_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  if not may_create_challenges(p_token) then return jsonb_build_object('status', 'forbidden'); end if;
  if p_duration_minutes is null or p_duration_minutes not between 1 and 240 then
    return jsonb_build_object('status', 'rejected');
  end if;
  insert into challenges (creator_id, title, description, points, winners_limit, ends_at)
  values (player_of(p_token), normalize_text(p_title), normalize_text(coalesce(p_description, '')), p_points,
          p_winners_limit, now() + make_interval(mins => p_duration_minutes))
  returning id into v_id;
  return jsonb_build_object('status', 'ok', 'challengeId', v_id);
exception
  when check_violation or not_null_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

-- p_extend_minutes: null keeps the end, otherwise it moves to now + minutes (also reopens an ended one).
create function public.update_challenge(
  p_token uuid, p_challenge uuid, p_title text, p_description text, p_points integer, p_winners_limit integer,
  p_extend_minutes integer
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_challenge challenges;
begin
  if player_of(p_token) is null and not is_admin(p_token) then return 'unauthorized'; end if;
  select * into v_challenge from challenges where id = p_challenge;
  if not found or not can_manage_challenge(p_token, v_challenge) then return 'rejected'; end if;
  if p_extend_minutes is not null and p_extend_minutes not between 1 and 240 then return 'rejected'; end if;
  update challenges set
    title = normalize_text(p_title),
    description = normalize_text(coalesce(p_description, '')),
    points = p_points,
    winners_limit = p_winners_limit,
    ends_at = case when p_extend_minutes is null then ends_at else now() + make_interval(mins => p_extend_minutes) end
  where id = p_challenge;
  return 'ok';
exception
  when check_violation or not_null_violation then return 'rejected';
end;
$$;

create function public.end_challenge(p_token uuid, p_challenge uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_challenge challenges;
begin
  if player_of(p_token) is null and not is_admin(p_token) then return 'unauthorized'; end if;
  select * into v_challenge from challenges where id = p_challenge;
  if not found or not can_manage_challenge(p_token, v_challenge) then return 'rejected'; end if;
  -- ends_at must stay after starts_at, even for a challenge ended in its very first instant.
  update challenges set ends_at = greatest(starts_at + interval '1 millisecond', least(ends_at, now()))
  where id = p_challenge;
  return 'ok';
end;
$$;

create function public.delete_challenge(p_token uuid, p_challenge uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_challenge challenges;
begin
  if player_of(p_token) is null and not is_admin(p_token) then return 'unauthorized'; end if;
  select * into v_challenge from challenges where id = p_challenge;
  if not found or not can_manage_challenge(p_token, v_challenge) then return 'rejected'; end if;
  delete from challenges where id = p_challenge;
  return 'ok';
end;
$$;

-- 'ok' | 'unauthorized' | 'disabled' | 'ended' | 'full' (the first N already took it) | 'rejected'.
create function public.complete_challenge(p_token uuid, p_challenge uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_challenge challenges;
begin
  if v_me is null then return 'unauthorized'; end if;
  if not challenges_enabled() then return 'disabled'; end if;
  -- One at a time per challenge: the first N must really be the first N.
  select * into v_challenge from challenges where id = p_challenge for update;
  if not found then return 'rejected'; end if;
  if exists (select 1 from challenge_completions where challenge_id = p_challenge and player_id = v_me) then return 'ok'; end if;
  if v_challenge.ends_at <= now() then return 'ended'; end if;
  if v_challenge.winners_limit is not null
     and (select count(*) from challenge_completions where challenge_id = p_challenge) >= v_challenge.winners_limit then
    return 'full';
  end if;
  insert into challenge_completions (challenge_id, player_id) values (p_challenge, v_me);
  return 'ok';
end;
$$;

-- Only while it runs: once over, results stay.
create function public.undo_challenge(p_token uuid, p_challenge uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then return 'unauthorized'; end if;
  delete from challenge_completions cc using challenges c
  where cc.challenge_id = p_challenge and cc.player_id = v_me and c.id = cc.challenge_id and c.ends_at > now();
  return case when found then 'ok' else 'rejected' end;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.check_secret_word(text),
  public.join_game(text, text, text, text, uuid, boolean),
  public.resume_session(uuid),
  public.catalog(uuid),
  public.participants(uuid),
  public.completions_for(uuid),
  public.feed(uuid, timestamptz, integer),
  public.profile(uuid, uuid),
  public.likers(uuid, uuid),
  public.features(uuid),
  public.permissions(uuid),
  public.complete_action(uuid, text),
  public.toggle_like(uuid, uuid),
  public.update_bio(uuid, text),
  public.open_conversation(uuid, uuid),
  public.conversations(uuid),
  public.conversation(uuid, uuid),
  public.messages(uuid, uuid, timestamptz, integer),
  public.mark_read(uuid, uuid),
  public.mark_unread(uuid, uuid),
  public.clear_conversation(uuid, uuid, boolean),
  public.send_message(uuid, uuid, text, uuid),
  public.edit_message(uuid, uuid, text),
  public.hide_message(uuid, uuid),
  public.polls(uuid),
  public.create_poll(uuid, text, text[], boolean, boolean, text, boolean, integer, boolean),
  public.vote_poll(uuid, uuid, uuid[]),
  public.close_poll(uuid, uuid),
  public.delete_poll(uuid, uuid),
  public.challenges(uuid),
  public.create_challenge(uuid, text, text, integer, integer, integer),
  public.update_challenge(uuid, uuid, text, text, integer, integer, integer),
  public.end_challenge(uuid, uuid),
  public.delete_challenge(uuid, uuid),
  public.complete_challenge(uuid, uuid),
  public.undo_challenge(uuid, uuid),
  public.admin_add_action(uuid, text, text, public.action_kind, public.photo_policy, integer, public.difficulty),
  public.admin_update_action(uuid, text, text, text, public.action_kind, public.photo_policy, integer, public.difficulty),
  public.admin_secret_word(uuid),
  public.admin_set_secret_word(uuid, text, boolean),
  public.admin_access_log(uuid),
  public.admin_set_feature(uuid, text, boolean),
  public.admin_players(uuid),
  public.admin_block_player(uuid, uuid, boolean),
  public.admin_set_permission(uuid, uuid, text, boolean)
to anon, authenticated;
