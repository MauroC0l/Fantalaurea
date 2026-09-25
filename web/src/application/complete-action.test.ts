import { describe, expect, it } from 'vitest';
import type { Action } from '../domain/action';
import type { PlayerSession } from '../domain/player';
import { ok } from '../domain/result';
import { completeAction } from './complete-action';
import type { PhotoProcessor, PlayerMoves } from './ports';

const session: PlayerSession = { role: 'player', token: 't', player: { id: 'p', nickname: 'N', realName: 'R' } };
const action = (photoPolicy: Action['photoPolicy']): Action => ({
  id: 'a', title: 'T', description: 'D', points: 0, kind: 'bonus', photoPolicy, difficulty: 'medium',
});
const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });

function fakes(prepare: PhotoProcessor['prepare'] = async () => ({ full: new Blob(), thumbnail: new Blob() })) {
  const calls: string[] = [];
  const moves = {
    complete: async () => { calls.push('complete'); return ok(undefined); },
    completeWithPhoto: async () => { calls.push('completeWithPhoto'); return ok(undefined); },
  } as unknown as PlayerMoves;
  return { deps: { moves, photos: { prepare } }, calls };
}

describe('completeAction', () => {
  it('refuses a required-photo action without a photo, before calling the backend', async () => {
    const { deps, calls } = fakes();
    expect(await completeAction(deps, session, action('required'), null)).toEqual({ ok: false, error: 'photo-required' });
    expect(calls).toEqual([]);
  });

  it('completes without a photo when none is needed', async () => {
    const { deps, calls } = fakes();
    expect((await completeAction(deps, session, action('optional'), null)).ok).toBe(true);
    expect(calls).toEqual(['complete']);
  });

  it('prepares and uploads the photo when one is given', async () => {
    const { deps, calls } = fakes();
    expect((await completeAction(deps, session, action('required'), file)).ok).toBe(true);
    expect(calls).toEqual(['completeWithPhoto']);
  });

  it('rejects a photo on an action that does not accept one', async () => {
    const { deps } = fakes();
    expect(await completeAction(deps, session, action('none'), file)).toEqual({ ok: false, error: 'rejected' });
  });

  it('reports an image the phone cannot decode', async () => {
    const { deps, calls } = fakes(async () => { throw new Error('decode'); });
    expect(await completeAction(deps, session, action('optional'), file)).toEqual({ ok: false, error: 'unreadable-photo' });
    expect(calls).toEqual([]);
  });
});
