-- Chat like WhatsApp (ADR 0016): reply, edit, forward, delete for me or for everyone; per person
-- "clear", "delete chat" and "mark as unread". Typing is only a realtime signal: nothing here.

-- ---------------------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------------------

alter table public.messages
  add column reply_to uuid references public.messages on delete set null,
  add column edited_at timestamptz,
  add column forwarded boolean not null default false,
  add column deleted_at timestamptz;

-- A message deleted for everyone stays as "Messaggio eliminato": replies to it keep their place.
alter table public.messages drop constraint messages_check;
alter table public.messages add constraint messages_shape check (
  (deleted_at is not null and body is null and media_id is null)
  or (deleted_at is null and (
    (kind = 'text' and body is not null and media_id is null)
    or (kind = 'photo' and body is null and media_id is not null)
    or (kind = 'voice' and body is null and media_id is not null and media_mime is not null and duration_ms is not null)
  ))
);

-- Per side (a/b, as player_a/player_b): messages up to cleared_at are gone for that person,
-- removed hides the chat from their list until a new message arrives, marked is "da leggere".
alter table public.conversations
  add column cleared_a_at timestamptz not null default '-infinity',
  add column cleared_b_at timestamptz not null default '-infinity',
  add column removed_a boolean not null default false,
  add column removed_b boolean not null default false,
  add column marked_a boolean not null default false,
  add column marked_b boolean not null default false;

create table public.message_hidden (
  message_id uuid not null references public.messages on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  primary key (message_id, player_id)
);

alter table public.message_hidden enable row level security;
revoke all on public.message_hidden from anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------

create function public.cleared_at_for(c public.conversations, p_player uuid) returns timestamptz
language sql immutable
as $$ select case when c.player_a = p_player then c.cleared_a_at else c.cleared_b_at end $$;

create function public.read_at_for(c public.conversations, p_player uuid) returns timestamptz
language sql immutable
as $$ select case when c.player_a = p_player then c.read_a_at else c.read_b_at end $$;

/** What p_player still sees of the conversation: not cleared, not deleted just for them. */
create function public.visible_messages(c public.conversations, p_player uuid) returns setof public.messages
language sql stable security definer set search_path = public
as $$
  select m.* from messages m
  where m.conversation_id = c.id
    and m.created_at > cleared_at_for(c, p_player)
    and not exists (select 1 from message_hidden h where h.message_id = m.id and h.player_id = p_player)
$$;

