import type { EveningAdmin, GameBoard, WriteFailure } from '../../application/ports';
import { saveAction, type ActionTarget, type SaveActionError } from '../../application/save-action';
import type { Action, ActionDraft } from '../../domain/action';
import type { AdminSession } from '../../domain/player';
import { ok, type Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

export class AdminState {
  readonly session: AdminSession;
  status = $state<LoadStatus>('loading');
  catalog = $state.raw<readonly Action[]>([]);
  participantCount = $state(0);

  readonly #board: GameBoard;
  readonly #admin: EveningAdmin;
  #unsubscribe: (() => void) | null = null;

  constructor(deps: { board: GameBoard; admin: EveningAdmin }, session: AdminSession) {
    this.#board = deps.board;
    this.#admin = deps.admin;
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

  save(target: ActionTarget, draft: ActionDraft): Promise<Result<void, SaveActionError>> {
    return saveAction(this.#admin, this.session, target, draft);
  }

  remove(action: Action): Promise<Result<void, WriteFailure>> {
    return this.#admin.removeAction(this.session, action.id);
  }

  async photoCount(): Promise<Result<number, WriteFailure>> {
    const album = await this.#admin.album(this.session);
    return album.ok ? ok(album.value.length) : album;
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
