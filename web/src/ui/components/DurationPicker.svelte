<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    /** Minutes. */
    value: number;
    /** Minutes, inclusive. */
    min?: number;
    max: number;
    label: string;
  }

  let { value = $bindable(), min = 5, max, label }: Props = $props();

  const MINUTE_STEP = 5;

  const hours = $derived(Math.floor(value / 60));
  const minutes = $derived(value % 60);
  const summary = $derived(
    [hours > 0 ? `${hours} h` : '', minutes > 0 ? `${minutes} min` : ''].filter(Boolean).join(' ') || '0 min',
  );

  function set(next: number) {
    value = Math.min(max, Math.max(min, next));
  }
</script>

<!-- Our own duration control: hours and minutes, each with − and +. No system time picker. -->
<div class="picker" role="group" aria-label={label}>
  <p class="summary" aria-live="polite">{summary}</p>
  <div class="wheels">
    {#each [{ unit: 'ore', amount: hours, step: 60 }, { unit: 'minuti', amount: minutes, step: MINUTE_STEP }] as wheel (wheel.unit)}
      <div class="wheel">
        <button
          type="button"
          class="step"
          aria-label="Togli {wheel.step === 60 ? 'un’ora' : `${MINUTE_STEP} minuti`}"
          disabled={value - wheel.step < min}
          onclick={() => set(value - wheel.step)}
        >
          <Icon name="minus" size={18} />
        </button>
        <span class="amount" role="spinbutton" aria-valuenow={wheel.amount} aria-label={wheel.unit}>
          <span class="number">{String(wheel.amount).padStart(2, '0')}</span>
          <span class="unit">{wheel.unit}</span>
        </span>
        <button
          type="button"
          class="step"
          aria-label="Aggiungi {wheel.step === 60 ? 'un’ora' : `${MINUTE_STEP} minuti`}"
          disabled={value + wheel.step > max}
          onclick={() => set(value + wheel.step)}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .picker {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .summary {
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: var(--weight-black);
    text-align: center;
  }

  .wheels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .wheel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .step {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-surface-strong);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    transition: transform var(--duration-fast) var(--ease-spring);
  }

  .step:active:not(:disabled) {
    transform: scale(0.88);
  }

  .step:disabled {
    opacity: 0.35;
  }

  .amount {
    display: grid;
    justify-items: center;
  }

  .number {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--weight-black);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .unit {
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
