<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from '../tone';

  interface Props {
    tone?: Tone;
    highlighted?: boolean;
    children: Snippet;
  }

  let { tone, highlighted = false, children }: Props = $props();
</script>

<div class="surface" data-tone={tone} class:highlighted>
  {@render children()}
</div>

<style>
  .surface {
    --tone: var(--color-border-strong);
    position: relative;
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
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

  .highlighted {
    border-color: color-mix(in srgb, var(--tone) 50%, transparent);
    background:
      radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--tone) 18%, transparent), transparent 60%),
      var(--color-surface);
  }
</style>
