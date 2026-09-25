<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { composeApp } from './app/compose';
  import { HashRouter, hrefTo } from './app/router.svelte';
  import { resumeSession } from './application/resume-session';
  import type { PlayerSession, Session } from './domain/player';
  import ActionsScreen from './features/actions/ActionsScreen.svelte';
  import AdminActionsScreen from './features/admin/AdminActionsScreen.svelte';
  import AlbumScreen from './features/admin/AlbumScreen.svelte';
  import EveningScreen from './features/admin/EveningScreen.svelte';
  import { AdminState } from './features/admin/admin-state.svelte';
  import { AlbumState } from './features/admin/album-state.svelte';
  import FeedScreen from './features/feed/FeedScreen.svelte';
  import { FeedState } from './features/feed/feed-state.svelte';
  import ChatListScreen from './features/chat/ChatListScreen.svelte';
  import { ChatListState } from './features/chat/chat-list-state.svelte';
  import ConversationScreen from './features/chat/ConversationScreen.svelte';
  import { ConversationState } from './features/chat/conversation-state.svelte';
  import { ALL_FEATURES_ON } from './domain/features';
  import { GameState } from './features/game/game-state.svelte';
  import JoinScreen from './features/join/JoinScreen.svelte';
  import SecretWordScreen from './features/join/SecretWordScreen.svelte';
  import ParticipantsScreen from './features/participants/ParticipantsScreen.svelte';
  import { PhotoLinksCache } from './features/photos/photo-links.svelte';
  import ProfileScreen from './features/profile/ProfileScreen.svelte';
  import { ProfileState } from './features/profile/profile-state.svelte';
  import RulesScreen from './features/rules/RulesScreen.svelte';
  import Button from './ui/components/Button.svelte';
  import CelebrationHost from './ui/components/CelebrationHost.svelte';
  import Dialog from './ui/components/Dialog.svelte';
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
    /** secretWord: null = not given yet; '' = the admin's way in, without it. */
    | { kind: 'anonymous'; secretWord: string | null }
    | { kind: 'playing'; game: GameState; feed: FeedState; chatList: ChatListState; links: PhotoLinksCache }
    | { kind: 'administering'; admin: AdminState; album: AlbumState };

  const deps = composeApp();
  const router = new HashRouter();
  let app = $state<AppState>({ kind: 'booting' });
  let confirmingLogout = $state(false);

  const PLAYER_TABS = [
    { id: 'bacheca', label: 'Bacheca', icon: 'home', href: hrefTo({ name: 'bacheca' }), feature: 'feed' },
    { id: 'azioni', label: 'Azioni', icon: 'checklist', href: hrefTo({ name: 'azioni' }), feature: null },
    { id: 'classifica', label: 'Classifica', icon: 'trophy', href: hrefTo({ name: 'classifica' }), feature: 'leaderboard' },
    { id: 'chat', label: 'Chat', icon: 'chat', href: hrefTo({ name: 'chat' }), feature: 'chat' },
    { id: 'profilo', label: 'Profilo', icon: 'user', href: hrefTo({ name: 'profilo' }), feature: null },
  ] as const;

  const ADMIN_TABS = [
    { id: 'admin', label: 'Azioni', icon: 'checklist', href: hrefTo({ name: 'admin' }) },
    { id: 'album', label: 'Album', icon: 'image', href: hrefTo({ name: 'album' }) },
    { id: 'serata', label: 'Serata', icon: 'key', href: hrefTo({ name: 'serata' }) },
  ] as const;

  type PlayerTab = (typeof PLAYER_TABS)[number]['id'];
  type AdminTab = (typeof ADMIN_TABS)[number]['id'];
  type PlayerScreen = PlayerTab | 'giocatore' | 'regole' | 'conversazione';

  const PLAYER_SCREENS: readonly string[] = ['bacheca', 'azioni', 'classifica', 'chat', 'profilo', 'giocatore', 'regole', 'conversazione'];

  const features = $derived(app.kind === 'playing' ? app.game.features : ALL_FEATURES_ON);

  /** Screens behind a switched-off feature fall back to the actions (ADR 0014). */
  const playerScreen = $derived.by((): PlayerScreen => {
    const name = router.current?.name ?? '';
    const wanted = (PLAYER_SCREENS.includes(name) ? name : features.feed ? 'bacheca' : 'azioni') as PlayerScreen;
    if (wanted === 'bacheca' && !features.feed) return 'azioni';
    if (wanted === 'classifica' && !features.leaderboard) return 'azioni';
    if ((wanted === 'chat' || wanted === 'conversazione') && !features.chat) return 'azioni';
    return wanted;
  });

  // Keeps the address in line when a switched-off screen fell back to the actions.
  $effect(() => {
    const name = router.current?.name;
    if (app.kind === 'playing' && playerScreen === 'azioni' && name && name !== 'azioni' && PLAYER_SCREENS.includes(name)) {
      router.go({ name: 'azioni' });
    }
  });

  const playerTab = $derived.by((): PlayerTab => {
    if (playerScreen === 'giocatore') return features.leaderboard ? 'classifica' : 'profilo';
    if (playerScreen === 'conversazione') return 'chat';
    if (playerScreen === 'regole') return 'profilo';
    return playerScreen;
  });

  const playerTabs = $derived(
    PLAYER_TABS.filter((tab) => tab.feature === null || features[tab.feature]).map((tab) =>
      tab.id === 'chat' && app.kind === 'playing' ? { ...tab, badge: app.chatList.unread } : tab,
    ),
  );

  const adminTab = $derived.by((): AdminTab => {
    const name = router.current?.name;
    return name === 'album' || name === 'serata' ? name : 'admin';
  });

  const anonymousScreen = $derived.by(() => {
    if (app.kind !== 'anonymous') return 'regole';
    const name = router.current?.name;
    if (name === 'iscrizione') return app.secretWord === null ? 'parola' : 'iscrizione';
    return name === 'parola' ? 'parola' : 'regole';
  });

  /** A fresh profile app for every profile page. */
  const profile = $derived.by(() => {
    if (app.kind !== 'playing') return null;
    const { session } = app.game;
    const route = router.current;
    const playerId = route?.name === 'giocatore' ? route.id : route?.name === 'profilo' ? session.player.id : null;
    return playerId ? new ProfileState(deps, session, playerId, sessionLost) : null;
  });

  /** A fresh conversation state for every open chat. */
  const conversation = $derived.by(() => {
    if (app.kind !== 'playing' || router.current?.name !== 'conversazione') return null;
    const { chatList } = app;
    return new ConversationState(deps, chatList.session, router.current.id, {
      onSessionLost: sessionLost,
      onRead: () => void chatList.refresh(),
    });
  });

  async function messagePlayer(playerId: string) {
    if (app.kind !== 'playing') return;
    const opened = await app.chatList.open(playerId);
    if (opened.ok) router.go({ name: 'conversazione', id: opened.value });
    else if (opened.error === 'disabled') toasts.show('La chat è spenta per questa serata', 'error');
    else if (opened.error !== 'unauthorized') toasts.show('Non riesco ad aprire la chat', 'error');
  }

  async function boot() {
    app = { kind: 'booting' };
    const outcome = await resumeSession(deps);
    if (outcome.kind === 'resumed') enter(outcome.session);
    else if (outcome.kind === 'offline') app = { kind: 'offline' };
    else app = { kind: 'anonymous', secretWord: null };
  }

  function enter(session: Session) {
    stopCurrent();
    if (session.role === 'admin') {
      const admin = new AdminState(deps, session, () => signOut('Sessione admin scaduta: rientra'));
      app = { kind: 'administering', admin, album: new AlbumState(deps, session) };
      void admin.start();
      if (router.current?.name !== 'album' && router.current?.name !== 'serata') router.go({ name: 'admin' });
      return;
    }
    play(session);
  }

  function play(session: PlayerSession) {
    const links = new PhotoLinksCache(deps.links, session, sessionLost);
    const game = new GameState(deps, session, { onSessionLost: sessionLost });
    const feed = new FeedState(deps, session, sessionLost);
    const chatList = new ChatListState(deps, session, sessionLost);
    app = { kind: 'playing', game, feed, chatList, links };
    void game.start();
    void feed.start();
    chatList.start();
    const name = router.current?.name ?? '';
    if (!PLAYER_SCREENS.includes(name) || name === 'regole') router.go({ name: 'bacheca' });
  }

  function sessionLost() {
    signOut('Devi rientrare: la serata o la parola sono cambiate');
  }

  function signOut(reason?: string) {
    if (app.kind === 'anonymous') return;
    stopCurrent();
    confirmingLogout = false;
    deps.sessions.clear();
    app = { kind: 'anonymous', secretWord: null };
    router.go({ name: 'regole' });
    if (reason) toasts.show(reason, 'error');
  }

  function stopCurrent() {
    if (app.kind === 'playing') {
      app.game.stop();
      app.feed.stop();
      app.chatList.stop();
    }
    if (app.kind === 'administering') app.admin.stop();
  }

  function acceptWord(word: string) {
    app = { kind: 'anonymous', secretWord: word };
    router.go({ name: 'iscrizione' });
  }

  function backToSecretWord() {
    app = { kind: 'anonymous', secretWord: null };
    router.go({ name: 'parola' });
  }

  function adminWayIn() {
    app = { kind: 'anonymous', secretWord: '' };
    router.go({ name: 'iscrizione' });
  }

  onDestroy(stopCurrent);

  void boot();
