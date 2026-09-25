import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AlbumPhoto,
  CompleteFailure,
  EveningAdmin,
  GameBoard,
  JoinFailure,
  OwnPhoto,
  PhotoDeletion,
  PlayerAccounts,
  PlayerMoves,
  PreparedPhoto,
  ResumeFailure,
  UpdateActionFailure,
  WriteFailure,
} from '../../application/ports';
import type { Action, ActionDraft } from '../../domain/action';
import type { Completion } from '../../domain/completion';
import type { AdminSession, Identity, Participant, PlayerSession, Session } from '../../domain/player';
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
  action_id: string;
  completed_at: string;
  has_photo: boolean;
  by_id: string;
  by_nickname: string;
}
interface ParticipantRow {
  id: string;
  nickname: string;
  real_name: string;
  actions_done: number;
  points: number;
}
type FunctionReply<T = unknown> = { status: 'ok' } & T;
type FunctionFailure = { status: 'unauthorized' | 'rejected' | 'error' };
type LinkRow = { id: string; thumbnailUrl: string; fullUrl: string };

const REALTIME_TABLES = ['actions', 'players', 'player_completions', 'shared_completions'] as const;
const INVALID_TEXT_REPRESENTATION = '22P02';
const PHOTOS_FUNCTION = 'photos';

export interface SupabaseBackendOptions {
  /** Many taps at once produce many events: listeners hear about them once, after a pause. */
  readonly notifyDebounceMs: number;
}

export class SupabaseBackend implements PlayerAccounts, GameBoard, PlayerMoves, EveningAdmin {
  readonly #client: SupabaseClient;
  readonly #url: string;
  readonly #options: SupabaseBackendOptions;
  readonly #listeners = new Set<() => void>();
  #channel: RealtimeChannel | null = null;
  #notifyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(url: string, publishableKey: string, options: SupabaseBackendOptions) {
    this.#client = createClient(url, publishableKey, { auth: { persistSession: false } });
    this.#url = url.replace(/\/$/, '');
    this.#options = options;
  }

  async join(identity: Identity): Promise<Result<Session, JoinFailure>> {
    const { data, error } = await this.#client.rpc('join_game', {
      p_nickname: identity.nickname,
      p_real_name: identity.realName,
    });
    if (error) return err('unavailable');
    const reply = data as { session: SessionRow } | { error: 'nickname-taken' };
    return 'error' in reply ? err(reply.error) : ok(toSession(reply.session));
  }

  async resume(token: string): Promise<Result<Session, ResumeFailure>> {
    const { data, error } = await this.#client.rpc('resume_session', { p_token: token });
    // A malformed token (e.g. left over from an older version) is simply unknown.
    if (error) return err(error.code === INVALID_TEXT_REPRESENTATION ? 'unknown-token' : 'unavailable');
    return data ? ok(toSession(data as SessionRow)) : err('unknown-token');
  }

  async catalog(): Promise<readonly Action[]> {
    const { data, error } = await this.#client
      .from('actions')
      .select('id, title, description, kind, points, photo_policy, difficulty')
      .order('position');
    if (error) throw error;
    return (data as ActionRow[]).map(toAction);
  }

  async completionsOf(session: PlayerSession): Promise<readonly Completion[]> {
    const { data, error } = await this.#client.rpc('completions_for', { p_player_id: session.player.id });
    if (error) throw error;
    return (data as CompletionRow[]).map((row) => ({
      actionId: row.action_id,
      completedAt: new Date(row.completed_at),
      hasPhoto: row.has_photo,
      by: { id: row.by_id, nickname: row.by_nickname },
    }));
  }

  async participants(): Promise<readonly Participant[]> {
    const { data, error } = await this.#client.rpc('participants');
    if (error) throw error;
    return (data as ParticipantRow[]).map((row) => ({
      player: { id: row.id, nickname: row.nickname, realName: row.real_name },
      actionsDone: Number(row.actions_done),
      points: Number(row.points),
    }));
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    this.#ensureSubscribed();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#unsubscribe();
    };
  }

  async complete(session: PlayerSession, actionId: string): Promise<Result<void, CompleteFailure>> {
    const { data, error } = await this.#client.rpc('complete_action', { p_token: session.token, p_action_id: actionId });
    if (error) return err('unavailable');
    return data === 'ok' ? ok(undefined) : err(data as CompleteFailure);
  }

  async completeWithPhoto(
    session: PlayerSession,
    actionId: string,
    photo: PreparedPhoto,
  ): Promise<Result<void, WriteFailure>> {
    const form = new FormData();
    form.append('token', session.token);
    form.append('actionId', actionId);
    form.append('full', photo.full, 'full.jpg');
    form.append('thumbnail', photo.thumbnail, 'thumbnail.jpg');
    return this.#toVoid(await this.#invoke(form));
  }

  async undo(session: PlayerSession, actionId: string): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke({ op: 'undo', token: session.token, actionId }));
  }

  deleteOwnPhoto(session: PlayerSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>> {
    return this.#deletePhoto(session.token, photoId);
  }

  async ownPhotos(session: PlayerSession): Promise<Result<readonly OwnPhoto[], WriteFailure>> {
    const reply = await this.#invoke<{ photos: (LinkRow & { actionId: string })[] }>({
      op: 'own-photos',
      token: session.token,
    });
    return reply.ok ? ok(reply.value.photos.map((photo) => ({ ...photo, ...this.#absolute(photo) }))) : reply;
  }

  async addAction(session: AdminSession, draft: ActionDraft): Promise<Result<Action, WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_add_action', {
      p_token: session.token,
      ...draftArgs(draft),
    });
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
      photos: (LinkRow & { actionTitle: string; nickname: string; realName: string; takenAt: string })[];
    }>({ op: 'album', token: session.token });
    if (!reply.ok) return reply;
    return ok(
      reply.value.photos.map((photo) => ({ ...photo, ...this.#absolute(photo), takenAt: new Date(photo.takenAt) })),
    );
  }

  deletePhoto(session: AdminSession, photoId: string): Promise<Result<PhotoDeletion, WriteFailure>> {
    return this.#deletePhoto(session.token, photoId);
  }

  async resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>> {
    return this.#toVoid(await this.#invoke({ op: 'reset', token: session.token }));
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
  #absolute(links: LinkRow): Pick<LinkRow, 'thumbnailUrl' | 'fullUrl'> {
    return { thumbnailUrl: this.#url + links.thumbnailUrl, fullUrl: this.#url + links.fullUrl };
  }

  #ensureSubscribed(): void {
    if (this.#channel) return;
    const channel = this.#client.channel('fantalaurea-changes');
    for (const table of REALTIME_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.#notifySoon());
    }
    // A phone waking up may have missed events while the connection was asleep.
    channel.subscribe((status) => status === 'SUBSCRIBED' && this.#notifySoon());
    document.addEventListener('visibilitychange', this.#onVisible);
    this.#channel = channel;
  }

  #unsubscribe(): void {
    document.removeEventListener('visibilitychange', this.#onVisible);
    if (this.#channel) void this.#client.removeChannel(this.#channel);
    this.#channel = null;
  }

  readonly #onVisible = () => {
    if (document.visibilityState === 'visible') this.#notifySoon();
  };

  #notifySoon(): void {
    clearTimeout(this.#notifyTimer);
    this.#notifyTimer = setTimeout(
      () => this.#listeners.forEach((listener) => listener()),
      this.#options.notifyDebounceMs,
    );
  }
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
