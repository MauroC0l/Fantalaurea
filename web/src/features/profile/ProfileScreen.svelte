<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { WriteFailure } from '../../application/ports';
  import { photosOf, type ProfilePhoto } from '../../domain/profile';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import Lightbox from '../../ui/components/Lightbox.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import PhotoPickerButton from '../../ui/components/PhotoPickerButton.svelte';
  import PointsPill from '../../ui/components/PointsPill.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import Thumbnail from '../../ui/components/Thumbnail.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';
  import type { GameState } from '../game/game-state.svelte';
  import { formatTime } from '../labels';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import BioEditorDialog from './BioEditorDialog.svelte';
  import type { ProfileState } from './profile-state.svelte';

  interface Props {
    profile: ProfileState;
    game: GameState;
    links: PhotoLinksCache;
    /** Extra actions for your own profile (rules, logout). */
    footer?: Snippet;
    /** Back arrow, for other players' profiles. */
    onback?: () => void;
  }

  let { profile, game, links, footer, onback }: Props = $props();

  let editingBio = $state<string | null>(null);
  let busy = $state(false);
  let viewing = $state<ProfilePhoto | null>(null);

  const data = $derived(profile.profile);
  const stats = $derived(game.participants.find((p) => p.player.id === profile.playerId));
  const rank = $derived(game.rankOf(profile.playerId));
  const photos = $derived(data ? photosOf(data) : []);

  onMount(() => {
    void profile.start();
    return () => profile.stop();
  });

  function report(error: WriteFailure | 'bio-too-long' | 'unreadable-photo') {
    const messages = {
      'bio-too-long': 'La bio è troppo lunga',
      'unreadable-photo': 'Non riesco a leggere questa foto: provane un’altra',
      rejected: 'Operazione non riuscita',
      unavailable: 'Connessione assente: riprova',
    } as const;
    if (error !== 'unauthorized') toasts.show(messages[error], 'error');
  }

  async function saveBio(bio: string) {
    busy = true;
    const result = await profile.saveBio(bio);
    busy = false;
    if (!result.ok) return report(result.error);
    editingBio = null;
    toasts.show('Bio aggiornata');
  }

  async function changeAvatar(file: File) {
    busy = true;
    const result = await profile.changeAvatar(file);
    busy = false;
    if (result.ok) toasts.show('Foto profilo aggiornata');
    else report(result.error);
  }

  async function removeAvatar() {
    busy = true;
    const result = await profile.removeAvatar();
    busy = false;
    if (!result.ok) report(result.error);
  }
</script>

<Screen withTabBar>
  {#if onback}
    <span class="back"><IconButton icon="arrowLeft" label="Indietro" onclick={onback} /></span>
  {/if}
  {#if profile.status === 'loading'}
    <Loader label="Carico il profilo…" />
  {:else if profile.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare il profilo">
      <Button variant="ghost" onclick={() => profile.start()}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else if !data}
    <EmptyState icon="user" title="Profilo non trovato">
      <p>Questo giocatore non partecipa più alla serata.</p>
    </EmptyState>
  {:else}
    <section class="hero" in:fly={{ y: 20, duration: duration('slow'), easing }}>
      <Avatar name={data.nickname} src={links.get(data.avatarId)?.thumbnailUrl} size="lg" />
      <h1>{data.nickname}</h1>
      <p class="real-name">{data.realName}</p>
      {#if profile.isMine}
        <div class="avatar-actions">
          <PhotoPickerButton size="small" variant="ghost" loading={busy} onpick={changeAvatar}>
            <Icon name="camera" size={16} /> {data.avatarId ? 'Cambia foto' : 'Aggiungi foto'}
          </PhotoPickerButton>
          {#if data.avatarId}
            <IconButton icon="trash" label="Togli la foto profilo" danger disabled={busy} onclick={removeAvatar} />
          {/if}
        </div>
      {/if}
    </section>

    <Surface>
      <dl class="stats">
        <div><dt>Punti</dt><dd>{stats?.points ?? 0}</dd></div>
        <div><dt>Posizione</dt><dd>{rank > 0 ? `${rank}°` : '—'}</dd></div>
        <div><dt>Azioni</dt><dd>{stats?.actionsDone ?? 0}</dd></div>
      </dl>
    </Surface>

    <Surface>
      <div class="bio">
        <div class="bio-head">
          <h2>Bio</h2>
          {#if profile.isMine}
            <IconButton icon="pencil" label="Modifica la bio" onclick={() => (editingBio = data.bio)} />
          {/if}
        </div>
        {#if data.bio}
          <p class="bio-text">{data.bio}</p>
        {:else}
          <p class="muted">{profile.isMine ? 'Scrivi qualcosa su di te: tocca la matita.' : 'Ancora nessuna bio.'}</p>
        {/if}
      </div>
    </Surface>

    <section class="section">
      <h2>Foto <span class="count">{photos.length}</span></h2>
      {#if photos.length === 0}
        <p class="muted">Ancora nessuna foto.</p>
      {:else}
        <ul class="grid">
          {#each photos as photo, index (photo.photoId)}
            <li in:fly={{ y: 12, duration: duration('base'), delay: stagger(index, 25), easing }}>
              <Thumbnail src={links.get(photo.photoId)?.thumbnailUrl ?? ''} alt={photo.caption || 'Foto'} onclick={() => (viewing = photo)} />
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="section">
      <h2>Azioni completate <span class="count">{data.completions.length}</span></h2>
      {#if data.completions.length === 0}
        <p class="muted">Ancora nessuna azione.</p>
      {:else}
        <ul class="actions">
          {#each data.completions as completion (completion.id)}
            <li>
              <Surface tone={completion.kind}>
                <div class="action">
                  <span class="action-text">
                    <span class="action-title">{completion.title}</span>
                    <span class="muted">alle {formatTime(completion.completedAt)}</span>
                  </span>
                  <PointsPill points={completion.points} />
                </div>
              </Surface>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if footer}
      <div class="footer">{@render footer()}</div>
    {/if}
  {/if}
</Screen>

<BioEditorDialog initial={editingBio} saving={busy} onsave={saveBio} onclose={() => (editingBio = null)} />

<Lightbox src={viewing ? (links.get(viewing.photoId)?.fullUrl ?? null) : null} alt={viewing?.caption ?? ''} onclose={() => (viewing = null)}>
  {#snippet caption()}
    {#if viewing}<p>{viewing.caption} · {formatTime(viewing.takenAt)}</p>{/if}
  {/snippet}
</Lightbox>

<style>
  .back {
    justify-self: start;
  }

  .hero {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    padding-top: var(--space-4);
    text-align: center;
  }

  h1 {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--weight-black);
    line-height: var(--leading-tight);
    background: var(--gradient-party);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    overflow-wrap: anywhere;
  }

  .real-name,
  .muted {
    color: var(--color-text-muted);
  }

  .avatar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    text-align: center;
  }

  dt {
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  dd {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--weight-black);
  }

  .bio {
    display: grid;
    gap: var(--space-2);
  }

  .bio-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .bio-text {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-md);
  }

  .count {
    color: var(--color-text-subtle);
  }

  .section {
    display: grid;
    gap: var(--space-3);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
    list-style: none;
  }

  .actions {
    display: grid;
    gap: var(--space-2);
    list-style: none;
  }

  .action {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .action-text {
    flex: 1;
    display: grid;
    min-width: 0;
    font-size: var(--text-sm);
  }

  .action-title {
    font-size: var(--text-md);
    font-weight: var(--weight-black);
  }

  .footer {
    display: grid;
    gap: var(--space-3);
  }
</style>
