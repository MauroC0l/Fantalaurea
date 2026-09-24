-- Actions are done once (ADR 0007) and may carry a photo stored in a private bucket, managed
-- only by the `photos` Edge Function (ADR 0008). Evening data is disposable: old counts go.

drop function public.set_count(uuid, text, integer);
drop function public.counts_for(uuid);
drop function public.participants();
drop function public.admin_add_action(uuid, text, public.action_kind);
drop function public.admin_remove_action(uuid, text);
drop function public.admin_reset_evening(uuid);
drop table public.player_counts;
drop table public.shared_counts;

-- Default actions are re-inserted by seed.sql with titles and photo policies.
delete from public.actions;

create type public.photo_policy as enum ('none', 'optional', 'required');

alter table public.actions rename column label to description;
alter table public.actions drop constraint actions_label_check;
alter table public.actions
  add constraint actions_description_check check (char_length(description) between 3 and 300),
  add column title text not null check (char_length(title) between 2 and 40),
  add column photo_policy public.photo_policy not null default 'none';

create table public.player_completions (
  player_id uuid not null references public.players on delete cascade,
  action_id text not null references public.actions on delete cascade,
  completed_at timestamptz not null default now(),
  photo_id uuid unique,
  primary key (player_id, action_id)
);

-- A 'common' action is completed once for everyone; player_id is who marked it.
create table public.shared_completions (
  action_id text primary key references public.actions on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  completed_at timestamptz not null default now(),
  photo_id uuid unique
);

alter table public.player_completions enable row level security;
alter table public.shared_completions enable row level security;
create policy "public read" on public.player_completions for select using (true);
create policy "public read" on public.shared_completions for select using (true);
revoke insert, update, delete, truncate on public.player_completions, public.shared_completions
  from anon, authenticated;

alter publication supabase_realtime add table public.player_completions, public.shared_completions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 15 * 1024 * 1024, array['image/jpeg']);

-- Every completion, personal or shared, seen through one shape.
create view public.all_completions with (security_invoker = true) as
  select c.player_id, c.action_id, c.completed_at, c.photo_id, false as shared from public.player_completions c
  union all
  select s.player_id, s.action_id, s.completed_at, s.photo_id, true from public.shared_completions s;

revoke all on public.all_completions from anon, authenticated;

create function public.participants()
returns table (id uuid, nickname text, real_name text, actions_done bigint)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nickname, p.real_name,
    (select count(*) from player_completions c where c.player_id = p.id)
      + (select count(*) from shared_completions)
  from players p
  order by p.created_at
$$;

create function public.completions_for(p_player_id uuid)
returns table (action_id text, completed_at timestamptz, has_photo boolean, by_id uuid, by_nickname text)
language sql stable security definer set search_path = public
as $$
  select c.action_id, c.completed_at, c.photo_id is not null, p.id, p.nickname
  from all_completions c join players p on p.id = c.player_id
  where c.shared or c.player_id = p_player_id
$$;

-- Returns 'ok' | 'unauthorized' | 'rejected' | 'photo-required'. Idempotent.
create function public.complete_action(p_token uuid, p_action_id text) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_player_id uuid := player_of(p_token);
  v_action actions;
begin
  if v_player_id is null then return 'unauthorized'; end if;
  select * into v_action from actions where id = p_action_id;
  if not found then return 'rejected'; end if;
  if v_action.photo_policy = 'required' then return 'photo-required'; end if;

  if v_action.kind = 'common' then
    insert into shared_completions (action_id, player_id) values (p_action_id, v_player_id)
    on conflict (action_id) do nothing;
  else
    insert into player_completions (player_id, action_id) values (v_player_id, p_action_id)
    on conflict (player_id, action_id) do nothing;
  end if;
  return 'ok';
end;
$$;

