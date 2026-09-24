<script lang="ts">
  import Burst from './Burst.svelte';
  import Icon from './Icon.svelte';
  import type { Tone } from '../tone';

  interface Props {
    value: number;
    tone: Tone;
    label: string;
    onstep: (step: 1 | -1) => void;
  }

  let { value, tone, label, onstep }: Props = $props();

  const BURST_LIFETIME_MS = 700;
  let bursts = $state<number[]>([]);
  let nextBurst = 0;

  function increment() {
    onstep(1);
    const id = nextBurst++;
    bursts.push(id);
    setTimeout(() => (bursts = bursts.filter((burst) => burst !== id)), BURST_LIFETIME_MS);
  }
</script>

<div class="stepper" data-tone={tone} class:active={value > 0}>
  <button
    class="step"
    onclick={() => onstep(-1)}
    disabled={value === 0}
    aria-label="Togli una volta: {label}"
  >
    <Icon name="minus" size={20} />
  </button>
  <span class="value" aria-live="polite" aria-label="Fatta {value} volte">
    {#key value}
      <span class="digit">{value}</span>
    {/key}
  </span>
  <button class="step plus" onclick={increment} aria-label="Segna una volta: {label}">
    <Icon name="plus" size={20} />
    {#each bursts as id (id)}
      <Burst {tone} />
    {/each}
  </button>
</div>

<style>
  .stepper {
    --tone: var(--color-bonus);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    transition:
      border-color var(--duration-base) var(--ease-out),
      box-shadow var(--duration-base) var(--ease-out);
  }

  [data-tone='malus'] {
    --tone: var(--color-malus);
  }

  [data-tone='common'] {
    --tone: var(--color-common);
  }

  .active {
    border-color: color-mix(in srgb, var(--tone) 55%, transparent);
    box-shadow: 0 0 22px color-mix(in srgb, var(--tone) 25%, transparent);
  }

  .step {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--tap-size);
    height: var(--tap-size);
    border-radius: 50%;
    background: var(--color-surface-strong);
    transition:
      transform var(--duration-fast) var(--ease-spring),
      opacity var(--duration-base) var(--ease-out);
  }

  .step:active:not(:disabled) {
    transform: scale(0.86);
  }

  .step:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .plus {
    background: var(--tone);
    color: var(--color-on-accent);
  }

  .value {
    display: grid;
    place-items: center;
    min-width: 2ch;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: var(--weight-black);
    font-variant-numeric: tabular-nums;
  }

  .active .value {
    color: var(--tone);
  }

  .digit {
    grid-area: 1 / 1;
    animation: pop var(--duration-base) var(--ease-spring);
  }

  @keyframes pop {
    from {
      transform: scale(1.6);
      opacity: 0.4;
    }
  }
</style>
