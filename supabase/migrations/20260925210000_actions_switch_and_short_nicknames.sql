-- "Azioni" becomes a switch like the others (ADR 0014) and nicknames shrink to 20 characters.

alter table public.evening_settings add column actions_enabled boolean not null default true;

create or replace function public.features(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_session(p_token);
  return (select jsonb_build_object('actions', actions_enabled, 'chat', chat_enabled, 'feed', feed_enabled,
                                    'leaderboard', leaderboard_enabled)
          from evening_settings);
end;
$$;

-- Returns 'ok' | 'unauthorized' | 'rejected'.
create or replace function public.admin_set_feature(p_token uuid, p_feature text, p_enabled boolean) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin(p_token) then return 'unauthorized'; end if;
  if p_feature not in ('actions', 'chat', 'feed', 'leaderboard') or p_enabled is null then return 'rejected'; end if;
  update evening_settings set
    actions_enabled = case when p_feature = 'actions' then p_enabled else actions_enabled end,
    chat_enabled = case when p_feature = 'chat' then p_enabled else chat_enabled end,
    feed_enabled = case when p_feature = 'feed' then p_enabled else feed_enabled end,
    leaderboard_enabled = case when p_feature = 'leaderboard' then p_enabled else leaderboard_enabled end
  where true;
  return 'ok';
end;
$$;

create function public.actions_enabled() returns boolean
language sql stable security definer set search_path = public
as $$ select actions_enabled from evening_settings $$;

create or replace function public.complete_action(p_token uuid, p_action_id text) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_player_id uuid := player_of(p_token);
  v_action actions;
begin
  if v_player_id is null then return 'unauthorized'; end if;
  if not actions_enabled() then return 'disabled'; end if;
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

-- Only new or changed nicknames: a check constraint would also block players who already have
-- a longer one from changing their bio or photo, because every update re-checks the row.
create function public.short_nickname() returns trigger
language plpgsql
as $$
begin
  if char_length(new.nickname) > 20 then
    raise exception 'nickname longer than 20 characters' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger players_short_nickname
before insert or update of nickname on public.players
for each row execute function public.short_nickname();

revoke execute on function public.actions_enabled(), public.short_nickname() from public, anon, authenticated;
