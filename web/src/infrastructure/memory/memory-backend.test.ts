import { describe, expect, it } from 'vitest';
import type { Action } from '../../domain/action';
import type { AdminSession, PlayerSession } from '../../domain/player';
import { inMemoryStorage } from '../browser/safe-storage';
import { MemoryBackend } from './memory-backend';

const actions: Action[] = [
  { id: 'b', kind: 'bonus', points: 10, label: 'Bonus' },
  { id: 'm', kind: 'malus', points: -5, label: 'Malus' },
  { id: 'c', kind: 'common', points: 100, label: 'Comune' },
];

const ADMIN = { nickname: 'Administrator', realName: 'admin' };

function backend() {
  return new MemoryBackend(actions, inMemoryStorage(), { latencyMs: 0, admin: ADMIN, demoPlayers: [] });
}

async function joined(board: MemoryBackend, nickname: string): Promise<PlayerSession> {
  const result = await board.join({ nickname, realName: `${nickname} Real` });
  if (!result.ok || result.value.role !== 'player') throw new Error('expected a player session');
  return result.value;
}

async function asAdmin(board: MemoryBackend): Promise<AdminSession> {
  const result = await board.join(ADMIN);
  if (!result.ok || result.value.role !== 'admin') throw new Error('expected an admin session');
  return result.value;
}

describe('MemoryBackend accounts', () => {
  it('lets the same nickname and real name back in', async () => {
    const board = backend();
    const first = await joined(board, 'Nick');
    const again = await board.join({ nickname: 'nick', realName: 'NICK real' });
    expect(again).toEqual({ ok: true, value: first });
  });

  it('refuses a taken nickname with another real name', async () => {
    const board = backend();
    await joined(board, 'Nick');
    expect(await board.join({ nickname: 'Nick', realName: 'Someone Else' })).toEqual({ ok: false, error: 'nickname-taken' });
  });

  it('does not resume an unknown token', async () => {
    expect(await backend().resume('nope')).toEqual({ ok: false, error: 'unknown-token' });
  });

  it('opens an admin session with the admin credentials, which is not a participant', async () => {
    const board = backend();
    const admin = await asAdmin(board);
    expect(await board.resume(admin.token)).toEqual({ ok: true, value: admin });
    expect(await board.participants()).toEqual([]);
  });

  it('reserves the admin nickname', async () => {
    expect(await backend().join({ nickname: 'administrator', realName: 'Mario' })).toEqual({
      ok: false,
      error: 'nickname-taken',
    });
  });
});

describe('MemoryBackend counts', () => {
  it('keeps personal counts separate and shares common ones', async () => {
    const board = backend();
    const alice = await joined(board, 'Alice');
    const bob = await joined(board, 'Bob');
    await board.setCount(alice, 'b', 2);
    await board.setCount(bob, 'c', 1);

    expect(await board.countsOf(alice)).toEqual({ b: 2, c: 1 });
    expect(await board.countsOf(bob)).toEqual({ c: 1 });
    const done = (await board.participants()).map((p) => [p.player.nickname, p.actionsDone]);
    expect(done).toEqual([['Alice', 3], ['Bob', 1]]);
  });

  it('rejects unknown actions, negative counts and unknown players', async () => {
    const board = backend();
    const alice = await joined(board, 'Alice');
    expect(await board.setCount(alice, 'missing', 1)).toEqual({ ok: false, error: 'rejected' });
    expect(await board.setCount(alice, 'b', -1)).toEqual({ ok: false, error: 'rejected' });
    expect(await board.setCount({ ...alice, token: 'forged' }, 'b', 1)).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('notifies listeners on every write', async () => {
    const board = backend();
    let notifications = 0;
    const unsubscribe = board.onChange(() => notifications++);
    const alice = await joined(board, 'Alice');
    await board.setCount(alice, 'b', 1);
    unsubscribe();
    await board.setCount(alice, 'b', 2);
    expect(notifications).toBe(2);
  });
});

describe('MemoryBackend evening administration', () => {
  it('adds an action with zero points', async () => {
    const board = backend();
    const admin = await asAdmin(board);
    const added = await board.addAction(admin, { label: 'Nuova', kind: 'bonus' });
    expect(added.ok && added.value).toMatchObject({ label: 'Nuova', kind: 'bonus', points: 0 });
    expect((await board.catalog()).map((a) => a.label)).toContain('Nuova');
  });

  it('removes an action together with its counts', async () => {
    const board = backend();
    const admin = await asAdmin(board);
    const alice = await joined(board, 'Alice');
    await board.setCount(alice, 'b', 3);
    await board.setCount(alice, 'c', 1);

    expect(await board.removeAction(admin, 'b')).toEqual({ ok: true, value: undefined });
    expect(await board.removeAction(admin, 'c')).toEqual({ ok: true, value: undefined });
    expect((await board.catalog()).map((a) => a.id)).toEqual(['m']);
    expect(await board.countsOf(alice)).toEqual({});
    expect(await board.removeAction(admin, 'b')).toEqual({ ok: false, error: 'rejected' });
  });

  it('resets the evening but keeps the action list and the admin', async () => {
    const board = backend();
    const admin = await asAdmin(board);
    const alice = await joined(board, 'Alice');
    await board.setCount(alice, 'c', 1);

    await board.resetEvening(admin);
    expect(await board.participants()).toEqual([]);
    expect(await board.resume(alice.token)).toEqual({ ok: false, error: 'unknown-token' });
    expect(await board.catalog()).toHaveLength(3);
    expect((await board.resume(admin.token)).ok).toBe(true);
    expect(await board.countsOf(await joined(board, 'Alice'))).toEqual({});
  });

  it('refuses admin operations without a valid admin token', async () => {
    const forged: AdminSession = { role: 'admin', token: 'forged' };
    const board = backend();
    expect(await board.addAction(forged, { label: 'X y z', kind: 'bonus' })).toEqual({ ok: false, error: 'unauthorized' });
    expect(await board.removeAction(forged, 'b')).toEqual({ ok: false, error: 'unauthorized' });
    expect(await board.resetEvening(forged)).toEqual({ ok: false, error: 'unauthorized' });
  });
});
