<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { duration, easing } from '../theme/motion';

  interface Props {
    eyebrow?: string;
    title: string;
    children?: Snippet;
  }

  let { eyebrow, title, children }: Props = $props();
</script>

<header in:fly={{ y: 16, duration: duration('slow'), easing }}>
  {#if eyebrow}
    <p class="eyebrow">{eyebrow}</p>
  {/if}
  <h1>{title}</h1>
  {#if children}
    <div class="extra">{@render children()}</div>
  {/if}
</header>

<style>
  header {
    display: grid;
    gap: var(--space-2);
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
