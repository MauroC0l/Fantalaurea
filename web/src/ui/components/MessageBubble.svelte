<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    mine: boolean;
    time: string;
    /** Photos sit edge to edge in the bubble. */
    media?: boolean;
    onselect?: () => void;
    children: Snippet;
  }

  let { mine, time, media = false, onselect, children }: Props = $props();
</script>

<div class="line" class:mine>
  <button class="bubble" class:mine class:media onclick={onselect} disabled={!onselect}>
    <span class="content">{@render children()}</span>
    <span class="time">{time}</span>
  </button>
</div>

<style>
  .line {
    display: flex;
    justify-content: flex-start;
  }

  .line.mine {
    justify-content: flex-end;
  }

  .bubble {
    display: grid;
    gap: var(--space-1);
    max-width: min(80%, 420px);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md) var(--radius-md) var(--radius-md) var(--space-1);
    background: var(--color-surface-strong);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    text-align: left;
    cursor: default;
  }

  .bubble.mine {
    border-radius: var(--radius-md) var(--radius-md) var(--space-1) var(--radius-md);
    background: var(--gradient-party);
    border-color: transparent;
    color: var(--color-on-accent);
    cursor: pointer;
  }

  .bubble.media {
    padding: var(--space-1);
  }

  .content {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .time {
    justify-self: end;
    font-size: var(--text-xs);
    opacity: 0.7;
    padding: 0 var(--space-1);
  }
</style>
