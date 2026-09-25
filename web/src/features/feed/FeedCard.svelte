<script lang="ts">
  import type { PhotoLinks } from '../../application/ports';
  import type { FeedItem } from '../../domain/feed';
  import { hrefTo } from '../routes';
  import Avatar from '../../ui/components/Avatar.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import LikeButton from '../../ui/components/LikeButton.svelte';
  import PhotoFrame from '../../ui/components/PhotoFrame.svelte';
  import PointsPill from '../../ui/components/PointsPill.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import { formatRelative } from '../labels';

  interface Props {
    item: FeedItem;
    avatar: PhotoLinks | undefined;
    photo: PhotoLinks | undefined;
    mine: boolean;
    now: Date;
    ontogglelike: () => void;
    onlike: () => void;
    onshowlikers: () => void;
    onopenphoto: () => void;
    ondelete: () => void;
  }

  let { item, avatar, photo, mine, now, ontogglelike, onlike, onshowlikers, onopenphoto, ondelete }: Props = $props();

  const VERBS = { bonus: 'ha completato', malus: 'si è preso un malus:', common: 'ha segnato per tutti:' } as const;
</script>

<Surface tone={item.kind === 'completion' ? item.action.kind : undefined} highlighted={item.kind === 'completion'}>
  <article class="card">
    <header class="author">
      <a class="who" href={hrefTo({ name: 'giocatore', id: item.author.id })}>
        <Avatar name={item.author.nickname} src={avatar?.thumbnailUrl} size="sm" />
        <span class="names">
          <span class="nickname">{item.author.nickname}</span>
          <span class="when">{formatRelative(item.createdAt, now)}</span>
        </span>
      </a>
      {#if mine && item.kind === 'post'}
        <IconButton icon="trash" label="Elimina il post" danger onclick={ondelete} />
      {/if}
    </header>

    {#if item.kind === 'completion'}
      <p class="event">
        {item.timed ? 'ha vinto la sfida a tempo' : VERBS[item.action.kind]}
        <strong>{item.action.title}</strong>
        <PointsPill points={item.action.points} />
      </p>
    {/if}

    {#if item.photoId}
      <PhotoFrame
        src={photo?.thumbnailUrl}
        alt={item.kind === 'post' ? `Foto di ${item.author.nickname}` : `${item.action.title}, di ${item.author.nickname}`}
        ondoubletap={onlike}
        onopen={onopenphoto}
      />
    {/if}

    {#if item.kind === 'post' && item.caption}
      <p class="caption"><strong>{item.author.nickname}</strong> {item.caption}</p>
    {/if}

    <LikeButton liked={item.likes.likedByMe} count={item.likes.count} ontoggle={ontogglelike} {onshowlikers} />
  </article>
</Surface>

<style>
  .card {
    display: grid;
    gap: var(--space-3);
  }

  .author {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .who {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .names {
    display: grid;
    min-width: 0;
  }

  .nickname {
    font-weight: var(--weight-black);
    overflow-wrap: anywhere;
  }

  .when {
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
  }

  .event {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
  }

  .event strong {
    color: var(--color-text);
  }

  .caption {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
</style>
