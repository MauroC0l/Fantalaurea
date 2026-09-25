-- Timed challenges beyond their section (ADR 0021): up to 12 hours, full list of who did them,
-- shown in profiles and in the feed, whose "Post" and "Imprese" are now two separate sections.

-- A completion can be liked in the feed: it needs its own id.
alter table public.challenge_completions add column id uuid not null default gen_random_uuid() unique;

create trigger challenge_completions_delete_likes after delete on public.challenge_completions
  for each row execute function public.delete_likes_of_target();

-- ---------------------------------------------------------------------------------------
-- Longer challenges
-- ---------------------------------------------------------------------------------------

create or replace function public.create_challenge(
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
  if p_duration_minutes is null or p_duration_minutes not between 1 and 720 then
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

create or replace function public.update_challenge(
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
  if p_extend_minutes is not null and p_extend_minutes not between 1 and 720 then return 'rejected'; end if;
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

-- ---------------------------------------------------------------------------------------
-- Who did it: everyone, in order, and whether they earned the points
-- ---------------------------------------------------------------------------------------

create function public.challenge_completers(p_token uuid, p_challenge uuid)
returns table (id uuid, nickname text, avatar_id uuid, completed_at timestamptz, rank bigint, earned boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return query
    select p.id, p.nickname, p.avatar_id, ranked.completed_at, ranked.rank,
           ranked.rank <= coalesce(c.winners_limit, 2147483647)
    from (select cc.player_id, cc.completed_at, row_number() over (order by cc.completed_at) as rank
          from challenge_completions cc where cc.challenge_id = p_challenge) ranked
    join players p on p.id = ranked.player_id and p.blocked_at is null
    join challenges c on c.id = p_challenge
    order by ranked.rank;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Profile: completed challenges next to the actions
-- ---------------------------------------------------------------------------------------

create or replace function public.profile(p_token uuid, p_player_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_player players;
begin
  perform require_session(p_token);
  select * into v_player from players where id = p_player_id and blocked_at is null;
  if not found then return null; end if;
  return jsonb_build_object(
    'player', jsonb_build_object('id', v_player.id, 'nickname', v_player.nickname, 'realName', v_player.real_name,
                                 'bio', v_player.bio, 'avatarId', v_player.avatar_id),
    'photoCount', case when player_of(p_token) = p_player_id then photos_of(p_player_id) end,
    'completions', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'actionId', a.id, 'title', a.title, 'kind', a.kind,
                                          'points', a.points, 'photoId', c.photo_id, 'completedAt', c.completed_at)
                       order by c.completed_at desc)
      from all_completions c join actions a on a.id = c.action_id where c.player_id = p_player_id), '[]'::jsonb),
    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'challengeId', r.challenge_id, 'title', r.title,
                                          'points', r.points, 'completedAt', r.completed_at,
                                          'earned', r.rank <= coalesce(r.winners_limit, 2147483647))
                       order by r.completed_at desc)
      from (select cc.id, cc.challenge_id, cc.player_id, cc.completed_at, c.title, c.points, c.winners_limit,
                   row_number() over (partition by cc.challenge_id order by cc.completed_at) as rank
            from challenge_completions cc join challenges c on c.id = cc.challenge_id) r
      where r.player_id = p_player_id), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object('id', po.id, 'photoId', po.photo_id, 'caption', po.caption,
                                          'createdAt', po.created_at) order by po.created_at desc)
      from posts po where po.player_id = p_player_id), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Feed in two sections: 'posts' and 'deeds' (completed actions and challenges)
-- ---------------------------------------------------------------------------------------

drop function public.feed(uuid, timestamptz, integer);
create function public.feed(p_token uuid, p_before timestamptz, p_limit integer, p_section text)
returns table (item_id uuid, item_kind text, created_at timestamptz, player_id uuid, nickname text,
               avatar_id uuid, photo_id uuid, caption text, action_title text,
               action_kind public.action_kind, action_points integer, like_count bigint, liked_by_me boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_player uuid := player_of(p_token);
begin
  perform require_session(p_token);
  return query
    with items as (
      select po.id, 'post'::text as kind, po.created_at as at, po.player_id, po.photo_id, po.caption,
             null::text as title, null::action_kind as akind, null::integer as apoints
      from posts po where p_section = 'posts'
      union all
      select c.id, 'completion', c.completed_at, c.player_id, c.photo_id, null, a.title, a.kind, a.points
      from all_completions c join actions a on a.id = c.action_id where p_section = 'deeds'
      union all
      select cc.id, 'challenge', cc.completed_at, cc.player_id, null, null, ch.title, 'bonus'::action_kind, ch.points
      from challenge_completions cc join challenges ch on ch.id = cc.challenge_id where p_section = 'deeds'
    )
    select i.id, i.kind, i.at, pl.id, pl.nickname, pl.avatar_id, i.photo_id, i.caption, i.title, i.akind, i.apoints,
      (select count(*) from likes l join players lp on lp.id = l.player_id
       where l.target_id = i.id and lp.blocked_at is null),
      exists (select 1 from likes l where l.target_id = i.id and l.player_id = v_player)
    from items i join players pl on pl.id = i.player_id
    where i.at < coalesce(p_before, 'infinity'::timestamptz) and pl.blocked_at is null
    order by i.at desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

create or replace function public.toggle_like(p_token uuid, p_target uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := player_of(p_token);
begin
  if v_player is null then return jsonb_build_object('status', 'unauthorized'); end if;
  if not exists (select 1 from posts where id = p_target)
     and not exists (select 1 from all_completions where id = p_target)
     and not exists (select 1 from challenge_completions where id = p_target) then
    return jsonb_build_object('status', 'rejected');
  end if;
  delete from likes where target_id = p_target and player_id = v_player;
  if found then return jsonb_build_object('status', 'ok', 'liked', false); end if;
  insert into likes (target_id, player_id) values (p_target, v_player);
  return jsonb_build_object('status', 'ok', 'liked', true);
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
  public.feed(uuid, timestamptz, integer, text),
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
  public.challenge_completers(uuid, uuid),
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
