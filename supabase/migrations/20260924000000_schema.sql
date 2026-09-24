-- Fantalaurea: one active evening. Clients may only READ public tables; every write goes
-- through the security definer functions below, which validate input and tokens.

create type public.action_kind as enum ('bonus', 'malus', 'common');

create table public.actions (
  id text primary key default ('custom-' || gen_random_uuid()),
  label text not null check (char_length(label) between 3 and 200),
  kind public.action_kind not null,
  points integer not null default 0,
  position integer generated always as identity
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 2 and 24),
  real_name text not null check (char_length(real_name) between 2 and 40),
  created_at timestamptz not null default now()
);

create unique index players_nickname_key on public.players (lower(nickname));

create table public.player_counts (
  player_id uuid not null references public.players on delete cascade,
  action_id text not null references public.actions on delete cascade,
  count integer not null check (count >= 0),
  primary key (player_id, action_id)
);

-- Counts of 'common' actions belong to everyone, so they have no player.
create table public.shared_counts (
  action_id text primary key references public.actions on delete cascade,
  count integer not null check (count >= 0)
);

-- Secret: never readable by clients (RLS on, no policies).
create table public.sessions (
  token uuid primary key default gen_random_uuid(),
  role text not null check (role in ('player', 'admin')),
  player_id uuid references public.players on delete cascade,
  check ((role = 'player') = (player_id is not null))
);

-- Secret: a single row, editable from the Supabase dashboard.
create table public.admin_credentials (
  id boolean primary key default true check (id),
  nickname text not null,
  real_name text not null
);

insert into public.admin_credentials (nickname, real_name) values ('Administrator', 'admin');

alter table public.actions enable row level security;
alter table public.players enable row level security;
alter table public.player_counts enable row level security;
alter table public.shared_counts enable row level security;
alter table public.sessions enable row level security;
alter table public.admin_credentials enable row level security;

create policy "public read" on public.actions for select using (true);
create policy "public read" on public.players for select using (true);
create policy "public read" on public.player_counts for select using (true);
create policy "public read" on public.shared_counts for select using (true);

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

alter publication supabase_realtime add table
  public.actions, public.players, public.player_counts, public.shared_counts;

-- Same rule as the app's normalizeText + sameName: trim, collapse spaces, ignore case.
create function public.normalize_text(raw text) returns text
language sql immutable
as $$ select regexp_replace(trim(raw), '\s+', ' ', 'g') $$;

create function public.same_name(a text, b text) returns boolean
language sql immutable
as $$ select lower(public.normalize_text(a)) = lower(public.normalize_text(b)) $$;

create function public.session_json(p_token uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case s.role
    when 'admin' then jsonb_build_object('role', 'admin', 'token', s.token)
    else jsonb_build_object(
      'role', 'player',
      'token', s.token,
      'player', jsonb_build_object('id', p.id, 'nickname', p.nickname, 'realName', p.real_name)
    )
  end
  from sessions s left join players p on p.id = s.player_id
  where s.token = p_token
$$;

create function public.player_of(p_token uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select player_id from sessions where token = p_token and role = 'player' $$;

create function public.is_admin(p_token uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from sessions where token = p_token and role = 'admin') $$;

-- Returns {"session": ...} or {"error": "nickname-taken"}.
create function public.join_game(p_nickname text, p_real_name text) returns jsonb
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
    return jsonb_build_object('session', session_json(v_token));
  end if;

  select * into v_player from players where lower(nickname) = lower(v_nickname);
  if found then
    if not same_name(v_real_name, v_player.real_name) then
      return jsonb_build_object('error', 'nickname-taken');
    end if;
    select token into v_token from sessions where player_id = v_player.id;
  else
    insert into players (nickname, real_name) values (v_nickname, v_real_name) returning * into v_player;
    insert into sessions (role, player_id) values ('player', v_player.id) returning token into v_token;
  end if;
  return jsonb_build_object('session', session_json(v_token));
exception
  when unique_violation then
    -- Two phones joined with the same nickname at the same instant.
    return jsonb_build_object('error', 'nickname-taken');
end;
$$;

create function public.resume_session(p_token uuid) returns jsonb
language sql stable security definer set search_path = public
as $$ select session_json(p_token) $$;

create function public.counts_for(p_player_id uuid)
returns table (action_id text, count integer)
language sql stable security definer set search_path = public
as $$
  select action_id, count from player_counts where player_id = p_player_id
  union all
  select action_id, count from shared_counts
$$;

create function public.participants()
returns table (id uuid, nickname text, real_name text, actions_done bigint)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nickname, p.real_name,
    coalesce((select sum(c.count) from player_counts c where c.player_id = p.id), 0)
      + coalesce((select sum(s.count) from shared_counts s), 0)
  from players p
  order by p.created_at
$$;

-- Returns 'ok' | 'unauthorized' | 'rejected'.
create function public.set_count(p_token uuid, p_action_id text, p_count integer) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_player_id uuid := player_of(p_token);
  v_kind action_kind;
begin
  if v_player_id is null then return 'unauthorized'; end if;
  select kind into v_kind from actions where id = p_action_id;
  if v_kind is null or p_count is null or p_count < 0 then return 'rejected'; end if;

  if v_kind = 'common' then
    insert into shared_counts (action_id, count) values (p_action_id, p_count)
    on conflict (action_id) do update set count = excluded.count;
  else
    insert into player_counts (player_id, action_id, count) values (v_player_id, p_action_id, p_count)
    on conflict (player_id, action_id) do update set count = excluded.count;
  end if;
  return 'ok';
end;
$$;

-- Returns {"action": ...} or {"error": "unauthorized" | "rejected"}.
create function public.admin_add_action(p_token uuid, p_label text, p_kind public.action_kind) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_action actions;
begin
  if not is_admin(p_token) then return jsonb_build_object('error', 'unauthorized'); end if;
  insert into actions (label, kind) values (normalize_text(p_label), p_kind) returning * into v_action;
  return jsonb_build_object('action', jsonb_build_object(
    'id', v_action.id, 'label', v_action.label, 'kind', v_action.kind, 'points', v_action.points));
exception
  when check_violation or not_null_violation then
    return jsonb_build_object('error', 'rejected');
end;
$$;

create function public.admin_remove_action(p_token uuid, p_action_id text) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  delete from actions where id = p_action_id;
  return case when found then 'ok' else 'rejected' end;
end;
$$;

-- Deletes players (and, by cascade, their sessions and counts); keeps actions and admins.
create function public.admin_reset_evening(p_token uuid) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  delete from players where true;
  delete from shared_counts where true;
  return 'ok';
end;
$$;

-- Supabase grants execute on new functions to anon by default: expose only the API below.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.join_game(text, text),
  public.resume_session(uuid),
  public.counts_for(uuid),
  public.participants(),
  public.set_count(uuid, text, integer),
  public.admin_add_action(uuid, text, public.action_kind),
  public.admin_remove_action(uuid, text),
  public.admin_reset_evening(uuid)
to anon, authenticated;
