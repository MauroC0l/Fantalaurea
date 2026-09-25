-- Closed evening (ADR 0011) and internal social network (ADR 0012).

-- ---------------------------------------------------------------------------------------
-- Clean-ups
-- ---------------------------------------------------------------------------------------

delete from public.actions where id = 'bonus-foto-intima';

drop function public.join_game(text, text);
drop function public.participants();
drop function public.completions_for(uuid);
drop function public.svc_photos(uuid);
drop function public.svc_delete_photo(uuid, uuid);
drop function public.svc_reset_evening();

-- Reads now go only through token-checked functions: no table is readable by clients.
drop policy "public read" on public.actions;
drop policy "public read" on public.players;
drop policy "public read" on public.player_completions;
drop policy "public read" on public.shared_completions;
revoke all on all tables in schema public from anon, authenticated;

alter publication supabase_realtime drop table
  public.actions, public.players, public.player_completions, public.shared_completions;

-- ---------------------------------------------------------------------------------------
-- New data
-- ---------------------------------------------------------------------------------------

create table public.evening_settings (
  id boolean primary key default true check (id),
  secret_word text not null check (char_length(secret_word) between 3 and 40),
  updated_at timestamptz not null default now()
);

create table public.admin_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  device text not null default ''
);

alter table public.players
  add column bio text not null default '' check (char_length(bio) <= 500),
  add column avatar_id uuid unique;

-- Completions become likeable: they need their own id.
alter table public.player_completions add column id uuid not null default gen_random_uuid() unique;
alter table public.shared_completions add column id uuid not null default gen_random_uuid() unique;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players on delete cascade,
  photo_id uuid not null unique,
  caption text not null default '' check (char_length(caption) <= 300),
  created_at timestamptz not null default now()
);

-- target_id is a post or a completion (both uuids, never colliding).
create table public.likes (
  target_id uuid not null,
  player_id uuid not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (target_id, player_id)
);

alter table public.evening_settings enable row level security;
alter table public.admin_access_log enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
revoke all on public.evening_settings, public.admin_access_log, public.posts, public.likes from anon, authenticated;

drop view public.all_completions;
create view public.all_completions with (security_invoker = true) as
  select c.id, c.player_id, c.action_id, c.completed_at, c.photo_id, false as shared from public.player_completions c
  union all
  select s.id, s.player_id, s.action_id, s.completed_at, s.photo_id, true from public.shared_completions s;
revoke all on public.all_completions from anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Secret word
-- ---------------------------------------------------------------------------------------

create function public.generate_secret_word() returns text
language sql volatile
as $$
  with words(list) as (
    select array['spritz', 'toga', 'alloro', 'brindisi', 'coriandoli', 'prosecco', 'laurea', 'relatore',
                 'appello', 'esame', 'libretto', 'corona', 'festa', 'confetti', 'dottore', 'sessione',
                 'bomboniera', 'pergamena', 'discorso', 'medaglia', 'tesi', 'ateneo', 'lode', 'aula']
  )
  select list[1 + floor(random() * array_length(list, 1))::int] || '-' ||
         list[1 + floor(random() * array_length(list, 1))::int] || '-' ||
         (10 + floor(random() * 90))::int
  from words
$$;

/** "Spritz Toga 47" and "spritz-toga-47" are the same word. */
create function public.word_key(raw text) returns text
language sql immutable
as $$ select lower(regexp_replace(coalesce(raw, ''), '[^[:alnum:]]', '', 'g')) $$;

insert into public.evening_settings (secret_word) values (public.generate_secret_word());

create function public.is_secret_word(p_word text) returns boolean
language sql stable security definer set search_path = public
as $$ select word_key(p_word) = word_key(secret_word) from evening_settings $$;

create function public.check_secret_word(p_word text) returns boolean
language sql stable security definer set search_path = public
as $$ select is_secret_word(p_word) $$;

-- ---------------------------------------------------------------------------------------
-- Change pings: realtime carries no data, only "table X changed" (ADR 0011)
-- ---------------------------------------------------------------------------------------

create function public.notify_change() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'fantalaurea', false);
  return null;
end;
$$;

create trigger notify_change after insert or update or delete on public.actions
  for each statement execute function public.notify_change();
create trigger notify_change after insert or update or delete on public.players
  for each statement execute function public.notify_change();
create trigger notify_change after insert or update or delete on public.player_completions
  for each statement execute function public.notify_change();
create trigger notify_change after insert or update or delete on public.shared_completions
  for each statement execute function public.notify_change();
create trigger notify_change after insert or update or delete on public.posts
  for each statement execute function public.notify_change();
create trigger notify_change after insert or update or delete on public.likes
  for each statement execute function public.notify_change();
create trigger notify_change after delete on public.sessions
  for each statement execute function public.notify_change();

create function public.delete_likes_of_target() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from likes where target_id = old.id;
  return null;
end;
$$;

create trigger delete_likes after delete on public.posts
  for each row execute function public.delete_likes_of_target();
