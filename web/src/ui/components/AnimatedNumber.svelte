<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { duration, easing } from '../theme/motion';

  let { value }: { value: number } = $props();

  const tween = Tween.of(() => value, { duration: duration('slow'), easing });
</script>

<span class="number">{Math.round(tween.current)}</span>

<style>
  .number {
    font-variant-numeric: tabular-nums;
  }
</style>
