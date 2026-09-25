<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { FORWARD_MAX, type ConversationSummary } from '../../domain/chat';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import ScrollArea from '../../ui/components/ScrollArea.svelte';
  import SelectableRow from '../../ui/components/SelectableRow.svelte';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';

  interface Props {
    open: boolean;
    conversations: readonly ConversationSummary[];
    links: PhotoLinksCache;
    sending: boolean;
    onsend: (conversationIds: string[]) => void;
    onclose: () => void;
  }

  let { open, conversations, links, sending, onsend, onclose }: Props = $props();

  const chosen = new SvelteSet<string>();

  $effect(() => {
    if (!open) chosen.clear();
  });

  function toggle(id: string) {
    if (chosen.has(id)) chosen.delete(id);
    else if (chosen.size < FORWARD_MAX) chosen.add(id);
  }
</script>

{#snippet actions()}
  <Button block loading={sending} disabled={chosen.size === 0} onclick={() => onsend([...chosen])}>
    <Icon name="forward" size={20} /> Inoltra{chosen.size > 0 ? ` a ${chosen.size}` : ''}
  </Button>
{/snippet}

<Dialog {open} title="Inoltra a…" {onclose} {actions}>
  <p>Scegli fino a {FORWARD_MAX} chat.</p>
  {#if conversations.length === 0}
    <p>Non hai altre chat aperte.</p>
  {:else}
    <ScrollArea maxHeight="45dvh" label="Le tue chat">
    <div class="list">
      {#each conversations as conversation (conversation.id)}
        <SelectableRow
          selected={chosen.has(conversation.id)}
          disabled={!chosen.has(conversation.id) && chosen.size >= FORWARD_MAX}
          onclick={() => toggle(conversation.id)}
        >
          <Avatar name={conversation.other.nickname} src={links.get(conversation.other.avatarId)?.thumbnailUrl} size="sm" />
          <span class="nickname">{conversation.other.nickname}</span>
        </SelectableRow>
      {/each}
    </div>
    </ScrollArea>
  {/if}
</Dialog>

<style>
  .list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .nickname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text);
    font-weight: var(--weight-bold);
  }
</style>
