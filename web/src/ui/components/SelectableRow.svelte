<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  interface Props {
    selected: boolean;
    disabled?: boolean;
    onclick: () => void;
    children: Snippet;
  }

  let { selected, disabled = false, onclick, children }: Props = $props();
</script>

<!-- A row of a multiple choice (e.g. "Inoltra a…"): our own round check, no system checkbox. -->
<button class="row" class:selected {disabled} role="checkbox" aria-checked={selected} {onclick}>
  <span class="content">{@render children()}</span>
  <span class="check" aria-hidden="true">
    {#if selected}<Icon name="check" size={14} />{/if}
  </span>
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 56px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    color: var(--color-text);
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .row.selected {
    background: var(--color-surface-strong);
  }

  .row:disabled {
    opacity: 0.45;
  }

  .content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .check {
    display: grid;
    place-items: center;
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--color-border-strong);
    color: var(--color-on-accent);
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .selected .check {
    background: var(--gradient-party);
    border-color: transparent;
  }
</style>
