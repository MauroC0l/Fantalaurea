-- Admin "Utenti" screen (ADR 0018): block / unblock, per-player permissions, 100 photos each.

-- ---------------------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------------------

alter table public.players
  add column blocked_at timestamptz,
  add column can_create_polls boolean not null default false,
  add column can_create_challenges boolean not null default false;

-- ---------------------------------------------------------------------------------------
-- Photo limit: photos that exist now (actions, posts, chat); the profile photo does not count
-- ---------------------------------------------------------------------------------------

create function public.photos_of(p_player uuid) returns bigint
language sql stable security definer set search_path = public
as $$
  select (select count(*) from player_completions where player_id = p_player and photo_id is not null)
       + (select count(*) from shared_completions where player_id = p_player and photo_id is not null)
       + (select count(*) from posts where player_id = p_player)
       + (select count(*) from messages where sender_id = p_player and kind = 'photo' and deleted_at is null)
$$;

create function public.has_photo_room(p_player uuid, p_needed integer default 1) returns boolean
language sql stable security definer set search_path = public
as $$ select photos_of(p_player) + p_needed <= 100 $$;

-- Asked by the Edge Function before uploading: no point sending 3 MB that will be refused.
create function public.svc_photo_room(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select has_photo_room(p_player) $$;

create or replace function public.svc_complete_with_photo(p_player_id uuid, p_action_id text, p_photo_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_action actions;
  v_owner uuid;
  v_previous uuid;
begin
  if not actions_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  select * into v_action from actions where id = p_action_id;
  if not found or v_action.photo_policy = 'none' then return jsonb_build_object('status', 'rejected'); end if;

  if v_action.kind = 'common' then
    select player_id, photo_id into v_owner, v_previous from shared_completions where action_id = p_action_id;
    if found and v_owner <> p_player_id then return jsonb_build_object('status', 'unauthorized'); end if;
  else
    select photo_id into v_previous from player_completions where player_id = p_player_id and action_id = p_action_id;
  end if;
  -- Replacing the photo of a completion does not add one.
  if v_previous is null and not has_photo_room(p_player_id) then return jsonb_build_object('status', 'photo-limit'); end if;

  if v_action.kind = 'common' then
    insert into shared_completions (action_id, player_id, photo_id) values (p_action_id, p_player_id, p_photo_id)
    on conflict (action_id) do update set photo_id = excluded.photo_id;
  else
    insert into player_completions (player_id, action_id, photo_id) values (p_player_id, p_action_id, p_photo_id)
    on conflict (player_id, action_id) do update set photo_id = excluded.photo_id;
  end if;
  return jsonb_build_object('status', 'ok', 'replaced_photo_id', v_previous);
end;
$$;

create or replace function public.svc_create_post(p_player_id uuid, p_photo_id uuid, p_caption text) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not (select feed_enabled from evening_settings) then return 'disabled'; end if;
  if not has_photo_room(p_player_id) then return 'photo-limit'; end if;
  insert into posts (player_id, photo_id, caption) values (p_player_id, p_photo_id, trim(coalesce(p_caption, '')));
  return 'ok';
exception
  when check_violation then return 'rejected';
end;
$$;

create or replace function public.svc_send_media(
  p_player uuid, p_conversation uuid, p_kind text, p_media_id uuid, p_mime text, p_duration_ms integer,
  p_reply_to uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_conversation conversations;
begin
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  v_conversation := conversation_of(p_player, p_conversation);
  if v_conversation.id is null or not valid_reply(p_conversation, p_reply_to)
     or is_blocked(other_in(v_conversation, p_player)) then
    return jsonb_build_object('status', 'rejected');
  end if;
  if p_kind = 'photo' and not has_photo_room(p_player) then return jsonb_build_object('status', 'photo-limit'); end if;
  insert into messages (conversation_id, sender_id, kind, media_id, media_mime, duration_ms, reply_to)
  values (p_conversation, p_player, p_kind, p_media_id, p_mime, p_duration_ms, p_reply_to);
  perform touch_conversation(p_conversation, p_player);
  return jsonb_build_object('status', 'ok', 'recipientInbox', recipient_inbox(v_conversation, p_player));
exception
  when check_violation or not_null_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Blocking: out at once, cannot come back, content hidden (not deleted) until unblocked
-- ---------------------------------------------------------------------------------------

create function public.is_blocked(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select blocked_at is not null from players where id = p_player), false) $$;

create or replace function public.join_game(
  p_secret_word text, p_nickname text, p_real_name text, p_device text,
  p_takeover uuid default null, p_distinct boolean default false
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_nickname text := normalize_text(p_nickname);
  v_real_name text := normalize_text(p_real_name);
  v_admin admin_credentials;
  v_player players;
  v_token uuid;
begin
  select * into v_admin from admin_credentials;
  if same_name(v_nickname, v_admin.nickname) then
    if not same_name(v_real_name, v_admin.real_name) then
      return jsonb_build_object('error', 'nickname-taken');
    end if;
    insert into sessions (role) values ('admin') returning token into v_token;
    insert into admin_access_log (device) values (left(coalesce(p_device, ''), 200));
    return jsonb_build_object('session', session_json(v_token));
  end if;

  if not is_secret_word(p_secret_word) then return jsonb_build_object('error', 'wrong-word'); end if;

  -- A new nickname is not a way back in: the real name is checked too.
  if exists (select 1 from players where blocked_at is not null
             and (lower(nickname) = lower(v_nickname) or same_name(real_name, v_real_name))) then
    return jsonb_build_object('error', 'blocked');
  end if;

  select * into v_player from players where lower(nickname) = lower(v_nickname);
  if found then
    if not same_name(v_real_name, v_player.real_name) then
      return jsonb_build_object('error', 'nickname-taken');
    end if;
    v_token := player_session(v_player.id);
    return jsonb_build_object('session', session_json(v_token));
  end if;

  if p_takeover is not null then
    update players set nickname = v_nickname
    where id = p_takeover and same_name(real_name, v_real_name) and blocked_at is null
    returning * into v_player;
    if not found then return jsonb_build_object('error', 'rejected'); end if;
    v_token := player_session(v_player.id);
    return jsonb_build_object('session', session_json(v_token));
  end if;

  if not p_distinct then
    select * into v_player from players where same_name(real_name, v_real_name) order by created_at limit 1;
    if found then
      return jsonb_build_object('error', 'real-name-exists',
        'existing', jsonb_build_object('id', v_player.id, 'nickname', v_player.nickname));
    end if;
  end if;

  insert into players (nickname, real_name) values (v_nickname, v_real_name) returning * into v_player;
  v_token := player_session(v_player.id);
  return jsonb_build_object('session', session_json(v_token));
exception
  when unique_violation then
    return jsonb_build_object('error', 'nickname-taken');
end;
$$;

create or replace function public.feed(p_token uuid, p_before timestamptz, p_limit integer)
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
      from posts po
      union all
      select c.id, 'completion', c.completed_at, c.player_id, c.photo_id, null, a.title, a.kind, a.points
      from all_completions c join actions a on a.id = c.action_id
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
      (select count(*) from player_completions c where c.player_id = p.id) + shared.done,
      coalesce((select sum(a.points) from player_completions c join actions a on a.id = c.action_id
                where c.player_id = p.id), 0) + shared.points
    from players p cross join shared
    where p.blocked_at is null
    order by p.created_at;
end;
$$;

drop function public.profile(uuid, uuid);
-- photoCount only for your own profile: "37 di 100".
create function public.profile(p_token uuid, p_player_id uuid) returns jsonb
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
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object('id', po.id, 'photoId', po.photo_id, 'caption', po.caption,
                                          'createdAt', po.created_at) order by po.created_at desc)
      from posts po where po.player_id = p_player_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.likers(p_token uuid, p_target uuid)
returns table (id uuid, nickname text, avatar_id uuid, liked_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return query
    select p.id, p.nickname, p.avatar_id, l.created_at
    from likes l join players p on p.id = l.player_id
    where l.target_id = p_target and p.blocked_at is null
    order by l.created_at desc;
end;
$$;

create or replace function public.open_conversation(p_token uuid, p_other uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_id uuid;
begin
  if v_me is null then return jsonb_build_object('status', 'unauthorized'); end if;
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  if p_other is null or p_other = v_me or not exists (select 1 from players where id = p_other and blocked_at is null) then
    return jsonb_build_object('status', 'rejected');
  end if;
  insert into conversations (player_a, player_b) values (least(v_me, p_other), greatest(v_me, p_other))
  on conflict (player_a, player_b) do nothing;
  select id into v_id from conversations where player_a = least(v_me, p_other) and player_b = greatest(v_me, p_other);
  return jsonb_build_object('status', 'ok', 'conversationId', v_id);
end;
$$;

create or replace function public.conversations(p_token uuid)
returns table (id uuid, other_id uuid, other_nickname text, other_avatar_id uuid, last_kind text, last_body text,
               last_mine boolean, last_deleted boolean, last_at timestamptz, unread bigint, marked boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select c.id, o.id, o.nickname, o.avatar_id, m.kind, m.body, m.sender_id = v_me, m.deleted_at is not null,
      m.created_at,
      (select count(*) from visible_messages(c, v_me) u
       where u.sender_id <> v_me and u.deleted_at is null and u.created_at > read_at_for(c, v_me)),
      case when c.player_a = v_me then c.marked_a else c.marked_b end
    from conversations c
    join players o on o.id = other_in(c, v_me)
    left join lateral (select * from visible_messages(c, v_me) x order by x.created_at desc limit 1) m on true
    where v_me in (c.player_a, c.player_b)
      and o.blocked_at is null
      and c.last_message_at is not null
      and not (case when c.player_a = v_me then c.removed_a else c.removed_b end)
    order by coalesce(m.created_at, c.last_message_at) desc;
end;
$$;

create or replace function public.conversation(p_token uuid, p_conversation uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_conversation conversations;
  v_other players;
begin
  if v_me is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_conversation := conversation_of(v_me, p_conversation);
  if v_conversation.id is null then return null; end if;
  select * into v_other from players where id = other_in(v_conversation, v_me) and blocked_at is null;
  if not found then return null; end if;
  return jsonb_build_object('id', v_conversation.id, 'otherInbox', v_other.inbox_key,
    'other', jsonb_build_object('id', v_other.id, 'nickname', v_other.nickname, 'avatarId', v_other.avatar_id));
end;
$$;

create or replace function public.send_message(p_token uuid, p_conversation uuid, p_body text, p_reply_to uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_conversation conversations;
begin
  if v_me is null then return jsonb_build_object('status', 'unauthorized'); end if;
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  v_conversation := conversation_of(v_me, p_conversation);
  if v_conversation.id is null or not valid_reply(p_conversation, p_reply_to)
     or is_blocked(other_in(v_conversation, v_me)) then
    return jsonb_build_object('status', 'rejected');
  end if;
  insert into messages (conversation_id, sender_id, kind, body, reply_to)
  values (p_conversation, v_me, 'text', trim(p_body), p_reply_to);
  perform touch_conversation(p_conversation, v_me);
  return jsonb_build_object('status', 'ok', 'recipientInbox', recipient_inbox(v_conversation, v_me));
exception
  when check_violation or not_null_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

create or replace function public.svc_forward_message(p_player uuid, p_message uuid, p_conversations uuid[]) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_source messages;
  v_target conversations;
  v_copy messages;
  v_copies jsonb := '[]'::jsonb;
begin
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  if coalesce(cardinality(p_conversations), 0) not between 1 and 5 then
    return jsonb_build_object('status', 'rejected');
  end if;
  select m.* into v_source from messages m join conversations c on c.id = m.conversation_id
  where m.id = p_message and m.deleted_at is null and p_player in (c.player_a, c.player_b);
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  if exists (select 1 from unnest(p_conversations) t(id)
             where (conversation_of(p_player, t.id)).id is null
                or is_blocked(other_in(conversation_of(p_player, t.id), p_player))) then
    return jsonb_build_object('status', 'rejected');
  end if;
  if v_source.kind = 'photo' and not has_photo_room(p_player, cardinality(p_conversations)) then
    return jsonb_build_object('status', 'photo-limit');
  end if;

  for v_target in select * from conversations where id = any(p_conversations) loop
    insert into messages (conversation_id, sender_id, kind, body, media_id, media_mime, duration_ms, forwarded)
    values (v_target.id, p_player, v_source.kind, v_source.body,
            case when v_source.media_id is null then null else gen_random_uuid() end,
            v_source.media_mime, v_source.duration_ms, true)
    returning * into v_copy;
    perform touch_conversation(v_target.id, p_player);
    v_copies := v_copies || jsonb_build_object('messageId', v_copy.id, 'conversationId', v_target.id,
      'mediaId', v_copy.media_id, 'recipientInbox', recipient_inbox(v_target, p_player));
  end loop;

  return jsonb_build_object('status', 'ok', 'kind', v_source.kind, 'sourceMediaId', v_source.media_id,
    'mime', v_source.media_mime, 'copies', v_copies);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Admin "Utenti" and player permissions
-- ---------------------------------------------------------------------------------------

create function public.admin_players(p_token uuid)
returns table (id uuid, nickname text, real_name text, avatar_id uuid, blocked boolean,
               can_create_polls boolean, can_create_challenges boolean, photos bigint, joined_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select p.id, p.nickname, p.real_name, p.avatar_id, p.blocked_at is not null,
           p.can_create_polls, p.can_create_challenges, photos_of(p.id), p.created_at
    from players p
    order by lower(p.nickname);
end;
$$;

-- Blocking also ends the player's sessions: their phone is sent out at the next read.
create function public.admin_block_player(p_token uuid, p_player uuid, p_blocked boolean) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  update players set blocked_at = case when p_blocked then coalesce(blocked_at, now()) end where id = p_player;
  if not found then return 'rejected'; end if;
  if p_blocked then delete from sessions where player_id = p_player; end if;
  return 'ok';
end;
$$;

create function public.admin_set_permission(p_token uuid, p_player uuid, p_permission text, p_enabled boolean)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  if p_permission not in ('polls', 'challenges') or p_enabled is null then return 'rejected'; end if;
  update players set
    can_create_polls = case when p_permission = 'polls' then p_enabled else can_create_polls end,
    can_create_challenges = case when p_permission = 'challenges' then p_enabled else can_create_challenges end
  where id = p_player;
  return case when found then 'ok' else 'rejected' end;
end;
$$;

/** What this session may create: the admin everything, a player what the admin allowed. */
create function public.permissions(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_player players;
begin
  perform require_session(p_token);
  if is_admin(p_token) then return jsonb_build_object('polls', true, 'challenges', true); end if;
  select * into v_player from players where id = player_of(p_token);
  return jsonb_build_object('polls', v_player.can_create_polls, 'challenges', v_player.can_create_challenges);
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
