<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { duration, easing } from '../theme/motion';

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  let { open, title, onclose, children, actions }: Props = $props();

  const titleId = $props.id();
  let panel = $state<HTMLElement>();

  $effect(() => {
    if (!open || !panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onclose();
    addEventListener('keydown', closeOnEscape);
    document.body.classList.add('scroll-locked');
    return () => {
      removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('scroll-locked');
      previousFocus?.focus();
    };
  });
</script>

{#if open}
  <div class="backdrop" onclick={onclose} aria-hidden="true" transition:fade={{ duration: duration('base') }}></div>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    bind:this={panel}
    transition:fly={{ y: 320, duration: duration('slow'), easing }}
  >
    <span class="grabber" aria-hidden="true"></span>
    <h2 id={titleId}>{title}</h2>
    <div class="body">{@render children()}</div>
    {#if actions}
      <div class="actions">{@render actions()}</div>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-dialog);
    background: var(--color-backdrop);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    z-index: var(--z-dialog);
    display: grid;
    gap: var(--space-4);
    width: min(100%, var(--content-max));
    max-height: 90dvh;
    overflow-y: auto;
    padding: var(--space-3) var(--space-5) calc(var(--space-6) + var(--safe-bottom));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-strong);
    border-bottom: none;
    box-shadow: var(--shadow-card);
    translate: -50% 0;
    outline: none;
  }

  .grabber {
    justify-self: center;
    width: 40px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--color-border-strong);
  }

  h2 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
  }

  .body {
    display: grid;
    gap: var(--space-4);
    color: var(--color-text-muted);
  }

  .actions {
    display: grid;
    gap: var(--space-3);
  }

  :global(body.scroll-locked) {
    overflow: hidden;
  }
</style>
