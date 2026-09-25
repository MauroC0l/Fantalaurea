-- Visible points and a difficulty label per action (ADR 0010).

create type public.difficulty as enum ('soft', 'medium', 'hard');

alter table public.actions add column difficulty public.difficulty not null default 'medium';
alter table public.actions add constraint actions_points_check check (points between -1000 and 1000);

-- Proposed for the default list; the admin reviews them from the app.
update public.actions set difficulty = 'soft' where id in (
  'bonus-shottino', 'bonus-brindisi-prof', 'bonus-canzone', 'bonus-cavallo',
  'malus-skill-issue', 'malus-parlare', 'malus-cibo-terra'
);
update public.actions set difficulty = 'hard' where id in (
  'bonus-verticale', 'bonus-foto-intima', 'bonus-selfie-pelato', 'bonus-elemosina', 'common-vomito',
  'malus-pianto', 'malus-rifiuto'
);

drop function public.participants();
drop function public.admin_add_action(uuid, text, text, public.action_kind, public.photo_policy);
drop function public.admin_update_action(uuid, text, text, text, public.action_kind, public.photo_policy);

create or replace function public.action_json(a public.actions) returns jsonb
language sql immutable
as $$
  select jsonb_build_object('id', a.id, 'title', a.title, 'description', a.description,
    'kind', a.kind, 'points', a.points, 'photoPolicy', a.photo_policy, 'difficulty', a.difficulty)
$$;

-- A malus always costs points: the sign comes from the kind, never from the admin's input.
create function public.signed_points(p_kind public.action_kind, p_points integer) returns integer
language sql immutable
as $$ select case when p_kind = 'malus' then -abs(p_points) else abs(p_points) end $$;

create function public.participants()
returns table (id uuid, nickname text, real_name text, actions_done bigint, points bigint)
language sql stable security definer set search_path = public
as $$
  with shared as (
    select count(*) as done, coalesce(sum(a.points), 0) as points
    from shared_completions s join actions a on a.id = s.action_id
  )
  select p.id, p.nickname, p.real_name,
    (select count(*) from player_completions c where c.player_id = p.id) + shared.done,
    coalesce((select sum(a.points) from player_completions c join actions a on a.id = c.action_id
              where c.player_id = p.id), 0) + shared.points
  from players p cross join shared
  order by p.created_at
$$;

create function public.admin_add_action(
  p_token uuid, p_title text, p_description text, p_kind public.action_kind,
  p_photo_policy public.photo_policy, p_points integer, p_difficulty public.difficulty
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_action actions;
begin
  if not is_admin(p_token) then return jsonb_build_object('error', 'unauthorized'); end if;
  insert into actions (title, description, kind, photo_policy, points, difficulty)
  values (normalize_text(p_title), normalize_text(p_description), p_kind, p_photo_policy,
          signed_points(p_kind, p_points), p_difficulty)
  returning * into v_action;
  return jsonb_build_object('action', action_json(v_action));
exception
  when check_violation or not_null_violation then
    return jsonb_build_object('error', 'rejected');
end;
$$;

-- Returns 'ok' | 'unauthorized' | 'rejected' | 'kind-locked'.
create function public.admin_update_action(
  p_token uuid, p_action_id text, p_title text, p_description text, p_kind public.action_kind,
  p_photo_policy public.photo_policy, p_points integer, p_difficulty public.difficulty
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
  set title = normalize_text(p_title), description = normalize_text(p_description), kind = p_kind,
      photo_policy = p_photo_policy, points = signed_points(p_kind, p_points), difficulty = p_difficulty
  where id = p_action_id;
  return 'ok';
exception
  when check_violation or not_null_violation then
    return 'rejected';
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.join_game(text, text),
  public.resume_session(uuid),
  public.participants(),
  public.completions_for(uuid),
  public.complete_action(uuid, text),
  public.admin_add_action(uuid, text, text, public.action_kind, public.photo_policy, integer, public.difficulty),
  public.admin_update_action(uuid, text, text, text, public.action_kind, public.photo_policy, integer, public.difficulty)
to anon, authenticated;
