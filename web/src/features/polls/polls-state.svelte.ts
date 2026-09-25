import { SessionExpiredError, type GameBoard, type PollFailure, type Polls, type WriteFailure } from '../../application/ports';
import type { PlayerSession, Session } from '../../domain/player';
import { validatePollDraft, type Poll, type PollDraft, type PollDraftError } from '../../domain/poll';
import { err, type Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

const CLOCK_MS = 15_000;

export type CreatePollError = PollFailure | { readonly kind: 'invalid'; readonly errors: readonly PollDraftError[] };

/** The evening's polls, fresh as others vote; `now` ticks so countdowns and closings show. */
export class PollsState {
  status = $state<LoadStatus>('loading');
  polls = $state.raw<readonly Poll[]>([]);
  now = $state(new Date());
  busy = $state<string | null>(null);

  readonly session: Session;
  readonly #polls: Polls;
  readonly #board: GameBoard;
  readonly #onSessionLost: () => void;
  #unsubscribe: (() => void) | null = null;
  #clock: ReturnType<typeof setInterval> | undefined;

  constructor(deps: { polls: Polls; board: GameBoard }, session: Session, onSessionLost: () => void) {
    this.#polls = deps.polls;
    this.#board = deps.board;
    this.session = session;
    this.#onSessionLost = onSessionLost;
  }

  /** The admin creates and manages but does not vote: votes belong to players. */
  get voter(): PlayerSession | null {
    return this.session.role === 'player' ? this.session : null;
  }

  start(): void {
    void this.refresh();
    this.#unsubscribe ??= this.#board.onChange((table) => {
      if (table === 'polls' || table === 'players') void this.refresh();
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
      this.polls = await this.#polls.list(this.session);
      this.now = new Date();
      this.status = 'ready';
    } catch (error) {
      if (error instanceof SessionExpiredError) this.#onSessionLost();
      else if (this.status === 'loading') this.status = 'failed';
    }
  }

  async create(draft: PollDraft): Promise<Result<void, CreatePollError>> {
    const valid = validatePollDraft(draft);
    if (!valid.ok) return err({ kind: 'invalid', errors: valid.error });
    const created = await this.#polls.create(this.session, valid.value);
    return this.#settle(created.ok ? { ok: true, value: undefined } : created);
  }

  vote(poll: Poll, optionIds: readonly string[]): Promise<Result<void, PollFailure>> {
    const voter = this.voter;
    if (!voter) return Promise.resolve(err('unauthorized'));
    return this.#busyWith(poll, () => this.#polls.vote(voter, poll.id, optionIds));
  }

  close(poll: Poll): Promise<Result<void, WriteFailure>> {
    return this.#busyWith(poll, () => this.#polls.close(this.session, poll.id));
  }

  remove(poll: Poll): Promise<Result<void, WriteFailure>> {
    return this.#busyWith(poll, () => this.#polls.remove(this.session, poll.id));
  }

  async #busyWith<E>(poll: Poll, operation: () => Promise<Result<void, E>>): Promise<Result<void, E>> {
    this.busy = poll.id;
    try {
      return this.#settle(await operation());
    } finally {
      this.busy = null;
    }
  }

  /** After any answer the list is read again: counts, closings and permissions may have moved. */
  async #settle<E>(result: Result<void, E>): Promise<Result<void, E>> {
    if (!result.ok && result.error === 'unauthorized') this.#onSessionLost();
    else await this.refresh();
    return result;
  }
}
