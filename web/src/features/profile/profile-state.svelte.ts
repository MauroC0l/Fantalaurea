import {
  SessionExpiredError,
  type ChangedTable,
  type GameBoard,
  type PhotoProcessor,
  type PlayerMoves,
  type WriteFailure,
} from '../../application/ports';
import { changeAvatar, saveBio } from '../../application/social';
import type { PlayerSession } from '../../domain/player';
import type { Profile } from '../../domain/profile';
import { err, type Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

const RELEVANT: ReadonlySet<ChangedTable> = new Set(['players', 'player_completions', 'shared_completions', 'posts']);

export interface ProfileDependencies {
  readonly board: GameBoard;
  readonly moves: PlayerMoves;
  readonly photos: PhotoProcessor;
}

export class ProfileState {
  status = $state<LoadStatus>('loading');
  /** null once loaded = this player no longer exists. */
  profile = $state.raw<Profile | null>(null);

  readonly playerId: string;
  readonly isMine: boolean;
  readonly #deps: ProfileDependencies;
  readonly #session: PlayerSession;
  readonly #onSessionLost: () => void;
  #unsubscribe: (() => void) | null = null;

  constructor(deps: ProfileDependencies, session: PlayerSession, playerId: string, onSessionLost: () => void) {
    this.#deps = deps;
    this.#session = session;
    this.playerId = playerId;
    this.isMine = playerId === session.player.id;
    this.#onSessionLost = onSessionLost;
  }

  async start(): Promise<void> {
    await this.#load();
    this.#unsubscribe ??= this.#deps.board.onChange((table) => {
      if (RELEVANT.has(table)) void this.#load();
    });
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async saveBio(bio: string): Promise<Result<void, WriteFailure | 'bio-too-long'>> {
    return this.#afterWrite(await saveBio(this.#deps.moves, this.#session, bio));
  }

  async changeAvatar(file: File): Promise<Result<void, WriteFailure | 'unreadable-photo'>> {
    return this.#afterWrite(await changeAvatar(this.#deps, this.#session, file));
  }

  async removeAvatar(): Promise<Result<void, WriteFailure>> {
    const avatarId = this.profile?.avatarId;
    if (!avatarId) return err('rejected');
    const result = await this.#deps.moves.deleteOwnPhoto(this.#session, avatarId);
    return this.#afterWrite(result.ok ? { ok: true, value: undefined } : result);
  }

  async #afterWrite<E>(result: Result<void, E>): Promise<Result<void, E>> {
    if (result.ok) await this.#load();
    else if (result.error === 'unauthorized') this.#onSessionLost();
    return result;
  }

  async #load(): Promise<void> {
    try {
      this.profile = await this.#deps.board.profile(this.#session, this.playerId);
      this.status = 'ready';
    } catch (error) {
      if (error instanceof SessionExpiredError) this.#onSessionLost();
      else if (this.status === 'loading') this.status = 'failed';
    }
  }
}
