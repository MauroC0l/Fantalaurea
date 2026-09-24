import { describe, expect, it } from 'vitest';
import type { Action } from '../../domain/action';
import type { Session } from '../../domain/player';
import { inMemoryStorage } from '../browser/safe-storage';
import { MemoryBackend } from './memory-backend';

const actions: Action[] = [
  { id: 'b', kind: 'bonus', points: 10, label: 'Bonus' },
  { id: 'm', kind: 'malus', points: -5, label: 'Malus' },
  { id: 'c', kind: 'common', points: 100, label: 'Comune' },
];

function backend() {
  return new MemoryBackend(actions, inMemoryStorage(), { latencyMs: 0, demoPlayers: [] });
}

async function joined(board: MemoryBackend, nickname: string): Promise<Session> {
  const result = await board.join({ nickname, realName: `${nickname} Real` });
  if (!result.ok) throw new Error(result.error);
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
