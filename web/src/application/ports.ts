import type { Action, ActionDraft } from '../domain/action';
import type { ChatMessage, ChatPeer, ConversationSummary, DeleteScope, VoiceRecording } from '../domain/chat';
import type { Completion } from '../domain/completion';
import type { AccessLogEntry, JoinRequest } from '../domain/evening';
import type { FeatureName, Features } from '../domain/features';
import type { FeedItem, Liker } from '../domain/feed';
import type { AdminSession, ManagedPlayer, Participant, Permission, Permissions, PlayerSession, Session } from '../domain/player';
import type { Challenge, ChallengeDraft, ChallengeEdit } from '../domain/challenge';
import type { Poll, PollDraft } from '../domain/poll';
import type { Profile } from '../domain/profile';
import type { Result } from '../domain/result';

/** Pages hold at most this many items: a shorter page means there is nothing older. */
export const FEED_PAGE_SIZE = 20;
export const CHAT_PAGE_SIZE = 40;

/** The backend could not be reached or failed unexpectedly. */
export type Unavailable = 'unavailable';

export type JoinFailure =
  | { readonly kind: 'wrong-word' }
  | { readonly kind: 'nickname-taken' }
  | { readonly kind: 'real-name-exists'; readonly existing: { readonly id: string; readonly nickname: string } }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'blocked' }
  | { readonly kind: Unavailable };
export type ResumeFailure = 'unknown-token' | Unavailable;
export type WriteFailure = 'unauthorized' | 'rejected' | Unavailable;
export type CompleteFailure = WriteFailure | 'photo-required';
export type UpdateActionFailure = WriteFailure | 'kind-locked';
/** The admin switched the feature off for this evening. */
export type FeatureFailure = WriteFailure | 'disabled';
/** The player already has PHOTO_LIMIT photos: one must go before another comes. */
export type PhotoLimitFailure = 'photo-limit';

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

export const CHANGED_TABLES = [
  'actions',
  'players',
  'player_completions',
  'shared_completions',
  'posts',
  'likes',
  'sessions',
  'evening_settings',
  'polls',
  'challenges',
] as const;
export type ChangedTable = (typeof CHANGED_TABLES)[number];

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
  features(session: Session): Promise<Features>;
  permissions(session: Session): Promise<Permissions>;
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
  completeWithPhoto(
    session: PlayerSession,
    actionId: string,
    photo: PreparedPhoto,
  ): Promise<Result<void, WriteFailure | PhotoLimitFailure>>;
  /** Also deletes the completion's photo. */
  undo(session: PlayerSession, actionId: string): Promise<Result<void, WriteFailure>>;
  /** Works for action photos, post photos (deletes the post) and the profile photo. */
  deleteOwnPhoto(session: PlayerSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>>;
  toggleLike(session: PlayerSession, targetId: string): Promise<Result<{ liked: boolean }, WriteFailure>>;
  createPost(session: PlayerSession, photo: PreparedPhoto, caption: string): Promise<Result<void, FeatureFailure | PhotoLimitFailure>>;
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
  setFeature(session: AdminSession, feature: FeatureName, enabled: boolean): Promise<Result<void, WriteFailure>>;
  players(session: AdminSession): Promise<Result<readonly ManagedPlayer[], WriteFailure>>;
  /** Blocking sends the player out at once and hides what they posted, until unblocked. */
  setBlocked(session: AdminSession, playerId: string, blocked: boolean): Promise<Result<void, WriteFailure>>;
  setPermission(session: AdminSession, playerId: string, permission: Permission, enabled: boolean): Promise<Result<void, WriteFailure>>;
  /** Removes players, completions, posts, photos and the access log; draws a new secret word. */
  resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>>;
}

export interface ChatMediaLinks {
  readonly url: string;
  /** Photos only. */
  readonly thumbnailUrl?: string;
}

