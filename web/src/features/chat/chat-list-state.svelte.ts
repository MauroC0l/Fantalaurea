import { SessionExpiredError, type Chat, type FeatureFailure, type GameBoard } from '../../application/ports';
import { unreadTotal, type ConversationSummary } from '../../domain/chat';
import type { PlayerSession } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

/** The player's open conversations, kept fresh for the whole session (unread badge). */
export class ChatListState {
  status = $state<LoadStatus>('loading');
  conversations = $state.raw<readonly ConversationSummary[]>([]);
  readonly unread = $derived(unreadTotal(this.conversations));

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
    this.#unsubscribe = [
      this.#chat.onInbox(this.session, () => void this.refresh()),
      // Nicknames and profile photos of the other people may change.
      this.#board.onChange((table) => {
        if (table === 'players') void this.refresh();
      }),
    ];
  }

  stop(): void {
    this.#unsubscribe.forEach((unsubscribe) => unsubscribe());
    this.#unsubscribe = [];
  }

  open(otherPlayerId: string): Promise<Result<string, FeatureFailure>> {
    return this.#chat.open(this.session, otherPlayerId);
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
}
