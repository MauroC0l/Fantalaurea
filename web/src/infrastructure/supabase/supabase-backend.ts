import { createClient, type PostgrestError, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  SessionExpiredError,
  type AlbumPhoto,
  type ChangedTable,
  type CompleteFailure,
  type EveningAdmin,
  type GameBoard,
  type JoinFailure,
  type PhotoDeletion,
  type PhotoLinkProvider,
  type PhotoLinks,
  type PlayerAccounts,
  type PlayerMoves,
  type PreparedPhoto,
  type ResumeFailure,
  type Unavailable,
  type UpdateActionFailure,
  type WriteFailure,
} from '../../application/ports';
import type { Action, ActionDraft } from '../../domain/action';
import type { Completion } from '../../domain/completion';
import type { AccessLogEntry, JoinRequest } from '../../domain/evening';
import type { FeedItem, Liker } from '../../domain/feed';
import type { AdminSession, Participant, PlayerSession, Session } from '../../domain/player';
import type { Profile } from '../../domain/profile';
import { err, ok, type Result } from '../../domain/result';

// Shapes returned by supabase/migrations and supabase/functions/photos.
type SessionRow =
  | { role: 'admin'; token: string }
  | { role: 'player'; token: string; player: { id: string; nickname: string; realName: string } };
interface ActionRow {
  id: string;
  title: string;
  description: string;
  kind: Action['kind'];
  points: number;
  photo_policy: Action['photoPolicy'];
  difficulty: Action['difficulty'];
}
interface CompletionRow {
  completion_id: string;
  action_id: string;
  completed_at: string;
  photo_id: string | null;
  by_id: string;
  by_nickname: string;
}
interface ParticipantRow {
  id: string;
  nickname: string;
  real_name: string;
  avatar_id: string | null;
  actions_done: number;
  points: number;
}
interface FeedRow {
  item_id: string;
  item_kind: 'post' | 'completion';
  created_at: string;
  player_id: string;
  nickname: string;
  avatar_id: string | null;
  photo_id: string | null;
  caption: string | null;
  action_title: string | null;
  action_kind: Action['kind'] | null;
  action_points: number | null;
  like_count: number;
  liked_by_me: boolean;
}
interface ProfileJson {
  player: { id: string; nickname: string; realName: string; bio: string; avatarId: string | null };
  completions: {
    id: string;
    actionId: string;
    title: string;
    kind: Action['kind'];
    points: number;
    photoId: string | null;
    completedAt: string;
  }[];
  posts: { id: string; photoId: string; caption: string; createdAt: string }[];
}
type FunctionReply<T = unknown> = { status: 'ok' } & T;
type FunctionFailure = { status: 'unauthorized' | 'rejected' | 'error' };

const CHANNEL = 'fantalaurea';
const INVALID_TEXT_REPRESENTATION = '22P02';
const INVALID_AUTHORIZATION = '28000';
const PHOTOS_FUNCTION = 'photos';
const MAX_LINKS_PER_REQUEST = 100;

export interface SupabaseBackendOptions {
  /** Many changes at once produce many signals: listeners hear about them once, after a pause. */
  readonly notifyDebounceMs: number;
}

