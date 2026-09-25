import { beforeEach, describe, expect, it } from 'vitest';
import { SessionExpiredError, type PreparedPhoto } from '../../application/ports';
import type { JoinRequest } from '../../domain/evening';
import type { AdminSession, PlayerSession } from '../../domain/player';
import { SupabaseBackend } from './supabase-backend';
import { SupabaseChat } from './supabase-chat';
import { createSupabaseClient } from './supabase-client';

// Default values of every local Supabase CLI stack.
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const client = createSupabaseClient(LOCAL_URL, LOCAL_KEY);
const backend = new SupabaseBackend(client, LOCAL_URL, { notifyDebounceMs: 0 });
const chat = new SupabaseChat(client, LOCAL_URL);

const photo = (): PreparedPhoto => ({
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumbnail: new Blob(['thumb'], { type: 'image/jpeg' }),
});

let admin: AdminSession;
let word: string;

async function asAdmin(): Promise<AdminSession> {
  const joined = await backend.join({
    secretWord: '',
    identity: { nickname: 'Administrator', realName: 'admin' },
    resolution: { kind: 'ask' },
  });
  if (!joined.ok || joined.value.role !== 'admin') throw new Error('admin login failed');
  return joined.value;
}

function request(nickname: string, realName = `${nickname} Real`, overrides: Partial<JoinRequest> = {}): JoinRequest {
  return { secretWord: word, identity: { nickname, realName }, resolution: { kind: 'ask' }, ...overrides };
}

async function asPlayer(nickname: string, realName?: string): Promise<PlayerSession> {
  const joined = await backend.join(request(nickname, realName));
  if (!joined.ok || joined.value.role !== 'player') throw new Error(`player join failed: ${JSON.stringify(joined)}`);
  return joined.value;
}

async function doneIds(session: PlayerSession): Promise<string[]> {
  return (await backend.completionsOf(session)).map((c) => c.actionId).sort();
}

beforeEach(async () => {
  admin = await asAdmin();
  await backend.resetEvening(admin);
  const current = await backend.secretWord(admin);
  if (!current.ok) throw new Error('secret word');
  word = current.value;
});

