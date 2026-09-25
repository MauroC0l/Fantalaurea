import { err, ok, type Result } from './result';
import { normalizeText } from './text';

export interface Player {
  readonly id: string;
  readonly nickname: string;
  readonly realName: string;
}

export interface Participant {
  readonly player: Player;
  readonly avatarId: string | null;
  readonly actionsDone: number;
  readonly points: number;
}

export interface PlayerSession {
  readonly role: 'player';
  readonly player: Player;
  readonly token: string;
}

/** The admin manages the evening but is not a player: it has no counts and no ranking. */
export interface AdminSession {
  readonly role: 'admin';
  readonly token: string;
}

export type Session = PlayerSession | AdminSession;

export interface Identity {
  readonly nickname: string;
  readonly realName: string;
}

export type IdentityField = keyof Identity;

export interface IdentityError {
  readonly field: IdentityField;
  readonly reason: 'too-short' | 'too-long';
}

export const IDENTITY_LIMITS: Readonly<Record<IdentityField, { min: number; max: number }>> = {
  nickname: { min: 2, max: 24 },
  realName: { min: 2, max: 40 },
};

/** Two names are the same identity if they differ only in case or spacing. */
export function sameName(a: string, b: string): boolean {
  return normalizeText(a).toLocaleLowerCase('it') === normalizeText(b).toLocaleLowerCase('it');
}

export function validateIdentity(raw: Identity): Result<Identity, readonly IdentityError[]> {
  const identity: Identity = {
    nickname: normalizeText(raw.nickname),
    realName: normalizeText(raw.realName),
  };
  const errors = (Object.keys(IDENTITY_LIMITS) as IdentityField[]).flatMap((field): IdentityError[] => {
    const { min, max } = IDENTITY_LIMITS[field];
    const length = [...identity[field]].length;
    if (length < min) return [{ field, reason: 'too-short' }];
    if (length > max) return [{ field, reason: 'too-long' }];
    return [];
  });
  return errors.length === 0 ? ok(identity) : err(errors);
}

/** Most points first, then most actions, then alphabetical. */
export function rankParticipants(participants: readonly Participant[]): Participant[] {
  return [...participants].sort(
    (a, b) =>
      b.points - a.points ||
      b.actionsDone - a.actionsDone ||
      a.player.nickname.localeCompare(b.player.nickname, 'it'),
  );
}