export class SupabaseBackend implements PlayerAccounts, GameBoard, PlayerMoves, EveningAdmin, PhotoLinkProvider {
  readonly #client: SupabaseClient;
  readonly #url: string;
  readonly #options: SupabaseBackendOptions;
  readonly #listeners = new Set<(table: ChangedTable) => void>();
  readonly #linkCache = new Map<string, PhotoLinks>();
  readonly #pendingTables = new Set<ChangedTable>();
  #channel: RealtimeChannel | null = null;
  #notifyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(url: string, publishableKey: string, options: SupabaseBackendOptions) {
    this.#client = createClient(url, publishableKey, { auth: { persistSession: false } });
    this.#url = url.replace(/\/$/, '');
    this.#options = options;
  }

  // ------------------------------------------------------------------ accounts

  async checkSecretWord(word: string): Promise<Result<boolean, Unavailable>> {
    const { data, error } = await this.#client.rpc('check_secret_word', { p_word: word });
    return error ? err('unavailable') : ok(data === true);
  }

  async join(request: JoinRequest): Promise<Result<Session, JoinFailure>> {
    const { resolution } = request;
    const { data, error } = await this.#client.rpc('join_game', {
      p_secret_word: request.secretWord,
      p_nickname: request.identity.nickname,
      p_real_name: request.identity.realName,
      p_device: describeDevice(),
      p_takeover: resolution.kind === 'takeover' ? resolution.playerId : null,
      p_distinct: resolution.kind === 'distinct',
    });
    if (error) return err({ kind: 'unavailable' });
    const reply = data as
      | { session: SessionRow }
      | { error: 'wrong-word' | 'nickname-taken' | 'rejected' }
      | { error: 'real-name-exists'; existing: { id: string; nickname: string } };
    if ('session' in reply) return ok(toSession(reply.session));
    return err(reply.error === 'real-name-exists' ? { kind: reply.error, existing: reply.existing } : { kind: reply.error });
  }

  async resume(token: string): Promise<Result<Session, ResumeFailure>> {
    const { data, error } = await this.#client.rpc('resume_session', { p_token: token });
    // A malformed token (e.g. left over from an older version) is simply unknown.
    if (error) return err(error.code === INVALID_TEXT_REPRESENTATION ? 'unknown-token' : 'unavailable');
    return data ? ok(toSession(data as SessionRow)) : err('unknown-token');
  }

  // ------------------------------------------------------------------ reads

  async catalog(session: Session): Promise<readonly Action[]> {
    return (await this.#read<ActionRow[]>('catalog', { p_token: session.token })).map(toAction);
  }

  async completionsOf(session: PlayerSession): Promise<readonly Completion[]> {
    const rows = await this.#read<CompletionRow[]>('completions_for', { p_token: session.token });
    return rows.map((row) => ({
      id: row.completion_id,
      actionId: row.action_id,
      completedAt: new Date(row.completed_at),
      photoId: row.photo_id,
      by: { id: row.by_id, nickname: row.by_nickname },
    }));
  }

  async participants(session: Session): Promise<readonly Participant[]> {
    const rows = await this.#read<ParticipantRow[]>('participants', { p_token: session.token });
    return rows.map((row) => ({
      player: { id: row.id, nickname: row.nickname, realName: row.real_name },
      avatarId: row.avatar_id,
      actionsDone: Number(row.actions_done),
      points: Number(row.points),
    }));
  }

  async feed(session: Session, before: Date | null): Promise<readonly FeedItem[]> {
    const rows = await this.#read<FeedRow[]>('feed', {
      p_token: session.token,
      p_before: before?.toISOString() ?? null,
      p_limit: 20,
    });
    return rows.map(toFeedItem);
  }

  async profile(session: Session, playerId: string): Promise<Profile | null> {
    const json = await this.#read<ProfileJson | null>('profile', { p_token: session.token, p_player_id: playerId });
    if (!json) return null;
    return {
      ...json.player,
      completions: json.completions.map((c) => ({ ...c, completedAt: new Date(c.completedAt) })),
      posts: json.posts.map((p) => ({ ...p, createdAt: new Date(p.createdAt) })),
    };
  }

  async likers(session: Session, targetId: string): Promise<readonly Liker[]> {
    const rows = await this.#read<{ id: string; nickname: string; avatar_id: string | null }[]>('likers', {
      p_token: session.token,
      p_target: targetId,
    });
    return rows.map((row) => ({ id: row.id, nickname: row.nickname, avatarId: row.avatar_id }));
  }

  onChange(listener: (table: ChangedTable) => void): () => void {
    this.#listeners.add(listener);
    this.#ensureSubscribed();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#unsubscribe();
    };
  }

  /** Signed links last a whole evening (12 h): each id is asked for once per session. */
  async links(session: Session, photoIds: readonly string[]): Promise<ReadonlyMap<string, PhotoLinks>> {
    const missing = [...new Set(photoIds)].filter((id) => !this.#linkCache.has(id));
    for (let start = 0; start < missing.length; start += MAX_LINKS_PER_REQUEST) {
      const batch = missing.slice(start, start + MAX_LINKS_PER_REQUEST);
      const reply = await this.#invoke<{ links: Record<string, PhotoLinks> }>({ op: 'links', token: session.token, photoIds: batch });
      if (!reply.ok) {
        if (reply.error === 'unauthorized') throw new SessionExpiredError();
        throw new Error(`photo links: ${reply.error}`);
      }
      for (const [id, links] of Object.entries(reply.value.links)) this.#linkCache.set(id, this.#absolute(links));
    }
    return new Map(photoIds.flatMap((id) => (this.#linkCache.has(id) ? [[id, this.#linkCache.get(id)!] as const] : [])));
  }

  // ------------------------------------------------------------------ player moves

  async complete(session: PlayerSession, actionId: string): Promise<Result<void, CompleteFailure>> {
    const { data, error } = await this.#client.rpc('complete_action', { p_token: session.token, p_action_id: actionId });
    if (error) return err('unavailable');
    return data === 'ok' ? ok(undefined) : err(data as CompleteFailure);
  }

  async completeWithPhoto(session: PlayerSession, actionId: string, photo: PreparedPhoto): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke(photoForm('complete', session, photo, { actionId })));
  }

  async undo(session: PlayerSession, actionId: string): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke({ op: 'undo', token: session.token, actionId }));
  }

  deleteOwnPhoto(session: PlayerSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>> {
    return this.#deletePhoto(session.token, photoId);
  }

  async toggleLike(session: PlayerSession, targetId: string): Promise<Result<{ liked: boolean }, WriteFailure>> {
    const { data, error } = await this.#client.rpc('toggle_like', { p_token: session.token, p_target: targetId });
    if (error) return err('unavailable');
    const reply = data as { status: 'ok'; liked: boolean } | { status: 'unauthorized' | 'rejected' };
    return reply.status === 'ok' ? ok({ liked: reply.liked }) : err(reply.status);
  }

  async createPost(session: PlayerSession, photo: PreparedPhoto, caption: string): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke(photoForm('post', session, photo, { caption })));
  }

  async deletePost(session: PlayerSession, postId: string): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke({ op: 'delete-post', token: session.token, postId }));
  }

  async updateBio(session: PlayerSession, bio: string): Promise<Result<void, WriteFailure>> {
    const { data, error } = await this.#client.rpc('update_bio', { p_token: session.token, p_bio: bio });
    if (error) return err('unavailable');
    return data === 'ok' ? ok(undefined) : err(data as WriteFailure);
  }

  async setAvatar(session: PlayerSession, photo: PreparedPhoto): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke(photoForm('avatar', session, photo, {})));
  }

  // ------------------------------------------------------------------ admin

  async addAction(session: AdminSession, draft: ActionDraft): Promise<Result<Action, WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_add_action', { p_token: session.token, ...draftArgs(draft) });
    if (error) return err('unavailable');
    const reply = data as { action: Action } | { error: 'unauthorized' | 'rejected' };
    return 'error' in reply ? err(reply.error) : ok(reply.action);
  }

  async updateAction(session: AdminSession, actionId: string, draft: ActionDraft): Promise<Result<void, UpdateActionFailure>> {
    const { data, error } = await this.#client.rpc('admin_update_action', {
      p_token: session.token,
      p_action_id: actionId,
      ...draftArgs(draft),
    });
    if (error) return err('unavailable');
    return data === 'ok' ? ok(undefined) : err(data as UpdateActionFailure);
  }

  async removeAction(session: AdminSession, actionId: string): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke({ op: 'remove-action', token: session.token, actionId }));
  }

  async album(session: AdminSession): Promise<Result<readonly AlbumPhoto[], WriteFailure>> {
    const reply = await this.#invoke<{
      photos: (PhotoLinks & Omit<AlbumPhoto, 'takenAt'> & { takenAt: string })[];
    }>({ op: 'album', token: session.token });
    if (!reply.ok) return reply;
    return ok(reply.value.photos.map((photo) => ({ ...photo, ...this.#absolute(photo), takenAt: new Date(photo.takenAt) })));
  }

  deletePhoto(session: AdminSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>> {
    return this.#deletePhoto(session.token, photoId);
  }

  async secretWord(session: AdminSession): Promise<Result<string, WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_secret_word', { p_token: session.token });
    if (error) return err('unavailable');
    return typeof data === 'string' ? ok(data) : err('unauthorized');
  }

  async setSecretWord(session: AdminSession, word: string | null, sendPlayersOut: boolean): Promise<Result<string, WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_set_secret_word', {
      p_token: session.token,
      p_word: word,
      p_kick_players: sendPlayersOut,
    });
    if (error) return err('unavailable');
    const reply = data as { status: 'ok'; word: string } | { status: 'unauthorized' | 'rejected' };
    return reply.status === 'ok' ? ok(reply.word) : err(reply.status);
  }

  async accessLog(session: AdminSession): Promise<Result<readonly AccessLogEntry[], WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_access_log', { p_token: session.token });
    if (error) return err(error.code === INVALID_AUTHORIZATION ? 'unauthorized' : 'unavailable');
    return ok((data as { at: string; device: string }[]).map((row) => ({ at: new Date(row.at), device: row.device })));
  }

  async resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>> {
    const result = this.#toVoid(await this.#invoke({ op: 'reset', token: session.token }));
    if (result.ok) this.#linkCache.clear();
    return result;
  }

  // ------------------------------------------------------------------ internals

  async #read<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.#client.rpc(fn, args);
    if (error) throw toReadError(error);
    return data as T;
  }

  async #deletePhoto(token: string, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>> {
    const reply = await this.#invoke<{ undone: boolean }>({ op: 'delete-photo', token, photoId });
    return reply.ok ? ok({ undone: reply.value.undone }) : reply;
  }

  async #invoke<T>(body: FormData | Record<string, unknown>): Promise<Result<FunctionReply<T>, WriteFailure>> {
    const { data, error } = await this.#client.functions.invoke(PHOTOS_FUNCTION, { body });
    if (error) return err('unavailable');
    const reply = data as FunctionReply<T> | FunctionFailure;
    if (reply.status === 'ok') return ok(reply as FunctionReply<T>);
    return err(reply.status === 'error' ? 'unavailable' : reply.status);
  }

  #toVoid(result: Result<unknown, WriteFailure>): Result<void, WriteFailure> {
    return result.ok ? ok(undefined) : result;
  }

  /** The function returns host-less links (see supabase/functions/photos). */
  #absolute(links: PhotoLinks): PhotoLinks {
    return { thumbnailUrl: this.#url + links.thumbnailUrl, fullUrl: this.#url + links.fullUrl };
  }

  #ensureSubscribed(): void {
    if (this.#channel) return;
    // The database broadcasts only "table X changed": data is read again with the token (ADR 0011).
    const channel = this.#client
      .channel(CHANNEL)
      .on('broadcast', { event: 'changed' }, ({ payload }) => this.#notifySoon((payload as { table: ChangedTable }).table));
    // A phone waking up may have missed signals while the connection was asleep.
    channel.subscribe((status) => status === 'SUBSCRIBED' && this.#notifyEverything());
    document.addEventListener('visibilitychange', this.#onVisible);
    this.#channel = channel;
  }

  #unsubscribe(): void {
    document.removeEventListener('visibilitychange', this.#onVisible);
    if (this.#channel) void this.#client.removeChannel(this.#channel);
    this.#channel = null;
  }

  readonly #onVisible = () => {
    if (document.visibilityState === 'visible') this.#notifyEverything();
  };

  #notifyEverything(): void {
    for (const table of ALL_TABLES) this.#notifySoon(table);
  }

  #notifySoon(table: ChangedTable): void {
    this.#pendingTables.add(table);
    clearTimeout(this.#notifyTimer);
    this.#notifyTimer = setTimeout(() => {
      const tables = [...this.#pendingTables];
      this.#pendingTables.clear();
      for (const listener of this.#listeners) for (const changed of tables) listener(changed);
    }, this.#options.notifyDebounceMs);
  }
}

const ALL_TABLES: readonly ChangedTable[] = [
  'actions',
  'players',
  'player_completions',
  'shared_completions',
  'posts',
  'likes',
  'sessions',
];

function toReadError(error: PostgrestError): Error {
  return error.code === INVALID_AUTHORIZATION ? new SessionExpiredError() : new Error(error.message);
}

function describeDevice(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function photoForm(op: string, session: PlayerSession, photo: PreparedPhoto, fields: Record<string, string>): FormData {
  const form = new FormData();
  form.append('op', op);
  form.append('token', session.token);
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  form.append('full', photo.full, 'full.jpg');
  form.append('thumbnail', photo.thumbnail, 'thumbnail.jpg');
  return form;
}

function toSession(row: SessionRow): Session {
  return row.role === 'admin'
    ? { role: 'admin', token: row.token }
    : { role: 'player', token: row.token, player: row.player };
}

function toAction(row: ActionRow): Action {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    points: row.points,
    photoPolicy: row.photo_policy,
    difficulty: row.difficulty,
  };
}

function toFeedItem(row: FeedRow): FeedItem {
  const base = {
    id: row.item_id,
    author: { id: row.player_id, nickname: row.nickname, avatarId: row.avatar_id },
    createdAt: new Date(row.created_at),
    likes: { count: Number(row.like_count), likedByMe: row.liked_by_me },
  };
  return row.item_kind === 'post'
    ? { ...base, kind: 'post', photoId: row.photo_id!, caption: row.caption ?? '' }
    : {
        ...base,
        kind: 'completion',
        photoId: row.photo_id,
        action: { title: row.action_title!, kind: row.action_kind!, points: row.action_points! },
      };
}

function draftArgs(draft: ActionDraft) {
  return {
    p_title: draft.title,
    p_description: draft.description,
    p_kind: draft.kind,
    p_photo_policy: draft.photoPolicy,
    p_points: draft.points,
    p_difficulty: draft.difficulty,
  };
}
