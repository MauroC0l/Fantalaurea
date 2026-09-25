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
    /** With these, arrows, swipes and arrow keys move between photos. */
    onprevious?: () => void;
    onnext?: () => void;
    /** e.g. "3 di 12". */
    position?: string;
  }

  let { src, alt, onclose, caption, actions, onprevious, onnext, position }: Props = $props();

  const SWIPE_MIN_PX = 50;

  let loaded = $state(false);
  let swipeStartX: number | null = null;

  $effect(() => {
    if (!src) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onclose();
      if (event.key === 'ArrowLeft') onprevious?.();
      if (event.key === 'ArrowRight') onnext?.();
    };
    addEventListener('keydown', onKey);
    document.body.classList.add('scroll-locked');
    return () => {
      removeEventListener('keydown', onKey);
      document.body.classList.remove('scroll-locked');
    };
  });

  $effect(() => {
    void src;
    loaded = false;
  });

  function endSwipe(event: PointerEvent) {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    swipeStartX = null;
    if (distance > SWIPE_MIN_PX) onprevious?.();
    if (distance < -SWIPE_MIN_PX) onnext?.();
  }
</script>

{#if src}
  <div class="lightbox" role="dialog" aria-modal="true" aria-label={alt} transition:fade={{ duration: duration('base') }}>
    <div class="top">
      <span class="position">{position ?? ''}</span>
      <IconButton icon="close" label="Chiudi" onclick={onclose} />
    </div>

    <div
      class="stage"
      role="presentation"
      onpointerdown={(event) => (swipeStartX = event.clientX)}
      onpointerup={endSwipe}
      onpointercancel={() => (swipeStartX = null)}
    >
      {#if !loaded}<span class="spinner" aria-hidden="true"></span>{/if}
      {#key src}
        <img {src} {alt} draggable="false" onload={() => (loaded = true)} class:loaded in:scale={{ start: 0.94, duration: duration('base'), easing }} />
      {/key}
      {#if onprevious}
        <span class="nav previous"><IconButton icon="chevronLeft" label="Foto precedente" onclick={onprevious} /></span>
      {/if}
      {#if onnext}
        <span class="nav next"><IconButton icon="chevronRight" label="Foto successiva" onclick={onnext} /></span>
      {/if}
    </div>

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
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--space-3) + var(--safe-top)) var(--space-4) var(--space-3);
  }

  .position {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
  }

  .stage {
    position: relative;
    min-height: 0;
    touch-action: pan-y;
    user-select: none;
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

  .nav {
    position: absolute;
    top: 50%;
    translate: 0 -50%;
    opacity: 0.85;
  }

  .previous {
    left: var(--space-2);
  }

  .next {
    right: var(--space-2);
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
