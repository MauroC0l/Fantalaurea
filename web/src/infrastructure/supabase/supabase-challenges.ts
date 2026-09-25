import type { SupabaseClient } from '@supabase/supabase-js';
import { SessionExpiredError, type ChallengeFailure, type Challenges, type WriteFailure } from '../../application/ports';
import type { Challenge, ChallengeCompleter, ChallengeDraft, ChallengeEdit } from '../../domain/challenge';
import type { PlayerSession, Session } from '../../domain/player';
import { err, ok, type Result } from '../../domain/result';
import type { ChangeSignals } from './change-signals';

// Shape returned by the challenges RPC (supabase/migrations, challenges).
interface ChallengeJson {
  id: string;
  title: string;
  description: string;
  points: number;
  winnersLimit: number | null;
  startsAt: string;
  endsAt: string;
  creator: { id: string; nickname: string } | null;
  canManage: boolean;
  completions: number;
  mine: { at: string; rank: number } | null;
  winners: { id: string; nickname: string; avatarId: string | null; at: string }[];
}

const INVALID_AUTHORIZATION = '28000';

/** Challenges through token-checked RPCs; every change is announced as "challenges" (ADR 0020). */
export class SupabaseChallenges implements Challenges {
  readonly #client: SupabaseClient;
  readonly #signals: ChangeSignals;

  constructor(client: SupabaseClient, signals: ChangeSignals) {
    this.#client = client;
    this.#signals = signals;
  }

  async list(session: Session): Promise<readonly Challenge[]> {
    const { data, error } = await this.#client.rpc('challenges', { p_token: session.token });
    if (error) throw error.code === INVALID_AUTHORIZATION ? new SessionExpiredError() : new Error(error.message);
    return (data as ChallengeJson[]).map(toChallenge);
  }

  async completers(session: Session, challengeId: string): Promise<readonly ChallengeCompleter[]> {
    const { data, error } = await this.#client.rpc('challenge_completers', { p_token: session.token, p_challenge: challengeId });
    if (error) throw error.code === INVALID_AUTHORIZATION ? new SessionExpiredError() : new Error(error.message);
    return (data as { id: string; nickname: string; avatar_id: string | null; completed_at: string; rank: number; earned: boolean }[]).map(
      (row) => ({
        id: row.id,
        nickname: row.nickname,
        avatarId: row.avatar_id,
        at: new Date(row.completed_at),
        rank: Number(row.rank),
        earned: row.earned,
      }),
    );
  }

  async create(session: Session, draft: ChallengeDraft): Promise<Result<string, ChallengeFailure>> {
    const { data, error } = await this.#client.rpc('create_challenge', {
      p_token: session.token,
      p_title: draft.title,
      p_description: draft.description,
      p_points: draft.points,
      p_duration_minutes: draft.durationMinutes,
      p_winners_limit: draft.winnersLimit,
    });
    if (error) return err('unavailable');
    const reply = data as { status: 'ok'; challengeId: string } | { status: 'unauthorized' | 'forbidden' | 'rejected' | 'disabled' };
    if (reply.status !== 'ok') return err(reply.status);
    this.#signals.announce(['challenges']);
    return ok(reply.challengeId);
  }

  update(session: Session, challengeId: string, edit: ChallengeEdit): Promise<Result<void, WriteFailure>> {
    return this.#write<WriteFailure>('update_challenge', {
      p_token: session.token,
      p_challenge: challengeId,
      p_title: edit.title,
      p_description: edit.description,
      p_points: edit.points,
      p_winners_limit: edit.winnersLimit,
      p_extend_minutes: edit.extendMinutes,
    });
  }

  end(session: Session, challengeId: string): Promise<Result<void, WriteFailure>> {
    return this.#write<WriteFailure>('end_challenge', { p_token: session.token, p_challenge: challengeId });
  }

  remove(session: Session, challengeId: string): Promise<Result<void, WriteFailure>> {
    return this.#write<WriteFailure>('delete_challenge', { p_token: session.token, p_challenge: challengeId });
  }

  complete(session: PlayerSession, challengeId: string): Promise<Result<void, ChallengeFailure>> {
    return this.#write<ChallengeFailure>('complete_challenge', { p_token: session.token, p_challenge: challengeId });
  }

  undo(session: PlayerSession, challengeId: string): Promise<Result<void, WriteFailure>> {
    return this.#write<WriteFailure>('undo_challenge', { p_token: session.token, p_challenge: challengeId });
  }

  async #write<E extends string>(fn: string, args: Record<string, unknown>): Promise<Result<void, E | 'unavailable'>> {
    const { data, error } = await this.#client.rpc(fn, args);
    if (error) return err('unavailable');
    if (data !== 'ok') return err(data as E);
    // Points move too: the ranking listens to "challenges".
    this.#signals.announce(['challenges']);
    return ok(undefined);
  }
}

function toChallenge(json: ChallengeJson): Challenge {
  return {
    ...json,
    startsAt: new Date(json.startsAt),
    endsAt: new Date(json.endsAt),
    completions: Number(json.completions),
    mine: json.mine ? { at: new Date(json.mine.at), rank: Number(json.mine.rank) } : null,
    winners: json.winners.map((w) => ({ ...w, at: new Date(w.at) })),
  };
}
