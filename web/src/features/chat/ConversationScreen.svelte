<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { Haptics, VoiceRecorder } from '../../application/ports';
  import { MESSAGE_MAX, VOICE_MAX_MS, type ChatMessage } from '../../domain/chat';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
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
  import VoicePlayer from '../../ui/components/VoicePlayer.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing } from '../../ui/theme/motion';
  import { formatTime } from '../labels';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import { hrefTo } from '../routes';
  import type { ConversationState, SendError } from './conversation-state.svelte';

  interface Props {
    conversation: ConversationState;
    links: PhotoLinksCache;
    recorder: VoiceRecorder;
    haptics: Haptics;
    onback: () => void;
  }

  let { conversation, links, recorder, haptics, onback }: Props = $props();

  let draft = $state('');
  let recording = $state<{ startedAt: number; elapsed: number } | null>(null);
  let viewing = $state<ChatMessage | null>(null);
  let deleting = $state<ChatMessage | null>(null);
  let clock: ReturnType<typeof setInterval> | undefined;

  const ERRORS: Record<Exclude<SendError, 'unauthorized' | 'empty'>, string> = {
    unavailable: 'Connessione assente: messaggio non inviato',
    rejected: 'Messaggio non valido',
    disabled: 'La chat è stata spenta dall’admin',
    'unreadable-photo': 'Non riesco a leggere questa foto',
  };

  onMount(() => {
    void conversation.start();
    return () => conversation.stop();
  });

  onDestroy(() => {
    clearInterval(clock);
    recorder.cancel();
  });

  // New messages at the bottom: follow them.
  $effect(() => {
    void conversation.arrivals;
    void tick().then(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
  });

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

  async function confirmDelete() {
    if (!deleting) return;
    const result = await conversation.deleteMessage(deleting);
    deleting = null;
    if (!result.ok && result.error !== 'unauthorized') toasts.show('Non sono riuscito a eliminarlo', 'error');
  }
</script>

{#snippet composer()}
  {#if conversation.status === 'ready' && conversation.peer}
    <div class="composer">
      {#if recording}
        <IconButton icon="trash" label="Annulla la registrazione" danger onclick={() => finishRecording(false)} />
        <RecordingIndicator elapsedMs={recording.elapsed} maxMs={VOICE_MAX_MS} />
        <IconButton icon="send" label="Invia il vocale" primary onclick={() => finishRecording(true)} />
      {:else}
        <PhotoPickerButton size="small" variant="ghost" disabled={conversation.sending} onpick={async (file) => report(await conversation.sendPhoto(file))}>
          <Icon name="camera" size={18} />
        </PhotoPickerButton>
        <MessageInput bind:value={draft} placeholder="Scrivi un messaggio" maxlength={MESSAGE_MAX} onsubmit={sendText} />
        {#if draft.trim()}
          <IconButton icon="send" label="Invia" primary disabled={conversation.sending} onclick={sendText} />
        {:else}
          <IconButton icon="mic" label="Registra un vocale" primary disabled={conversation.sending} onclick={startRecording} />
        {/if}
      {/if}
    </div>
  {/if}
{/snippet}

<Screen footer={composer}>
  <TopBar {onback}>
    {#if conversation.peer}
      <a class="peer" href={hrefTo({ name: 'giocatore', id: conversation.peer.id })}>
        <Avatar name={conversation.peer.nickname} src={links.get(conversation.peer.avatarId)?.thumbnailUrl} size="sm" />
        <span class="nickname">{conversation.peer.nickname}</span>
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
        <Button size="small" variant="ghost" loading={conversation.loadingOlder} onclick={() => conversation.loadOlder()}>
          Messaggi precedenti
        </Button>
      {/if}
      {#if conversation.messages.length === 0}
        <p class="hint">Scrivi il primo messaggio a {conversation.peer.nickname}.</p>
      {/if}
      {#each conversation.messages as message (message.id)}
        {@const mine = conversation.isMine(message)}
        <div in:fly={{ y: 12, duration: duration('fast'), easing }}>
          <MessageBubble
            {mine}
            media={message.kind === 'photo'}
            time={formatTime(message.sentAt)}
            onselect={mine ? () => (deleting = message) : undefined}
          >
            {#if message.kind === 'text'}
              {message.text}
            {:else if message.kind === 'photo'}
              <button class="photo" onclick={(event) => { event.stopPropagation(); viewing = message; }} aria-label="Apri la foto">
                {#if conversation.mediaOf(message)?.thumbnailUrl}
                  <img src={conversation.mediaOf(message)?.thumbnailUrl} alt="Foto inviata in chat" />
                {:else}
                  <span class="photo-placeholder"><Icon name="image" size={28} /></span>
                {/if}
              </button>
            {:else}
              <VoicePlayer src={conversation.mediaOf(message)?.url} durationMs={message.durationMs} inverted={mine} />
            {/if}
          </MessageBubble>
        </div>
      {/each}
    </div>
  {/if}
</Screen>


<Lightbox
  src={viewing ? (conversation.mediaOf(viewing)?.url ?? null) : null}
  alt="Foto della chat"
  onclose={() => (viewing = null)}
/>

{#snippet deleteActions()}
  <Button variant="danger" block onclick={confirmDelete}>Elimina per tutti e due</Button>
  <Button variant="ghost" block onclick={() => (deleting = null)}>Annulla</Button>
{/snippet}

<Dialog open={deleting !== null} title="Eliminare il messaggio?" onclose={() => (deleting = null)} actions={deleteActions}>
  <p>Sparisce anche dal telefono di {conversation.peer?.nickname ?? 'chi l’ha ricevuto'}.</p>
</Dialog>

<style>
  .peer {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .nickname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-black);
  }

  .messages {
    display: grid;
    gap: var(--space-2);
  }

  .composer {
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
    border-radius: var(--radius-sm);
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
