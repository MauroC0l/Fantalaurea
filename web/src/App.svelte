<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { composeApp } from './app/compose';
  import { HashRouter, hrefTo, type Route } from './app/router.svelte';
  import type { WriteFailure } from './application/ports';
  import { resumeSession } from './application/resume-session';
  import type { Session } from './domain/player';
  import ActionsScreen from './features/actions/ActionsScreen.svelte';
  import AdminScreen from './features/admin/AdminScreen.svelte';
  import { AdminState } from './features/admin/admin-state.svelte';
  import { GameState } from './features/game/game-state.svelte';
  import JoinScreen from './features/join/JoinScreen.svelte';
  import ParticipantsScreen from './features/participants/ParticipantsScreen.svelte';
  import RulesScreen from './features/rules/RulesScreen.svelte';
  import Button from './ui/components/Button.svelte';
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
    | { kind: 'administering'; admin: AdminState };

  const deps = composeApp();
  const router = new HashRouter();
  let state = $state<AppState>({ kind: 'booting' });

  const TABS = [
    { id: 'azioni', label: 'Azioni', icon: 'checklist', href: hrefTo('azioni') },
    { id: 'partecipanti', label: 'Partecipanti', icon: 'users', href: hrefTo('partecipanti') },
    { id: 'regole', label: 'Regole', icon: 'book', href: hrefTo('regole') },
  ] as const;

  type PlayingRoute = (typeof TABS)[number]['id'];

  const playingRoute = $derived<PlayingRoute>(
    router.current === 'partecipanti' || router.current === 'regole' ? router.current : 'azioni',
  );

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
      const admin = new AdminState(deps.board, deps.admin, session);
      state = { kind: 'administering', admin };
      void admin.start();
      router.go('admin');
      return;
    }
    const game = new GameState(deps.board, session, {
      onWriteFailed: handleWriteFailure,
      onSessionLost: () => signOut('La serata è ricominciata: iscriviti di nuovo'),
    });
    state = { kind: 'playing', game };
    void game.start();
    if (router.current !== 'partecipanti' && router.current !== 'regole') router.go('azioni');
  }

  function handleWriteFailure(failure: WriteFailure) {
    if (failure === 'unauthorized') signOut('La tua iscrizione non esiste più: iscriviti di nuovo');
    else toasts.show('Non sono riuscito a salvare: riprova', 'error');
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
  <div in:fade={{ duration: duration('base') }}>
    <AdminScreen
      admin={state.admin}
      onlogout={() => signOut()}
      onunauthorized={() => signOut('Sessione admin scaduta: rientra')}
    />
  </div>
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
  <TabBar tabs={TABS} active={playingRoute} />
{/if}
