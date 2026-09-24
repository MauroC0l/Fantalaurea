<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLButtonAttributes, 'class'> {
    variant?: 'primary' | 'ghost';
    loading?: boolean;
    block?: boolean;
    children: Snippet;
  }

  let { variant = 'primary', loading = false, block = false, disabled, children, ...rest }: Props = $props();
</script>

<button
  {...rest}
  class="button"
  class:block
  data-variant={variant}
  disabled={disabled || loading}
  aria-busy={loading}
>
  <span class="content" class:hidden={loading}>{@render children()}</span>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {/if}
</button>

<style>
  .button {
    position: relative;
    display: inline-grid;
    place-items: center;
    min-height: 56px;
    padding: 0 var(--space-6);
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: var(--weight-bold);
    letter-spacing: 0.01em;
    overflow: hidden;
    transition:
      transform var(--duration-fast) var(--ease-out),
      opacity var(--duration-base) var(--ease-out),
      box-shadow var(--duration-base) var(--ease-out);
  }

  .button:active:not(:disabled) {
    transform: scale(0.96);
  }

  .button:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .block {
    display: grid;
    width: 100%;
  }

  [data-variant='primary'] {
    background: var(--gradient-party);
    background-size: 200% 100%;
    color: var(--color-on-accent);
    box-shadow: var(--shadow-glow);
    animation: shimmer 6s var(--ease-out) infinite alternate;
  }

  [data-variant='ghost'] {
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    color: var(--color-text);
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
  }

  .content {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .hidden {
    visibility: hidden;
  }

  .spinner {
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 3px solid currentColor;
    border-right-color: transparent;
    animation: spin 700ms linear infinite;
  }

  @keyframes shimmer {
    from {
      background-position: 0% 50%;
    }
    to {
      background-position: 100% 50%;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
</style>
