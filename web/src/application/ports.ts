import type { Action, ActionDraft } from '../domain/action';
import type { Completion } from '../domain/completion';
import type { AccessLogEntry, JoinRequest } from '../domain/evening';
import type { FeedItem, Liker } from '../domain/feed';
import type { AdminSession, Participant, PlayerSession, Session } from '../domain/player';
import type { Profile } from '../domain/profile';
import type { Result } from '../domain/result';

/** The backend could not be reached or failed unexpectedly. */
export type Unavailable = 'unavailable';

export type JoinFailure =
  | { readonly kind: 'wrong-word' }
  | { readonly kind: 'nickname-taken' }
  | { readonly kind: 'real-name-exists'; readonly existing: { readonly id: string; readonly nickname: string } }
  | { readonly kind: 'rejected' }
  | { readonly kind: Unavailable };
export type ResumeFailure = 'unknown-token' | Unavailable;
export type WriteFailure = 'unauthorized' | 'rejected' | Unavailable;
export type CompleteFailure = WriteFailure | 'photo-required';
export type UpdateActionFailure = WriteFailure | 'kind-locked';

/** Thrown by reads when the token is no longer valid (evening reset, players sent out). */
export class SessionExpiredError extends Error {
  constructor() {
    super('session expired');
    this.name = 'SessionExpiredError';
  }
}

export interface PlayerAccounts {
  checkSecretWord(word: string): Promise<Result<boolean, Unavailable>>;
  /** The admin credentials open an admin session without the secret word. */
  join(request: JoinRequest): Promise<Result<Session, JoinFailure>>;
  resume(token: string): Promise<Result<Session, ResumeFailure>>;
}

export type ChangedTable =
  | 'actions'
  | 'players'
  | 'player_completions'
  | 'shared_completions'
  | 'posts'
  | 'likes'
  | 'sessions';

/** Reads reject with SessionExpiredError, or any other error when the backend is unavailable. */
export interface GameBoard {
  catalog(session: Session): Promise<readonly Action[]>;
  /** The player's completions plus the shared ones, whoever marked them. */
  completionsOf(session: PlayerSession): Promise<readonly Completion[]>;
  participants(session: Session): Promise<readonly Participant[]>;
  /** Newest first, older than `before` when given. */
  feed(session: Session, before: Date | null): Promise<readonly FeedItem[]>;
  profile(session: Session, playerId: string): Promise<Profile | null>;
  likers(session: Session, targetId: string): Promise<readonly Liker[]>;
  /** Notifies which table changed; returns the unsubscribe function. */
  onChange(listener: (table: ChangedTable) => void): () => void;
}

export interface PhotoLinks {
  readonly thumbnailUrl: string;
  readonly fullUrl: string;
}

export interface PhotoLinkProvider {
  /** Only ids of existing photos come back. */
  links(session: Session, photoIds: readonly string[]): Promise<ReadonlyMap<string, PhotoLinks>>;
}

/** A photo ready to upload: full size plus a small preview for grids. */
export interface PreparedPhoto {
  readonly full: Blob;
  readonly thumbnail: Blob;
}

export interface AlbumPhoto extends PhotoLinks {
  readonly id: string;
  readonly source: 'action' | 'post';
  readonly title: string;
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
  /** Works for action photos, post photos (deletes the post) and the profile photo. */
  deleteOwnPhoto(session: PlayerSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>>;
  toggleLike(session: PlayerSession, targetId: string): Promise<Result<{ liked: boolean }, WriteFailure>>;
  createPost(session: PlayerSession, photo: PreparedPhoto, caption: string): Promise<Result<void, WriteFailure>>;
  deletePost(session: PlayerSession, postId: string): Promise<Result<void, WriteFailure>>;
  updateBio(session: PlayerSession, bio: string): Promise<Result<void, WriteFailure>>;
  setAvatar(session: PlayerSession, photo: PreparedPhoto): Promise<Result<void, WriteFailure>>;
}

export interface EveningAdmin {
  addAction(session: AdminSession, draft: ActionDraft): Promise<Result<Action, WriteFailure>>;
  updateAction(session: AdminSession, actionId: string, draft: ActionDraft): Promise<Result<void, UpdateActionFailure>>;
  /** Also deletes every completion of that action, with their photos. */
  removeAction(session: AdminSession, actionId: string): Promise<Result<void, WriteFailure>>;
  album(session: AdminSession): Promise<Result<readonly AlbumPhoto[], WriteFailure>>;
  /** Moderation: deleting a post's photo deletes the post. */
  deletePhoto(session: AdminSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>>;
  secretWord(session: AdminSession): Promise<Result<string, WriteFailure>>;
  /** `word` null = draw a new one. Returns the word now in force. */
  setSecretWord(session: AdminSession, word: string | null, sendPlayersOut: boolean): Promise<Result<string, WriteFailure>>;
  accessLog(session: AdminSession): Promise<Result<readonly AccessLogEntry[], WriteFailure>>;
  /** Removes players, completions, posts, photos and the access log; draws a new secret word. */
  resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>>;
}

export type PhotoShape = 'original' | 'square';

export interface PhotoProcessor {
  /** Re-encodes the picked image: JPEG, correct orientation, bounded size; `square` crops the centre. */
  prepare(file: File, shape: PhotoShape): Promise<PreparedPhoto>;
}

export interface NamedFile {
  readonly name: string;
  readonly blob: Blob;
}

export interface PhotoExporter {
  canShare(files: readonly NamedFile[]): boolean;
  /** Must be called straight from a tap: browsers require a user gesture to share. */
  share(files: readonly NamedFile[]): Promise<'shared' | 'cancelled'>;
  shareText(text: string): Promise<'shared' | 'cancelled' | 'unsupported'>;
  download(file: NamedFile): void;
  downloadZip(files: readonly NamedFile[], zipName: string): Promise<void>;
}

export interface Clipboard {
  copy(text: string): Promise<boolean>;
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