-- Returns {"action": ...} or {"error": "unauthorized" | "rejected"}.
create function public.admin_add_action(
  p_token uuid, p_title text, p_description text, p_kind public.action_kind, p_photo_policy public.photo_policy
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_action actions;
begin
  if not is_admin(p_token) then return jsonb_build_object('error', 'unauthorized'); end if;
  insert into actions (title, description, kind, photo_policy)
  values (normalize_text(p_title), normalize_text(p_description), p_kind, p_photo_policy)
  returning * into v_action;
  return jsonb_build_object('action', action_json(v_action));
exception
  when check_violation or not_null_violation then
    return jsonb_build_object('error', 'rejected');
end;
$$;

-- Returns 'ok' | 'unauthorized' | 'rejected' | 'kind-locked'.
create function public.admin_update_action(
  p_token uuid, p_action_id text, p_title text, p_description text,
  p_kind public.action_kind, p_photo_policy public.photo_policy
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_current actions;
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  select * into v_current from actions where id = p_action_id;
  if not found then return 'rejected'; end if;
  -- Common and personal completions live in different tables: switching would lose them.
  if (v_current.kind = 'common') <> (p_kind = 'common')
     and exists (select 1 from all_completions where action_id = p_action_id) then
    return 'kind-locked';
  end if;
  update actions
  set title = normalize_text(p_title), description = normalize_text(p_description),
      kind = p_kind, photo_policy = p_photo_policy
  where id = p_action_id;
  return 'ok';
exception
  when check_violation or not_null_violation then
    return 'rejected';
end;
$$;

create function public.action_json(a public.actions) returns jsonb
language sql immutable
as $$
  select jsonb_build_object('id', a.id, 'title', a.title, 'description', a.description,
    'kind', a.kind, 'points', a.points, 'photoPolicy', a.photo_policy)
$$;

-- ---------------------------------------------------------------------------------------
-- Service functions: called only by the `photos` Edge Function (service_role), which also
-- deletes the files whose ids these functions return.
-- ---------------------------------------------------------------------------------------

-- Returns {"status": "ok", "replaced_photo_id": uuid|null} or {"status": "unauthorized" | "rejected"}.
create function public.svc_complete_with_photo(p_player_id uuid, p_action_id text, p_photo_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_action actions;
  v_owner uuid;
  v_previous uuid;
begin
  select * into v_action from actions where id = p_action_id;
  if not found or v_action.photo_policy = 'none' then return jsonb_build_object('status', 'rejected'); end if;

  if v_action.kind = 'common' then
    select player_id, photo_id into v_owner, v_previous from shared_completions where action_id = p_action_id;
    if found and v_owner <> p_player_id then return jsonb_build_object('status', 'unauthorized'); end if;
    insert into shared_completions (action_id, player_id, photo_id) values (p_action_id, p_player_id, p_photo_id)
    on conflict (action_id) do update set photo_id = excluded.photo_id;
  else
    select photo_id into v_previous from player_completions where player_id = p_player_id and action_id = p_action_id;
    insert into player_completions (player_id, action_id, photo_id) values (p_player_id, p_action_id, p_photo_id)
    on conflict (player_id, action_id) do update set photo_id = excluded.photo_id;
  end if;
  return jsonb_build_object('status', 'ok', 'replaced_photo_id', v_previous);
end;
$$;

-- Returns {"status": "ok" | "rejected", "photo_id": uuid|null}.
create function public.svc_undo(p_player_id uuid, p_action_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_photo uuid;
begin
  delete from player_completions where player_id = p_player_id and action_id = p_action_id
  returning photo_id into v_photo;
  if not found then
    delete from shared_completions where player_id = p_player_id and action_id = p_action_id
    returning photo_id into v_photo;
    if not found then return jsonb_build_object('status', 'rejected'); end if;
  end if;
  return jsonb_build_object('status', 'ok', 'photo_id', v_photo);
end;
$$;

-- p_player_id null = admin. A photo of a 'required' action cannot exist without its
-- completion, so deleting it also undoes the action.
-- Returns {"status": "ok" | "rejected", "undone": boolean}.
create function public.svc_delete_photo(p_photo_id uuid, p_player_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_completion all_completions;
  v_policy photo_policy;
begin
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

create function public.svc_photos(p_player_id uuid)
returns table (photo_id uuid, action_id text, action_title text, player_nickname text, player_real_name text, completed_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select c.photo_id, a.id, a.title, p.nickname, p.real_name, c.completed_at
  from all_completions c
  join actions a on a.id = c.action_id
  join players p on p.id = c.player_id
  where c.photo_id is not null and (p_player_id is null or c.player_id = p_player_id)
  order by c.completed_at desc
$$;

create function public.svc_remove_action(p_action_id text) returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_photos uuid[];
begin
  select coalesce(array_agg(photo_id), '{}') into v_photos
  from all_completions where action_id = p_action_id and photo_id is not null;
  delete from actions where id = p_action_id;
  if not found then return null; end if;
  return v_photos;
end;
$$;

-- Deletes players (cascading to sessions and completions); keeps actions and admins.
create function public.svc_reset_evening() returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_photos uuid[];
begin
  select coalesce(array_agg(photo_id), '{}') into v_photos from all_completions where photo_id is not null;
  delete from players where true;
  return v_photos;
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.join_game(text, text),
  public.resume_session(uuid),
  public.participants(),
  public.completions_for(uuid),
  public.complete_action(uuid, text),
  public.admin_add_action(uuid, text, text, public.action_kind, public.photo_policy),
  public.admin_update_action(uuid, text, text, text, public.action_kind, public.photo_policy)
to anon, authenticated;
