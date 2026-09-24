<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import IconButton from './IconButton.svelte';
  import { duration, easing } from '../theme/motion';

  interface Props {
    src: string | null;
    alt: string;
    onclose: () => void;
    caption?: Snippet;
    actions?: Snippet;
  }

  let { src, alt, onclose, caption, actions }: Props = $props();

  let loaded = $state(false);

  $effect(() => {
    if (!src) return;
    loaded = false;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onclose();
    addEventListener('keydown', closeOnEscape);
    document.body.classList.add('scroll-locked');
    return () => {
      removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('scroll-locked');
    };
  });
</script>

{#if src}
  <div class="lightbox" role="dialog" aria-modal="true" aria-label={alt} transition:fade={{ duration: duration('base') }}>
    <div class="top">
      <IconButton icon="close" label="Chiudi" onclick={onclose} />
    </div>
    <button class="stage" onclick={onclose} aria-label="Chiudi">
      {#if !loaded}<span class="spinner" aria-hidden="true"></span>{/if}
      <img {src} {alt} onload={() => (loaded = true)} class:loaded in:scale={{ start: 0.92, duration: duration('slow'), easing }} />
    </button>
    {#if caption || actions}
      <div class="bottom">
        {#if caption}<div class="caption">{@render caption()}</div>{/if}
        {#if actions}<div class="actions">{@render actions()}</div>{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: var(--z-dialog);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: 100dvh;
    background: var(--color-bg);
  }

  .top {
    display: flex;
    justify-content: flex-end;
    padding: calc(var(--space-3) + var(--safe-top)) var(--space-4) var(--space-3);
  }

  .stage {
    position: relative;
    min-height: 0;
    cursor: zoom-out;
  }

  img {
    position: absolute;
    inset: 0;
    margin: auto;
    max-width: calc(100% - 2 * var(--space-2));
    max-height: 100%;
    object-fit: contain;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity var(--duration-base) var(--ease-out);
  }

  img.loaded {
    opacity: 1;
  }

  .spinner {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid var(--color-accent-2);
    border-right-color: transparent;
    animation: spin 700ms linear infinite;
  }

  .bottom {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) calc(var(--space-4) + var(--safe-bottom));
  }

  .caption {
    color: var(--color-text-muted);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .actions > :global(*) {
    flex: 1 1 40%;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
</style>
