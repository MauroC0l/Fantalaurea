import type { ActionKind } from './action';

export const BIO_MAX = 500;

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

export interface Profile {
  readonly id: string;
  readonly nickname: string;
  readonly realName: string;
  readonly bio: string;
  readonly avatarId: string | null;
  readonly completions: readonly ProfileCompletion[];
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
