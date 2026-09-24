<script lang="ts" generics="T extends string">
  interface Option {
    value: T;
    label: string;
  }

  let { options, value = $bindable(), label }: { options: readonly Option[]; value: T; label: string } = $props();

  const activeIndex = $derived(Math.max(0, options.findIndex((option) => option.value === value)));
</script>

<div class="segmented" role="radiogroup" aria-label={label} style:--count={options.length} style:--index={activeIndex}>
  <span class="indicator" aria-hidden="true"></span>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      class:active={option.value === value}
      onclick={() => (value = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--count), 1fr);
    padding: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .indicator {
    position: absolute;
    inset: var(--space-1) auto var(--space-1) var(--space-1);
    width: calc((100% - 2 * var(--space-1)) / var(--count));
    border-radius: var(--radius-pill);
    background: var(--color-surface-strong);
    border: 1px solid var(--color-border-strong);
    transform: translateX(calc(100% * var(--index)));
    transition: transform var(--duration-base) var(--ease-spring);
  }

  button {
    position: relative;
    height: 40px;
    border-radius: var(--radius-pill);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    transition: color var(--duration-base) var(--ease-out);
  }

  button.active {
    color: var(--color-text);
  }
</style>