/** A reply must point to a message of the same conversation. */
create function public.valid_reply(p_conversation uuid, p_reply_to uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select p_reply_to is null or exists (select 1 from messages where id = p_reply_to and conversation_id = p_conversation)
$$;

create or replace function public.touch_conversation(p_conversation uuid, p_sender uuid) returns void
language sql security definer set search_path = public
as $$
  update conversations set
    last_message_at = now(),
    read_a_at = case when player_a = p_sender then now() else read_a_at end,
    read_b_at = case when player_b = p_sender then now() else read_b_at end,
    marked_a = case when player_a = p_sender then false else marked_a end,
    marked_b = case when player_b = p_sender then false else marked_b end,
    removed_a = false,
    removed_b = false
  where id = p_conversation
$$;

-- ---------------------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------------------

drop function public.conversations(uuid);
create function public.conversations(p_token uuid)
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
      and c.last_message_at is not null
      and not (case when c.player_a = v_me then c.removed_a else c.removed_b end)
    order by coalesce(m.created_at, c.last_message_at) desc;
end;
$$;

drop function public.conversation(uuid, uuid);
-- otherInbox lets the phone say "sta scrivendo…" before any message is sent.
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
  return jsonb_build_object('id', v_conversation.id, 'otherInbox', v_other.inbox_key,
    'other', jsonb_build_object('id', v_other.id, 'nickname', v_other.nickname, 'avatarId', v_other.avatar_id));
end;
$$;

drop function public.messages(uuid, uuid, timestamptz, integer);
create function public.messages(p_token uuid, p_conversation uuid, p_before timestamptz, p_limit integer)
returns table (id uuid, sender_id uuid, kind text, body text, duration_ms integer, created_at timestamptz,
               edited boolean, forwarded boolean, deleted boolean,
               reply_id uuid, reply_sender_id uuid, reply_kind text, reply_body text, reply_deleted boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_conversation conversations;
begin
  if v_me is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_conversation := conversation_of(v_me, p_conversation);
  if v_conversation.id is null then return; end if;
  return query
    select m.id, m.sender_id, m.kind, m.body, m.duration_ms, m.created_at,
      m.edited_at is not null, m.forwarded, m.deleted_at is not null,
      r.id, r.sender_id, r.kind, r.body, r.deleted_at is not null
    from visible_messages(v_conversation, v_me) m
    left join messages r on r.id = m.reply_to
    where m.created_at < coalesce(p_before, 'infinity'::timestamptz)
    order by m.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------------------

create or replace function public.mark_read(p_token uuid, p_conversation uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then return 'unauthorized'; end if;
  update conversations set
    read_a_at = case when player_a = v_me then now() else read_a_at end,
    read_b_at = case when player_b = v_me then now() else read_b_at end,
    marked_a = case when player_a = v_me then false else marked_a end,
    marked_b = case when player_b = v_me then false else marked_b end
  where id = p_conversation and v_me in (player_a, player_b);
  return 'ok';
end;
$$;

create function public.mark_unread(p_token uuid, p_conversation uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then return 'unauthorized'; end if;
  update conversations set
    marked_a = case when player_a = v_me then true else marked_a end,
    marked_b = case when player_b = v_me then true else marked_b end
  where id = p_conversation and v_me in (player_a, player_b);
  return case when found then 'ok' else 'rejected' end;
end;
$$;

-- p_remove: "Cancella chat" (also leaves the list), otherwise "Svuota" (stays, empty).
create function public.clear_conversation(p_token uuid, p_conversation uuid, p_remove boolean) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then return 'unauthorized'; end if;
  update conversations set
    cleared_a_at = case when player_a = v_me then now() else cleared_a_at end,
    cleared_b_at = case when player_b = v_me then now() else cleared_b_at end,
    removed_a = case when player_a = v_me then p_remove else removed_a end,
    removed_b = case when player_b = v_me then p_remove else removed_b end,
    marked_a = case when player_a = v_me then false else marked_a end,
    marked_b = case when player_b = v_me then false else marked_b end
  where id = p_conversation and v_me in (player_a, player_b);
  return case when found then 'ok' else 'rejected' end;
end;
$$;

drop function public.send_message(uuid, uuid, text);
-- Returns {"status": "ok", "recipientInbox"} or {"status": "unauthorized" | "rejected" | "disabled"}.
create function public.send_message(p_token uuid, p_conversation uuid, p_body text, p_reply_to uuid default null)
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
  if v_conversation.id is null or not valid_reply(p_conversation, p_reply_to) then
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

-- Only your own texts. Returns {"status", "conversationId", "recipientInbox"}.
create function public.edit_message(p_token uuid, p_message uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_message messages;
  v_conversation conversations;
begin
  if v_me is null then return jsonb_build_object('status', 'unauthorized'); end if;
  if not chat_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  update messages set body = trim(p_body), edited_at = now()
  where id = p_message and sender_id = v_me and kind = 'text' and deleted_at is null
  returning * into v_message;
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  select * into v_conversation from conversations where id = v_message.conversation_id;
  return jsonb_build_object('status', 'ok', 'conversationId', v_conversation.id,
    'recipientInbox', recipient_inbox(v_conversation, v_me));
exception
  when check_violation or not_null_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

-- "Elimina per me": any message of your conversations, yours or not.
create function public.hide_message(p_token uuid, p_message uuid) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
begin
  if v_me is null then return 'unauthorized'; end if;
  insert into message_hidden (message_id, player_id)
  select m.id, v_me from messages m join conversations c on c.id = m.conversation_id
  where m.id = p_message and v_me in (c.player_a, c.player_b)
  on conflict do nothing;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Service functions for the `photos` Edge Function (service_role only)
-- ---------------------------------------------------------------------------------------

drop function public.svc_send_media(uuid, uuid, text, uuid, text, integer);
create function public.svc_send_media(
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
  if v_conversation.id is null or not valid_reply(p_conversation, p_reply_to) then
    return jsonb_build_object('status', 'rejected');
  end if;
  insert into messages (conversation_id, sender_id, kind, media_id, media_mime, duration_ms, reply_to)
  values (p_conversation, p_player, p_kind, p_media_id, p_mime, p_duration_ms, p_reply_to);
  perform touch_conversation(p_conversation, p_player);
  return jsonb_build_object('status', 'ok', 'recipientInbox', recipient_inbox(v_conversation, p_player));
exception
  when check_violation or not_null_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

drop function public.svc_delete_message(uuid, uuid);
-- "Elimina per tutti", sender only. Returns {"status", "kind", "mediaId", "mime", "conversationId",
-- "recipientInbox"}: the function removes the file, the phones reload only that conversation.
create function public.svc_delete_message(p_player uuid, p_message uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_message messages;
  v_conversation conversations;
begin
  select * into v_message from messages where id = p_message and sender_id = p_player and deleted_at is null;
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  update messages set deleted_at = now(), body = null, media_id = null, media_mime = null, duration_ms = null,
    edited_at = null
  where id = p_message;
  select * into v_conversation from conversations where id = v_message.conversation_id;
  return jsonb_build_object('status', 'ok', 'kind', v_message.kind, 'mediaId', v_message.media_id,
    'mime', v_message.media_mime, 'conversationId', v_conversation.id,
    'recipientInbox', recipient_inbox(v_conversation, p_player));
end;
$$;

-- Copies a message into up to 5 of p_player's conversations. Media get new ids: the function
-- copies the files, so each copy can be deleted on its own. Returns {"status", "kind",
-- "sourceMediaId", "mime", "copies": [{"messageId", "conversationId", "mediaId", "recipientInbox"}]}.
create function public.svc_forward_message(p_player uuid, p_message uuid, p_conversations uuid[]) returns jsonb
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
  if exists (select 1 from unnest(p_conversations) t(id) where (conversation_of(p_player, t.id)).id is null) then
    return jsonb_build_object('status', 'rejected');
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

-- A forwarded copy whose file could not be copied: removed as if never sent.
create function public.svc_drop_message(p_message uuid) returns void
language sql security definer set search_path = public
as $$ delete from messages where id = p_message $$;

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
  public.admin_set_feature(uuid, text, boolean)
to anon, authenticated;
