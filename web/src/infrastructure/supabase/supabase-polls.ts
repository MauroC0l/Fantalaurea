import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { SessionExpiredError, type PollFailure, type Polls, type WriteFailure } from '../../application/ports';
import type { PlayerSession, Session } from '../../domain/player';
import type { Poll, PollDraft, PollRules } from '../../domain/poll';
import { err, ok, type Result } from '../../domain/result';
import type { ChangeSignals } from './change-signals';

// Shape returned by the polls RPC (supabase/migrations, polls).
interface PollJson extends PollRules {
  closeWhenAllVoted: boolean;
  id: string;
  question: string;
  creator: { id: string; nickname: string } | null;
  closesAt: string | null;
  closed: boolean;
  createdAt: string;
  canManage: boolean;
  voterCount: number;
  myVotes: string[];
  resultsVisible: boolean;
  options: { id: string; label: string; votes: number | null; voters: { id: string; nickname: string; avatarId: string | null }[] | null }[];
}

const INVALID_AUTHORIZATION = '28000';

/** Polls through token-checked RPCs; every change is announced as "polls" (ADR 0019). */
export class SupabasePolls implements Polls {
  readonly #client: SupabaseClient;
  readonly #signals: ChangeSignals;

  constructor(client: SupabaseClient, signals: ChangeSignals) {
    this.#client = client;
    this.#signals = signals;
  }

  async list(session: Session): Promise<readonly Poll[]> {
    const { data, error } = await this.#client.rpc('polls', { p_token: session.token });
    if (error) throw toReadError(error);
    return (data as PollJson[]).map(toPoll);
  }

  async create(session: Session, draft: PollDraft): Promise<Result<string, PollFailure>> {
    const { data, error } = await this.#client.rpc('create_poll', {
      p_token: session.token,
      p_question: draft.question,
      p_options: draft.options,
      p_anonymous: draft.rules.anonymous,
      p_multiple: draft.rules.multiple,
      p_results: draft.rules.results,
      p_vote_change: draft.rules.voteChange,
      p_duration_minutes: draft.durationMinutes,
      // The user meant "automatic" as "timed" (ADR 0021): closing on the last vote is not offered.
      p_close_when_all_voted: false,
    });
    if (error) return err('unavailable');
    const reply = data as { status: 'ok'; pollId: string } | { status: 'unauthorized' | 'forbidden' | 'rejected' | 'disabled' };
    if (reply.status !== 'ok') return err(reply.status);
    this.#signals.announce(['polls']);
    return ok(reply.pollId);
  }

  async vote(session: PlayerSession, pollId: string, optionIds: readonly string[]): Promise<Result<void, PollFailure>> {
    return this.#write<PollFailure>('vote_poll', { p_token: session.token, p_poll: pollId, p_options: optionIds });
  }

  close(session: Session, pollId: string): Promise<Result<void, WriteFailure>> {
    return this.#write<WriteFailure>('close_poll', { p_token: session.token, p_poll: pollId });
  }

  remove(session: Session, pollId: string): Promise<Result<void, WriteFailure>> {
    return this.#write<WriteFailure>('delete_poll', { p_token: session.token, p_poll: pollId });
  }

  async #write<E extends string>(fn: string, args: Record<string, unknown>): Promise<Result<void, E | 'unavailable'>> {
    const { data, error } = await this.#client.rpc(fn, args);
    if (error) return err('unavailable');
    if (data !== 'ok') return err(data as E);
    this.#signals.announce(['polls']);
    return ok(undefined);
  }
}

function toPoll(json: PollJson): Poll {
  return {
    id: json.id,
    question: json.question,
    creator: json.creator,
    rules: {
      anonymous: json.anonymous,
      multiple: json.multiple,
      results: json.results,
      voteChange: json.voteChange,
    },
    closesAt: json.closesAt ? new Date(json.closesAt) : null,
    closed: json.closed,
    createdAt: new Date(json.createdAt),
    canManage: json.canManage,
    voterCount: Number(json.voterCount),
    myVotes: json.myVotes,
    resultsVisible: json.resultsVisible,
    options: json.options.map((o) => ({ ...o, votes: o.votes === null ? null : Number(o.votes) })),
  };
}

function toReadError(error: PostgrestError): Error {
  return error.code === INVALID_AUTHORIZATION ? new SessionExpiredError() : new Error(error.message);
}
