import type { Action, ActionDraft } from '../domain/action';
import type { ActionCounts } from '../domain/counts';
import type { AdminSession, Identity, Participant, PlayerSession, Session } from '../domain/player';
import type { Result } from '../domain/result';

/** The backend could not be reached or failed unexpectedly. */
export type Unavailable = 'unavailable';

export type JoinFailure = 'nickname-taken' | Unavailable;
export type ResumeFailure = 'unknown-token' | Unavailable;
export type WriteFailure = 'unauthorized' | 'rejected' | Unavailable;

export interface PlayerAccounts {
  /** The admin credentials open an admin session; any other identity joins as a player. */
  join(identity: Identity): Promise<Result<Session, JoinFailure>>;
  resume(token: string): Promise<Result<Session, ResumeFailure>>;
}

/** Reads reject when the backend is unavailable; writes report failures as values. */
export interface GameBoard {
  catalog(): Promise<readonly Action[]>;
  /** Includes the shared counts of the actions that belong to everyone. */
  countsOf(session: PlayerSession): Promise<ActionCounts>;
  setCount(session: PlayerSession, actionId: string, count: number): Promise<Result<void, WriteFailure>>;
  participants(): Promise<readonly Participant[]>;
  /** Notifies whenever the catalog, the players or any count change; returns the unsubscribe function. */
  onChange(listener: () => void): () => void;
}

export interface EveningAdmin {
  addAction(session: AdminSession, draft: ActionDraft): Promise<Result<Action, WriteFailure>>;
  /** Also deletes every count recorded for that action. */
  removeAction(session: AdminSession, actionId: string): Promise<Result<void, WriteFailure>>;
  /** Removes every player and count; the action list stays for the next evening. */
  resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>>;
}

export interface SessionStore {
  read(): string | null;
  write(token: string): void;
  clear(): void;
}

export type HapticPattern = 'tap' | 'warning';

export interface Haptics {
  pulse(pattern: HapticPattern): void;
}
