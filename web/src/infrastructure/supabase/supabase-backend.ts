import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type {
  EveningAdmin,
  GameBoard,
  JoinFailure,
  PlayerAccounts,
  ResumeFailure,
  WriteFailure,
} from '../../application/ports';
import type { Action, ActionDraft } from '../../domain/action';
import type { ActionCounts } from '../../domain/counts';
import type { AdminSession, Identity, Participant, PlayerSession, Session } from '../../domain/player';
import { err, ok, type Result } from '../../domain/result';

// Row shapes returned by the functions in supabase/migrations.
type SessionRow =
  | { role: 'admin'; token: string }
  | { role: 'player'; token: string; player: { id: string; nickname: string; realName: string } };
type WriteStatus = 'ok' | 'unauthorized' | 'rejected';
interface ParticipantRow {
  id: string;
  nickname: string;
  real_name: string;
  actions_done: number;
}

const REALTIME_TABLES = ['actions', 'players', 'player_counts', 'shared_counts'] as const;
const INVALID_TEXT_REPRESENTATION = '22P02';

export interface SupabaseBackendOptions {
  /** Many taps at once produce many events: listeners hear about them once, after a pause. */
  readonly notifyDebounceMs: number;
}

export class SupabaseBackend implements PlayerAccounts, GameBoard, EveningAdmin {
  readonly #client: SupabaseClient;
  readonly #options: SupabaseBackendOptions;
  readonly #listeners = new Set<() => void>();
  #channel: RealtimeChannel | null = null;
  #notifyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(url: string, publishableKey: string, options: SupabaseBackendOptions) {
    this.#client = createClient(url, publishableKey, { auth: { persistSession: false } });
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
    // A malformed token (e.g. left over from the in-memory backend) is simply unknown.
    if (error) return err(error.code === INVALID_TEXT_REPRESENTATION ? 'unknown-token' : 'unavailable');
    return data ? ok(toSession(data as SessionRow)) : err('unknown-token');
  }

  async catalog(): Promise<readonly Action[]> {
    const { data, error } = await this.#client.from('actions').select('id, label, kind, points').order('position');
    if (error) throw error;
    return data as Action[];
  }

  async countsOf(session: PlayerSession): Promise<ActionCounts> {
    const { data, error } = await this.#client.rpc('counts_for', { p_player_id: session.player.id });
    if (error) throw error;
    return Object.fromEntries((data as { action_id: string; count: number }[]).map((row) => [row.action_id, row.count]));
  }

  async setCount(session: PlayerSession, actionId: string, count: number): Promise<Result<void, WriteFailure>> {
    const { data, error } = await this.#client.rpc('set_count', {
      p_token: session.token,
      p_action_id: actionId,
      p_count: count,
    });
    return error ? err('unavailable') : toWriteResult(data as WriteStatus);
  }

  async participants(): Promise<readonly Participant[]> {
    const { data, error } = await this.#client.rpc('participants');
    if (error) throw error;
    return (data as ParticipantRow[]).map((row) => ({
      player: { id: row.id, nickname: row.nickname, realName: row.real_name },
      actionsDone: Number(row.actions_done),
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

  async addAction(session: AdminSession, draft: ActionDraft): Promise<Result<Action, WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_add_action', {
      p_token: session.token,
      p_label: draft.label,
      p_kind: draft.kind,
    });
    if (error) return err('unavailable');
    const reply = data as { action: Action } | { error: 'unauthorized' | 'rejected' };
    return 'error' in reply ? err(reply.error) : ok(reply.action);
  }

  async removeAction(session: AdminSession, actionId: string): Promise<Result<void, WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_remove_action', {
      p_token: session.token,
      p_action_id: actionId,
    });
    return error ? err('unavailable') : toWriteResult(data as WriteStatus);
  }

  async resetEvening(session: AdminSession): Promise<Result<void, WriteFailure>> {
    const { data, error } = await this.#client.rpc('admin_reset_evening', { p_token: session.token });
    return error ? err('unavailable') : toWriteResult(data as WriteStatus);
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

function toWriteResult(status: WriteStatus): Result<void, WriteFailure> {
  return status === 'ok' ? ok(undefined) : err(status);
}
