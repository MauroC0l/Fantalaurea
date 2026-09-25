<script lang="ts">
  import type { Liker } from '../../domain/feed';
  import { hrefTo } from '../routes';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';

  interface Props {
    likers: readonly Liker[] | 'loading' | null;
    links: PhotoLinksCache;
    onclose: () => void;
  }

  let { likers, links, onclose }: Props = $props();
</script>

{#snippet actions()}
  <Button block variant="ghost" onclick={onclose}>Chiudi</Button>
{/snippet}

<Dialog open={likers !== null} title="Mi piace" {onclose} {actions}>
  {#if likers === 'loading'}
    <Loader label="Chi ha messo like…" />
  {:else if likers}
    <ul class="list">
      {#each likers as liker (liker.id)}
        <li>
          <a class="row" href={hrefTo({ name: 'giocatore', id: liker.id })} onclick={onclose}>
            <Avatar name={liker.nickname} src={links.get(liker.avatarId)?.thumbnailUrl} size="sm" />
            <span>{liker.nickname}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Dialog>

<style>
  .list {
    display: grid;
    gap: var(--space-2);
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-size);
    color: var(--color-text);
    font-weight: var(--weight-bold);
  }
</style>
