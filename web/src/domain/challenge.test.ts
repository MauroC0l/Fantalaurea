import { describe, expect, it } from 'vitest';
import { canComplete, earnedPoints, isRunning, openFor, secondsLeft, spotsLeft, validateChallenge, type Challenge } from './challenge';

const now = new Date(2026, 9, 2, 23, 0, 0);
const minutes = (m: number) => new Date(now.getTime() + m * 60_000);

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c',
    title: 'Trenino',
    description: '',
    points: 20,
    winnersLimit: null,
    startsAt: minutes(-5),
    endsAt: minutes(10),
    creator: null,
    canManage: false,
    completions: 0,
    mine: null,
    winners: [],
    ...overrides,
  };
}

describe('challenges', () => {
  it('validates title, description and points', () => {
    const draft = { title: '  Trenino ', description: '', points: 20, winnersLimit: null, durationMinutes: 15 };
    expect(validateChallenge(draft)).toEqual({ ok: true, value: { ...draft, title: 'Trenino' } });
    expect(validateChallenge({ ...draft, title: 'x', points: 0 })).toEqual({ ok: false, error: ['title-too-short', 'points-out-of-range'] });
  });

  it('runs until its end and counts down', () => {
    expect(isRunning(challenge(), now)).toBe(true);
    expect(isRunning(challenge({ endsAt: now }), now)).toBe(false);
    expect(secondsLeft(challenge(), now)).toBe(600);
  });

  it('can be completed once, and only while spots are left', () => {
    expect(canComplete(challenge(), now)).toBe(true);
    expect(canComplete(challenge({ mine: { at: now, rank: 1 } }), now)).toBe(false);
    expect(spotsLeft(challenge({ winnersLimit: 3, completions: 3 }))).toBe(0);
    expect(canComplete(challenge({ winnersLimit: 3, completions: 3 }), now)).toBe(false);
    expect(openFor([challenge(), challenge({ endsAt: minutes(-1) })], now)).toBe(1);
  });

  it('gives points only within the first N', () => {
    expect(earnedPoints(challenge({ winnersLimit: 2, mine: { at: now, rank: 2 } }))).toBe(true);
    expect(earnedPoints(challenge({ winnersLimit: 1, mine: { at: now, rank: 2 } }))).toBe(false);
  });
});
