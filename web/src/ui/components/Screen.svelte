<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Leaves room at the bottom for the floating tab bar. */
    withTabBar?: boolean;
    children: Snippet;
    footer?: Snippet;
  }

  let { withTabBar = false, children, footer }: Props = $props();
</script>

<main class="screen" class:with-tabbar={withTabBar} class:with-footer={!!footer}>
  {@render children()}
</main>
{#if footer}
  <div class="footer">{@render footer()}</div>
{/if}

<style>
  .screen {
    display: grid;
    align-content: start;
    gap: var(--space-6);
    width: min(100%, var(--content-max));
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(var(--space-7) + var(--safe-top)) var(--space-4) calc(var(--space-7) + var(--safe-bottom));
  }

  .with-tabbar {
    padding-bottom: calc(var(--tabbar-height) + var(--space-8) + var(--safe-bottom));
  }

  .with-footer {
    padding-bottom: calc(120px + var(--safe-bottom));
  }

  .footer {
    position: fixed;
    inset: auto 0 0;
    display: grid;
    justify-items: center;
    padding: var(--space-6) var(--space-4) calc(var(--space-4) + var(--safe-bottom));
    background: linear-gradient(to top, var(--color-bg) 45%, transparent);
  }

  .footer > :global(*) {
    width: min(100%, var(--content-max));
  }
</style>
