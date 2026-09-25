import { describe, expect, it } from 'vitest';
import { deedsOf, type Profile } from './profile';

describe('deedsOf', () => {
  it('merges actions and timed challenges, newest first, with no points after the first N', () => {
    const at = (minute: number) => new Date(2026, 9, 2, 22, minute);
    const profile: Profile = {
      id: 'p',
      nickname: 'Alice',
      realName: 'Alice Rossi',
      bio: '',
      avatarId: null,
      photoCount: null,
      posts: [],
      completions: [{ id: 'a', actionId: 'x', title: 'Shottino', kind: 'bonus', points: 5, photoId: null, completedAt: at(10) }],
      challenges: [
        { id: 'c1', challengeId: 'y', title: 'Trenino', points: 30, completedAt: at(20), earned: true },
        { id: 'c2', challengeId: 'z', title: 'Selfie', points: 10, completedAt: at(5), earned: false },
      ],
    };
    expect(deedsOf(profile).map((d) => [d.title, d.points, d.timed])).toEqual([
      ['Trenino', 30, true],
      ['Shottino', 5, false],
      ['Selfie', 0, true],
    ]);
  });
});
