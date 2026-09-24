import type { GameBoard, WriteFailure } from '../../application/ports';
import type { Action } from '../../domain/action';
import { countOf, nextCount, totalActions, withCount, type ActionCounts, type Step } from '../../domain/counts';
import { rankParticipants, type Participant, type PlayerSession } from '../../domain/player';

export type LoadStatus = 'loading' | 'ready' | 'failed';

export interface GameEvents {
  onWriteFailed(failure: WriteFailure): void;
  /** The player no longer exists, e.g. the admin started a new evening. */
  onSessionLost(): void;
}

/**
 * Live view of one player's game. Counter changes show up immediately (optimistic) and are
 * written in order per action, so fast repeated taps cannot reach the backend out of order.
 */
export class GameState {
  readonly session: PlayerSession;
  status = $state<LoadStatus>('loading');
  catalog = $state.raw<readonly Action[]>([]);
  counts = $state.raw<ActionCounts>({});
  participants = $state.raw<readonly Participant[]>([]);
  readonly totalDone = $derived(totalActions(this.counts));

  readonly #board: GameBoard;
  readonly #events: GameEvents;
  readonly #pendingWrites = new Map<string, Promise<void>>();
  #unsubscribe: (() => void) | null = null;

  constructor(board: GameBoard, session: PlayerSession, events: GameEvents) {
    this.#board = board;
    this.session = session;
    this.#events = events;
  }

  async start(): Promise<void> {
    this.status = 'loading';
    try {
      await this.#refreshAll();
      this.status = 'ready';
      this.#unsubscribe ??= this.#board.onChange(() => void this.#syncQuietly());
    } catch {
      this.status = 'failed';
    }
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  countOf(action: Action): number {
    return countOf(this.counts, action.id);
  }

  step(action: Action, step: Step): void {
    const current = this.countOf(action);
    const next = nextCount(current, step);
    if (next === current) return;
    this.counts = withCount(this.counts, action.id, next);
    this.#enqueueWrite(action.id);
  }

  #enqueueWrite(actionId: string): void {
    const previous = this.#pendingWrites.get(actionId) ?? Promise.resolve();
    const write = previous.then(() => this.#flush(actionId));
    this.#pendingWrites.set(actionId, write);
    void write.finally(() => {
      if (this.#pendingWrites.get(actionId) === write) this.#pendingWrites.delete(actionId);
    });
  }

  async #flush(actionId: string): Promise<void> {
    const result = await this.#board.setCount(this.session, actionId, countOf(this.counts, actionId));
    if (result.ok) return;
    this.#events.onWriteFailed(result.error);
    this.#pendingWrites.delete(actionId);
    await this.#syncQuietly();
  }

  async #syncQuietly(): Promise<void> {
    try {
      await this.#refreshAll();
    } catch {
      // The next change notification or write will try again.
    }
  }

  async #refreshAll(): Promise<void> {
    const [catalog, fromBoard, participants] = await Promise.all([
      this.#board.catalog(),
      this.#board.countsOf(this.session),
      this.#board.participants(),
    ]);
    if (!participants.some((p) => p.player.id === this.session.player.id)) {
      this.#events.onSessionLost();
      return;
    }
    this.catalog = catalog;
    this.counts = this.#withPendingWrites(fromBoard);
    this.participants = rankParticipants(participants);
  }

  /** Values still being written are newer than what the backend knows. */
  #withPendingWrites(fromBoard: ActionCounts): ActionCounts {
    const merged = { ...fromBoard };
    for (const actionId of this.#pendingWrites.keys()) merged[actionId] = countOf(this.counts, actionId);
    return merged;
  }
}