</script>

<PartyBackground />
<ToastHost />
<CelebrationHost />

{#if app.kind === 'booting'}
  <Screen><Loader label="Si accendono le luci…" /></Screen>
{:else if app.kind === 'offline'}
  <Screen>
    <EmptyState icon="alert" title="Sei offline">
      <p>Non riesco a raggiungere la festa. Controlla la connessione.</p>
      <Button variant="ghost" onclick={boot}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  </Screen>
{:else if app.kind === 'anonymous'}
  {#key anonymousScreen}
    <div in:fade={{ duration: duration('base') }}>
      {#if anonymousScreen === 'iscrizione'}
        <JoinScreen
          accounts={deps.accounts}
          sessions={deps.sessions}
          secretWord={app.secretWord ?? ''}
          onjoined={enter}
          onwrongword={backToSecretWord}
          onback={backToSecretWord}
        />
      {:else if anonymousScreen === 'parola'}
        <SecretWordScreen
          accounts={deps.accounts}
          onaccepted={acceptWord}
          onadmin={adminWayIn}
          onback={() => router.go({ name: 'regole' })}
        />
      {:else}
        <RulesScreen onjoin={() => router.go({ name: 'parola' })} />
      {/if}
    </div>
  {/key}
{:else if app.kind === 'administering'}
  {#key adminTab}
    <div in:fade={{ duration: duration('base') }}>
      {#if adminTab === 'album'}
        <AlbumScreen album={app.album} onunauthorized={() => signOut('Sessione admin scaduta: rientra')} />
      {:else if adminTab === 'serata'}
        <EveningScreen
          admin={app.admin}
          clipboard={deps.clipboard}
          exporter={deps.exporter}
          onlogout={() => signOut()}
          onunauthorized={() => signOut('Sessione admin scaduta: rientra')}
          onopenalbum={() => router.go({ name: 'album' })}
        />
      {:else}
        <AdminActionsScreen
          admin={app.admin}
          onlogout={() => signOut()}
          onunauthorized={() => signOut('Sessione admin scaduta: rientra')}
        />
      {/if}
    </div>
  {/key}
  <TabBar tabs={ADMIN_TABS} active={adminTab} />
{:else}
  {#key router.current}
    <div in:fade={{ duration: duration('base') }}>
      {#if playerScreen === 'azioni'}
        <ActionsScreen game={app.game} links={app.links} haptics={deps.haptics} />
      {:else if playerScreen === 'classifica'}
        <ParticipantsScreen game={app.game} links={app.links} />
      {:else if playerScreen === 'chat'}
        <ChatListScreen list={app.chatList} links={app.links} />
      {:else if playerScreen === 'conversazione' && conversation}
        <ConversationScreen
          {conversation}
          links={app.links}
          recorder={deps.recorder}
          haptics={deps.haptics}
          onback={() => router.go({ name: 'chat' })}
        />
      {:else if (playerScreen === 'profilo' || playerScreen === 'giocatore') && profile}
        {@const other = profile.playerId}
        <ProfileScreen
          {profile}
          game={app.game}
          links={app.links}
          showRank={features.leaderboard}
          onback={playerScreen === 'giocatore' ? () => history.back() : undefined}
          onmessage={features.chat && !profile.isMine ? () => messagePlayer(other) : undefined}
        >
          {#snippet footer()}
            {#if profile.isMine}
              <Button variant="ghost" block onclick={() => router.go({ name: 'regole' })}>
                <Icon name="book" size={20} /> Regole del gioco
              </Button>
              <Button variant="danger" block onclick={() => (confirmingLogout = true)}>
                <Icon name="logout" size={20} /> Esci
              </Button>
            {/if}
          {/snippet}
        </ProfileScreen>
      {:else if playerScreen === 'regole'}
        <RulesScreen />
      {:else}
        <FeedScreen feed={app.feed} links={app.links} haptics={deps.haptics} />
      {/if}
    </div>
  {/key}
  {#if playerScreen !== 'conversazione'}
    <TabBar tabs={playerTabs} active={playerTab} />
  {/if}

  {#snippet logoutActions()}
    <Button variant="danger" block onclick={() => signOut()}>Esci</Button>
    <Button variant="ghost" block onclick={() => (confirmingLogout = false)}>Resta</Button>
  {/snippet}

  <Dialog open={confirmingLogout} title="Vuoi uscire?" onclose={() => (confirmingLogout = false)} actions={logoutActions}>
    <p>
      Le tue azioni restano salvate. Per rientrare servono la parola della serata, lo stesso nickname
      (<strong>{app.game.session.player.nickname}</strong>) e lo stesso nome vero.
    </p>
  </Dialog>
{/if}

