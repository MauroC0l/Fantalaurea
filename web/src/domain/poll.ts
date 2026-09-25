import { err, ok, type Result } from './result';
import { normalizeText } from './text';

export const POLL_QUESTION_MAX = 200;
export const POLL_OPTION_MAX = 100;
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 10;
/** Durations offered when creating a poll, in minutes; null = until closed by hand. */
export const POLL_DURATIONS: readonly (number | null)[] = [null, 5, 15, 30, 60, 120];
/** Longest custom duration, in minutes (the server checks the same). */
export const POLL_DURATION_MAX = 1440;

/** When the others see how the votes are going. */
export type ResultsVisibility = 'always' | 'after-vote' | 'after-close';

export interface PollRules {
  readonly anonymous: boolean;
  readonly multiple: boolean;
  readonly results: ResultsVisibility;
  readonly voteChange: boolean;
}

export interface PollDraft {
  readonly question: string;
  readonly options: readonly string[];
  readonly rules: PollRules;
  readonly durationMinutes: number | null;
}

export type PollDraftError = 'question-too-short' | 'question-too-long' | 'too-few-options' | 'too-many-options' | 'option-too-long' | 'duplicate-options';

export interface PollVoter {
  readonly id: string;
  readonly nickname: string;
  readonly avatarId: string | null;
}

export interface PollOption {
  readonly id: string;
  readonly label: string;
  /** null while the rules keep results hidden. */
  readonly votes: number | null;
  /** null when hidden or the poll is anonymous. */
  readonly voters: readonly PollVoter[] | null;
}

export interface Poll {
  readonly id: string;
  readonly question: string;
  /** null = the admin. */
  readonly creator: { readonly id: string; readonly nickname: string } | null;
  readonly rules: PollRules;
  readonly closesAt: Date | null;
  /** Closed by hand, by time or because everyone voted, as the server saw it when read. */
  readonly closed: boolean;
  readonly createdAt: Date;
  readonly canManage: boolean;
  readonly voterCount: number;
  readonly myVotes: readonly string[];
  readonly resultsVisible: boolean;
  readonly options: readonly PollOption[];
}

export const DEFAULT_POLL_RULES: PollRules = {
  anonymous: true,
  multiple: false,
  results: 'after-vote',
  voteChange: true,
};

/** The draft as it will be sent: trimmed, empty options dropped. */
export function validatePollDraft(draft: PollDraft): Result<PollDraft, readonly PollDraftError[]> {
  const question = normalizeText(draft.question);
  const options = draft.options.map(normalizeText).filter((option) => option !== '');
  const errors: PollDraftError[] = [];
  if ([...question].length < 3) errors.push('question-too-short');
  if ([...question].length > POLL_QUESTION_MAX) errors.push('question-too-long');
  if (options.length < POLL_OPTIONS_MIN) errors.push('too-few-options');
  if (options.length > POLL_OPTIONS_MAX) errors.push('too-many-options');
  if (options.some((option) => [...option].length > POLL_OPTION_MAX)) errors.push('option-too-long');
  if (new Set(options.map((option) => option.toLocaleLowerCase('it'))).size !== options.length) errors.push('duplicate-options');
  return errors.length > 0 ? err(errors) : ok({ ...draft, question, options });
}

/** Also closed once its time is up, even before the list is read again. */
export function isOpen(poll: Poll, now: Date): boolean {
  return !poll.closed && (poll.closesAt === null || poll.closesAt > now);
}

export function hasVoted(poll: Poll): boolean {
  return poll.myVotes.length > 0;
}

export function canVote(poll: Poll, now: Date): boolean {
  return isOpen(poll, now) && (!hasVoted(poll) || poll.rules.voteChange);
}

/** Share of the votes, 0-100; with more choices each voter can count on several options. */
export function shareOf(option: PollOption, poll: Poll): number {
  const total = poll.options.reduce((sum, o) => sum + (o.votes ?? 0), 0);
  return total === 0 || option.votes === null ? 0 : Math.round((option.votes / total) * 100);
}

/** The option(s) ahead, for highlighting a finished poll; none while nobody voted. */
export function leadingOptions(poll: Poll): ReadonlySet<string> {
  const best = Math.max(0, ...poll.options.map((o) => o.votes ?? 0));
  return new Set(best === 0 ? [] : poll.options.filter((o) => o.votes === best).map((o) => o.id));
}
