<script lang="ts">
  let { points }: { points: number } = $props();

  const sign = $derived(points > 0 ? '+' : points < 0 ? '−' : '');
</script>

<span class="pill" class:negative={points < 0} aria-label="{points} punti">{sign}{Math.abs(points)}</span>

<style>
  .pill {
    --tone: var(--color-bonus);
    display: inline-grid;
    place-items: center;
    min-width: 44px;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--tone) 16%, transparent);
    color: var(--tone);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .negative {
    --tone: var(--color-malus);
  }
</style>
