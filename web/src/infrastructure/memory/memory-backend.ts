import type { GameBoard, JoinFailure, PlayerAccounts, ResumeFailure, WriteFailure } from '../../application/ports';
import { isSharedByEveryone, type Action } from '../../domain/action';
import { isValidCount, totalActions, type ActionCounts } from '../../domain/counts';
import { sameName, type Identity, type Participant, type Player, type Session } from '../../domain/player';
import { err, ok, type Result } from '../../domain/result';
import type { KeyValueStorage } from '../browser/safe-storage';

interface StoredPlayer extends Player {
  readonly token: string;
}

interface MemoryDb {
  players: StoredPlayer[];
  personalCounts: Record<string, Record<string, number>>;
  sharedCounts: Record<string, number>;
}

export interface MemoryBackendOptions {
  readonly latencyMs: number;
  readonly demoPlayers: readonly Identity[];
}

const STORAGE_KEY = 'fantalaurea:memory-db';

/**
 * Stand-in for the real backend while developing: same contracts, data kept in this browser.
 * It cannot share data between phones.
 */
export class MemoryBackend implements PlayerAccounts, GameBoard {
  readonly #actions: readonly Action[];
  readonly #storage: KeyValueStorage;
  readonly #options: MemoryBackendOptions;
  readonly #listeners = new Set<() => void>();
  readonly #db: MemoryDb;

  constructor(actions: readonly Action[], storage: KeyValueStorage, options: MemoryBackendOptions) {
    this.#actions = actions;
    this.#storage = storage;
    this.#options = options;
    this.#db = this.#load();
  }

  async join(identity: Identity): Promise<Result<Session, JoinFailure>> {
    await this.#delay();
    const existing = this.#db.players.find((p) => sameName(p.nickname, identity.nickname));
    if (existing) {
      return sameName(existing.realName, identity.realName)
        ? ok(toSession(existing))
        : err('nickname-taken');
    }
    const created = this.#createPlayer(identity);
    this.#commit();
    return ok(toSession(created));
  }

  async resume(token: string): Promise<Result<Session, ResumeFailure>> {
    await this.#delay();
    const player = this.#playerByToken(token);
    return player ? ok(toSession(player)) : err('unknown-token');
  }

  async catalog(): Promise<readonly Action[]> {
    await this.#delay();
    return this.#actions;
  }

  async countsOf(session: Session): Promise<ActionCounts> {
    await this.#delay();
    return { ...this.#db.personalCounts[session.player.id], ...this.#db.sharedCounts };
  }

  async setCount(session: Session, actionId: string, count: number): Promise<Result<void, WriteFailure>> {
    await this.#delay();
    const player = this.#playerByToken(session.token);
    if (!player) return err('unauthorized');
    const action = this.#actions.find((a) => a.id === actionId);
    if (!action || !isValidCount(count)) return err('rejected');

    const target = isSharedByEveryone(action)
      ? this.#db.sharedCounts
      : (this.#db.personalCounts[player.id] ??= {});
    target[actionId] = count;
    this.#commit();
    return ok(undefined);
  }

  async participants(): Promise<readonly Participant[]> {
    await this.#delay();
    const shared = totalActions(this.#db.sharedCounts);
    return this.#db.players.map((stored) => ({
      player: toPlayer(stored),
      actionsDone: totalActions(this.#db.personalCounts[stored.id] ?? {}) + shared,
    }));
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #createPlayer(identity: Identity): StoredPlayer {
    const player: StoredPlayer = { id: crypto.randomUUID(), token: crypto.randomUUID(), ...identity };
    this.#db.players.push(player);
    return player;
  }

  #playerByToken(token: string): StoredPlayer | undefined {
    return this.#db.players.find((p) => p.token === token);
  }

  #commit(): void {
    this.#storage.write(STORAGE_KEY, JSON.stringify(this.#db));
    this.#listeners.forEach((listener) => listener());
  }

  #load(): MemoryDb {
    const saved = this.#storage.read(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as MemoryDb;
    const db: MemoryDb = { players: [], personalCounts: {}, sharedCounts: {} };
    this.#options.demoPlayers.forEach((identity, index) => {
      const player: StoredPlayer = { id: `demo-${index}`, token: `demo-${index}`, ...identity };
      db.players.push(player);
      db.personalCounts[player.id] = { [this.#actions[index % this.#actions.length].id]: index + 1 };
    });
    return db;
  }

  #delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#options.latencyMs));
  }
}

function toPlayer({ id, nickname, realName }: StoredPlayer): Player {
  return { id, nickname, realName };
}

function toSession(stored: StoredPlayer): Session {
  return { player: toPlayer(stored), token: stored.token };
}
