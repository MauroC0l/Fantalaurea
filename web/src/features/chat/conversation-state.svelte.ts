import { SvelteMap } from 'svelte/reactivity';
import {
  CHAT_PAGE_SIZE,
  SessionExpiredError,
  type Chat,
  type ChatMediaLinks,
  type FeatureFailure,
  type PhotoProcessor,
  type WriteFailure,
} from '../../application/ports';
import { mergeMessages, messageText, type ChatMessage, type ChatPeer, type VoiceRecording } from '../../domain/chat';
import type { PlayerSession } from '../../domain/player';
import { err, type Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

export type SendError = FeatureFailure | 'empty' | 'unreadable-photo';

/** One open conversation: messages oldest first, older pages on demand, new ones as they come. */
export class ConversationState {
  status = $state<LoadStatus>('loading');
  peer = $state.raw<ChatPeer | null>(null);
  messages = $state.raw<readonly ChatMessage[]>([]);
  hasOlder = $state(true);
  loadingOlder = $state(false);
  sending = $state(false);
  /** Bumped when new messages arrive at the bottom, so the screen can scroll down. */
  arrivals = $state(0);

  readonly id: string;
  readonly session: PlayerSession;
  readonly #chat: Chat;
  readonly #photos: PhotoProcessor;
  readonly #onSessionLost: () => void;
  readonly #onRead: () => void;
  readonly #media = new SvelteMap<string, ChatMediaLinks>();
  readonly #mediaRequested = new Set<string>();
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
      this.#unsubscribe ??= this.#chat.onInbox(this.session, (conversationId) => {
        // An empty id means "something was deleted somewhere": reload anyway.
        if (conversationId === this.id || conversationId === '') void this.#refreshNewest();
      });
    } catch (error) {
      this.#fail(error);
    }
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  isMine(message: ChatMessage): boolean {
    return message.senderId === this.session.player.id;
  }

  /** Reactive: the links appear once fetched. */
  mediaOf(message: ChatMessage): ChatMediaLinks | undefined {
    const links = this.#media.get(message.id);
    if (!links && message.kind !== 'text' && !this.#mediaRequested.has(message.id)) {
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

  sendText(raw: string): Promise<Result<void, SendError>> {
    const text = messageText(raw);
    if (text === null) return Promise.resolve(err('empty'));
    return this.#send(() => this.#chat.sendText(this.session, this.id, text));
  }

  sendPhoto(file: File): Promise<Result<void, SendError>> {
    return this.#send(async () => {
      try {
        return this.#chat.sendPhoto(this.session, this.id, await this.#photos.prepare(file, 'original'));
      } catch {
        return err('unreadable-photo');
      }
    });
  }

  sendVoice(voice: VoiceRecording): Promise<Result<void, SendError>> {
    return this.#send(() => this.#chat.sendVoice(this.session, this.id, voice));
  }

  async deleteMessage(message: ChatMessage): Promise<Result<void, WriteFailure>> {
    const result = await this.#chat.deleteMessage(this.session, message.id);
    if (result.ok) this.messages = this.messages.filter((m) => m.id !== message.id);
    else if (result.error === 'unauthorized') this.#onSessionLost();
    return result;
  }

  async #send(operation: () => Promise<Result<void, SendError>>): Promise<Result<void, SendError>> {
    this.sending = true;
    try {
      const result = await operation();
      if (result.ok) await this.#refreshNewest();
      else if (result.error === 'unauthorized') this.#onSessionLost();
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
      const before = this.messages.length;
      const older = complete ? [] : this.messages.filter((m) => m.sentAt.getTime() < oldestInPage);
      this.messages = mergeMessages(older, page);
      if (this.messages.length !== before) this.arrivals++;
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
