-- Change signals now come from the clients (ADR 0013): hosted Realtime does not deliver
-- database broadcasts to public channels.

drop trigger notify_change on public.actions;
drop trigger notify_change on public.players;
drop trigger notify_change on public.player_completions;
drop trigger notify_change on public.shared_completions;
drop trigger notify_change on public.posts;
drop trigger notify_change on public.likes;
drop trigger notify_change on public.sessions;
drop function public.notify_change();
