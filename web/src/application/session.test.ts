import { describe, expect, it } from 'vitest';
import { err, ok } from '../domain/result';
import type { JoinRequest } from '../domain/evening';
import type { Identity, Session } from '../domain/player';
import { joinGame } from './join-game';
import type { PlayerAccounts, SessionStore } from './ports';
import { resumeSession } from './resume-session';

const session: Session = { role: 'player', player: { id: 'p1', nickname: 'Nick', realName: 'Real' }, token: 't1', inboxKey: 'k1' };

function fakeSessions(initial: string | null = null): SessionStore & { token: string | null } {
  return {
    token: initial,
    read() { return this.token; },
    write(token) { this.token = token; },
    clear() { this.token = null; },
  };
}

function fakeAccounts(overrides: Partial<PlayerAccounts>): PlayerAccounts {
  return {
    checkSecretWord: async () => ok(true),
    join: async () => ok(session),
    resume: async () => ok(session),
    ...overrides,
  };
}

const request = (identity: Identity): JoinRequest => ({ secretWord: 'w', identity, resolution: { kind: 'ask' } });

describe('joinGame', () => {
  it('saves the token after a successful join', async () => {
    const sessions = fakeSessions();
    const result = await joinGame({ accounts: fakeAccounts({}), sessions }, request({ nickname: 'Nick', realName: 'Real' }));
    expect(result).toEqual(ok(session));
    expect(sessions.token).toBe('t1');
  });

  it('does not call the backend with invalid input', async () => {
    let called = false;
    const accounts = fakeAccounts({ join: async () => { called = true; return ok(session); } });
    const result = await joinGame({ accounts, sessions: fakeSessions() }, request({ nickname: '', realName: 'Real' }));
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });

  it('passes backend failures through without saving anything', async () => {
    const sessions = fakeSessions();
    const accounts = fakeAccounts({ join: async () => err({ kind: 'nickname-taken' }) });
    const result = await joinGame({ accounts, sessions }, request({ nickname: 'Nick', realName: 'Real' }));
    expect(result).toEqual(err({ kind: 'nickname-taken' }));
    expect(sessions.token).toBeNull();
  });
});

describe('resumeSession', () => {
  it('asks to join when no token is saved', async () => {
    expect(await resumeSession({ accounts: fakeAccounts({}), sessions: fakeSessions() })).toEqual({ kind: 'needs-join' });
  });

  it('forgets a token the backend does not know', async () => {
    const sessions = fakeSessions('stale');
    const accounts = fakeAccounts({ resume: async () => err('unknown-token') });
    expect(await resumeSession({ accounts, sessions })).toEqual({ kind: 'needs-join' });
    expect(sessions.token).toBeNull();
  });

  it('keeps the token when the backend is unreachable', async () => {
    const sessions = fakeSessions('t1');
    const accounts = fakeAccounts({ resume: async () => err('unavailable') });
    expect(await resumeSession({ accounts, sessions })).toEqual({ kind: 'offline' });
    expect(sessions.token).toBe('t1');
  });
});

describe('joinGame with a real name already registered', () => {
  it('passes the takeover choice and the normalized identity to the backend', async () => {
    let received: JoinRequest | null = null;
    const accounts = fakeAccounts({ join: async (r) => { received = r; return ok(session); } });
    const takeover: JoinRequest = {
      secretWord: 'spritz-toga-47',
      identity: { nickname: '  Nuovo  Nick ', realName: 'Luca Rossi' },
      resolution: { kind: 'takeover', playerId: 'p1' },
    };
    await joinGame({ accounts, sessions: fakeSessions() }, takeover);
    expect(received).toEqual({ ...takeover, identity: { nickname: 'Nuovo Nick', realName: 'Luca Rossi' } });
  });
});
