<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    onback: () => void;
    children?: Snippet;
  }

  let { onback, children }: Props = $props();
</script>

<!-- Stays at the top while the page scrolls underneath (e.g. a chat). -->
<header class="bar">
  <IconButton icon="arrowLeft" label="Indietro" onclick={onback} />
  {#if children}<div class="content">{@render children()}</div>{/if}
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: var(--z-tabbar);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: calc(-1 * var(--space-7) - var(--safe-top)) calc(-1 * var(--space-4)) 0;
    padding: calc(var(--space-3) + var(--safe-top)) var(--space-4) var(--space-3);
    background: var(--color-surface-bar);
    border-bottom: 1px solid var(--color-border);
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
  }

  .content {
    flex: 1;
    min-width: 0;
  }
</style>
