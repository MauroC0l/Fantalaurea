<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { composeApp } from './app/compose';
  import { HashRouter, hrefTo, type Route } from './app/router.svelte';
  import { resumeSession } from './application/resume-session';
  import type { Session } from './domain/player';
  import ActionsScreen from './features/actions/ActionsScreen.svelte';
  import AdminActionsScreen from './features/admin/AdminActionsScreen.svelte';
  import AlbumScreen from './features/admin/AlbumScreen.svelte';
  import { AdminState } from './features/admin/admin-state.svelte';
  import { AlbumState } from './features/admin/album-state.svelte';
  import { GameState } from './features/game/game-state.svelte';
  import JoinScreen from './features/join/JoinScreen.svelte';
  import ParticipantsScreen from './features/participants/ParticipantsScreen.svelte';
  import RulesScreen from './features/rules/RulesScreen.svelte';
  import Button from './ui/components/Button.svelte';
  import CelebrationHost from './ui/components/CelebrationHost.svelte';
  import EmptyState from './ui/components/EmptyState.svelte';
  import Icon from './ui/components/Icon.svelte';
  import Loader from './ui/components/Loader.svelte';
  import PartyBackground from './ui/components/PartyBackground.svelte';
  import Screen from './ui/components/Screen.svelte';
  import TabBar from './ui/components/TabBar.svelte';
  import ToastHost from './ui/components/ToastHost.svelte';
  import { toasts } from './ui/components/toasts.svelte';
  import { duration } from './ui/theme/motion';

  type AppState =
    | { kind: 'booting' }
    | { kind: 'offline' }
    | { kind: 'anonymous' }
    | { kind: 'playing'; game: GameState }
    | { kind: 'administering'; admin: AdminState; album: AlbumState };

  const deps = composeApp();
  const router = new HashRouter();
  let state = $state<AppState>({ kind: 'booting' });

  const PLAYER_TABS = [
    { id: 'azioni', label: 'Azioni', icon: 'checklist', href: hrefTo('azioni') },
    { id: 'partecipanti', label: 'Partecipanti', icon: 'users', href: hrefTo('partecipanti') },
    { id: 'regole', label: 'Regole', icon: 'book', href: hrefTo('regole') },
  ] as const;

  const ADMIN_TABS = [
    { id: 'admin', label: 'Azioni', icon: 'checklist', href: hrefTo('admin') },
    { id: 'album', label: 'Album', icon: 'image', href: hrefTo('album') },
  ] as const;

  type PlayingRoute = (typeof PLAYER_TABS)[number]['id'];
  type AdminRoute = (typeof ADMIN_TABS)[number]['id'];

  const playingRoute = $derived<PlayingRoute>(
    router.current === 'partecipanti' || router.current === 'regole' ? router.current : 'azioni',
  );
  const adminRoute = $derived<AdminRoute>(router.current === 'album' ? 'album' : 'admin');
  const anonymousRoute = $derived<Route>(router.current === 'iscrizione' ? 'iscrizione' : 'regole');

  async function boot() {
    state = { kind: 'booting' };
    const outcome = await resumeSession(deps);
    if (outcome.kind === 'resumed') enter(outcome.session);
    else state = { kind: outcome.kind === 'offline' ? 'offline' : 'anonymous' };
  }

  function enter(session: Session) {
    stopCurrent();
    if (session.role === 'admin') {
      const admin = new AdminState(deps, session);
      state = { kind: 'administering', admin, album: new AlbumState(deps, session) };
      void admin.start();
      if (router.current !== 'album') router.go('admin');
      return;
    }
    const game = new GameState(deps, session, {
      onSessionLost: () => signOut('La serata è ricominciata: iscriviti di nuovo'),
    });
    state = { kind: 'playing', game };
    void game.start();
    if (router.current !== 'partecipanti' && router.current !== 'regole') router.go('azioni');
  }

  function signOut(reason?: string) {
    stopCurrent();
    deps.sessions.clear();
    state = { kind: 'anonymous' };
    router.go('regole');
    if (reason) toasts.show(reason, 'error');
  }

  function stopCurrent() {
    if (state.kind === 'playing') state.game.stop();
    if (state.kind === 'administering') state.admin.stop();
  }

  onDestroy(stopCurrent);

  void boot();
</script>

<PartyBackground />
<ToastHost />
<CelebrationHost />

{#if state.kind === 'booting'}
  <Screen><Loader label="Si accendono le luci…" /></Screen>
{:else if state.kind === 'offline'}
  <Screen>
    <EmptyState icon="alert" title="Sei offline">
      <p>Non riesco a raggiungere la festa. Controlla la connessione.</p>
      <Button variant="ghost" onclick={boot}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  </Screen>
{:else if state.kind === 'anonymous'}
  {#key anonymousRoute}
    <div in:fade={{ duration: duration('base') }}>
      {#if anonymousRoute === 'iscrizione'}
        <JoinScreen accounts={deps.accounts} sessions={deps.sessions} onjoined={enter} />
      {:else}
        <RulesScreen onjoin={() => router.go('iscrizione')} />
      {/if}
    </div>
  {/key}
{:else if state.kind === 'administering'}
  {#key adminRoute}
    <div in:fade={{ duration: duration('base') }}>
      {#if adminRoute === 'album'}
        <AlbumScreen album={state.album} onunauthorized={() => signOut('Sessione admin scaduta: rientra')} />
      {:else}
        <AdminActionsScreen
          admin={state.admin}
          onlogout={() => signOut()}
          onunauthorized={() => signOut('Sessione admin scaduta: rientra')}
          onopenalbum={() => router.go('album')}
        />
      {/if}
    </div>
  {/key}
  <TabBar tabs={ADMIN_TABS} active={adminRoute} />
{:else}
  {#key playingRoute}
    <div in:fade={{ duration: duration('base') }}>
      {#if playingRoute === 'partecipanti'}
        <ParticipantsScreen game={state.game} />
      {:else if playingRoute === 'regole'}
        <RulesScreen />
      {:else}
        <ActionsScreen game={state.game} haptics={deps.haptics} onlogout={() => signOut()} />
      {/if}
    </div>
  {/key}
  <TabBar tabs={PLAYER_TABS} active={playingRoute} />
{/if}
