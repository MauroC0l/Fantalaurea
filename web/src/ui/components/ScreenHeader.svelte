<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { duration, easing } from '../theme/motion';

  interface Props {
    eyebrow?: string;
    title: string;
    children?: Snippet;
    /** Shown top right, e.g. an IconButton. */
    trailing?: Snippet;
  }

  let { eyebrow, title, children, trailing }: Props = $props();
</script>

<header in:fly={{ y: 16, duration: duration('slow'), easing }}>
  <div class="text">
    {#if eyebrow}
      <p class="eyebrow">{eyebrow}</p>
    {/if}
    <h1>{title}</h1>
    {#if children}
      <div class="extra">{@render children()}</div>
    {/if}
  </div>
  {#if trailing}
    {@render trailing()}
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .text {
    flex: 1;
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .eyebrow {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--weight-black);
    line-height: var(--leading-tight);
    background: var(--gradient-party);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    overflow-wrap: anywhere;
  }

  .extra {
    color: var(--color-text-muted);
  }
</style>
