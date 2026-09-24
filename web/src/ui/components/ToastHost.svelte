<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { toasts } from './toasts.svelte';
  import { duration, easing } from '../theme/motion';
</script>

<div class="host" aria-live="assertive">
  {#each toasts.items as toast (toast.id)}
    <button
      class="toast"
      data-tone={toast.tone}
      onclick={() => toasts.dismiss(toast.id)}
      in:fly={{ y: -40, duration: duration('base'), easing }}
      out:fly={{ y: -20, duration: duration('fast') }}
      animate:flip={{ duration: duration('base') }}
    >
      <Icon name={toast.tone === 'error' ? 'alert' : 'sparkle'} size={20} />
      <span>{toast.message}</span>
    </button>
  {/each}
</div>

<style>
  .host {
    position: fixed;
    top: calc(var(--space-3) + var(--safe-top));
    left: 50%;
    z-index: var(--z-toast);
    display: grid;
    gap: var(--space-2);
    width: min(calc(100% - 2 * var(--space-4)), var(--content-max));
    transform: translateX(-50%);
    pointer-events: none;
  }

  .toast {
    --tone: var(--color-accent-3);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface-overlay);
    border: 1px solid color-mix(in srgb, var(--tone) 60%, transparent);
    box-shadow: var(--shadow-card);
    text-align: left;
    font-weight: var(--weight-bold);
    pointer-events: auto;
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
  }

  .toast :global(svg) {
    color: var(--tone);
  }

  [data-tone='error'] {
    --tone: var(--color-danger);
  }
</style>
