import type {
  EveningAdmin,
  GameBoard,
  JoinFailure,
  PlayerAccounts,
  ResumeFailure,
  WriteFailure,
} from '../../application/ports';
import { isSharedByEveryone, type Action, type ActionDraft } from '../../domain/action';
import { isValidCount, totalActions, type ActionCounts } from '../../domain/counts';
import {
  sameName,
  type AdminSession,
  type Identity,
  type Participant,
  type Player,
  type PlayerSession,
  type Session,
} from '../../domain/player';
import { err, ok, type Result } from '../../domain/result';
import type { KeyValueStorage } from '../browser/safe-storage';

interface StoredPlayer extends Player {
  readonly token: string;
}

interface MemoryDb {
  actions: Action[];
  players: StoredPlayer[];
  adminTokens: string[];
  personalCounts: Record<string, Record<string, number>>;
  sharedCounts: Record<string, number>;
}

export interface MemoryBackendOptions {
  readonly latencyMs: number;
  readonly admin: Identity;
  readonly demoPlayers: readonly Identity[];
}

const STORAGE_KEY = 'fantalaurea:memory-db:v2';

/**
 * Stand-in for the real backend while developing: same contracts, data kept in this browser.
 * It cannot share data between phones.
 */
export class MemoryBackend implements PlayerAccounts, GameBoard, EveningAdmin {
  readonly #storage: KeyValueStorage;
  readonly #options: MemoryBackendOptions;
  readonly #listeners = new Set<() => void>();
  readonly #db: MemoryDb;

  constructor(defaultActions: readonly Action[], storage: KeyValueStorage, options: MemoryBackendOptions) {
    this.#storage = storage;
    this.#options = options;
    this.#db = this.#load(defaultActions);
  }

  async join(identity: Identity): Promise<Result<Session, JoinFailure>> {
    await this.#delay();
    if (sameName(identity.nickname, this.#options.admin.nickname)) {
      return sameName(identity.realName, this.#options.admin.realName)
        ? ok(this.#openAdminSession())
        : err('nickname-taken');
    }
    const existing = this.#db.players.find((p) => sameName(p.nickname, identity.nickname));
    if (existing) {
      return sameName(existing.realName, identity.realName)
        ? ok(toPlayerSession(existing))
        : err('nickname-taken');
    }
    const created = this.#createPlayer(identity);
    this.#commit();
    return ok(toPlayerSession(created));
  }

  async resume(token: string): Promise<Result<Session, ResumeFailure>> {
    await this.#delay();
    if (this.#db.adminTokens.includes(token)) return ok({ role: 'admin', token });
    const player = this.#playerByToken(token);
    return player ? ok(toPlayerSession(player)) : err('unknown-token');
  }

  async catalog(): Promise<readonly Action[]> {
    await this.#delay();
    return [...this.#db.actions];
  }

  async countsOf(session: PlayerSession): Promise<ActionCounts> {
    await this.#delay();
    return { ...this.#db.personalCounts[session.player.id], ...this.#db.sharedCounts };
  }

  async setCount(session: PlayerSession, actionId: string, count: number): Promise<Result<void, WriteFailure>> {
    await this.#delay();
    const player = this.#playerByToken(session.token);
    if (!player) return err('unauthorized');
    const action = this.#db.actions.find((a) => a.id === actionId);
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

  async addAction(session: AdminSession, draft: ActionDraft): Promise<Result<Action, WriteFailure>> {
    await this.#delay();
    if (!this.#isAdmin(session)) return err('unauthorized');
    const action: Action = { id: `custom-${crypto.randomUUID()}`, points: 0, ...draft };
    this.#db.actions.push(action);
    this.#commit();
    return ok(action);
  }

  async removeAction(session: AdminSession, actionId: string): Promise<Result<void, WriteFailure>> {
    await this.#delay();
    if (!this.#isAdmin(session)) return err('unauthorized');
    if (!this.#db.actions.some((a) => a.id === actionId)) return err('rejected');
    this.#db.actions = this.#db.actions.filter((a) => a.id !== actionId);
    delete this.#db.sharedCounts[actionId];
    Object.values(this.#db.personalCounts).forEach((counts) => delete counts[actionId]);
    this.#commit();
    return ok(undefined);
  }

  async resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>> {
    await this.#delay();
    if (!this.#isAdmin(session)) return err('unauthorized');
    this.#db.players = [];
    this.#db.personalCounts = {};
    this.#db.sharedCounts = {};
    this.#commit();
    return ok(undefined);
  }

  #openAdminSession(): AdminSession {
    const token = crypto.randomUUID();
    this.#db.adminTokens.push(token);
    this.#commit();
    return { role: 'admin', token };
  }

  #isAdmin(session: AdminSession): boolean {
    return this.#db.adminTokens.includes(session.token);
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

  #load(defaultActions: readonly Action[]): MemoryDb {
    const saved = this.#storage.read(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as MemoryDb;
    const db: MemoryDb = {
      actions: [...defaultActions],
      players: [],
      adminTokens: [],
      personalCounts: {},
      sharedCounts: {},
    };
    this.#options.demoPlayers.forEach((identity, index) => {
      const player: StoredPlayer = { id: `demo-${index}`, token: `demo-${index}`, ...identity };
      db.players.push(player);
      db.personalCounts[player.id] = { [defaultActions[index % defaultActions.length].id]: index + 1 };
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

function toPlayerSession(stored: StoredPlayer): PlayerSession {
  return { role: 'player', player: toPlayer(stored), token: stored.token };
}
