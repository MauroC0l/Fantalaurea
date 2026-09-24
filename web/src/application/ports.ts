import type { Action, ActionDraft } from '../domain/action';
import type { Completion } from '../domain/completion';
import type { AdminSession, Identity, Participant, PlayerSession, Session } from '../domain/player';
import type { Result } from '../domain/result';

/** The backend could not be reached or failed unexpectedly. */
export type Unavailable = 'unavailable';

export type JoinFailure = 'nickname-taken' | Unavailable;
export type ResumeFailure = 'unknown-token' | Unavailable;
export type WriteFailure = 'unauthorized' | 'rejected' | Unavailable;
export type CompleteFailure = WriteFailure | 'photo-required';
export type UpdateActionFailure = WriteFailure | 'kind-locked';

export interface PlayerAccounts {
  /** The admin credentials open an admin session; any other identity joins as a player. */
  join(identity: Identity): Promise<Result<Session, JoinFailure>>;
  resume(token: string): Promise<Result<Session, ResumeFailure>>;
}

/** Reads reject when the backend is unavailable. */
export interface GameBoard {
  catalog(): Promise<readonly Action[]>;
  /** The player's completions plus the shared ones, whoever marked them. */
  completionsOf(session: PlayerSession): Promise<readonly Completion[]>;
  participants(): Promise<readonly Participant[]>;
  /** Notifies whenever actions, players or completions change; returns the unsubscribe function. */
  onChange(listener: () => void): () => void;
}

/** A photo ready to upload: full size plus a small preview for grids. */
export interface PreparedPhoto {
  readonly full: Blob;
  readonly thumbnail: Blob;
}

export interface PhotoLinks {
  readonly id: string;
  readonly thumbnailUrl: string;
  readonly fullUrl: string;
}

export interface OwnPhoto extends PhotoLinks {
  readonly actionId: string;
}

export interface AlbumPhoto extends PhotoLinks {
  readonly actionTitle: string;
  readonly nickname: string;
  readonly realName: string;
  readonly takenAt: Date;
}

export interface PhotoDeletion {
  readonly undone: boolean;
}

export interface PlayerMoves {
  complete(session: PlayerSession, actionId: string): Promise<Result<void, CompleteFailure>>;
  /** Completes the action, or replaces the photo of an action already completed. */
  completeWithPhoto(session: PlayerSession, actionId: string, photo: PreparedPhoto): Promise<Result<void, WriteFailure>>;
  /** Also deletes the completion's photo. */
  undo(session: PlayerSession, actionId: string): Promise<Result<void, WriteFailure>>;
  deleteOwnPhoto(session: PlayerSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>>;
  ownPhotos(session: PlayerSession): Promise<Result<readonly OwnPhoto[], WriteFailure>>;
}

export interface EveningAdmin {
  addAction(session: AdminSession, draft: ActionDraft): Promise<Result<Action, WriteFailure>>;
  updateAction(session: AdminSession, actionId: string, draft: ActionDraft): Promise<Result<void, UpdateActionFailure>>;
  /** Also deletes every completion of that action, with their photos. */
  removeAction(session: AdminSession, actionId: string): Promise<Result<void, WriteFailure>>;
  album(session: AdminSession): Promise<Result<readonly AlbumPhoto[], WriteFailure>>;
  deletePhoto(session: AdminSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>>;
  /** Removes every player, completion and photo; the action list stays for the next evening. */
  resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>>;
}

export interface PhotoProcessor {
  /** Re-encodes the picked image: JPEG, correct orientation, bounded size. */
  prepare(file: File): Promise<PreparedPhoto>;
}

export interface NamedFile {
  readonly name: string;
  readonly blob: Blob;
}

export interface PhotoExporter {
  canShare(files: readonly NamedFile[]): boolean;
  /** Must be called straight from a tap: browsers require a user gesture to share. */
  share(files: readonly NamedFile[]): Promise<'shared' | 'cancelled'>;
  download(file: NamedFile): void;
  downloadZip(files: readonly NamedFile[], zipName: string): Promise<void>;
}

export interface SessionStore {
  read(): string | null;
  write(token: string): void;
  clear(): void;
}

export type HapticPattern = 'tap' | 'success' | 'warning';

export interface Haptics {
  pulse(pattern: HapticPattern): void;
}
