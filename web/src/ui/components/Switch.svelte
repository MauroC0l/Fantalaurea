<script lang="ts">
  interface Props {
    checked: boolean;
    label: string;
    description?: string;
    disabled?: boolean;
    onchange: (checked: boolean) => void;
  }

  let { checked, label, description, disabled = false, onchange }: Props = $props();
</script>

<button class="row" role="switch" aria-checked={checked} {disabled} onclick={() => onchange(!checked)}>
  <span class="text">
    <span class="label">{label}</span>
    {#if description}<span class="description">{description}</span>{/if}
  </span>
  <span class="track" class:on={checked} aria-hidden="true"><span class="thumb"></span></span>
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    min-height: var(--tap-size);
    text-align: left;
  }

  .row:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .text {
    flex: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .label {
    font-weight: var(--weight-black);
  }

  .description {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .track {
    position: relative;
    flex: none;
    width: 52px;
    height: 32px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-strong);
    border: 1px solid var(--color-border-strong);
    transition: background var(--duration-base) var(--ease-out);
  }

  .track.on {
    background: var(--gradient-party);
    border-color: transparent;
    box-shadow: var(--shadow-glow);
  }

  .thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-text);
    transition: transform var(--duration-base) var(--ease-spring);
  }

  .on .thumb {
    transform: translateX(20px);
  }
</style>
