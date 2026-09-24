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
  const participant = (nickname: string, actionsDone: number): Participant => ({
    player: { id: nickname, nickname, realName: nickname },
    actionsDone,
  });

  it('orders by actions done, then by nickname', () => {
    const ranked = rankParticipants([participant('b', 1), participant('c', 3), participant('a', 1)]);
    expect(ranked.map((p) => p.player.nickname)).toEqual(['c', 'a', 'b']);
  });
});
