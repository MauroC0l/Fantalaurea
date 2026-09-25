import type { ActionKind } from './action';

export const BIO_MAX = 500;
/** Photos each player may have at once: actions, posts and chat; the profile photo is free (ADR 0018). */
export const PHOTO_LIMIT = 100;

export interface ProfileCompletion {
  readonly id: string;
  readonly actionId: string;
  readonly title: string;
  readonly kind: ActionKind;
  readonly points: number;
  readonly photoId: string | null;
  readonly completedAt: Date;
}

export interface ProfilePost {
  readonly id: string;
  readonly photoId: string;
  readonly caption: string;
  readonly createdAt: Date;
}

/** A timed challenge the player completed (ADR 0021). */
export interface ProfileChallenge {
  readonly id: string;
  readonly challengeId: string;
  readonly title: string;
  readonly points: number;
  readonly completedAt: Date;
  /** false when the player came after the first N. */
  readonly earned: boolean;
}

export interface Profile {
  readonly id: string;
  readonly nickname: string;
  readonly realName: string;
  readonly bio: string;
  readonly avatarId: string | null;
  /** Only on your own profile: how many of the PHOTO_LIMIT you use. */
  readonly photoCount: number | null;
  readonly completions: readonly ProfileCompletion[];
  readonly challenges: readonly ProfileChallenge[];
  readonly posts: readonly ProfilePost[];
}

export interface ProfilePhoto {
  readonly photoId: string;
  readonly caption: string;
  readonly takenAt: Date;
}

/** Every photo of a player, from actions and posts, newest first. */
export function photosOf(profile: Profile): ProfilePhoto[] {
  const fromActions = profile.completions.flatMap((c) =>
    c.photoId ? [{ photoId: c.photoId, caption: c.title, takenAt: c.completedAt }] : [],
  );
  const fromPosts = profile.posts.map((p) => ({ photoId: p.photoId, caption: p.caption, takenAt: p.createdAt }));
  return [...fromActions, ...fromPosts].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

export function isValidBio(bio: string): boolean {
  return [...bio.trim()].length <= BIO_MAX;
}

/** Something a player did: an action of the list or a timed challenge, for the profile. */
export interface Deed {
  readonly id: string;
  readonly title: string;
  readonly kind: ActionKind;
  /** What it gave: 0 for a challenge completed after the first N. */
  readonly points: number;
  readonly at: Date;
  readonly timed: boolean;
}

/** Actions and timed challenges together, newest first. */
export function deedsOf(profile: Profile): Deed[] {
  const actions = profile.completions.map((c) => ({ id: c.id, title: c.title, kind: c.kind, points: c.points, at: c.completedAt, timed: false }));
  const challenges = profile.challenges.map((c) => ({
    id: c.id,
    title: c.title,
    kind: 'bonus' as const,
    points: c.earned ? c.points : 0,
    at: c.completedAt,
    timed: true,
  }));
  return [...actions, ...challenges].sort((a, b) => b.at.getTime() - a.at.getTime());
}
