<script lang="ts">
  import Burst from './Burst.svelte';
  import { celebrations } from './celebrations.svelte';
</script>

<div class="host" aria-hidden="true">
  {#each celebrations.items as item (item.id)}
    <span class="spot"><Burst tone={item.tone} spread={2.6} /></span>
  {/each}
</div>

<style>
  .host {
    position: fixed;
    inset: 0;
    z-index: var(--z-burst);
    pointer-events: none;
  }

  .spot {
    position: absolute;
    left: 50%;
    top: 45%;
  }
</style>
