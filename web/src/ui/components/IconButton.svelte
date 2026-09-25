<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from './Icon.svelte';
  import type { IconName } from '../icons';

  interface Props extends Omit<HTMLButtonAttributes, 'class' | 'aria-label'> {
    icon: IconName;
    label: string;
    danger?: boolean;
    /** The main action of a bar, e.g. send: party gradient. */
    primary?: boolean;
  }

  let { icon, label, danger = false, primary = false, ...rest }: Props = $props();
</script>

<button {...rest} class="icon-button" class:danger class:primary aria-label={label} title={label}>
  <Icon name={icon} size={20} />
</button>

<style>
  .icon-button {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--tap-size);
    height: var(--tap-size);
    border-radius: 50%;
    background: var(--color-surface-strong);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    transition:
      transform var(--duration-fast) var(--ease-spring),
      color var(--duration-base) var(--ease-out);
  }

  .icon-button:active {
    transform: scale(0.88);
  }

  .primary {
    background: var(--gradient-party);
    border-color: transparent;
    color: var(--color-on-accent);
    box-shadow: var(--shadow-glow);
  }

  .icon-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .danger {
    color: var(--color-danger);
  }
</style>
