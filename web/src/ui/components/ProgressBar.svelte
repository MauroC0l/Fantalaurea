<script lang="ts">
  let { value, max, label }: { value: number; max: number; label: string } = $props();

  const ratio = $derived(max === 0 ? 0 : Math.min(1, value / max));
</script>

<div class="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
  <span class="fill" style:--ratio={ratio}></span>
</div>

<style>
  .progress {
    height: 10px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-strong);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--gradient-party);
    box-shadow: var(--shadow-glow);
    transform: scaleX(var(--ratio));
    transform-origin: left;
    transition: transform var(--duration-slow) var(--ease-spring);
  }
</style>
