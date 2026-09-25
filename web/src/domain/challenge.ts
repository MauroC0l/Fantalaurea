import { err, ok, type Result } from './result';
import { normalizeText } from './text';

export const CHALLENGE_TITLE_MAX = 40;
export const CHALLENGE_DESCRIPTION_MAX = 300;
export const CHALLENGE_POINTS_MAX = 100;
/** Offered durations, in minutes. */
export const CHALLENGE_DURATIONS: readonly number[] = [5, 10, 15, 30, 60];
/** Longest custom duration, in minutes (the server checks the same). */
export const CHALLENGE_DURATION_MAX = 720;
/** null = everyone who makes it in time. */
export const CHALLENGE_WINNERS: readonly (number | null)[] = [null, 1, 3, 5, 10];

export interface ChallengeWinner {
  readonly id: string;
  readonly nickname: string;
  readonly avatarId: string | null;
  readonly at: Date;
}

/** One of those who did a challenge, in order of arrival. */
export interface ChallengeCompleter {
  readonly id: string;
  readonly nickname: string;
  readonly avatarId: string | null;
  readonly at: Date;
  readonly rank: number;
  readonly earned: boolean;
}

export interface Challenge {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly points: number;
  readonly winnersLimit: number | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** null = the admin. */
  readonly creator: { readonly id: string; readonly nickname: string } | null;
  readonly canManage: boolean;
  readonly completions: number;
  /** Your completion and your place, if you did it. */
  readonly mine: { readonly at: Date; readonly rank: number } | null;
  /** In order of arrival: the first N, or everyone. */
  readonly winners: readonly ChallengeWinner[];
}

export interface ChallengeDraft {
  readonly title: string;
  readonly description: string;
  readonly points: number;
  readonly winnersLimit: number | null;
  readonly durationMinutes: number;
}

/** Editing keeps the end unless extendMinutes says "from now, this long". */
export interface ChallengeEdit extends Omit<ChallengeDraft, 'durationMinutes'> {
  readonly extendMinutes: number | null;
}

export type ChallengeDraftError = 'title-too-short' | 'title-too-long' | 'description-too-long' | 'points-out-of-range';

export function validateChallenge<T extends Omit<ChallengeDraft, 'durationMinutes'>>(draft: T): Result<T, readonly ChallengeDraftError[]> {
  const title = normalizeText(draft.title);
  const description = normalizeText(draft.description);
  const errors: ChallengeDraftError[] = [];
  if ([...title].length < 2) errors.push('title-too-short');
  if ([...title].length > CHALLENGE_TITLE_MAX) errors.push('title-too-long');
  if ([...description].length > CHALLENGE_DESCRIPTION_MAX) errors.push('description-too-long');
  if (!Number.isInteger(draft.points) || draft.points < 1 || draft.points > CHALLENGE_POINTS_MAX) errors.push('points-out-of-range');
  return errors.length > 0 ? err(errors) : ok({ ...draft, title, description });
}

export function isRunning(challenge: Challenge, now: Date): boolean {
  return challenge.startsAt <= now && challenge.endsAt > now;
}

export function secondsLeft(challenge: Challenge, now: Date): number {
  return Math.max(0, Math.ceil((challenge.endsAt.getTime() - now.getTime()) / 1000));
}

/** null when there is no limit. */
export function spotsLeft(challenge: Challenge): number | null {
  return challenge.winnersLimit === null ? null : Math.max(0, challenge.winnersLimit - challenge.completions);
}

export function canComplete(challenge: Challenge, now: Date): boolean {
  return isRunning(challenge, now) && challenge.mine === null && spotsLeft(challenge) !== 0;
}

/** Did your completion earn the points? Late arrivals beyond a lowered limit do not. */
export function earnedPoints(challenge: Challenge): boolean {
  return challenge.mine !== null && (challenge.winnersLimit === null || challenge.mine.rank <= challenge.winnersLimit);
}

/** Running challenges you have not done yet: the Azioni tab shows how many. */
export function openFor(challenges: readonly Challenge[], now: Date): number {
  return challenges.filter((challenge) => canComplete(challenge, now)).length;
}
