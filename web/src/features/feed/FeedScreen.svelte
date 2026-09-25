<script lang="ts">
  import { onDestroy } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import type { Haptics, WriteFailure } from '../../application/ports';
  import type { PublishError } from '../../application/social';
  import type { FeedItem, Liker } from '../../domain/feed';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Lightbox from '../../ui/components/Lightbox.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import PhotoPickerButton from '../../ui/components/PhotoPickerButton.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing } from '../../ui/theme/motion';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import FeedCard from './FeedCard.svelte';
  import type { FeedState } from './feed-state.svelte';
  import LikersDialog from './LikersDialog.svelte';
  import PostComposerDialog from './PostComposerDialog.svelte';

  interface Props {
    feed: FeedState;
    links: PhotoLinksCache;
    haptics: Haptics;
  }

  let { feed, links, haptics }: Props = $props();

  type OpenDialog =
    | { kind: 'none' }
    | { kind: 'compose'; file: File }
    | { kind: 'likers'; likers: readonly Liker[] | 'loading' }
    | { kind: 'photo'; item: FeedItem }
    | { kind: 'delete'; item: FeedItem };

  let dialog = $state<OpenDialog>({ kind: 'none' });
  let publishing = $state(false);
  let now = $state(new Date());
  let sentinel = $state<HTMLElement>();

  const close = () => (dialog = { kind: 'none' });

  const PUBLISH_ERRORS: Record<Exclude<PublishError, 'unauthorized'>, string> = {
    unavailable: 'Connessione assente: riprova',
    rejected: 'Post non valido',
    'caption-too-long': 'La didascalia è troppo lunga',
    disabled: 'La bacheca è stata spenta dall’admin',
    'unreadable-photo': 'Non riesco a leggere questa foto: provane un’altra',
  };

  // Keeps "5 min fa" accurate without reloading.
  const clock = setInterval(() => (now = new Date()), 60_000);
  onDestroy(() => clearInterval(clock));

  // Loads the next page before the end of the list comes into view.
  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void feed.loadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  async function publish(caption: string) {
    if (dialog.kind !== 'compose') return;
    publishing = true;
    const result = await feed.publish(dialog.file, caption);
    publishing = false;
    if (!result.ok) {
      if (result.error !== 'unauthorized') toasts.show(PUBLISH_ERRORS[result.error], 'error');
      return;
    }
    close();
    haptics.pulse('success');
    toasts.show('Post pubblicato!');
  }

  async function showLikers(item: FeedItem) {
    dialog = { kind: 'likers', likers: 'loading' };
    try {
      const likers = await feed.likers(item);
      if (dialog.kind === 'likers') dialog = { kind: 'likers', likers };
    } catch {
      close();
      toasts.show('Non riesco a caricare i like', 'error');
    }
  }

  async function toggleLike(item: FeedItem) {
    haptics.pulse('tap');
    const result = await feed.toggleLike(item);
    if (!result.ok) report(result.error);
  }

  async function deletePost(item: FeedItem) {
    const result = await feed.deletePost(item);
    close();
    if (result.ok) toasts.show('Post eliminato');
    else report(result.error);
  }

  function report(error: WriteFailure) {
    if (error !== 'unauthorized') toasts.show('Operazione non riuscita: riprova', 'error');
  }
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Fantalaurea" title="Bacheca">
    <p>Foto e imprese della serata, in diretta.</p>
    {#snippet trailing()}
      <PhotoPickerButton size="small" onpick={(file) => (dialog = { kind: 'compose', file })}>
        <Icon name="camera" size={18} /> Posta
      </PhotoPickerButton>
    {/snippet}
  </ScreenHeader>

  {#if feed.status === 'loading'}
    <Loader label="Carico la bacheca…" />
  {:else if feed.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare la bacheca">
      <Button variant="ghost" onclick={() => feed.start()}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else if feed.items.length === 0}
    <EmptyState icon="party" title="La festa sta iniziando">
      <p>Pubblica la prima foto o completa un'azione: comparirà qui.</p>
    </EmptyState>
  {:else}
    <ul class="list">
      {#each feed.items as item (item.id)}
        <li animate:flip={{ duration: duration('base') }} in:fly={{ y: -24, duration: duration('base'), easing }}>
          <FeedCard
            {item}
            {now}
            avatar={links.get(item.author.avatarId)}
            photo={links.get(item.photoId)}
            mine={item.author.id === feed.session.player.id}
            ontogglelike={() => toggleLike(item)}
            onlike={() => {
              haptics.pulse('tap');
              void feed.like(item);
            }}
            onshowlikers={() => showLikers(item)}
            onopenphoto={() => (dialog = { kind: 'photo', item })}
            ondelete={() => (dialog = { kind: 'delete', item })}
          />
        </li>
      {/each}
    </ul>
    <div bind:this={sentinel} class="sentinel">
      {#if feed.loadingMore}
        <Loader label="Altre foto…" />
      {:else if !feed.hasMore}
        <p class="end">Hai visto tutto. Ora torna a fare baldoria.</p>
      {/if}
    </div>
  {/if}
</Screen>

<PostComposerDialog
  file={dialog.kind === 'compose' ? dialog.file : null}
  {publishing}
  onpublish={publish}
  onrepick={(file) => (dialog = { kind: 'compose', file })}
  onclose={close}
/>

<LikersDialog likers={dialog.kind === 'likers' ? dialog.likers : null} {links} onclose={close} />

<Lightbox
  src={dialog.kind === 'photo' ? (links.get(dialog.item.photoId)?.fullUrl ?? null) : null}
  alt={dialog.kind === 'photo' ? `Foto di ${dialog.item.author.nickname}` : ''}
  onclose={close}
>
  {#snippet caption()}
    {#if dialog.kind === 'photo'}
      <p><strong>{dialog.item.author.nickname}</strong>
        {dialog.item.kind === 'post' ? dialog.item.caption : dialog.item.action.title}</p>
    {/if}
  {/snippet}
</Lightbox>

{#snippet deleteActions()}
  {#if dialog.kind === 'delete'}
    {@const item = dialog.item}
    <Button variant="danger" block onclick={() => deletePost(item)}>Elimina</Button>
  {/if}
  <Button variant="ghost" block onclick={close}>Annulla</Button>
{/snippet}

<Dialog open={dialog.kind === 'delete'} title="Eliminare il post?" onclose={close} actions={deleteActions}>
  <p>La foto e i like spariscono per tutti.</p>
</Dialog>

<style>
  .list {
    display: grid;
    gap: var(--space-4);
    list-style: none;
  }

  .sentinel {
    min-height: 1px;
  }

  .end {
    padding: var(--space-4) 0;
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
    text-align: center;
  }
</style>
