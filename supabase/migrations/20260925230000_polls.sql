-- Polls (ADR 0019): created by the admin or by players the admin allowed; each poll has its own
-- rules for anonymity, choices, when results show, changing votes and closing.

alter table public.evening_settings add column polls_enabled boolean not null default true;

create type public.poll_results as enum ('always', 'after-vote', 'after-close');

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  -- null = the admin
  creator_id uuid references public.players on delete cascade,
  question text not null check (char_length(question) between 3 and 200),
  anonymous boolean not null,
  multiple boolean not null,
  results public.poll_results not null,
  vote_change boolean not null,
  closes_at timestamptz,
  close_when_all_voted boolean not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  position integer not null,
  unique (poll_id, position)
);

create table public.poll_votes (
  poll_id uuid not null references public.polls on delete cascade,
  option_id uuid not null references public.poll_options on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, player_id)
);

create index poll_votes_by_player on public.poll_votes (poll_id, player_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls, public.poll_options, public.poll_votes from anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Switch
-- ---------------------------------------------------------------------------------------

create or replace function public.features(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return (select jsonb_build_object('actions', actions_enabled, 'chat', chat_enabled, 'feed', feed_enabled,
                                    'leaderboard', leaderboard_enabled, 'polls', polls_enabled)
          from evening_settings);
end;
$$;

create or replace function public.admin_set_feature(p_token uuid, p_feature text, p_enabled boolean) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  if p_feature not in ('actions', 'chat', 'feed', 'leaderboard', 'polls') or p_enabled is null then return 'rejected'; end if;
  update evening_settings set
    actions_enabled = case when p_feature = 'actions' then p_enabled else actions_enabled end,
    chat_enabled = case when p_feature = 'chat' then p_enabled else chat_enabled end,
    feed_enabled = case when p_feature = 'feed' then p_enabled else feed_enabled end,
    leaderboard_enabled = case when p_feature = 'leaderboard' then p_enabled else leaderboard_enabled end,
    polls_enabled = case when p_feature = 'polls' then p_enabled else polls_enabled end
  where true;
  return 'ok';
end;
$$;

create function public.polls_enabled() returns boolean
language sql stable security definer set search_path = public
as $$ select polls_enabled from evening_settings $$;

-- Admin-made polls have no player to cascade from: the evening's reset removes them too.
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
  delete from players where true;
  delete from admin_access_log where true;
  update evening_settings set secret_word = generate_secret_word(), updated_at = now() where true;
  return v_photos;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------

create function public.poll_is_closed(p public.polls) returns boolean
language sql stable
as $$ select p.closed_at is not null or (p.closes_at is not null and p.closes_at <= now()) $$;

create function public.can_manage_poll(p_token uuid, p public.polls) returns boolean
language sql stable security definer set search_path = public
as $$ select is_admin(p_token) or (p.creator_id is not null and p.creator_id = player_of(p_token)) $$;

/** Voters who still count: blocked players' votes are hidden like the rest of their content. */
create function public.poll_voters(p_poll uuid) returns bigint
language sql stable security definer set search_path = public
as $$
  select count(distinct v.player_id) from poll_votes v join players p on p.id = v.player_id
  where v.poll_id = p_poll and p.blocked_at is null
$$;

-- ---------------------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------------------

/**
 * Every visible poll, open ones first. Counts and voters appear only when the poll's rules allow
 * (the admin always sees counts); voters' names never in anonymous polls.
 */
create function public.polls(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_admin boolean := is_admin(p_token);
begin
  perform require_session(p_token);
  return coalesce((
    select jsonb_agg(poll order by (poll->>'closed')::boolean, poll->>'createdAt' desc)
    from (
      select jsonb_build_object(
        'id', p.id,
        'question', p.question,
        'creator', case when p.creator_id is null then null
                        else (select jsonb_build_object('id', c.id, 'nickname', c.nickname) from players c where c.id = p.creator_id) end,
        'anonymous', p.anonymous,
        'multiple', p.multiple,
        'results', p.results,
        'voteChange', p.vote_change,
        'closeWhenAllVoted', p.close_when_all_voted,
        'closesAt', p.closes_at,
        'closed', poll_is_closed(p),
        'createdAt', p.created_at,
        'canManage', can_manage_poll(p_token, p),
        'voterCount', poll_voters(p.id),
        'myVotes', coalesce((select jsonb_agg(v.option_id) from poll_votes v where v.poll_id = p.id and v.player_id = v_me), '[]'::jsonb),
        'resultsVisible', visible.yes,
        'options', (
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'label', o.label,
            'votes', case when visible.yes then (
              select count(*) from poll_votes v join players vp on vp.id = v.player_id
              where v.option_id = o.id and vp.blocked_at is null) end,
            'voters', case when visible.yes and not p.anonymous then coalesce((
              select jsonb_agg(jsonb_build_object('id', vp.id, 'nickname', vp.nickname, 'avatarId', vp.avatar_id)
                               order by v.created_at)
              from poll_votes v join players vp on vp.id = v.player_id
              where v.option_id = o.id and vp.blocked_at is null), '[]'::jsonb) end
          ) order by o.position)
          from poll_options o where o.poll_id = p.id
        )
      ) as poll
      from polls p
      cross join lateral (select
        v_admin
        or p.results = 'always'
        or poll_is_closed(p)
        or (p.results = 'after-vote' and exists (select 1 from poll_votes v where v.poll_id = p.id and v.player_id = v_me))
        as yes) visible
      where p.creator_id is null or not is_blocked(p.creator_id)
    ) listed
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------------------

-- Returns {"status": "ok", "pollId"} or {"status": "unauthorized" | "forbidden" | "rejected" | "disabled"}.
create function public.create_poll(
  p_token uuid, p_question text, p_options text[], p_anonymous boolean, p_multiple boolean, p_results text,
  p_vote_change boolean, p_duration_minutes integer, p_close_when_all_voted boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_poll polls;
  v_labels text[];
begin
  if v_me is null and not is_admin(p_token) then return jsonb_build_object('status', 'unauthorized'); end if;
  if not polls_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  if v_me is not null and not (select can_create_polls from players where id = v_me) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  select array_agg(normalize_text(label) order by ordinality) into v_labels
  from unnest(p_options) with ordinality as label where normalize_text(label) <> '';
  if coalesce(cardinality(v_labels), 0) not between 2 and 10
     or (select count(distinct lower(l)) from unnest(v_labels) l) <> cardinality(v_labels)
     or p_duration_minutes is not null and p_duration_minutes not between 1 and 1440 then
    return jsonb_build_object('status', 'rejected');
  end if;

  insert into polls (creator_id, question, anonymous, multiple, results, vote_change, closes_at, close_when_all_voted)
  values (v_me, normalize_text(p_question), p_anonymous, p_multiple, p_results::poll_results, p_vote_change,
          case when p_duration_minutes is null then null else now() + make_interval(mins => p_duration_minutes) end,
          p_close_when_all_voted)
  returning * into v_poll;
  insert into poll_options (poll_id, label, position)
  select v_poll.id, label, ordinality from unnest(v_labels) with ordinality as label;
  return jsonb_build_object('status', 'ok', 'pollId', v_poll.id);
exception
  when check_violation or not_null_violation or invalid_text_representation then
    return jsonb_build_object('status', 'rejected');
end;
$$;

-- 'ok' | 'unauthorized' | 'disabled' | 'closed' | 'locked' (already voted, no changes) | 'rejected'.
create function public.vote_poll(p_token uuid, p_poll uuid, p_options uuid[]) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_poll polls;
begin
  if v_me is null then return 'unauthorized'; end if;
  if not polls_enabled() then return 'disabled'; end if;
  select * into v_poll from polls where id = p_poll for update;
  if not found then return 'rejected'; end if;
  if poll_is_closed(v_poll) then return 'closed'; end if;
  if not v_poll.vote_change and exists (select 1 from poll_votes where poll_id = p_poll and player_id = v_me) then
    return 'locked';
  end if;
  if coalesce(cardinality(p_options), 0) = 0
     or (not v_poll.multiple and cardinality(p_options) > 1)
     or exists (select 1 from unnest(p_options) o(id) where not exists (
                  select 1 from poll_options where id = o.id and poll_id = p_poll)) then
    return 'rejected';
  end if;

  delete from poll_votes where poll_id = p_poll and player_id = v_me;
  insert into poll_votes (poll_id, option_id, player_id)
  select p_poll, id, v_me from (select distinct unnest(p_options) as id) chosen;

  -- "Si chiude quando hanno votato tutti": fixed at that moment, a latecomer does not reopen it.
  if v_poll.close_when_all_voted
     and poll_voters(p_poll) >= (select count(*) from players where blocked_at is null) then
    update polls set closed_at = now() where id = p_poll;
  end if;
  return 'ok';
end;
$$;

create function public.close_poll(p_token uuid, p_poll uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_poll polls;
begin
  if player_of(p_token) is null and not is_admin(p_token) then return 'unauthorized'; end if;
  select * into v_poll from polls where id = p_poll;
  if not found or not can_manage_poll(p_token, v_poll) then return 'rejected'; end if;
  update polls set closed_at = coalesce(closed_at, now()) where id = p_poll;
  return 'ok';
end;
$$;

create function public.delete_poll(p_token uuid, p_poll uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_poll polls;
begin
  if player_of(p_token) is null and not is_admin(p_token) then return 'unauthorized'; end if;
  select * into v_poll from polls where id = p_poll;
  if not found or not can_manage_poll(p_token, v_poll) then return 'rejected'; end if;
  delete from polls where id = p_poll;
  return 'ok';
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
