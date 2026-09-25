<script lang="ts">
  import Avatar from './Avatar.svelte';

  interface Props {
    people: readonly { id: string; nickname: string; src: string | undefined }[];
    /** How many faces before "+N". */
    max?: number;
    onclick?: () => void;
    label: string;
  }

  let { people, max = 5, onclick, label }: Props = $props();

  const shown = $derived(people.slice(0, max));
  const more = $derived(people.length - shown.length);
</script>

<!-- Overlapping faces, e.g. who voted an option; tapping shows the full list. -->
<button class="stack" {onclick} disabled={!onclick} aria-label={label}>
  {#each shown as person (person.id)}
    <span class="face"><Avatar name={person.nickname} src={person.src} size="sm" /></span>
  {/each}
  {#if more > 0}<span class="more">+{more}</span>{/if}
</button>

<style>
  .stack {
    display: inline-flex;
    align-items: center;
    padding-left: 8px;
  }

  .face {
    margin-left: -8px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--color-bg-elevated);
  }

  .more {
    margin-left: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
  }
</style>
