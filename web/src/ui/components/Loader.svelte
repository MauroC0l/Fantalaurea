<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<div class="loader" role="status">
  <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
  <span class="label">{label}</span>
</div>

<style>
  .loader {
    display: grid;
    justify-items: center;
    gap: var(--space-4);
    padding: var(--space-8) 0;
    color: var(--color-text-muted);
  }

  .dots {
    display: flex;
    gap: var(--space-2);
  }

  i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--gradient-party);
    animation: bounce 900ms var(--ease-out) infinite;
  }

  i:nth-child(2) {
    animation-delay: 120ms;
  }

  i:nth-child(3) {
    animation-delay: 240ms;
  }

  @keyframes bounce {
    50% {
      transform: translateY(-12px);
      opacity: 0.5;
    }
  }
</style>
