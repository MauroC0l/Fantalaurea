import type { EveningAdmin, GameBoard, WriteFailure } from '../../application/ports';
import type { AdminSession, ManagedPlayer, Permission } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

/** The admin's "Utenti": everyone who joined, blocked or not, with their permissions (ADR 0018). */
export class UsersState {
  status = $state<LoadStatus>('loading');
  players = $state.raw<readonly ManagedPlayer[]>([]);

  readonly #admin: EveningAdmin;
  readonly #board: GameBoard;
  readonly #session: AdminSession;
  readonly #onUnauthorized: () => void;
  #unsubscribe: (() => void) | null = null;

  constructor(deps: { admin: EveningAdmin; board: GameBoard }, session: AdminSession, onUnauthorized: () => void) {
    this.#admin = deps.admin;
    this.#board = deps.board;
    this.#session = session;
    this.#onUnauthorized = onUnauthorized;
  }

  async start(): Promise<void> {
    await this.refresh();
    // New players join and photos come and go while the admin looks.
    this.#unsubscribe ??= this.#board.onChange((table) => {
      if (table === 'players' || table === 'posts' || table === 'player_completions') void this.refresh();
    });
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async refresh(): Promise<void> {
    const result = await this.#admin.players(this.#session);
    if (result.ok) {
      this.players = result.value;
      this.status = 'ready';
    } else if (result.error === 'unauthorized') {
      this.#onUnauthorized();
    } else if (this.status === 'loading') {
      this.status = 'failed';
    }
  }

  setBlocked(player: ManagedPlayer, blocked: boolean): Promise<Result<void, WriteFailure>> {
    return this.#change(player, { ...player, blocked }, () => this.#admin.setBlocked(this.#session, player.id, blocked));
  }

  /** Instant: the switch moves at once and goes back if the server refuses. */
  setPermission(player: ManagedPlayer, permission: Permission, enabled: boolean): Promise<Result<void, WriteFailure>> {
    return this.#change(player, { ...player, permissions: { ...player.permissions, [permission]: enabled } }, () =>
      this.#admin.setPermission(this.#session, player.id, permission, enabled),
    );
  }

  async #change(
    before: ManagedPlayer,
    after: ManagedPlayer,
    operation: () => Promise<Result<void, WriteFailure>>,
  ): Promise<Result<void, WriteFailure>> {
    this.#replace(after);
    const result = await operation();
    if (!result.ok) {
      this.#replace(before);
      if (result.error === 'unauthorized') this.#onUnauthorized();
    }
    return result;
  }

  #replace(player: ManagedPlayer): void {
    this.players = this.players.map((p) => (p.id === player.id ? player : p));
  }
}
