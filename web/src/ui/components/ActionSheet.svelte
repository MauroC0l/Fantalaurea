<script lang="ts" module>
  import type { IconName } from '../icons';

  export interface SheetItem {
    readonly icon: IconName;
    readonly label: string;
    readonly danger?: boolean;
    readonly onselect: () => void;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    open: boolean;
    title: string;
    items: readonly SheetItem[];
    onclose: () => void;
    /** Shown above the choices, e.g. the message the menu is about. */
    children?: Snippet;
  }

  let { open, title, items, onclose, children }: Props = $props();

  // Synchronous on purpose: some choices (camera, gallery) need the tap itself to open.
  function choose(item: SheetItem) {
    onclose();
    item.onselect();
  }
</script>

<Dialog {open} {title} {onclose}>
  {#if children}{@render children()}{/if}
  <ul class="items">
    {#each items as item (item.label)}
      <li>
        <button class="item" class:danger={item.danger} onclick={() => choose(item)}>
          <span class="icon"><Icon name={item.icon} size={20} /></span>
          {item.label}
        </button>
      </li>
    {/each}
  </ul>
</Dialog>

<style>
  .items {
    display: grid;
    list-style: none;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }

  li + li {
    border-top: 1px solid var(--color-border);
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 52px;
    padding: 0 var(--space-4);
    color: var(--color-text);
    font-weight: var(--weight-bold);
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .item:active,
  .item:hover {
    background: var(--color-surface-strong);
  }

  .icon {
    color: var(--color-text-muted);
  }

  .danger,
  .danger .icon {
    color: var(--color-danger);
  }
</style>
