import { describe, expect, it } from 'vitest';
import { rankParticipants, sameName, validateIdentity, type Participant } from './player';

describe('validateIdentity', () => {
  it('normalizes spacing', () => {
    const result = validateIdentity({ nickname: '  Er   Verticale ', realName: ' Luca  Verdi' });
    expect(result).toEqual({ ok: true, value: { nickname: 'Er Verticale', realName: 'Luca Verdi' } });
  });

  it('reports every invalid field', () => {
    const result = validateIdentity({ nickname: ' x ', realName: 'a'.repeat(41) });
    expect(result).toEqual({
      ok: false,
      error: [
        { field: 'nickname', reason: 'too-short' },
        { field: 'realName', reason: 'too-long' },
      ],
    });
  });
});

describe('sameName', () => {
  it('ignores case and spacing', () => {
    expect(sameName('Er  Verticale', ' er verticale')).toBe(true);
    expect(sameName('Luca', 'Luka')).toBe(false);
  });
});

describe('rankParticipants', () => {
  const participant = (nickname: string, points: number, actionsDone: number): Participant => ({
    player: { id: nickname, nickname, realName: nickname },
    avatarId: null,
    points,
    actionsDone,
  });

  it('orders by points, then actions done, then nickname', () => {
    const ranked = rankParticipants([
      participant('b', 10, 1),
      participant('d', 10, 3),
      participant('c', 30, 1),
      participant('a', 10, 1),
    ]);
    expect(ranked.map((p) => p.player.nickname)).toEqual(['c', 'd', 'a', 'b']);
  });
});
