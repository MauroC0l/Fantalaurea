<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from '../icons';

  let { icon, title, children }: { icon: IconName; title: string; children?: Snippet } = $props();
</script>

<div class="empty">
  <span class="icon"><Icon name={icon} size={32} /></span>
  <h2>{title}</h2>
  {#if children}
    <div class="body">{@render children()}</div>
  {/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    padding: var(--space-8) var(--space-4);
    text-align: center;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--color-surface-strong);
    color: var(--color-accent-3);
    animation: float 3s var(--ease-out) infinite alternate;
  }

  h2 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }

  .body {
    display: grid;
    gap: var(--space-4);
    justify-items: center;
    color: var(--color-text-muted);
  }

  @keyframes float {
    to {
      transform: translateY(-8px);
    }
  }
</style>
