import { beforeEach, describe, expect, it } from 'vitest';
import type { PreparedPhoto } from '../../application/ports';
import type { AdminSession, PlayerSession } from '../../domain/player';
import { SupabaseBackend } from './supabase-backend';

// Default values of every local Supabase CLI stack.
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const backend = new SupabaseBackend(LOCAL_URL, LOCAL_KEY, { notifyDebounceMs: 0 });

const photo = (): PreparedPhoto => ({
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumbnail: new Blob(['thumb'], { type: 'image/jpeg' }),
});

async function asAdmin(): Promise<AdminSession> {
  const joined = await backend.join({ nickname: 'Administrator', realName: 'admin' });
  if (!joined.ok || joined.value.role !== 'admin') throw new Error('admin login failed');
  return joined.value;
}

async function asPlayer(nickname: string): Promise<PlayerSession> {
  const joined = await backend.join({ nickname, realName: `${nickname} Real` });
  if (!joined.ok || joined.value.role !== 'player') throw new Error('player join failed');
  return joined.value;
}

async function doneIds(session: PlayerSession): Promise<string[]> {
  return (await backend.completionsOf(session)).map((c) => c.actionId).sort();
}

let admin: AdminSession;

beforeEach(async () => {
  admin = await asAdmin();
  await backend.resetEvening(admin);
});

describe('completions', () => {
  it('completes once, shares common actions and counts them for everyone', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    expect(await backend.complete(alice, 'bonus-shottino')).toEqual({ ok: true, value: undefined });
    expect(await backend.complete(alice, 'bonus-shottino')).toEqual({ ok: true, value: undefined });
    await backend.complete(bob, 'common-vomito');

    expect(await doneIds(alice)).toEqual(['bonus-shottino', 'common-vomito']);
    const done = Object.fromEntries(
      (await backend.participants()).map((p) => [p.player.nickname, [p.actionsDone, p.points]]),
    );
    expect(done).toEqual({ Alice: [2, 102], Bob: [1, 100] });
  });

  it('requires a photo where the admin asked for one', async () => {
    const alice = await asPlayer('Alice');
    expect(await backend.complete(alice, 'bonus-verticale')).toEqual({ ok: false, error: 'photo-required' });
    expect(await backend.completeWithPhoto(alice, 'bonus-verticale', photo())).toEqual({ ok: true, value: undefined });
    expect(await backend.completeWithPhoto(alice, 'bonus-shottino', photo())).toEqual({ ok: false, error: 'rejected' });
  });

  it('lets only whoever marked a shared action undo it', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.complete(alice, 'common-vomito');
    expect(await backend.undo(bob, 'common-vomito')).toEqual({ ok: false, error: 'rejected' });
    expect(await backend.undo(alice, 'common-vomito')).toEqual({ ok: true, value: undefined });
    expect(await doneIds(bob)).toEqual([]);
  });
});

describe('photos', () => {
  it('shows players only their own photos, and the admin all of them', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.completeWithPhoto(alice, 'bonus-verticale', photo());
    await backend.completeWithPhoto(bob, 'bonus-lento', photo());

    const own = await backend.ownPhotos(alice);
    expect(own.ok && own.value.map((p) => p.actionId)).toEqual(['bonus-verticale']);
    const album = await backend.album(admin);
    expect(album.ok && album.value.map((p) => p.nickname).sort()).toEqual(['Alice', 'Bob']);

    const link = album.ok ? album.value[0].thumbnailUrl : '';
    expect((await fetch(link)).status).toBe(200);
    expect((await backend.album(alice as unknown as AdminSession)).ok).toBe(false);
  });

  it('undoes a required-photo action when its photo is deleted, keeps an optional one', async () => {
    const alice = await asPlayer('Alice');
    await backend.completeWithPhoto(alice, 'bonus-verticale', photo());
    await backend.completeWithPhoto(alice, 'bonus-foto-intima', photo());
    const own = await backend.ownPhotos(alice);
    if (!own.ok) throw new Error('own photos');
    const idOf = (actionId: string) => own.value.find((p) => p.actionId === actionId)!.id;

    expect(await backend.deleteOwnPhoto(alice, idOf('bonus-verticale'))).toEqual({ ok: true, value: { undone: true } });
    expect(await backend.deleteOwnPhoto(alice, idOf('bonus-foto-intima'))).toEqual({ ok: true, value: { undone: false } });
    expect(await doneIds(alice)).toEqual(['bonus-foto-intima']);
  });

  it('does not let a player delete someone else’s photo', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.completeWithPhoto(alice, 'bonus-verticale', photo());
    const album = await backend.album(admin);
    const photoId = album.ok ? album.value[0].id : '';
    expect(await backend.deleteOwnPhoto(bob, photoId)).toEqual({ ok: false, error: 'rejected' });
    expect(await backend.deletePhoto(admin, photoId)).toEqual({ ok: true, value: { undone: true } });
  });

  it('empties the album when the evening is reset', async () => {
    const alice = await asPlayer('Alice');
    await backend.completeWithPhoto(alice, 'bonus-verticale', photo());
    await backend.resetEvening(admin);
    expect(await backend.album(admin)).toEqual({ ok: true, value: [] });
    expect(await backend.participants()).toEqual([]);
  });
});

describe('admin', () => {
  it('adds, edits and removes actions', async () => {
    const draft = {
      title: 'Nuova',
      description: 'Una azione nuova',
      kind: 'bonus',
      photoPolicy: 'optional',
      difficulty: 'hard',
      points: 25,
    } as const;
    const added = await backend.addAction(admin, draft);
    if (!added.ok) throw new Error('add');
    expect(added.value).toMatchObject(draft);

    expect(await backend.updateAction(admin, added.value.id, { ...draft, title: 'Rinominata' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect((await backend.catalog()).find((a) => a.id === added.value.id)?.title).toBe('Rinominata');
    expect(await backend.removeAction(admin, added.value.id)).toEqual({ ok: true, value: undefined });
  });

  it('refuses to move a completed action in or out of the shared kind', async () => {
    const alice = await asPlayer('Alice');
    await backend.complete(alice, 'bonus-shottino');
    const shottino = (await backend.catalog()).find((a) => a.id === 'bonus-shottino')!;
    const asDraft = { ...shottino, points: Math.abs(shottino.points) };
    expect(await backend.updateAction(admin, shottino.id, { ...asDraft, kind: 'common' })).toEqual({
      ok: false,
      error: 'kind-locked',
    });
    expect(await backend.updateAction(admin, shottino.id, { ...asDraft, kind: 'malus' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect((await backend.catalog()).find((a) => a.id === 'bonus-shottino')?.points).toBe(-2);
  });
});
