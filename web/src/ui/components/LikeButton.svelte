<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    liked: boolean;
    count: number;
    ontoggle: () => void;
    /** Opens the list of who liked it. */
    onshowlikers: () => void;
  }

  let { liked, count, ontoggle, onshowlikers }: Props = $props();
</script>

<span class="likes">
  <button class="heart" class:liked onclick={ontoggle} aria-pressed={liked} aria-label={liked ? 'Togli il mi piace' : 'Mi piace'}>
    {#key liked}
      <span class="icon"><Icon name="heart" size={24} filled={liked} /></span>
    {/key}
  </button>
  <button class="count" onclick={onshowlikers} disabled={count === 0}>
    {count === 0 ? 'Nessun like' : count === 1 ? 'Piace a 1 persona' : `Piace a ${count} persone`}
  </button>
</span>

<style>
  .likes {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .heart {
    display: grid;
    place-items: center;
    width: var(--tap-size);
    height: var(--tap-size);
    margin-left: calc(-1 * var(--space-2));
    color: var(--color-text);
  }

  .liked {
    color: var(--color-accent-1);
  }

  .icon {
    display: grid;
    animation: pop var(--duration-base) var(--ease-spring);
  }

  .count {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .count:disabled {
    cursor: default;
    color: var(--color-text-subtle);
  }

  @keyframes pop {
    from {
      transform: scale(0.6);
    }
  }
</style>
