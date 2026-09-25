import { SessionExpiredError, type Chat, type FeatureFailure, type GameBoard, type WriteFailure } from '../../application/ports';
import { unreadOf, unreadTotal, type ConversationSummary } from '../../domain/chat';
import type { PlayerSession } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';
import { TypingTracker } from './typing-tracker.svelte';

/** The player's open conversations, kept fresh for the whole session (unread badge). */
export class ChatListState {
  status = $state<LoadStatus>('loading');
  conversations = $state.raw<readonly ConversationSummary[]>([]);
  readonly unread = $derived(unreadTotal(this.conversations));
  readonly typing = new TypingTracker();

  readonly session: PlayerSession;
  readonly #chat: Chat;
  readonly #board: GameBoard;
  readonly #onSessionLost: () => void;
  #unsubscribe: (() => void)[] = [];

  constructor(deps: { chat: Chat; board: GameBoard }, session: PlayerSession, onSessionLost: () => void) {
    this.#chat = deps.chat;
    this.#board = deps.board;
    this.session = session;
    this.#onSessionLost = onSessionLost;
  }

  start(): void {
    void this.refresh();
    this.typing.start(this.#chat, this.session);
    this.#unsubscribe = [
      this.#chat.onInbox(this.session, (conversationId) => {
        this.typing.settle(conversationId);
        void this.refresh();
      }),
      // Nicknames and profile photos of the other people may change.
      this.#board.onChange((table) => {
        if (table === 'players') void this.refresh();
      }),
    ];
  }

  stop(): void {
    this.#unsubscribe.forEach((unsubscribe) => unsubscribe());
    this.#unsubscribe = [];
    this.typing.stop();
  }

  open(otherPlayerId: string): Promise<Result<string, FeatureFailure>> {
    return this.#chat.open(this.session, otherPlayerId);
  }

  /** "Segna come letta" / "Segna come da leggere", instantly. */
  async toggleUnread(conversation: ConversationSummary): Promise<Result<void, WriteFailure>> {
    const unread = unreadOf(conversation) > 0;
    this.#replace({ ...conversation, unread: 0, marked: !unread });
    if (unread) {
      await this.#chat.markRead(this.session, conversation.id);
      return { ok: true, value: undefined };
    }
    return this.#settle(await this.#chat.markUnread(this.session, conversation.id));
  }

  async clear(conversation: ConversationSummary, mode: 'empty' | 'remove'): Promise<Result<void, WriteFailure>> {
    if (mode === 'remove') this.conversations = this.conversations.filter((c) => c.id !== conversation.id);
    else this.#replace({ ...conversation, last: null, unread: 0, marked: false });
    return this.#settle(await this.#chat.clear(this.session, conversation.id, mode));
  }

  async refresh(): Promise<void> {
    try {
      this.conversations = await this.#chat.conversations(this.session);
      this.status = 'ready';
    } catch (error) {
      if (error instanceof SessionExpiredError) this.#onSessionLost();
      else if (this.status === 'loading') this.status = 'failed';
    }
  }

  /** A refused change: the list goes back to what the server says. */
  #settle(result: Result<void, WriteFailure>): Result<void, WriteFailure> {
    if (!result.ok) {
      if (result.error === 'unauthorized') this.#onSessionLost();
      void this.refresh();
    }
    return result;
  }

  #replace(conversation: ConversationSummary): void {
    this.conversations = this.conversations.map((c) => (c.id === conversation.id ? conversation : c));
  }
}
