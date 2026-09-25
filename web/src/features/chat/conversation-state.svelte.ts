import { SvelteMap } from 'svelte/reactivity';
import {
  CHAT_PAGE_SIZE,
  SessionExpiredError,
  type Chat,
  type ChatMediaLinks,
  type FeatureFailure,
  type PhotoLimitFailure,
  type PhotoProcessor,
  type WriteFailure,
} from '../../application/ports';
import {
  mergeMessages,
  messageText,
  TYPING_SIGNAL_EVERY_MS,
  type ChatMessage,
  type ChatPeer,
  type DeleteScope,
  type VoiceRecording,
} from '../../domain/chat';
import type { PlayerSession } from '../../domain/player';
import { err, type Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';
import { TypingTracker } from './typing-tracker.svelte';

export type SendError = FeatureFailure | PhotoLimitFailure | 'empty' | 'unreadable-photo';

/** What the composer is doing: a new message, an answer to one, or a correction of one of mine. */
export type ComposerMode =
  | { readonly kind: 'new' }
  | { readonly kind: 'reply'; readonly message: ChatMessage }
  | { readonly kind: 'edit'; readonly message: ChatMessage & { kind: 'text' } };

const NEW: ComposerMode = { kind: 'new' };

/** One open conversation: messages oldest first, older pages on demand, new ones as they come. */
export class ConversationState {
  status = $state<LoadStatus>('loading');
  peer = $state.raw<ChatPeer | null>(null);
  messages = $state.raw<readonly ChatMessage[]>([]);
  hasOlder = $state(true);
  loadingOlder = $state(false);
  sending = $state(false);
  mode = $state.raw<ComposerMode>(NEW);
  /** Bumped when new messages arrive at the bottom, so the screen can scroll down. */
  arrivals = $state(0);
  readonly typing = new TypingTracker();

  readonly id: string;
  readonly session: PlayerSession;
  readonly #chat: Chat;
  readonly #photos: PhotoProcessor;
  readonly #onSessionLost: () => void;
  readonly #onRead: () => void;
  readonly #media = new SvelteMap<string, ChatMediaLinks>();
  readonly #mediaRequested = new Set<string>();
  #lastTypingSignal = 0;
  #unsubscribe: (() => void) | null = null;

  constructor(
    deps: { chat: Chat; photos: PhotoProcessor },
    session: PlayerSession,
    conversationId: string,
    events: { onSessionLost: () => void; onRead: () => void },
  ) {
    this.#chat = deps.chat;
    this.#photos = deps.photos;
    this.session = session;
    this.id = conversationId;
    this.#onSessionLost = events.onSessionLost;
    this.#onRead = events.onRead;
  }

  async start(): Promise<void> {
    try {
      const [info, page] = await Promise.all([
        this.#chat.conversation(this.session, this.id),
        this.#chat.messages(this.session, this.id, null),
      ]);
      this.peer = info?.other ?? null;
      this.messages = mergeMessages([], page);
      this.hasOlder = page.length === CHAT_PAGE_SIZE;
      this.status = 'ready';
      this.arrivals++;
      void this.#markRead();
      this.typing.start(this.#chat, this.session);
      this.#unsubscribe ??= this.#chat.onInbox(this.session, (conversationId) => {
        if (conversationId !== this.id) return;
        this.typing.settle(this.id);
        void this.#refreshNewest();
      });
    } catch (error) {
      this.#fail(error);
    }
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.typing.stop();
  }

  get peerTyping(): boolean {
    return this.typing.isTyping(this.id);
  }

  isMine(message: ChatMessage): boolean {
    return message.senderId === this.session.player.id;
  }

  /** Reactive: the links appear once fetched. */
  mediaOf(message: ChatMessage): ChatMediaLinks | undefined {
    const links = this.#media.get(message.id);
    if (!links && (message.kind === 'photo' || message.kind === 'voice') && !this.#mediaRequested.has(message.id)) {
      this.#mediaRequested.add(message.id);
      queueMicrotask(() => void this.#loadMedia());
    }
    return links;
  }

  async loadOlder(): Promise<void> {
    const oldest = this.messages[0];
    if (!oldest || !this.hasOlder || this.loadingOlder) return;
    this.loadingOlder = true;
    try {
      const page = await this.#chat.messages(this.session, this.id, oldest.sentAt);
      this.hasOlder = page.length === CHAT_PAGE_SIZE;
      this.messages = mergeMessages(this.messages, page);
    } catch (error) {
      this.#fail(error);
    } finally {
      this.loadingOlder = false;
    }
  }

  replyTo(message: ChatMessage): void {
    this.mode = { kind: 'reply', message };
  }

  edit(message: ChatMessage): void {
    if (message.kind === 'text' && this.isMine(message)) this.mode = { kind: 'edit', message };
  }

  cancelMode(): void {
    this.mode = NEW;
  }

  /** Called on every keystroke: the other person hears about it at most every few seconds. */
  typed(): void {
    const now = Date.now();
    if (now - this.#lastTypingSignal < TYPING_SIGNAL_EVERY_MS) return;
    this.#lastTypingSignal = now;
    this.#chat.typing(this.session, this.id);
  }

  sendText(raw: string): Promise<Result<void, SendError>> {
    const text = messageText(raw);
    if (text === null) return Promise.resolve(err('empty'));
    const mode = this.mode;
    if (mode.kind === 'edit') return this.#send(() => this.#chat.editMessage(this.session, mode.message.id, text));
    return this.#send(() => this.#chat.sendText(this.session, this.id, text, this.#replyId()));
  }

  sendPhoto(file: File): Promise<Result<void, SendError>> {
    return this.#send(async () => {
      try {
        const photo = await this.#photos.prepare(file, 'original');
        return this.#chat.sendPhoto(this.session, this.id, photo, this.#replyId());
      } catch {
        return err('unreadable-photo');
      }
    });
  }

  sendVoice(voice: VoiceRecording): Promise<Result<void, SendError>> {
    return this.#send(() => this.#chat.sendVoice(this.session, this.id, voice, this.#replyId()));
  }

  /** Instant: "per me" makes it vanish, "per tutti" leaves the "Messaggio eliminato" trace. */
  async deleteMessage(message: ChatMessage, scope: DeleteScope): Promise<Result<void, WriteFailure>> {
    const before = this.messages;
    this.messages =
      scope === 'me'
        ? this.messages.filter((m) => m.id !== message.id)
        : this.messages.map((m) =>
            m.id === message.id ? { id: m.id, senderId: m.senderId, sentAt: m.sentAt, forwarded: false, replyTo: null, kind: 'deleted' } : m,
          );
    if (this.mode.kind !== 'new' && this.mode.message.id === message.id) this.mode = NEW;
    const result = await this.#chat.deleteMessage(this.session, message.id, scope);
    if (!result.ok) {
      this.messages = before;
      if (result.error === 'unauthorized') this.#onSessionLost();
    }
    return result;
  }

  forward(message: ChatMessage, conversationIds: readonly string[]): Promise<Result<void, FeatureFailure | PhotoLimitFailure>> {
    return this.#chat.forward(this.session, message.id, conversationIds);
  }

  #replyId(): string | null {
    return this.mode.kind === 'reply' ? this.mode.message.id : null;
  }

  async #send(operation: () => Promise<Result<void, SendError>>): Promise<Result<void, SendError>> {
    this.sending = true;
    try {
      const result = await operation();
      if (result.ok) {
        this.mode = NEW;
        await this.#refreshNewest();
      } else if (result.error === 'unauthorized') this.#onSessionLost();
      return result;
    } finally {
      this.sending = false;
    }
  }

  /** Reloads the newest page; messages deleted meanwhile disappear from it. */
  async #refreshNewest(): Promise<void> {
    try {
      const page = await this.#chat.messages(this.session, this.id, null);
      // A short page is the whole conversation: nothing older to keep.
      const complete = page.length < CHAT_PAGE_SIZE;
      const oldestInPage = page.at(-1)?.sentAt.getTime() ?? Infinity;
      const newestBefore = this.messages.at(-1)?.id;
      const older = complete ? [] : this.messages.filter((m) => m.sentAt.getTime() < oldestInPage);
      this.messages = mergeMessages(older, page);
      if (this.messages.at(-1)?.id !== newestBefore) this.arrivals++;
      void this.#markRead();
    } catch (error) {
      this.#fail(error);
    }
  }

  /** Reading here updates the unread badge elsewhere (the conversation list). */
  async #markRead(): Promise<void> {
    await this.#chat.markRead(this.session, this.id);
    this.#onRead();
  }

  async #loadMedia(): Promise<void> {
    const ids = [...this.#mediaRequested].filter((id) => !this.#media.has(id));
    if (ids.length === 0) return;
    try {
      const links = await this.#chat.mediaLinks(this.session, ids);
      for (const [id, link] of links) this.#media.set(id, link);
    } catch (error) {
      for (const id of ids) this.#mediaRequested.delete(id);
      this.#fail(error);
    }
  }

  #fail(error: unknown): void {
    if (error instanceof SessionExpiredError) this.#onSessionLost();
    else if (this.status === 'loading') this.status = 'failed';
  }
}
