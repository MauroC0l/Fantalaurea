import { addAction, type AddActionError } from '../../application/add-action';
import type { EveningAdmin, GameBoard, WriteFailure } from '../../application/ports';
import type { Action, ActionDraft } from '../../domain/action';
import type { AdminSession } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

export class AdminState {
  readonly session: AdminSession;
  status = $state<LoadStatus>('loading');
  catalog = $state.raw<readonly Action[]>([]);
  participantCount = $state(0);

  readonly #board: GameBoard;
  readonly #admin: EveningAdmin;
  #unsubscribe: (() => void) | null = null;

  constructor(board: GameBoard, admin: EveningAdmin, session: AdminSession) {
    this.#board = board;
    this.#admin = admin;
    this.session = session;
  }

  async start(): Promise<void> {
    this.status = 'loading';
    try {
      await this.#refresh();
      this.status = 'ready';
      this.#unsubscribe ??= this.#board.onChange(() => void this.#refresh().catch(() => {}));
    } catch {
      this.status = 'failed';
    }
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  add(draft: ActionDraft): Promise<Result<Action, AddActionError>> {
    return addAction(this.#admin, this.session, draft);
  }

  remove(action: Action): Promise<Result<void, WriteFailure>> {
    return this.#admin.removeAction(this.session, action.id);
  }

  resetEvening(): Promise<Result<void, WriteFailure>> {
    return this.#admin.resetEvening(this.session);
  }

  async #refresh(): Promise<void> {
    const [catalog, participants] = await Promise.all([this.#board.catalog(), this.#board.participants()]);
    this.catalog = catalog;
    this.participantCount = participants.length;
  }
}
