import { err, ok, type Result } from './result';

export interface Player {
  readonly id: string;
  readonly nickname: string;
  readonly realName: string;
}

export interface Participant {
  readonly player: Player;
  readonly actionsDone: number;
}

export interface Session {
  readonly player: Player;
  readonly token: string;
}

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

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Two names are the same identity if they differ only in case or spacing. */
export function sameName(a: string, b: string): boolean {
  return normalizeName(a).toLocaleLowerCase('it') === normalizeName(b).toLocaleLowerCase('it');
}

export function validateIdentity(raw: Identity): Result<Identity, readonly IdentityError[]> {
  const identity: Identity = {
    nickname: normalizeName(raw.nickname),
    realName: normalizeName(raw.realName),
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

export function rankParticipants(participants: readonly Participant[]): Participant[] {
  return [...participants].sort(
    (a, b) =>
      b.actionsDone - a.actionsDone || a.player.nickname.localeCompare(b.player.nickname, 'it'),
  );
}
