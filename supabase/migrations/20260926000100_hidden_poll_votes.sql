-- A poll by a blocked player is hidden (ADR 0018): it cannot be voted by id either.

create or replace function public.vote_poll(p_token uuid, p_poll uuid, p_options uuid[]) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := player_of(p_token);
  v_poll polls;
begin
  if v_me is null then return 'unauthorized'; end if;
  if not polls_enabled() then return 'disabled'; end if;
  select * into v_poll from polls where id = p_poll for update;
  if not found or (v_poll.creator_id is not null and is_blocked(v_poll.creator_id)) then return 'rejected'; end if;
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
