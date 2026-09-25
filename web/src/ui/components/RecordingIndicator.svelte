<script lang="ts">
  let { elapsedMs, maxMs }: { elapsedMs: number; maxMs: number } = $props();

  const seconds = $derived(Math.floor(elapsedMs / 1000));
  const left = $derived(Math.max(0, Math.ceil((maxMs - elapsedMs) / 1000)));
</script>

<span class="recording" role="status">
  <span class="dot" aria-hidden="true"></span>
  <span class="time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
  <span class="left">{left <= 10 ? `ancora ${left} s` : 'Registrazione…'}</span>
</span>

<style>
  .recording {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-size);
    padding: 0 var(--space-4);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-danger) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 50%, transparent);
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-danger);
    animation: pulse 1s ease-in-out infinite;
  }

  .time {
    font-weight: var(--weight-black);
    font-variant-numeric: tabular-nums;
  }

  .left {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  @keyframes pulse {
    50% {
      opacity: 0.3;
      transform: scale(0.8);
    }
  }
</style>
