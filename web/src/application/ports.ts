import type { Action } from '../domain/action';
import type { ActionCounts } from '../domain/counts';
import type { Identity, Participant, Session } from '../domain/player';
import type { Result } from '../domain/result';

/** The backend could not be reached or failed unexpectedly. */
export type Unavailable = 'unavailable';

export type JoinFailure = 'nickname-taken' | Unavailable;
export type ResumeFailure = 'unknown-token' | Unavailable;
export type WriteFailure = 'unauthorized' | 'rejected' | Unavailable;

export interface PlayerAccounts {
  join(identity: Identity): Promise<Result<Session, JoinFailure>>;
  resume(token: string): Promise<Result<Session, ResumeFailure>>;
}

/** Reads reject when the backend is unavailable; writes report failures as values. */
export interface GameBoard {
  catalog(): Promise<readonly Action[]>;
  /** Includes the shared counts of the actions that belong to everyone. */
  countsOf(session: Session): Promise<ActionCounts>;
  setCount(session: Session, actionId: string, count: number): Promise<Result<void, WriteFailure>>;
  participants(): Promise<readonly Participant[]>;
  /** Notifies whenever any player's counts change; returns the unsubscribe function. */
  onChange(listener: () => void): () => void;
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