create trigger delete_likes after delete on public.player_completions
  for each row execute function public.delete_likes_of_target();
create trigger delete_likes after delete on public.shared_completions
  for each row execute function public.delete_likes_of_target();

-- ---------------------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------------------

create function public.has_session(p_token uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from sessions where token = p_token) $$;

/** Raised by every read with an unknown token; the app then asks to enter again. */
create function public.require_session(p_token uuid) returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not has_session(p_token) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
end;
$$;

create function public.player_session(p_player_id uuid) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_token uuid;
begin
  select token into v_token from sessions where player_id = p_player_id limit 1;
  if v_token is null then
    insert into sessions (role, player_id) values ('player', p_player_id) returning token into v_token;
  end if;
  return v_token;
end;
$$;

-- Returns {"session": ...} or {"error": "wrong-word" | "nickname-taken" | "rejected"}
-- or {"error": "real-name-exists", "existing": {"id", "nickname"}}.
-- p_takeover: the player who owns this real name gets the new nickname and keeps everything.
-- p_distinct: the person says they are someone else with the same real name.
create function public.join_game(
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
    where id = p_takeover and same_name(real_name, v_real_name)
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

-- ---------------------------------------------------------------------------------------
-- Reads (any valid session)
-- ---------------------------------------------------------------------------------------

create function public.catalog(p_token uuid)
returns table (id text, title text, description text, kind public.action_kind, points integer,
               photo_policy public.photo_policy, difficulty public.difficulty)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return query
    select a.id, a.title, a.description, a.kind, a.points, a.photo_policy, a.difficulty
    from actions a order by a.position;
end;
$$;

create function public.participants(p_token uuid)
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
    order by p.created_at;
end;
$$;

create function public.completions_for(p_token uuid)
returns table (completion_id uuid, action_id text, completed_at timestamptz, photo_id uuid, by_id uuid, by_nickname text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_player uuid := player_of(p_token);
begin
  if v_player is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select c.id, c.action_id, c.completed_at, c.photo_id, p.id, p.nickname
    from all_completions c join players p on p.id = c.player_id
    where c.shared or c.player_id = v_player;
end;
$$;

create function public.feed(p_token uuid, p_before timestamptz, p_limit integer)
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
      (select count(*) from likes l where l.target_id = i.id),
      exists (select 1 from likes l where l.target_id = i.id and l.player_id = v_player)
    from items i join players pl on pl.id = i.player_id
    where i.at < coalesce(p_before, 'infinity'::timestamptz)
    order by i.at desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

create function public.profile(p_token uuid, p_player_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_player players;
begin
  perform require_session(p_token);
  select * into v_player from players where id = p_player_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'player', jsonb_build_object('id', v_player.id, 'nickname', v_player.nickname, 'realName', v_player.real_name,
                                 'bio', v_player.bio, 'avatarId', v_player.avatar_id),
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

create function public.likers(p_token uuid, p_target uuid)
returns table (id uuid, nickname text, avatar_id uuid, liked_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return query
    select p.id, p.nickname, p.avatar_id, l.created_at
    from likes l join players p on p.id = l.player_id
    where l.target_id = p_target
    order by l.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Player writes without files
-- ---------------------------------------------------------------------------------------

-- Returns {"status": "ok", "liked": boolean} or {"status": "unauthorized" | "rejected"}.
create function public.toggle_like(p_token uuid, p_target uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := player_of(p_token);
begin
  if v_player is null then return jsonb_build_object('status', 'unauthorized'); end if;
  if not exists (select 1 from posts where id = p_target)
     and not exists (select 1 from all_completions where id = p_target) then
    return jsonb_build_object('status', 'rejected');
  end if;
  delete from likes where target_id = p_target and player_id = v_player;
  if found then return jsonb_build_object('status', 'ok', 'liked', false); end if;
  insert into likes (target_id, player_id) values (p_target, v_player);
  return jsonb_build_object('status', 'ok', 'liked', true);
end;
$$;

-- Returns 'ok' | 'unauthorized' | 'rejected'.
create function public.update_bio(p_token uuid, p_bio text) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := player_of(p_token);
begin
  if v_player is null then return 'unauthorized'; end if;
  update players set bio = trim(coalesce(p_bio, '')) where id = v_player;
  return 'ok';
exception
  when check_violation then return 'rejected';
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------------------

create function public.admin_secret_word(p_token uuid) returns text
language sql stable security definer set search_path = public
as $$ select case when is_admin(p_token) then (select secret_word from evening_settings) end $$;

-- p_word null = generate a new one. p_kick_players = everyone inside must enter again.
-- Returns {"status": "ok", "word": text} or {"status": "unauthorized" | "rejected"}.
create function public.admin_set_secret_word(p_token uuid, p_word text, p_kick_players boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_word text := coalesce(normalize_text(p_word), generate_secret_word());
begin
  if not is_admin(p_token) then return jsonb_build_object('status', 'unauthorized'); end if;
  if char_length(word_key(v_word)) < 3 then return jsonb_build_object('status', 'rejected'); end if;
  update evening_settings set secret_word = v_word, updated_at = now() where true;
  if p_kick_players then delete from sessions where role = 'player'; end if;
  return jsonb_build_object('status', 'ok', 'word', v_word);
exception
  when check_violation then return jsonb_build_object('status', 'rejected');
end;
$$;

create function public.admin_access_log(p_token uuid)
returns table (at timestamptz, device text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query select l.at, l.device from admin_access_log l order by l.at desc;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Service functions for the `photos` Edge Function (service_role only)
-- ---------------------------------------------------------------------------------------

create function public.svc_create_post(p_player_id uuid, p_photo_id uuid, p_caption text) returns text
language plpgsql security definer set search_path = public
as $$
begin
  insert into posts (player_id, photo_id, caption) values (p_player_id, p_photo_id, trim(coalesce(p_caption, '')));
  return 'ok';
exception
  when check_violation then return 'rejected';
end;
$$;

/** p_player_id null = admin. Returns the post's photo id, or null if not allowed. */
create function public.svc_delete_post(p_post_id uuid, p_player_id uuid) returns uuid
language sql security definer set search_path = public
as $$
  delete from posts where id = p_post_id and (p_player_id is null or player_id = p_player_id)
  returning photo_id
$$;

/** Returns the previous avatar's photo id, to delete its files. */
create function public.svc_set_avatar(p_player_id uuid, p_photo_id uuid) returns uuid
language sql security definer set search_path = public
as $$
  with previous as (select avatar_id from players where id = p_player_id)
  update players set avatar_id = p_photo_id where id = p_player_id
  returning (select avatar_id from previous)
$$;

create function public.svc_known_photos(p_ids uuid[]) returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(candidate.photo), '{}') from unnest(p_ids) as candidate(photo)
  where exists (select 1 from all_completions c where c.photo_id = candidate.photo)
     or exists (select 1 from posts p where p.photo_id = candidate.photo)
     or exists (select 1 from players pl where pl.avatar_id = candidate.photo)
$$;

create function public.svc_photos()
returns table (photo_id uuid, source text, title text, player_nickname text, player_real_name text, taken_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select c.photo_id, 'action', a.title, p.nickname, p.real_name, c.completed_at
  from all_completions c join actions a on a.id = c.action_id join players p on p.id = c.player_id
  where c.photo_id is not null
  union all
  select po.photo_id, 'post', coalesce(nullif(po.caption, ''), 'Post in bacheca'), p.nickname, p.real_name, po.created_at
  from posts po join players p on p.id = po.player_id
  order by 6 desc
$$;

-- p_player_id null = admin. A required photo cannot exist without its completion, and a post
-- is its photo: deleting either photo removes the completion or the post.
-- Returns {"status": "ok" | "rejected", "undone": boolean}.
create function public.svc_delete_photo(p_photo_id uuid, p_player_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_completion all_completions;
  v_policy photo_policy;
begin
  if exists (select 1 from posts where photo_id = p_photo_id) then
    delete from posts where photo_id = p_photo_id and (p_player_id is null or player_id = p_player_id);
    return jsonb_build_object('status', case when found then 'ok' else 'rejected' end, 'undone', false);
  end if;

  if exists (select 1 from players where avatar_id = p_photo_id) then
    update players set avatar_id = null where avatar_id = p_photo_id and (p_player_id is null or id = p_player_id);
    return jsonb_build_object('status', case when found then 'ok' else 'rejected' end, 'undone', false);
  end if;

  select * into v_completion from all_completions where photo_id = p_photo_id;
  if not found or (p_player_id is not null and v_completion.player_id <> p_player_id) then
    return jsonb_build_object('status', 'rejected');
  end if;
  select photo_policy into v_policy from actions where id = v_completion.action_id;

  if v_policy = 'required' then
    delete from player_completions where photo_id = p_photo_id;
    delete from shared_completions where photo_id = p_photo_id;
  else
    update player_completions set photo_id = null where photo_id = p_photo_id;
    update shared_completions set photo_id = null where photo_id = p_photo_id;
  end if;
  return jsonb_build_object('status', 'ok', 'undone', v_policy = 'required');
end;
$$;

-- Deletes players (cascading to sessions, completions, posts, likes), the admin access log,
-- and draws a new secret word. Keeps actions and admin sessions.
create function public.svc_reset_evening() returns uuid[]
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
  delete from players where true;
  delete from admin_access_log where true;
  update evening_settings set secret_word = generate_secret_word(), updated_at = now() where true;
  return v_photos;
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
  public.complete_action(uuid, text),
  public.toggle_like(uuid, uuid),
  public.update_bio(uuid, text),
  public.admin_add_action(uuid, text, text, public.action_kind, public.photo_policy, integer, public.difficulty),
  public.admin_update_action(uuid, text, text, text, public.action_kind, public.photo_policy, integer, public.difficulty),
  public.admin_secret_word(uuid),
  public.admin_set_secret_word(uuid, text, boolean),
  public.admin_access_log(uuid)
to anon, authenticated;
