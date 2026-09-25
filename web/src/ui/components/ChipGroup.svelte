<script lang="ts" generics="T">
  interface Option {
    value: T;
    label: string;
  }

  interface Props {
    options: readonly Option[];
    value: T;
    label: string;
    /** One line that scrolls sideways instead of wrapping: for filters above a list. */
    scroll?: boolean;
  }

  let { options, value = $bindable(), label, scroll = false }: Props = $props();
</script>

<!-- A single choice among many short options: wraps on narrow screens, unlike SegmentedControl. -->
<div class="chips" class:scroll role="radiogroup" aria-label={label}>
  {#each options as option (option.label)}
    <button
      type="button"
      class="chip"
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
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chips.scroll {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    /* Bleeds to the screen edges so the last chip visibly continues off screen. */
    margin: 0 calc(-1 * var(--space-4));
    padding: 0 var(--space-4);
  }

  .chips.scroll::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex: none;
    min-height: 38px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    transition:
      background var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .chip.active {
    background: var(--gradient-party);
    border-color: transparent;
    color: var(--color-on-accent);
  }
</style>
