<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from '../tone';

  let { tone, children }: { tone: Tone | 'neutral'; children: Snippet } = $props();
</script>

<span class="badge" data-tone={tone}>{@render children()}</span>

<style>
  .badge {
    --tone: var(--color-text-muted);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--tone) 16%, transparent);
    color: var(--tone);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
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
</style>
