import { SessionExpiredError, type EveningAdmin, type GameBoard, type WriteFailure } from '../../application/ports';
import { saveAction, type ActionTarget, type SaveActionError } from '../../application/save-action';
import type { Action, ActionDraft } from '../../domain/action';
import type { AccessLogEntry } from '../../domain/evening';
import { ALL_FEATURES_ON, type FeatureName, type Features } from '../../domain/features';
import type { AdminSession } from '../../domain/player';
import { ok, type Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

export class AdminState {
  readonly session: AdminSession;
  status = $state<LoadStatus>('loading');
  catalog = $state.raw<readonly Action[]>([]);
  participantCount = $state(0);
  secretWord = $state<string | null>(null);
  accessLog = $state.raw<readonly AccessLogEntry[]>([]);
  features = $state.raw<Features>(ALL_FEATURES_ON);

  readonly #board: GameBoard;
  readonly #admin: EveningAdmin;
  readonly #onSessionLost: () => void;
  #unsubscribe: (() => void) | null = null;

  constructor(deps: { board: GameBoard; admin: EveningAdmin }, session: AdminSession, onSessionLost: () => void) {
    this.#board = deps.board;
    this.#admin = deps.admin;
    this.session = session;
    this.#onSessionLost = onSessionLost;
  }

  async start(): Promise<void> {
    this.status = 'loading';
    try {
      await this.#refresh();
      this.status = 'ready';
      this.#unsubscribe ??= this.#board.onChange(() => void this.#refreshQuietly());
    } catch (error) {
      if (error instanceof SessionExpiredError) this.#onSessionLost();
      else this.status = 'failed';
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

  /** `word` null = draw a new one. */
  async setSecretWord(word: string | null, sendPlayersOut: boolean): Promise<Result<string, WriteFailure>> {
    const result = await this.#admin.setSecretWord(this.session, word, sendPlayersOut);
    if (result.ok) this.secretWord = result.value;
    return result;
  }

  /** Optimistic: the switch moves at once and goes back if the server refuses. */
  async setFeature(feature: FeatureName, enabled: boolean): Promise<Result<void, WriteFailure>> {
    const previous = this.features;
    this.features = { ...previous, [feature]: enabled };
    const result = await this.#admin.setFeature(this.session, feature, enabled);
    if (!result.ok) this.features = previous;
    return result;
  }

  async resetEvening(): Promise<Result<void, WriteFailure>> {
    const result = await this.#admin.resetEvening(this.session);
    if (result.ok) await this.#refreshQuietly();
    return result;
  }

  async #refreshQuietly(): Promise<void> {
    try {
      await this.#refresh();
    } catch (error) {
      if (error instanceof SessionExpiredError) this.#onSessionLost();
    }
  }

  async #refresh(): Promise<void> {
    const [catalog, participants, features, word, log] = await Promise.all([
      this.#board.catalog(this.session),
      this.#board.participants(this.session),
      this.#board.features(this.session),
      this.#admin.secretWord(this.session),
      this.#admin.accessLog(this.session),
    ]);
    if ((!word.ok && word.error === 'unauthorized') || (!log.ok && log.error === 'unauthorized')) {
      throw new SessionExpiredError();
    }
    this.catalog = catalog;
    this.participantCount = participants.length;
    this.features = features;
    if (word.ok) this.secretWord = word.value;
    if (log.ok) this.accessLog = log.value;
  }
}
