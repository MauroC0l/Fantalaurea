import { describe, expect, it } from 'vitest';
import type { PlayerSession } from '../domain/player';
import { ok } from '../domain/result';
import type { PhotoProcessor, PhotoShape, PlayerMoves } from './ports';
import { changeAvatar, publishPost, saveBio } from './social';

const session: PlayerSession = { role: 'player', token: 't', player: { id: 'p', nickname: 'N', realName: 'R' } };
const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });

function fakes() {
  const shapes: PhotoShape[] = [];
  const calls: string[] = [];
  const photos: PhotoProcessor = {
    prepare: async (_file, shape) => { shapes.push(shape); return { full: new Blob(), thumbnail: new Blob() }; },
  };
  const moves = {
    createPost: async (_s: unknown, _p: unknown, caption: string) => { calls.push(`post:${caption}`); return ok(undefined); },
    setAvatar: async () => { calls.push('avatar'); return ok(undefined); },
    updateBio: async (_s: unknown, bio: string) => { calls.push(`bio:${bio}`); return ok(undefined); },
  } as unknown as PlayerMoves;
  return { deps: { moves, photos }, shapes, calls };
}

describe('social use cases', () => {
  it('publishes a post with a trimmed caption and an unchanged photo shape', async () => {
    const { deps, shapes, calls } = fakes();
    expect((await publishPost(deps, session, file, '  Che serata  ')).ok).toBe(true);
    expect(shapes).toEqual(['original']);
    expect(calls).toEqual(['post:Che serata']);
  });

  it('refuses a caption over 300 characters before uploading', async () => {
    const { deps, calls } = fakes();
    expect(await publishPost(deps, session, file, 'x'.repeat(301))).toEqual({ ok: false, error: 'caption-too-long' });
    expect(calls).toEqual([]);
  });

  it('crops profile photos to a square', async () => {
    const { deps, shapes } = fakes();
    await changeAvatar(deps, session, file);
    expect(shapes).toEqual(['square']);
  });

  it('accepts a bio up to 500 characters', async () => {
    const { deps, calls } = fakes();
    expect((await saveBio(deps.moves, session, 'y'.repeat(500))).ok).toBe(true);
    expect(await saveBio(deps.moves, session, 'y'.repeat(501))).toEqual({ ok: false, error: 'bio-too-long' });
    expect(calls).toHaveLength(1);
  });
});
