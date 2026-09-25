<script lang="ts">
  import { flip } from 'svelte/animate';
  import type { Haptics } from '../../application/ports';
  import { previewOf, unreadOf, type ConversationSummary } from '../../domain/chat';
  import { longpress } from '../../ui/actions/longpress';
  import ActionSheet, { type SheetItem } from '../../ui/components/ActionSheet.svelte';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration } from '../../ui/theme/motion';
  import { formatRelative } from '../labels';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import { hrefTo } from '../routes';
  import type { ChatListState } from './chat-list-state.svelte';

  let { list, links, haptics }: { list: ChatListState; links: PhotoLinksCache; haptics: Haptics } = $props();

  const now = new Date();

  let menuFor = $state<ConversationSummary | null>(null);
  let confirming = $state<{ conversation: ConversationSummary; mode: 'empty' | 'remove' } | null>(null);

  const menuItems = $derived<SheetItem[]>(
    menuFor ? itemsFor(menuFor) : [],
  );

  function itemsFor(conversation: ConversationSummary): SheetItem[] {
    const unread = unreadOf(conversation) > 0;
    return [
      {
        icon: unread ? 'check' : 'unread',
        label: unread ? 'Segna come letta' : 'Segna come da leggere',
        onselect: () => void settle(list.toggleUnread(conversation)),
      },
      { icon: 'eraser', label: 'Svuota messaggi', onselect: () => (confirming = { conversation, mode: 'empty' }) },
      { icon: 'trash', label: 'Cancella chat', danger: true, onselect: () => (confirming = { conversation, mode: 'remove' }) },
    ];
  }

  function openMenu(conversation: ConversationSummary) {
    haptics.pulse('tap');
    menuFor = conversation;
  }

  async function clear() {
    if (!confirming) return;
    const { conversation, mode } = confirming;
    confirming = null;
    await settle(list.clear(conversation, mode));
  }

  async function settle(change: Promise<{ ok: boolean; error?: string }>) {
    const result = await change;
    if (!result.ok && result.error !== 'unauthorized') toasts.show('Non ci sono riuscito, riprova', 'error');
  }
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Messaggi privati" title="Chat">
    <p>Solo tu e l'altra persona leggete i messaggi.</p>
  </ScreenHeader>

  {#if list.status === 'loading'}
    <Loader label="Carico le chat…" />
  {:else if list.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare le chat">
      <Button variant="ghost" onclick={() => list.refresh()}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else if list.conversations.length === 0}
    <EmptyState icon="chat" title="Ancora nessuna chat">
      <p>Apri il profilo di qualcuno e premi "Invia messaggio".</p>
    </EmptyState>
  {:else}
    <ul class="list">
      {#each list.conversations as conversation (conversation.id)}
        {@const unread = unreadOf(conversation)}
        {@const typing = list.typing.isTyping(conversation.id)}
        <li animate:flip={{ duration: duration('base') }}>
          <a class="link" href={hrefTo({ name: 'conversazione', id: conversation.id })} use:longpress={() => openMenu(conversation)}>
            <Surface highlighted={unread > 0}>
              <div class="row">
                <Avatar name={conversation.other.nickname} src={links.get(conversation.other.avatarId)?.thumbnailUrl} />
                <div class="text">
                  <div class="top">
                    <span class="nickname">{conversation.other.nickname}</span>
                    {#if conversation.last}<span class="when">{formatRelative(conversation.last.at, now)}</span>{/if}
                  </div>
                  <div class="bottom">
                    {#if typing}
                      <span class="preview typing">sta scrivendo…</span>
                    {:else}
                      <span class="preview" class:unread={unread > 0}>{previewOf(conversation.last)}</span>
                    {/if}
                    {#if conversation.marked && conversation.unread === 0}
                      <span class="dot" aria-label="Da leggere"></span>
                    {:else if unread > 0}
                      <span class="badge">{unread}</span>
                    {/if}
                  </div>
                </div>
              </div>
            </Surface>
          </a>
        </li>
      {/each}
    </ul>
    <p class="tip">Tieni premuta una chat per le altre opzioni.</p>
  {/if}
</Screen>

<ActionSheet open={menuFor !== null} title={menuFor?.other.nickname ?? ''} items={menuItems} onclose={() => (menuFor = null)} />

{#snippet confirmActions()}
  <Button variant="danger" block onclick={clear}>{confirming?.mode === 'remove' ? 'Cancella chat' : 'Svuota messaggi'}</Button>
  <Button variant="ghost" block onclick={() => (confirming = null)}>Annulla</Button>
{/snippet}

<Dialog
  open={confirming !== null}
  title={confirming?.mode === 'remove' ? 'Cancellare la chat?' : 'Svuotare i messaggi?'}
  onclose={() => (confirming = null)}
  actions={confirmActions}
>
  <p>
    Solo per te: {confirming?.conversation.other.nickname ?? 'l’altra persona'} continua a vederli.
    {confirming?.mode === 'remove' ? 'Se ti riscrive, la chat ricompare con i soli messaggi nuovi.' : 'La chat resta nell’elenco, vuota.'}
  </p>
</Dialog>

<style>
  .list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    list-style: none;
  }

  .link {
    display: block;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .text {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
    min-width: 0;
  }

  .top,
  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .nickname {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-black);
  }

  .when {
    flex: none;
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
  }

  .preview {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .preview.typing {
    color: var(--color-accent-3);
    font-weight: var(--weight-bold);
  }

  .dot {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--gradient-party);
  }

  .tip {
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
    text-align: center;
  }

  .link {
    -webkit-touch-callout: none;
    user-select: none;
  }

  .preview.unread {
    color: var(--color-text);
    font-weight: var(--weight-bold);
  }

  .badge {
    flex: none;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--gradient-party);
    color: var(--color-on-accent);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
    line-height: 22px;
    text-align: center;
  }
</style>
