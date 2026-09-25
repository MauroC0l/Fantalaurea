import { SessionExpiredError, type ChallengeFailure, type Challenges, type GameBoard, type WriteFailure } from '../../application/ports';
import {
  isRunning,
  openFor,
  validateChallenge,
  type Challenge,
  type ChallengeCompleter,
  type ChallengeDraft,
  type ChallengeDraftError,
  type ChallengeEdit,
} from '../../domain/challenge';
import type { PlayerSession, Session } from '../../domain/player';
import { err, type Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

const CLOCK_MS = 5_000;

export type SaveChallengeError = ChallengeFailure | { readonly kind: 'invalid'; readonly errors: readonly ChallengeDraftError[] };

/**
 * The evening's timed challenges, live for the whole session (ADR 0020): a new one is announced
 * wherever the player is, and the Azioni tab counts those still to do.
 */
export class ChallengesState {
  status = $state<LoadStatus>('loading');
  challenges = $state.raw<readonly Challenge[]>([]);
  now = $state(new Date());
  busy = $state<string | null>(null);

  readonly running = $derived(this.challenges.filter((c) => isRunning(c, this.now)));
  readonly finished = $derived(this.challenges.filter((c) => !isRunning(c, this.now)));
  /** Running challenges this player can still do. */
  readonly todo = $derived(openFor(this.challenges, this.now));
  /** Those this player completed, for the "Fatte" list. */
  readonly mine = $derived(this.challenges.filter((c) => c.mine !== null));

  readonly session: Session;
  readonly #challenges: Challenges;
  readonly #board: GameBoard;
  readonly #onSessionLost: () => void;
  readonly #onNew: (challenge: Challenge) => void;
  #known: Set<string> | null = null;
  #unsubscribe: (() => void) | null = null;
  #clock: ReturnType<typeof setInterval> | undefined;

  constructor(
    deps: { challenges: Challenges; board: GameBoard },
    session: Session,
    events: { onSessionLost: () => void; onNew: (challenge: Challenge) => void },
  ) {
    this.#challenges = deps.challenges;
    this.#board = deps.board;
    this.session = session;
    this.#onSessionLost = events.onSessionLost;
    this.#onNew = events.onNew;
  }

  /** The admin creates and manages but does not take part. */
  get player(): PlayerSession | null {
    return this.session.role === 'player' ? this.session : null;
  }

  start(): void {
    void this.refresh();
    this.#unsubscribe ??= this.#board.onChange((table) => {
      if (table === 'challenges' || table === 'players') void this.refresh();
    });
    this.#clock ??= setInterval(() => (this.now = new Date()), CLOCK_MS);
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    clearInterval(this.#clock);
    this.#clock = undefined;
  }

  async refresh(): Promise<void> {
    try {
      const challenges = await this.#challenges.list(this.session);
      this.now = new Date();
      // Only after the first load: the challenges already running when you arrive are not "new".
      if (this.#known) {
        for (const challenge of challenges) {
          if (!this.#known.has(challenge.id) && isRunning(challenge, this.now)) this.#onNew(challenge);
        }
      }
      this.#known = new Set(challenges.map((c) => c.id));
      this.challenges = challenges;
      this.status = 'ready';
    } catch (error) {
      if (error instanceof SessionExpiredError) this.#onSessionLost();
      else if (this.status === 'loading') this.status = 'failed';
    }
  }

  /** Everyone who did it: read on demand, the list can be long. */
  async completers(challenge: Challenge): Promise<readonly ChallengeCompleter[] | null> {
    try {
      return await this.#challenges.completers(this.session, challenge.id);
    } catch (error) {
      if (error instanceof SessionExpiredError) this.#onSessionLost();
      return null;
    }
  }

  async create(draft: ChallengeDraft): Promise<Result<void, SaveChallengeError>> {
    const valid = validateChallenge(draft);
    if (!valid.ok) return err({ kind: 'invalid', errors: valid.error });
    const created = await this.#challenges.create(this.session, valid.value);
    // Your own challenge is not news to you.
    if (created.ok) this.#known?.add(created.value);
    return this.#settle(created.ok ? { ok: true, value: undefined } : created);
  }

  async update(challenge: Challenge, edit: ChallengeEdit): Promise<Result<void, SaveChallengeError>> {
    const valid = validateChallenge(edit);
    if (!valid.ok) return err({ kind: 'invalid', errors: valid.error });
    return this.#busyWith(challenge, () => this.#challenges.update(this.session, challenge.id, valid.value));
  }

  end(challenge: Challenge): Promise<Result<void, WriteFailure>> {
    return this.#busyWith(challenge, () => this.#challenges.end(this.session, challenge.id));
  }

  remove(challenge: Challenge): Promise<Result<void, WriteFailure>> {
    return this.#busyWith(challenge, () => this.#challenges.remove(this.session, challenge.id));
  }

  complete(challenge: Challenge): Promise<Result<void, ChallengeFailure>> {
    const player = this.player;
    if (!player) return Promise.resolve(err('unauthorized'));
    return this.#busyWith(challenge, () => this.#challenges.complete(player, challenge.id));
  }

  undo(challenge: Challenge): Promise<Result<void, WriteFailure>> {
    const player = this.player;
    if (!player) return Promise.resolve(err('unauthorized'));
    return this.#busyWith(challenge, () => this.#challenges.undo(player, challenge.id));
  }

  async #busyWith<E>(challenge: Challenge, operation: () => Promise<Result<void, E>>): Promise<Result<void, E>> {
    this.busy = challenge.id;
    try {
      return this.#settle(await operation());
    } finally {
      this.busy = null;
    }
  }

  async #settle<E>(result: Result<void, E>): Promise<Result<void, E>> {
    if (!result.ok && result.error === 'unauthorized') this.#onSessionLost();
    else await this.refresh();
    return result;
  }
}
