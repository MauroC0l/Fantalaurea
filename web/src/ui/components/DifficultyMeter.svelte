<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    /** 1 to 3 flames. */
    level: 1 | 2 | 3;
    label: string;
  }

  let { level, label }: Props = $props();
</script>

<span class="meter" data-level={level} role="img" aria-label="Difficoltà: {label}" title={label}>
  {#each [1, 2, 3] as flame (flame)}
    <span class="flame" class:lit={flame <= level}><Icon name="flame" size={14} /></span>
  {/each}
</span>

<style>
  .meter {
    --heat: var(--color-bonus);
    display: inline-flex;
    gap: 1px;
  }

  [data-level='2'] {
    --heat: var(--color-common);
  }

  [data-level='3'] {
    --heat: var(--color-accent-1);
  }

  .flame {
    color: var(--color-border-strong);
  }

  .lit {
    color: var(--heat);
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--heat) 60%, transparent));
  }
</style>