describe('entering the evening', () => {
  it('needs the secret word, ignoring case, spaces and dashes', async () => {
    expect(await backend.checkSecretWord('nope')).toEqual({ ok: true, value: false });
    expect(await backend.checkSecretWord(word.toUpperCase().replaceAll('-', ' '))).toEqual({ ok: true, value: true });
    expect(await backend.join({ ...request('Alice'), secretWord: 'nope' })).toEqual({ ok: false, error: { kind: 'wrong-word' } });
  });

  it('asks before giving an existing real name a new nickname, then keeps the profile', async () => {
    const alice = await asPlayer('Alice', 'Alice Rossi');
    await backend.complete(alice, 'bonus-shottino');

    const asked = await backend.join(request('Alicetta', 'alice  rossi'));
    expect(asked).toEqual({ ok: false, error: { kind: 'real-name-exists', existing: { id: alice.player.id, nickname: 'Alice' } } });

    const takeover = await backend.join(request('Alicetta', 'Alice Rossi', { resolution: { kind: 'takeover', playerId: alice.player.id } }));
    if (!takeover.ok || takeover.value.role !== 'player') throw new Error('takeover');
    expect(takeover.value.player).toMatchObject({ id: alice.player.id, nickname: 'Alicetta' });
    expect(await doneIds(takeover.value)).toEqual(['bonus-shottino']);

    const other = await backend.join(request('Omonima', 'Alice Rossi', { resolution: { kind: 'distinct' } }));
    expect(other.ok && other.value.role === 'player' && other.value.player.id !== alice.player.id).toBe(true);
  });

  it('refuses every read without a valid session', async () => {
    const forged = { role: 'player', token: '00000000-0000-0000-0000-000000000000', inboxKey: 'x', player: { id: 'x', nickname: 'x', realName: 'x' } } as const;
    await expect(backend.catalog(forged)).rejects.toBeInstanceOf(SessionExpiredError);
    await expect(backend.feed(forged, null)).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('lets the admin change the word, keeping or sending out who is inside', async () => {
    const alice = await asPlayer('Alice');
    const kept = await backend.setSecretWord(admin, 'Spritz Toga 7', false);
    expect(kept).toEqual({ ok: true, value: 'Spritz Toga 7' });
    expect((await backend.catalog(alice)).length).toBeGreaterThan(0);

    const drawn = await backend.setSecretWord(admin, null, true);
    expect(drawn.ok && drawn.value).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    await expect(backend.catalog(alice)).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('logs every admin login and forgets the log with the evening', async () => {
    await asAdmin();
    const log = await backend.accessLog(admin);
    expect(log.ok && log.value.length).toBe(1);
    await backend.resetEvening(admin);
    expect(await backend.accessLog(admin)).toEqual({ ok: true, value: [] });
  });
});

describe('completions and points', () => {
  it('completes once, shares common actions and counts points for everyone', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.complete(alice, 'bonus-shottino');
    await backend.complete(alice, 'bonus-shottino');
    await backend.complete(bob, 'common-vomito');

    expect(await doneIds(alice)).toEqual(['bonus-shottino', 'common-vomito']);
    const scores = Object.fromEntries((await backend.participants(alice)).map((p) => [p.player.nickname, [p.actionsDone, p.points]]));
    expect(scores).toEqual({ Alice: [2, 102], Bob: [1, 100] });
  });

  it('requires a photo where the admin asked for one', async () => {
    const alice = await asPlayer('Alice');
    expect(await backend.complete(alice, 'bonus-verticale')).toEqual({ ok: false, error: 'photo-required' });
    expect(await backend.completeWithPhoto(alice, 'bonus-verticale', photo())).toEqual({ ok: true, value: undefined });
    expect(await backend.completeWithPhoto(alice, 'bonus-shottino', photo())).toEqual({ ok: false, error: 'rejected' });
  });
});

describe('feed, likes and profiles', () => {
  it('shows posts and completions to everyone, newest first, with likes', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.complete(alice, 'bonus-shottino');
    expect(await backend.createPost(bob, photo(), 'Che serata')).toEqual({ ok: true, value: undefined });

    const feed = await backend.feed(alice, null);
    expect(feed.map((item) => item.kind)).toEqual(['post', 'completion']);
    const post = feed[0];
    expect(post.kind === 'post' && post.caption).toBe('Che serata');

    expect(await backend.toggleLike(alice, post.id)).toEqual({ ok: true, value: { liked: true } });
    expect((await backend.likers(bob, post.id)).map((l) => l.nickname)).toEqual(['Alice']);
    expect((await backend.feed(bob, null))[0].likes).toEqual({ count: 1, likedByMe: false });
    expect(await backend.toggleLike(alice, post.id)).toEqual({ ok: true, value: { liked: false } });
  });

  it('gives any participant the links to every photo', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.completeWithPhoto(alice, 'bonus-verticale', photo());
    const photoId = (await backend.feed(bob, null))[0].photoId!;
    const links = await backend.links(bob, [photoId, '00000000-0000-0000-0000-000000000000']);
    expect([...links.keys()]).toEqual([photoId]);
    expect((await fetch(links.get(photoId)!.thumbnailUrl)).status).toBe(200);
  });

  it('builds a profile with bio, avatar, completions and posts', async () => {
    const alice = await asPlayer('Alice');
    await backend.updateBio(alice, 'Regina della pista');
    await backend.setAvatar(alice, photo());
    await backend.complete(alice, 'bonus-shottino');
    await backend.createPost(alice, photo(), '');

    const profile = await backend.profile(alice, alice.player.id);
    expect(profile).toMatchObject({ nickname: 'Alice', bio: 'Regina della pista' });
    expect(profile?.avatarId).toBeTruthy();
    expect(profile?.completions.map((c) => c.actionId)).toEqual(['bonus-shottino']);
    expect(profile?.posts).toHaveLength(1);
    expect(await backend.updateBio(alice, 'x'.repeat(501))).toEqual({ ok: false, error: 'rejected' });
  });

  it('lets authors delete their posts and the admin moderate from the album', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.createPost(alice, photo(), 'uno');
    await backend.createPost(alice, photo(), 'due');
    const [second, first] = await backend.feed(bob, null);

    expect(await backend.deletePost(bob, first.id)).toEqual({ ok: false, error: 'rejected' });
    expect(await backend.deletePost(alice, first.id)).toEqual({ ok: true, value: undefined });

    const album = await backend.album(admin);
    expect(album.ok && album.value.map((p) => [p.source, p.title])).toEqual([['post', 'due']]);
    expect(await backend.deletePhoto(admin, second.photoId!)).toEqual({ ok: true, value: { undone: false } });
    expect(await backend.feed(bob, null)).toEqual([]);
  });

  it('empties everything and draws a new word when the evening is reset', async () => {
    const alice = await asPlayer('Alice');
    await backend.createPost(alice, photo(), '');
    await backend.resetEvening(admin);
    expect(await backend.album(admin)).toEqual({ ok: true, value: [] });
    expect(await backend.participants(admin)).toEqual([]);
    expect((await backend.secretWord(admin)).ok && (await backend.secretWord(admin))).not.toEqual({ ok: true, value: word });
  });
});

