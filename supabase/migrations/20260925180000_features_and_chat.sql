-- Features the admin can switch on and off (ADR 0014) and private chat (ADR 0015).

-- ---------------------------------------------------------------------------------------
-- Feature switches
-- ---------------------------------------------------------------------------------------

alter table public.evening_settings
  add column chat_enabled boolean not null default true,
  add column feed_enabled boolean not null default true,
  add column leaderboard_enabled boolean not null default true;

create function public.features(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return (select jsonb_build_object('chat', chat_enabled, 'feed', feed_enabled, 'leaderboard', leaderboard_enabled)
          from evening_settings);
end;
$$;

-- Returns 'ok' | 'unauthorized' | 'rejected'.
create function public.admin_set_feature(p_token uuid, p_feature text, p_enabled boolean) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  if p_feature not in ('chat', 'feed', 'leaderboard') or p_enabled is null then return 'rejected'; end if;
  update evening_settings set
    chat_enabled = case when p_feature = 'chat' then p_enabled else chat_enabled end,
    feed_enabled = case when p_feature = 'feed' then p_enabled else feed_enabled end,
    leaderboard_enabled = case when p_feature = 'leaderboard' then p_enabled else leaderboard_enabled end
  where true;
  return 'ok';
end;
$$;

create function public.chat_enabled() returns boolean
language sql stable security definer set search_path = public
as $$ select chat_enabled from evening_settings $$;

-- Posts need the feed switched on.
create or replace function public.svc_create_post(p_player_id uuid, p_photo_id uuid, p_caption text) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not (select feed_enabled from evening_settings) then return 'disabled'; end if;
  insert into posts (player_id, photo_id, caption) values (p_player_id, p_photo_id, trim(coalesce(p_caption, '')));
  return 'ok';
exception
  when check_violation then return 'rejected';
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Inbox keys: each player listens on "inbox:<key>" for chat signals (ADR 0015)
-- ---------------------------------------------------------------------------------------

alter table public.players add column inbox_key uuid not null default gen_random_uuid() unique;

create or replace function public.session_json(p_token uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case s.role
    when 'admin' then jsonb_build_object('role', 'admin', 'token', s.token)
    else jsonb_build_object(
      'role', 'player',
      'token', s.token,
      'inboxKey', p.inbox_key,
      'player', jsonb_build_object('id', p.id, 'nickname', p.nickname, 'realName', p.real_name)
    )
  end
  from sessions s left join players p on p.id = s.player_id
  where s.token = p_token
$$;

-- ---------------------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references public.players on delete cascade,
  player_b uuid not null references public.players on delete cascade,
  read_a_at timestamptz not null default '-infinity',
  read_b_at timestamptz not null default '-infinity',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (player_a < player_b),
  unique (player_a, player_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null references public.players on delete cascade,
  kind text not null check (kind in ('text', 'photo', 'voice')),
  body text check (char_length(body) between 1 and 1000),
  media_id uuid unique,
  media_mime text,
  duration_ms integer check (duration_ms between 0 and 65000),
  created_at timestamptz not null default now(),
  check (
    (kind = 'text' and body is not null and media_id is null)
    or (kind = 'photo' and body is null and media_id is not null)
    or (kind = 'voice' and body is null and media_id is not null and media_mime is not null and duration_ms is not null)
  )
);

create index messages_by_conversation on public.messages (conversation_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 15 * 1024 * 1024,
        array['image/jpeg', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac']);

/** The conversation, only if p_player takes part in it. */
create function public.conversation_of(p_player uuid, p_conversation uuid) returns public.conversations
language sql stable security definer set search_path = public
as $$ select * from conversations where id = p_conversation and p_player in (player_a, player_b) $$;

create function public.other_in(c public.conversations, p_player uuid) returns uuid
language sql immutable
as $$ select case when c.player_a = p_player then c.player_b else c.player_a end $$;

create function public.recipient_inbox(c public.conversations, p_sender uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select inbox_key from players where id = other_in(c, p_sender) $$;

/** Records a new message on the conversation and marks it read by its sender. */
create function public.touch_conversation(p_conversation uuid, p_sender uuid) returns void
language sql security definer set search_path = public
as $$
  update conversations set
    last_message_at = now(),
    read_a_at = case when player_a = p_sender then now() else read_a_at end,
    read_b_at = case when player_b = p_sender then now() else read_b_at end
  where id = p_conversation
$$;

-- Returns {"status": "ok", "conversationId"} or {"status": "unauthorized" | "rejected" | "disabled"}.
create function public.open_conversation(p_token uuid, p_other uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_id uuid;
begin
  if v_me is null then return jsonb_build_object('status', 'unauthorized'); end if;
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  if p_other is null or p_other = v_me or not exists (select 1 from players where id = p_other) then
    return jsonb_build_object('status', 'rejected');
  end if;
  insert into conversations (player_a, player_b) values (least(v_me, p_other), greatest(v_me, p_other))
  on conflict (player_a, player_b) do nothing;
  select id into v_id from conversations where player_a = least(v_me, p_other) and player_b = greatest(v_me, p_other);
  return jsonb_build_object('status', 'ok', 'conversationId', v_id);
end;
$$;

create function public.conversations(p_token uuid)
returns table (id uuid, other_id uuid, other_nickname text, other_avatar_id uuid, last_kind text, last_body text,
               last_mine boolean, last_at timestamptz, unread bigint)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select c.id, o.id, o.nickname, o.avatar_id, m.kind, m.body, m.sender_id = v_me, m.created_at,
      (select count(*) from messages u
       where u.conversation_id = c.id and u.sender_id <> v_me
         and u.created_at > case when c.player_a = v_me then c.read_a_at else c.read_b_at end)
    from conversations c
    join players o on o.id = other_in(c, v_me)
    join lateral (select * from messages x where x.conversation_id = c.id order by x.created_at desc limit 1) m on true
    where v_me in (c.player_a, c.player_b)
    order by m.created_at desc;
end;
$$;

create function public.conversation(p_token uuid, p_conversation uuid) returns jsonb
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
  select * into v_other from players where id = other_in(v_conversation, v_me);
  return jsonb_build_object('id', v_conversation.id,
    'other', jsonb_build_object('id', v_other.id, 'nickname', v_other.nickname, 'avatarId', v_other.avatar_id));
end;
$$;

create function public.messages(p_token uuid, p_conversation uuid, p_before timestamptz, p_limit integer)
returns table (id uuid, sender_id uuid, kind text, body text, media_mime text, duration_ms integer, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  if (conversation_of(v_me, p_conversation)).id is null then return; end if;
  return query
    select m.id, m.sender_id, m.kind, m.body, m.media_mime, m.duration_ms, m.created_at
    from messages m
    where m.conversation_id = p_conversation and m.created_at < coalesce(p_before, 'infinity'::timestamptz)
    order by m.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

create function public.mark_read(p_token uuid, p_conversation uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then return 'unauthorized'; end if;
  update conversations set
    read_a_at = case when player_a = v_me then now() else read_a_at end,
    read_b_at = case when player_b = v_me then now() else read_b_at end
  where id = p_conversation and v_me in (player_a, player_b);
  return 'ok';
end;
$$;

-- Returns {"status": "ok", "recipientInbox"} or {"status": "unauthorized" | "rejected" | "disabled"}.
create function public.send_message(p_token uuid, p_conversation uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_conversation conversations;
begin
  if v_me is null then return jsonb_build_object('status', 'unauthorized'); end if;
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  v_conversation := conversation_of(v_me, p_conversation);
  if v_conversation.id is null then return jsonb_build_object('status', 'rejected'); end if;
  insert into messages (conversation_id, sender_id, kind, body) values (p_conversation, v_me, 'text', trim(p_body));
  perform touch_conversation(p_conversation, v_me);
  return jsonb_build_object('status', 'ok', 'recipientInbox', recipient_inbox(v_conversation, v_me));
exception
  when check_violation or not_null_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Chat service functions for the `photos` Edge Function (service_role only)
-- ---------------------------------------------------------------------------------------

create function public.svc_send_media(
  p_player uuid, p_conversation uuid, p_kind text, p_media_id uuid, p_mime text, p_duration_ms integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_conversation conversations;
begin
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  v_conversation := conversation_of(p_player, p_conversation);
  if v_conversation.id is null then return jsonb_build_object('status', 'rejected'); end if;
  insert into messages (conversation_id, sender_id, kind, media_id, media_mime, duration_ms)
  values (p_conversation, p_player, p_kind, p_media_id, p_mime, p_duration_ms);
  perform touch_conversation(p_conversation, p_player);
  return jsonb_build_object('status', 'ok', 'recipientInbox', recipient_inbox(v_conversation, p_player));
exception
  when check_violation or not_null_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

-- Only the sender deletes. Returns {"status", "kind", "mediaId", "mime", "recipientInbox"}.
create function public.svc_delete_message(p_player uuid, p_message uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_message messages;
  v_conversation conversations;
begin
  delete from messages where id = p_message and sender_id = p_player returning * into v_message;
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  select * into v_conversation from conversations where id = v_message.conversation_id;
  return jsonb_build_object('status', 'ok', 'kind', v_message.kind, 'mediaId', v_message.media_id,
    'mime', v_message.media_mime, 'recipientInbox', recipient_inbox(v_conversation, p_player));
end;
$$;

/** Media of the given messages, only from conversations p_player takes part in. */
create function public.svc_chat_media(p_player uuid, p_message_ids uuid[])
returns table (message_id uuid, kind text, media_id uuid, media_mime text)
language sql stable security definer set search_path = public
as $$
  select m.id, m.kind, m.media_id, m.media_mime
  from messages m join conversations c on c.id = m.conversation_id
  where m.id = any(p_message_ids) and m.media_id is not null and p_player in (c.player_a, c.player_b)
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
  public.complete_action(uuid, text),
  public.toggle_like(uuid, uuid),
  public.update_bio(uuid, text),
  public.open_conversation(uuid, uuid),
  public.conversations(uuid),
  public.conversation(uuid, uuid),
  public.messages(uuid, uuid, timestamptz, integer),
  public.mark_read(uuid, uuid),
  public.send_message(uuid, uuid, text),
  public.admin_add_action(uuid, text, text, public.action_kind, public.photo_policy, integer, public.difficulty),
  public.admin_update_action(uuid, text, text, text, public.action_kind, public.photo_policy, integer, public.difficulty),
  public.admin_secret_word(uuid),
  public.admin_set_secret_word(uuid, text, boolean),
  public.admin_access_log(uuid),
  public.admin_set_feature(uuid, text, boolean)
to anon, authenticated;