/** Private conversations between two players (ADR 0015). Reads reject like GameBoard's. */
export interface Chat {
  conversations(session: PlayerSession): Promise<readonly ConversationSummary[]>;
  conversation(session: PlayerSession, conversationId: string): Promise<{ id: string; other: ChatPeer } | null>;
  /** Newest first, older than `before` when given. */
  messages(session: PlayerSession, conversationId: string, before: Date | null): Promise<readonly ChatMessage[]>;
  mediaLinks(session: PlayerSession, messageIds: readonly string[]): Promise<ReadonlyMap<string, ChatMediaLinks>>;
  open(session: PlayerSession, otherPlayerId: string): Promise<Result<string, FeatureFailure>>;
  /** replyTo: id of the message answered, if any. */
  sendText(session: PlayerSession, conversationId: string, text: string, replyTo: string | null): Promise<Result<void, FeatureFailure>>;
  sendPhoto(
    session: PlayerSession,
    conversationId: string,
    photo: PreparedPhoto,
    replyTo: string | null,
  ): Promise<Result<void, FeatureFailure | PhotoLimitFailure>>;
  sendVoice(
    session: PlayerSession,
    conversationId: string,
    voice: VoiceRecording,
    replyTo: string | null,
  ): Promise<Result<void, FeatureFailure>>;
  editMessage(session: PlayerSession, messageId: string, text: string): Promise<Result<void, FeatureFailure>>;
  deleteMessage(session: PlayerSession, messageId: string, scope: DeleteScope): Promise<Result<void, WriteFailure>>;
  forward(
    session: PlayerSession,
    messageId: string,
    conversationIds: readonly string[],
  ): Promise<Result<void, FeatureFailure | PhotoLimitFailure>>;
  markRead(session: PlayerSession, conversationId: string): Promise<void>;
  markUnread(session: PlayerSession, conversationId: string): Promise<Result<void, WriteFailure>>;
  /** "empty" keeps the chat in the list; "remove" takes it out until a new message arrives. Only for this player. */
  clear(session: PlayerSession, conversationId: string, mode: 'empty' | 'remove'): Promise<Result<void, WriteFailure>>;
  /** Tells the other person "sta scrivendo…". Fire and forget. */
  typing(session: PlayerSession, conversationId: string): void;
  /** A conversation of this player changed: new, edited or deleted message. */
  onInbox(session: PlayerSession, listener: (conversationId: string) => void): () => void;
  onTyping(session: PlayerSession, listener: (conversationId: string) => void): () => void;
}

export type RecordingFailure = 'denied' | 'unsupported';

export interface VoiceRecorder {
  /** Asks for the microphone the first time (a system dialog). */
  start(): Promise<Result<void, RecordingFailure>>;
  /** A recording reaching the maximum length stops by itself; stop() still returns it. */
  stop(): Promise<VoiceRecording | null>;
  cancel(): void;
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

/** "forbidden": this player may not create polls; "closed": too late to vote; "locked": voted already, no changes. */
export type PollFailure = FeatureFailure | 'forbidden' | 'closed' | 'locked';

/** Polls of the evening (ADR 0019). Reads reject like GameBoard's. */
export interface Polls {
  list(session: Session): Promise<readonly Poll[]>;
  create(session: Session, draft: PollDraft): Promise<Result<string, PollFailure>>;
  vote(session: PlayerSession, pollId: string, optionIds: readonly string[]): Promise<Result<void, PollFailure>>;
  close(session: Session, pollId: string): Promise<Result<void, WriteFailure>>;
  remove(session: Session, pollId: string): Promise<Result<void, WriteFailure>>;
}

/** "forbidden": may not create; "ended": time is up; "full": the first N already made it. */
export type ChallengeFailure = FeatureFailure | 'forbidden' | 'ended' | 'full';

/** Timed challenges (ADR 0020). Reads reject like GameBoard's. */
export interface Challenges {
  list(session: Session): Promise<readonly Challenge[]>;
  create(session: Session, draft: ChallengeDraft): Promise<Result<string, ChallengeFailure>>;
  update(session: Session, challengeId: string, edit: ChallengeEdit): Promise<Result<void, WriteFailure>>;
  end(session: Session, challengeId: string): Promise<Result<void, WriteFailure>>;
  remove(session: Session, challengeId: string): Promise<Result<void, WriteFailure>>;
  complete(session: PlayerSession, challengeId: string): Promise<Result<void, ChallengeFailure>>;
  undo(session: PlayerSession, challengeId: string): Promise<Result<void, WriteFailure>>;
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
