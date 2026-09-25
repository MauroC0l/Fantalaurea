<script lang="ts">
  import type { IconName } from '../icons';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    icon: IconName;
    title: string;
    text: string;
    oncancel: () => void;
  }

  let { icon, title, text, oncancel }: Props = $props();
</script>

<!-- Above the message field: what the next message answers or corrects. -->
<div class="banner">
  <span class="icon"><Icon name={icon} size={18} /></span>
  <span class="body">
    <span class="title">{title}</span>
    <span class="text">{text}</span>
  </span>
  <IconButton icon="close" label="Annulla" onclick={oncancel} />
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
    border-left: 3px solid var(--color-accent-3);
    border-radius: var(--radius-sm);
    background: var(--color-bg-elevated);
  }

  .icon {
    color: var(--color-accent-3);
  }

  .body {
    flex: 1;
    display: grid;
    min-width: 0;
  }

  .title {
    color: var(--color-accent-3);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
  }

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
