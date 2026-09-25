<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<!-- Between messages of different days: "Oggi", "Ieri", "ven 25 set". -->
<div class="divider"><span>{label}</span></div>

<style>
  .divider {
    display: flex;
    justify-content: center;
    margin: var(--space-4) 0 var(--space-1);
  }

  span {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--color-surface-bar);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
  }
</style>
