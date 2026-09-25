<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Clipboard, Haptics, VoiceRecorder } from '../../application/ports';
  import {
    actionsFor,
    deleteScopesFor,
    MESSAGE_MAX,
    quoteOf,
    quoteText,
    VOICE_MAX_MS,
    type ChatMessage,
    type MessageAction,
    type QuotedMessage,
  } from '../../domain/chat';
  import ActionSheet, { type SheetItem } from '../../ui/components/ActionSheet.svelte';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
  import ComposerBanner from '../../ui/components/ComposerBanner.svelte';
  import DayDivider from '../../ui/components/DayDivider.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import Lightbox from '../../ui/components/Lightbox.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import MessageBubble from '../../ui/components/MessageBubble.svelte';
  import MessageInput from '../../ui/components/MessageInput.svelte';
  import PhotoPickerButton from '../../ui/components/PhotoPickerButton.svelte';
  import RecordingIndicator from '../../ui/components/RecordingIndicator.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import TopBar from '../../ui/components/TopBar.svelte';
  import TypingIndicator from '../../ui/components/TypingIndicator.svelte';
  import VoicePlayer from '../../ui/components/VoicePlayer.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { formatTime, PHOTO_LIMIT_MESSAGE } from '../labels';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import { hrefTo } from '../routes';
  import type { ChatListState } from './chat-list-state.svelte';
  import { layoutMessages } from './chat-layout';
  import type { ConversationState, SendError } from './conversation-state.svelte';
  import ForwardDialog from './ForwardDialog.svelte';

  interface Props {
    conversation: ConversationState;
    chatList: ChatListState;
    links: PhotoLinksCache;
    recorder: VoiceRecorder;
    haptics: Haptics;
    clipboard: Clipboard;
    onback: () => void;
  }

  let { conversation, chatList, links, recorder, haptics, clipboard, onback }: Props = $props();

  const HIGHLIGHT_MS = 1600;

  let draft = $state('');
  let input = $state<ReturnType<typeof MessageInput>>();
  let recording = $state<{ startedAt: number; elapsed: number } | null>(null);
  let viewing = $state<ChatMessage | null>(null);
  let menuFor = $state<ChatMessage | null>(null);
  let deleting = $state<ChatMessage | null>(null);
  let forwarding = $state<ChatMessage | null>(null);
  let forwardSending = $state(false);
  let highlighted = $state<string | null>(null);
  let clock: ReturnType<typeof setInterval> | undefined;

  const rows = $derived(layoutMessages(conversation.messages));
  const others = $derived(chatList.conversations.filter((c) => c.id !== conversation.id));

  const ERRORS: Record<Exclude<SendError, 'unauthorized' | 'empty'>, string> = {
    unavailable: 'Connessione assente: messaggio non inviato',
    rejected: 'Messaggio non valido',
    disabled: 'La chat è stata spenta dall’admin',
    'unreadable-photo': 'Non riesco a leggere questa foto',
    'photo-limit': PHOTO_LIMIT_MESSAGE,
  };

  const LABELS: Record<MessageAction, { icon: SheetItem['icon']; label: string; danger?: boolean }> = {
    reply: { icon: 'reply', label: 'Rispondi' },
    copy: { icon: 'copy', label: 'Copia testo' },
    edit: { icon: 'pencil', label: 'Modifica' },
    forward: { icon: 'forward', label: 'Inoltra' },
    delete: { icon: 'trash', label: 'Elimina', danger: true },
  };

  const menuItems = $derived<SheetItem[]>(
    menuFor
      ? actionsFor(menuFor, conversation.session.player.id).map((action) => {
          const message = menuFor!;
          return { ...LABELS[action], onselect: () => run(action, message) };
        })
      : [],
  );

  onMount(() => {
    void conversation.start();
    return () => conversation.stop();
  });

  onDestroy(() => {
    clearInterval(clock);
    recorder.cancel();
  });

  // New messages at the bottom, or the other person starting to type: follow them.
  $effect(() => {
    void conversation.arrivals;
    void conversation.peerTyping;
    void tick().then(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
  });

  function authorOf(quote: QuotedMessage): string {
    return quote.senderId === conversation.session.player.id ? 'Tu' : (conversation.peer?.nickname ?? '');
  }

  function openMenu(message: ChatMessage) {
    haptics.pulse('tap');
    menuFor = message;
  }

  function startReply(message: ChatMessage) {
    haptics.pulse('tap');
    conversation.replyTo(message);
    input?.focus();
  }

  async function run(action: MessageAction, message: ChatMessage) {
    if (action === 'reply') startReply(message);
    if (action === 'edit' && message.kind === 'text') {
      conversation.edit(message);
      draft = message.text;
      input?.focus();
    }
    if (action === 'copy' && message.kind === 'text') {
      toasts.show((await clipboard.copy(message.text)) ? 'Testo copiato' : 'Non riesco a copiarlo', 'info');
    }
    if (action === 'forward') forwarding = message;
    if (action === 'delete') deleting = message;
  }

  function cancelMode() {
    if (conversation.mode.kind === 'edit') draft = '';
    conversation.cancelMode();
  }

  /** From a reply to the message it answers, if it is loaded. */
  async function jumpTo(id: string) {
    const target = document.querySelector(`[data-message="${id}"]`);
    if (!target) {
      toasts.show('È più indietro: carica i messaggi precedenti', 'info');
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlighted = id;
    await new Promise((resolve) => setTimeout(resolve, HIGHLIGHT_MS));
    if (highlighted === id) highlighted = null;
  }

  function report(result: { ok: boolean; error?: SendError }) {
    if (result.ok) return haptics.pulse('tap');
    if (result.error && result.error !== 'unauthorized' && result.error !== 'empty') toasts.show(ERRORS[result.error], 'error');
  }

  async function sendText() {
    if (conversation.sending) return;
    const text = draft;
    draft = '';
    const result = await conversation.sendText(text);
    if (!result.ok && result.error !== 'empty') draft = text;
    report(result);
  }

  async function startRecording() {
    const started = await recorder.start();
    if (!started.ok) {
      toasts.show(started.error === 'denied' ? 'Serve il permesso del microfono' : 'Questo telefono non registra audio dal browser', 'error');
      return;
    }
    haptics.pulse('tap');
    const startedAt = performance.now();
    recording = { startedAt, elapsed: 0 };
    clock = setInterval(() => {
      if (!recording) return;
      recording = { ...recording, elapsed: performance.now() - recording.startedAt };
      // The recorder stops itself at the limit: send what was recorded.
      if (recording.elapsed >= VOICE_MAX_MS) void finishRecording(true);
    }, 200);
  }

  async function finishRecording(send: boolean) {
    clearInterval(clock);
    recording = null;
    if (!send) return recorder.cancel();
    const voice = await recorder.stop();
    if (voice && voice.durationMs >= 500) report(await conversation.sendVoice(voice));
  }

  async function remove(scope: 'me' | 'everyone') {
    const message = deleting;
    deleting = null;
    if (!message) return;
    const result = await conversation.deleteMessage(message, scope);
    if (!result.ok && result.error !== 'unauthorized') toasts.show('Non sono riuscito a eliminarlo', 'error');
  }

  async function forward(conversationIds: string[]) {
    if (!forwarding) return;
    forwardSending = true;
    const result = await conversation.forward(forwarding, conversationIds);
    forwardSending = false;
    if (result.ok) {
      forwarding = null;
      toasts.show(conversationIds.length === 1 ? 'Inoltrato' : `Inoltrato a ${conversationIds.length} chat`, 'info');
    } else if (result.error !== 'unauthorized') {
      const reason = { disabled: 'La chat è stata spenta dall’admin', 'photo-limit': PHOTO_LIMIT_MESSAGE }[result.error as string];
      toasts.show(reason ?? 'Non sono riuscito a inoltrarlo', 'error');
    }
  }
</script>

{#snippet composer()}
  {#if conversation.status === 'ready' && conversation.peer}
    <div class="composer">
      {#if conversation.mode.kind === 'reply'}
        <ComposerBanner
          icon="reply"
          title="Rispondi a {authorOf(quoteOf(conversation.mode.message))}"
          text={quoteText(quoteOf(conversation.mode.message))}
          oncancel={cancelMode}
        />
      {:else if conversation.mode.kind === 'edit'}
        <ComposerBanner icon="pencil" title="Modifica messaggio" text={conversation.mode.message.text} oncancel={cancelMode} />
      {/if}
      <div class="bar">
        {#if recording}
          <IconButton icon="trash" label="Annulla la registrazione" danger onclick={() => finishRecording(false)} />
          <RecordingIndicator elapsedMs={recording.elapsed} maxMs={VOICE_MAX_MS} />
          <IconButton icon="send" label="Invia il vocale" primary onclick={() => finishRecording(true)} />
        {:else}
          {#if conversation.mode.kind !== 'edit'}
            <PhotoPickerButton size="small" variant="ghost" label="Invia una foto" disabled={conversation.sending} onpick={async (file) => report(await conversation.sendPhoto(file))}>
              <Icon name="camera" size={18} />
            </PhotoPickerButton>
          {/if}
          <MessageInput
            bind:this={input}
            bind:value={draft}
            placeholder="Scrivi un messaggio"
            maxlength={MESSAGE_MAX}
            onsubmit={sendText}
            oninput={() => conversation.typed()}
          />
          {#if draft.trim() || conversation.mode.kind === 'edit'}
            <IconButton
              icon={conversation.mode.kind === 'edit' ? 'check' : 'send'}
              label={conversation.mode.kind === 'edit' ? 'Salva la modifica' : 'Invia'}
              primary
              disabled={conversation.sending || !draft.trim()}
              onclick={sendText}
            />
          {:else}
            <IconButton icon="mic" label="Registra un vocale" primary disabled={conversation.sending} onclick={startRecording} />
          {/if}
        {/if}
      </div>
    </div>
  {/if}
{/snippet}

<Screen footer={composer}>
  <TopBar {onback}>
    {#if conversation.peer}
      <a class="peer" href={hrefTo({ name: 'giocatore', id: conversation.peer.id })}>
        <Avatar name={conversation.peer.nickname} src={links.get(conversation.peer.avatarId)?.thumbnailUrl} size="sm" />
        <span class="who">
          <span class="nickname">{conversation.peer.nickname}</span>
          {#if conversation.peerTyping}<span class="typing">sta scrivendo…</span>{/if}
        </span>
      </a>
    {/if}
  </TopBar>

  {#if conversation.status === 'loading'}
    <Loader label="Apro la chat…" />
  {:else if conversation.status === 'failed' || !conversation.peer}
    <EmptyState icon="alert" title="Chat non disponibile">
      <p>Forse la serata è ricominciata.</p>
    </EmptyState>
  {:else}
    <div class="messages">
      {#if conversation.hasOlder && conversation.messages.length > 0}
        <div class="older">
          <Button size="small" variant="ghost" loading={conversation.loadingOlder} onclick={() => conversation.loadOlder()}>
            Messaggi precedenti
          </Button>
        </div>
      {/if}
      {#if conversation.messages.length === 0}
        <p class="hint">Scrivi il primo messaggio a {conversation.peer.nickname}.</p>
      {/if}
      {#each rows as row (row.message.id)}
        {@const message = row.message}
        {@const mine = conversation.isMine(message)}
        {#if row.day}<DayDivider label={row.day} />{/if}
        <div data-message={message.id}>
          <MessageBubble
            {mine}
            time={formatTime(message.sentAt)}
            groupStart={row.groupStart}
            groupEnd={row.groupEnd}
            media={message.kind === 'photo'}
            voice={message.kind === 'voice'}
            deleted={message.kind === 'deleted'}
            edited={message.kind === 'text' && message.edited}
            forwarded={message.forwarded}
            highlighted={highlighted === message.id}
            quote={message.replyTo
              ? { author: authorOf(message.replyTo), text: quoteText(message.replyTo), onclick: () => jumpTo(message.replyTo!.id) }
              : undefined}
            onmenu={() => openMenu(message)}
            onreply={message.kind === 'deleted' ? undefined : () => startReply(message)}
          >
            {#if message.kind === 'text'}
              {message.text}
            {:else if message.kind === 'photo'}
              <button class="photo" onclick={() => (viewing = message)} aria-label="Apri la foto">
                {#if conversation.mediaOf(message)?.thumbnailUrl}
                  <img src={conversation.mediaOf(message)?.thumbnailUrl} alt="Foto inviata in chat" draggable="false" />
                {:else}
                  <span class="photo-placeholder"><Icon name="image" size={28} /></span>
                {/if}
              </button>
            {:else if message.kind === 'voice'}
              <VoicePlayer src={conversation.mediaOf(message)?.url} durationMs={message.durationMs} seed={message.id} inverted={mine} />
            {/if}
          </MessageBubble>
        </div>
      {/each}
      {#if conversation.peerTyping}<TypingIndicator />{/if}
    </div>
  {/if}
</Screen>

<Lightbox
  src={viewing ? (conversation.mediaOf(viewing)?.url ?? null) : null}
  alt="Foto della chat"
  onclose={() => (viewing = null)}
/>

<ActionSheet open={menuFor !== null} title="Messaggio" items={menuItems} onclose={() => (menuFor = null)} />

{#snippet deleteActions()}
  {#if deleting && deleteScopesFor(deleting, conversation.session.player.id).includes('everyone')}
    <Button variant="danger" block onclick={() => remove('everyone')}>Elimina per tutti</Button>
  {/if}
  <Button variant="ghost" block onclick={() => remove('me')}>Elimina per me</Button>
  <Button variant="ghost" block onclick={() => (deleting = null)}>Annulla</Button>
{/snippet}

<Dialog open={deleting !== null} title="Eliminare il messaggio?" onclose={() => (deleting = null)} actions={deleteActions}>
  <p>"Per me" lo toglie solo dal tuo telefono. "Per tutti" lo toglie anche a {conversation.peer?.nickname ?? 'chi l’ha ricevuto'}.</p>
</Dialog>

<ForwardDialog
  open={forwarding !== null}
  conversations={others}
  {links}
  sending={forwardSending}
  onsend={forward}
  onclose={() => (forwarding = null)}
/>

<style>
  .peer {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .who {
    display: grid;
    min-width: 0;
  }

  .nickname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-black);
  }

  .typing {
    color: var(--color-accent-3);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
  }

  .messages {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding-bottom: var(--space-2);
  }

  .older {
    display: flex;
    justify-content: center;
    margin-bottom: var(--space-2);
  }

  .composer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }

  .bar {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .hint {
    color: var(--color-text-muted);
    text-align: center;
  }

  .photo {
    display: block;
    width: min(240px, 60vw);
    aspect-ratio: 4 / 5;
    border-radius: 15px;
    overflow: hidden;
    background: var(--color-surface);
  }

  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-placeholder {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--color-text-subtle);
  }
</style>
