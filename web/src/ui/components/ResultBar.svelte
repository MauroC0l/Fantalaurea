<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    label: string;
    /** 0-100 */
    share: number;
    count: number;
    mine?: boolean;
    /** Ahead of the others: stronger colour. */
    leading?: boolean;
  }

  let { label, share, count, mine = false, leading = false }: Props = $props();
</script>

<!-- One option of a poll with its result: the fill grows from the left. -->
<div class="bar" class:leading>
  <span class="fill" style:--share="{share}%"></span>
  <span class="label">
    {#if mine}<span class="mine" aria-label="Il tuo voto"><Icon name="check" size={14} /></span>{/if}
    {label}
  </span>
  <span class="numbers">{share}% <span class="count">· {count}</span></span>
</div>

<style>
  .bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 48px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--share);
    background: rgb(168 85 247 / 0.28);
    transition: width var(--duration-slow) var(--ease-out);
  }

  .leading .fill {
    background: linear-gradient(90deg, rgb(255 61 139 / 0.45), rgb(168 85 247 / 0.45));
  }

  .label,
  .numbers {
    position: relative;
  }

  .label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: var(--weight-bold);
  }

  .mine {
    display: grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--gradient-party);
    color: var(--color-on-accent);
  }

  .numbers {
    flex: none;
    font-weight: var(--weight-black);
    font-variant-numeric: tabular-nums;
  }

  .count {
    color: var(--color-text-subtle);
    font-weight: var(--weight-bold);
  }
</style>