describe('admin actions', () => {
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
    expect(await backend.updateAction(admin, added.value.id, { ...draft, kind: 'malus' })).toEqual({ ok: true, value: undefined });
    expect((await backend.catalog(admin)).find((a) => a.id === added.value.id)?.points).toBe(-25);
    expect(await backend.removeAction(admin, added.value.id)).toEqual({ ok: true, value: undefined });
  });

  it('no longer offers the intimate-photo action', async () => {
    expect((await backend.catalog(admin)).some((a) => a.id === 'bonus-foto-intima')).toBe(false);
  });
});

describe('features', () => {
  it('lets the admin switch features off, and the server enforces it', async () => {
    const alice = await asPlayer('Alice');
    expect(await backend.features(alice)).toEqual({ chat: true, feed: true, leaderboard: true });
    await backend.setFeature(admin, 'feed', false);
    expect((await backend.features(alice)).feed).toBe(false);
    expect(await backend.createPost(alice, photo(), 'no')).toEqual({ ok: false, error: 'disabled' });
    await backend.setFeature(admin, 'feed', true);
  });
});

describe('chat', () => {
  const voice = () => ({ blob: new Blob(['voce'], { type: 'audio/mp4' }), mime: 'audio/mp4', durationMs: 1500 });

  it('opens one conversation per pair and exchanges text, photos and voice', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    const opened = await chat.open(alice, bob.player.id);
    if (!opened.ok) throw new Error('open');
    expect(await chat.open(bob, alice.player.id)).toEqual(opened);
    expect(await chat.open(alice, alice.player.id)).toEqual({ ok: false, error: 'rejected' });

    await chat.sendText(alice, opened.value, 'Ciao!');
    await chat.sendPhoto(alice, opened.value, photo());
    const [bobConversation] = await chat.conversations(bob);
    expect(bobConversation).toMatchObject({ other: { nickname: 'Alice' }, unread: 2 });
    await chat.markRead(bob, opened.value);
    expect((await chat.conversations(bob))[0].unread).toBe(0);

    // Replying counts as reading: the sender never has unread messages of their own.
    await chat.sendVoice(bob, opened.value, voice());
    expect((await chat.conversations(alice))[0]).toMatchObject({ unread: 1, last: { kind: 'voice', mine: false } });

    const messages = await chat.messages(bob, opened.value, null);
    expect(messages.map((m) => m.kind)).toEqual(['voice', 'photo', 'text']);

    const links = await chat.mediaLinks(bob, messages.map((m) => m.id));
    expect(links.size).toBe(2);
    expect((await fetch(links.get(messages[1].id)!.thumbnailUrl!)).status).toBe(200);
  });

  it('keeps conversations private and lets only the sender delete a message', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    const carl = await asPlayer('Carl');
    const opened = await chat.open(alice, bob.player.id);
    if (!opened.ok) throw new Error('open');
    await chat.sendPhoto(alice, opened.value, photo());
    const [message] = await chat.messages(alice, opened.value, null);

    expect(await chat.messages(carl, opened.value, null)).toEqual([]);
    expect(await chat.conversation(carl, opened.value)).toBeNull();
    expect((await chat.mediaLinks(carl, [message.id])).size).toBe(0);
    expect(await chat.deleteMessage(bob, message.id)).toEqual({ ok: false, error: 'rejected' });
    expect(await chat.deleteMessage(alice, message.id)).toEqual({ ok: true, value: undefined });
    expect(await chat.messages(bob, opened.value, null)).toEqual([]);
  });

  it('refuses messages when the admin switches the chat off', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    const opened = await chat.open(alice, bob.player.id);
    if (!opened.ok) throw new Error('open');
    await backend.setFeature(admin, 'chat', false);
    expect(await chat.sendText(alice, opened.value, 'ehi')).toEqual({ ok: false, error: 'disabled' });
    expect(await chat.sendVoice(alice, opened.value, voice())).toEqual({ ok: false, error: 'disabled' });
    await backend.setFeature(admin, 'chat', true);
  });
});
