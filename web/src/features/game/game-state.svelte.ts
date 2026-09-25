import { completeAction, type CompleteError } from '../../application/complete-action';
import type { GameBoard, OwnPhoto, PhotoDeletion, PhotoProcessor, PlayerMoves, WriteFailure } from '../../application/ports';
import type { Action } from '../../domain/action';
import { isOwnedBy, type Completion, type Completions } from '../../domain/completion';
import { rankParticipants, type Participant, type PlayerSession } from '../../domain/player';
import { err, type Result } from '../../domain/result';

export type LoadStatus = 'loading' | 'ready' | 'failed';

export interface GameEvents {
  /** The backend no longer knows this player, e.g. the admin started a new evening. */
  onSessionLost(): void;
}

export interface GameDependencies {
  readonly board: GameBoard;
  readonly moves: PlayerMoves;
  readonly photos: PhotoProcessor;
}

// Photo links are signed for an hour: renew them a bit earlier.
const PHOTO_LINKS_MAX_AGE_MS = 50 * 60 * 1000;

/** Live view of one player's evening: the actions still to do, those done, and the ranking. */
export class GameState {
  readonly session: PlayerSession;
  status = $state<LoadStatus>('loading');
  catalog = $state.raw<readonly Action[]>([]);
  completions = $state.raw<Completions>(new Map());
  participants = $state.raw<readonly Participant[]>([]);
  ownPhotos = $state.raw<ReadonlyMap<string, OwnPhoto>>(new Map());
  busy = $state.raw<ReadonlySet<string>>(new Set());

  readonly me = $derived(this.participants.find((p) => p.player.id === this.session.player.id));
  readonly todo = $derived(this.catalog.filter((action) => !this.completions.has(action.id)));
  readonly done = $derived(
    this.catalog
      .filter((action) => this.completions.has(action.id))
      .sort((a, b) => this.completionOf(b)!.completedAt.getTime() - this.completionOf(a)!.completedAt.getTime()),
  );

  readonly #deps: GameDependencies;
  readonly #events: GameEvents;
  #unsubscribe: (() => void) | null = null;
  #photosKey = '';
  #photosFetchedAt = 0;

  constructor(deps: GameDependencies, session: PlayerSession, events: GameEvents) {
    this.#deps = deps;
    this.session = session;
    this.#events = events;
  }

  async start(): Promise<void> {
    this.status = 'loading';
    try {
      await this.#refreshAll();
      this.status = 'ready';
      this.#unsubscribe ??= this.#deps.board.onChange(() => void this.#syncQuietly());
    } catch {
      this.status = 'failed';
    }
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  completionOf(action: Action): Completion | undefined {
    return this.completions.get(action.id);
  }

  canChange(action: Action): boolean {
    const completion = this.completionOf(action);
    return !completion || isOwnedBy(completion, this.session.player.id);
  }

  photoOf(action: Action): OwnPhoto | undefined {
    return this.ownPhotos.get(action.id);
  }

  isBusy(action: Action): boolean {
    return this.busy.has(action.id);
  }

  complete(action: Action, photo: File | null): Promise<Result<void, CompleteError>> {
    return this.#run(action, () => completeAction(this.#deps, this.session, action, photo));
  }

  undo(action: Action): Promise<Result<void, WriteFailure>> {
    return this.#run(action, () => this.#deps.moves.undo(this.session, action.id));
  }

  deletePhoto(action: Action): Promise<Result<PhotoDeletion, WriteFailure>> {
    const photo = this.photoOf(action);
    if (!photo) return Promise.resolve(err('rejected'));
    return this.#run(action, () => this.#deps.moves.deleteOwnPhoto(this.session, photo.id));
  }

  async #run<T, E>(action: Action, operation: () => Promise<Result<T, E>>): Promise<Result<T, E>> {
    this.busy = new Set(this.busy).add(action.id);
    try {
      const result = await operation();
      if (!result.ok && result.error === 'unauthorized') this.#events.onSessionLost();
      else await this.#syncQuietly();
      return result;
    } finally {
      const remaining = new Set(this.busy);
      remaining.delete(action.id);
      this.busy = remaining;
    }
  }

  async #syncQuietly(): Promise<void> {
    try {
      await this.#refreshAll();
    } catch {
      // The next change notification will try again.
    }
  }

  async #refreshAll(): Promise<void> {
    const { board } = this.#deps;
    const [catalog, completions, participants] = await Promise.all([
      board.catalog(),
      board.completionsOf(this.session),
      board.participants(),
    ]);
    if (!participants.some((p) => p.player.id === this.session.player.id)) {
      this.#events.onSessionLost();
      return;
    }
    this.catalog = catalog;
    this.completions = new Map(completions.map((completion) => [completion.actionId, completion]));
    this.participants = rankParticipants(participants);
    await this.#refreshOwnPhotos(completions);
  }

  /** Photo links come from an Edge Function: ask only when own photos changed or links are old. */
  async #refreshOwnPhotos(completions: readonly Completion[]): Promise<void> {
    const key = completions
      .filter((c) => c.hasPhoto && isOwnedBy(c, this.session.player.id))
      .map((c) => `${c.actionId}@${c.completedAt.getTime()}`)
      .join('|');
    const fresh = Date.now() - this.#photosFetchedAt < PHOTO_LINKS_MAX_AGE_MS;
    if (key === this.#photosKey && fresh) return;

    if (key === '') {
      this.ownPhotos = new Map();
    } else {
      const photos = await this.#deps.moves.ownPhotos(this.session);
      if (!photos.ok) return;
      this.ownPhotos = new Map(photos.value.map((photo) => [photo.actionId, photo]));
    }
    this.#photosKey = key;
    this.#photosFetchedAt = Date.now();
  }
}
