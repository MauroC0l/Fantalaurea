<script lang="ts" generics="T extends string">
  import Icon from './Icon.svelte';
  import type { IconName } from '../icons';

  interface Tab {
    id: T;
    label: string;
    icon: IconName;
    href: string;
    /** Unread items: shown as a small counter on the icon. */
    badge?: number;
  }

  let { tabs, active }: { tabs: readonly Tab[]; active: T } = $props();

  const activeIndex = $derived(Math.max(0, tabs.findIndex((tab) => tab.id === active)));
</script>

<nav class="tabbar" style:--count={tabs.length} style:--index={activeIndex}>
  <span class="indicator" aria-hidden="true"></span>
  {#each tabs as tab (tab.id)}
    <a href={tab.href} class="tab" class:active={tab.id === active} aria-current={tab.id === active ? 'page' : undefined}>
      <span class="icon">
        <Icon name={tab.icon} size={22} />
        {#if tab.badge}<span class="badge" aria-label="{tab.badge} non letti">{tab.badge > 99 ? '99+' : tab.badge}</span>{/if}
      </span>
      <span class="label">{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    left: 50%;
    bottom: calc(var(--space-3) + var(--safe-bottom));
    z-index: var(--z-tabbar);
    display: grid;
    grid-template-columns: repeat(var(--count), 1fr);
    width: min(calc(100% - 2 * var(--space-4)), var(--content-max));
    height: var(--tabbar-height);
    padding: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--color-surface-overlay);
    border: 1px solid var(--color-border-strong);
    box-shadow: var(--shadow-card);
    transform: translateX(-50%);
    backdrop-filter: blur(var(--blur-glass)) saturate(1.4);
    -webkit-backdrop-filter: blur(var(--blur-glass)) saturate(1.4);
  }

  .indicator {
    position: absolute;
    inset: var(--space-1) auto var(--space-1) var(--space-1);
    width: calc((100% - 2 * var(--space-1)) / var(--count));
    border-radius: var(--radius-pill);
    background: var(--gradient-party);
    box-shadow: var(--shadow-glow);
    transform: translateX(calc(100% * var(--index)));
    transition: transform var(--duration-slow) var(--ease-spring);
  }

  .tab {
    position: relative;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    transition: color var(--duration-base) var(--ease-out);
  }

  .icon {
    position: relative;
    display: grid;
  }

  .badge {
    position: absolute;
    top: -6px;
    right: -12px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: var(--radius-pill);
    background: var(--color-danger);
    color: var(--color-text);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
    line-height: 18px;
    text-align: center;
  }

  .label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab.active {
    color: var(--color-on-accent);
  }
</style>
