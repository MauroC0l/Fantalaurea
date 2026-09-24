<script lang="ts">
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import type { Tone } from '../tone';
  import { duration, easing } from '../theme/motion';

  interface Props {
    open?: boolean;
    tone?: Tone;
    summary: Snippet;
    children: Snippet;
  }

  let { open = $bindable(false), tone, summary, children }: Props = $props();

  const panelId = $props.id();
</script>

<div class="disclosure" class:open data-tone={tone}>
  <button class="summary" aria-expanded={open} aria-controls={panelId} onclick={() => (open = !open)}>
    <span class="summary-content">{@render summary()}</span>
    <span class="chevron"><Icon name="chevronDown" size={20} /></span>
  </button>
  {#if open}
    <div class="panel" id={panelId} transition:slide={{ duration: duration('base'), easing }}>
      <div class="panel-content">{@render children()}</div>
    </div>
  {/if}
</div>

<style>
  .disclosure {
    --tone: var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
    transition: border-color var(--duration-base) var(--ease-out);
  }

  [data-tone='bonus'] {
    --tone: var(--color-bonus);
  }

  [data-tone='malus'] {
    --tone: var(--color-malus);
  }

  [data-tone='common'] {
    --tone: var(--color-common);
  }

  .open {
    border-color: color-mix(in srgb, var(--tone) 55%, transparent);
  }

  .summary {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 64px;
    padding: var(--space-3) var(--space-4);
    text-align: left;
    border-radius: inherit;
    transition: transform var(--duration-fast) var(--ease-out);
  }

  .summary:active {
    transform: scale(0.985);
  }

  .summary-content {
    flex: 1;
    min-width: 0;
  }

  .chevron {
    color: var(--color-text-muted);
    transition: transform var(--duration-base) var(--ease-spring);
  }

  .open .chevron {
    transform: rotate(180deg);
  }

  .panel-content {
    display: grid;
    gap: var(--space-4);
    padding: 0 var(--space-4) var(--space-4);
  }
</style>
