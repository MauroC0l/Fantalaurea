import { beforeEach, describe, expect, it } from 'vitest';
import { SessionExpiredError, type PreparedPhoto } from '../../application/ports';
import type { JoinRequest } from '../../domain/evening';
import type { AdminSession, PlayerSession } from '../../domain/player';
import { DEFAULT_POLL_RULES, type PollDraft } from '../../domain/poll';
import { ChangeSignals } from './change-signals';
import { SupabaseBackend } from './supabase-backend';
import { SupabaseChat } from './supabase-chat';
import { SupabasePolls } from './supabase-polls';
import { SupabaseChallenges } from './supabase-challenges';
import { createSupabaseClient } from './supabase-client';

// Default values of every local Supabase CLI stack.
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const client = createSupabaseClient(LOCAL_URL, LOCAL_KEY);
const signals = new ChangeSignals(client, { notifyDebounceMs: 0 });
const backend = new SupabaseBackend(client, LOCAL_URL, signals);
const polls = new SupabasePolls(client, signals);
const challenges = new SupabaseChallenges(client, signals);
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
  it('refuses completions while the actions are switched off', async () => {
    const alice = await asPlayer('Alice');
    const [action] = (await backend.catalog(alice)).filter((a) => a.photoPolicy !== 'required' && a.kind !== 'common');
    await backend.setFeature(admin, 'actions', false);
    expect(await backend.complete(alice, action.id)).toEqual({ ok: false, error: 'rejected' });
    await backend.setFeature(admin, 'actions', true);
    expect(await backend.complete(alice, action.id)).toEqual({ ok: true, value: undefined });
  });

  it('accepts new nicknames up to 20 characters', async () => {
    await asPlayer('x'.repeat(20), 'Venti Caratteri');
    expect((await backend.join(request('y'.repeat(21), 'Ventuno Caratteri'))).ok).toBe(false);
  });


  it('lets the admin switch features off, and the server enforces it', async () => {
    const alice = await asPlayer('Alice');
    expect(await backend.features(alice)).toEqual({ actions: true, chat: true, feed: true, leaderboard: true, polls: true, challenges: true });
    await backend.setFeature(admin, 'feed', false);
    expect((await backend.features(alice)).feed).toBe(false);
    expect(await backend.createPost(alice, photo(), 'no')).toEqual({ ok: false, error: 'disabled' });
    await backend.setFeature(admin, 'feed', true);
  });
});

describe('users', () => {
  it('blocks a player: out at once, cannot come back, content hidden until unblocked', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.createPost(alice, photo(), 'ciao');
    expect(await backend.feed(bob, null)).toHaveLength(1);

    expect(await backend.setBlocked(admin, alice.player.id, true)).toEqual({ ok: true, value: undefined });
    await expect(backend.participants(alice)).rejects.toBeInstanceOf(SessionExpiredError);
    expect(await backend.join(request('Alice'))).toEqual({ ok: false, error: { kind: 'blocked' } });
    expect(await backend.join(request('Alice2', 'Alice Real'))).toEqual({ ok: false, error: { kind: 'blocked' } });
    expect(await backend.feed(bob, null)).toEqual([]);
    expect((await backend.participants(bob)).map((p) => p.player.nickname)).toEqual(['Bob']);
    expect(await backend.profile(bob, alice.player.id)).toBeNull();
    expect(await chat.open(bob, alice.player.id)).toEqual({ ok: false, error: 'rejected' });
    const managed = await backend.players(admin);
    expect(managed.ok && managed.value.find((p) => p.nickname === 'Alice')?.blocked).toBe(true);

    await backend.setBlocked(admin, alice.player.id, false);
    expect((await backend.join(request('Alice'))).ok).toBe(true);
    expect(await backend.feed(bob, null)).toHaveLength(1);
  });

  it('lets the admin allow single players to create polls and challenges', async () => {
    const alice = await asPlayer('Alice');
    expect(await backend.permissions(alice)).toEqual({ polls: false, challenges: false });
    expect(await backend.permissions(admin)).toEqual({ polls: true, challenges: true });
    await backend.setPermission(admin, alice.player.id, 'polls', true);
    expect(await backend.permissions(alice)).toEqual({ polls: true, challenges: false });
  });

  it('allows 100 photos each; deleting one makes room', async () => {
    const alice = await asPlayer('Alice');
    for (let batch = 0; batch < 10; batch++) {
      await Promise.all(Array.from({ length: 10 }, () => backend.createPost(alice, photo(), '')));
    }
    expect(await backend.createPost(alice, photo(), 'una di troppo')).toEqual({ ok: false, error: 'photo-limit' });
    const profile = await backend.profile(alice, alice.player.id);
    expect(profile?.photoCount).toBe(100);
    await backend.deletePost(alice, profile!.posts[0].id);
    expect((await backend.createPost(alice, photo(), 'ora sì')).ok).toBe(true);
  }, 60_000);
});

describe('polls', () => {
  const draft = (rules: Partial<PollDraft['rules']> = {}): PollDraft => ({
    question: 'Miglior outfit?',
    options: ['Giulia', 'Marco', 'Anna'],
    rules: { ...DEFAULT_POLL_RULES, ...rules },
    durationMinutes: null,
  });

  it('is created by the admin or by players allowed to', async () => {
    const alice = await asPlayer('Alice');
    expect(await polls.create(alice, draft())).toEqual({ ok: false, error: 'forbidden' });
    await backend.setPermission(admin, alice.player.id, 'polls', true);
    expect((await polls.create(alice, draft())).ok).toBe(true);
    expect((await polls.create(admin, draft())).ok).toBe(true);
    const mine = (await polls.list(alice)).find((p) => p.creator?.nickname === 'Alice');
    expect(mine).toMatchObject({ canManage: true, voterCount: 0 });
    expect((await polls.list(alice)).find((p) => p.creator === null)?.canManage).toBe(false);
  });

  it('hides results until you vote and shows who voted what only when not anonymous', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await polls.create(admin, draft({ anonymous: false, results: 'after-vote' }));
    const [poll] = await polls.list(alice);
    expect(await polls.vote(alice, poll.id, [poll.options[0].id, poll.options[1].id])).toEqual({ ok: false, error: 'rejected' });
    await polls.vote(alice, poll.id, [poll.options[0].id]);
    const [beforeBob] = await polls.list(bob);
    expect(beforeBob.resultsVisible).toBe(false);
    expect(beforeBob.options[0].votes).toBeNull();
    await polls.vote(bob, beforeBob.id, [beforeBob.options[0].id]);
    const [afterBob] = await polls.list(bob);
    expect(afterBob.options[0]).toMatchObject({ votes: 2, voters: [{ nickname: 'Alice' }, { nickname: 'Bob' }] });
    expect((await polls.list(admin))[0].options[0].votes).toBe(2);
  });

  it('keeps the first vote when changes are off, and closes itself once everyone voted', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await polls.create(admin, draft({ voteChange: false, closeWhenAllVoted: true }));
    const [poll] = await polls.list(alice);
    await polls.vote(alice, poll.id, [poll.options[0].id]);
    expect(await polls.vote(alice, poll.id, [poll.options[1].id])).toEqual({ ok: false, error: 'locked' });
    await polls.vote(bob, poll.id, [poll.options[1].id]);
    expect((await polls.list(alice))[0].closed).toBe(true);
    const carl = await asPlayer('Carl');
    expect(await polls.vote(carl, poll.id, [poll.options[0].id])).toEqual({ ok: false, error: 'closed' });
  });

  it('is closed or deleted only by its creator or the admin, and follows the switch', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.setPermission(admin, alice.player.id, 'polls', true);
    await polls.create(alice, draft());
    const [poll] = await polls.list(bob);
    expect(poll.canManage).toBe(false);
    expect(await polls.close(bob, poll.id)).toEqual({ ok: false, error: 'rejected' });
    expect(await polls.close(alice, poll.id)).toEqual({ ok: true, value: undefined });
    await backend.setFeature(admin, 'polls', false);
    expect(await polls.create(admin, draft())).toEqual({ ok: false, error: 'disabled' });
    await backend.setFeature(admin, 'polls', true);
    expect(await polls.remove(admin, poll.id)).toEqual({ ok: true, value: undefined });
    expect(await polls.list(bob)).toEqual([]);
  });

  it('cannot be voted once its creator is blocked', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await backend.setPermission(admin, alice.player.id, 'polls', true);
    await polls.create(alice, draft());
    const [poll] = await polls.list(bob);
    await backend.setBlocked(admin, alice.player.id, true);
    expect(await polls.vote(bob, poll.id, [poll.options[0].id])).toEqual({ ok: false, error: 'rejected' });
  });
});

describe('challenges', () => {
  const draft = (winnersLimit: number | null = null) => ({ title: 'Trenino', description: '', points: 20, winnersLimit, durationMinutes: 10 });
  const pointsOf = async (session: PlayerSession) =>
    (await backend.participants(session)).find((p) => p.player.id === session.player.id)?.points ?? 0;

  it('is launched by the admin or by players allowed to', async () => {
    const alice = await asPlayer('Alice');
    expect(await challenges.create(alice, draft())).toEqual({ ok: false, error: 'forbidden' });
    await backend.setPermission(admin, alice.player.id, 'challenges', true);
    expect((await challenges.create(alice, draft())).ok).toBe(true);
    expect((await challenges.create(admin, draft())).ok).toBe(true);
    expect(await challenges.list(alice)).toHaveLength(2);
  });

  it('gives its points in the ranking, only to the first N when limited', async () => {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    await challenges.create(admin, draft(1));
    const [challenge] = await challenges.list(alice);
    const before = await pointsOf(alice);
    expect(await challenges.complete(alice, challenge.id)).toEqual({ ok: true, value: undefined });
    expect(await pointsOf(alice)).toBe(before + 20);
    expect(await challenges.complete(bob, challenge.id)).toEqual({ ok: false, error: 'full' });
    expect((await challenges.list(alice))[0]).toMatchObject({ completions: 1, mine: { rank: 1 }, winners: [{ nickname: 'Alice' }] });

    await challenges.undo(alice, challenge.id);
    expect(await pointsOf(alice)).toBe(before);
    expect((await challenges.complete(bob, challenge.id)).ok).toBe(true);
  });

  it('refuses completions once ended, reopens when extended, takes points back when deleted', async () => {
    const alice = await asPlayer('Alice');
    await challenges.create(admin, draft());
    const [challenge] = await challenges.list(alice);
    await challenges.end(admin, challenge.id);
    expect(await challenges.complete(alice, challenge.id)).toEqual({ ok: false, error: 'ended' });
    await challenges.update(admin, challenge.id, { title: 'Trenino lungo', description: '', points: 30, winnersLimit: null, extendMinutes: 5 });
    expect((await challenges.complete(alice, challenge.id)).ok).toBe(true);
    const before = await pointsOf(alice);
    await challenges.remove(admin, challenge.id);
    expect(await pointsOf(alice)).toBe(before - 30);
  });

  it('follows the switch', async () => {
    await backend.setFeature(admin, 'challenges', false);
    expect(await challenges.create(admin, draft())).toEqual({ ok: false, error: 'disabled' });
    await backend.setFeature(admin, 'challenges', true);
  });
});

describe('chat', () => {
  const voice = () => ({ blob: new Blob(['voce'], { type: 'audio/mp4' }), mime: 'audio/mp4', durationMs: 1500 });

  async function pair() {
    const alice = await asPlayer('Alice');
    const bob = await asPlayer('Bob');
    const opened = await chat.open(alice, bob.player.id);
    if (!opened.ok) throw new Error('open');
    return { alice, bob, id: opened.value };
  }

  it('opens one conversation per pair and exchanges text, photos and voice', async () => {
    const { alice, bob, id } = await pair();
    expect(await chat.open(bob, alice.player.id)).toEqual({ ok: true, value: id });
    expect(await chat.open(alice, alice.player.id)).toEqual({ ok: false, error: 'rejected' });

    await chat.sendText(alice, id, 'Ciao!', null);
    await chat.sendPhoto(alice, id, photo(), null);
    const [bobConversation] = await chat.conversations(bob);
    expect(bobConversation).toMatchObject({ other: { nickname: 'Alice' }, unread: 2, marked: false });
    await chat.markRead(bob, id);
    expect((await chat.conversations(bob))[0].unread).toBe(0);

    // Replying counts as reading: the sender never has unread messages of their own.
    await chat.sendVoice(bob, id, voice(), null);
    expect((await chat.conversations(alice))[0]).toMatchObject({ unread: 1, last: { kind: 'voice', mine: false } });

    const messages = await chat.messages(bob, id, null);
    expect(messages.map((m) => m.kind)).toEqual(['voice', 'photo', 'text']);

    const links = await chat.mediaLinks(bob, messages.map((m) => m.id));
    expect(links.size).toBe(2);
    expect((await fetch(links.get(messages[1].id)!.thumbnailUrl!)).status).toBe(200);
  });

  it('keeps conversations private; only the sender deletes for everyone, anyone for themselves', async () => {
    const { alice, bob, id } = await pair();
    const carl = await asPlayer('Carl');
    await chat.sendPhoto(alice, id, photo(), null);
    await chat.sendText(bob, id, 'Bella!', null);
    const [answer, picture] = await chat.messages(alice, id, null);

    expect(await chat.messages(carl, id, null)).toEqual([]);
    expect(await chat.conversation(carl, id)).toBeNull();
    expect((await chat.mediaLinks(carl, [picture.id])).size).toBe(0);
    expect(await chat.deleteMessage(bob, picture.id, 'everyone')).toEqual({ ok: false, error: 'rejected' });

    expect(await chat.deleteMessage(alice, picture.id, 'everyone')).toEqual({ ok: true, value: undefined });
    expect((await chat.messages(bob, id, null)).map((m) => m.kind)).toEqual(['text', 'deleted']);
    expect((await chat.mediaLinks(bob, [picture.id])).size).toBe(0);

    await chat.deleteMessage(alice, answer.id, 'me');
    expect((await chat.messages(alice, id, null)).map((m) => m.kind)).toEqual(['deleted']);
    expect((await chat.messages(bob, id, null)).map((m) => m.kind)).toEqual(['text', 'deleted']);
  });

  it('replies, edits own texts and forwards copies to other chats', async () => {
    const { alice, bob, id } = await pair();
    const carl = await asPlayer('Carl');
    const other = await chat.open(alice, carl.player.id);
    if (!other.ok) throw new Error('open');
    await chat.sendText(bob, id, 'Arrivi?', null);
    const [question] = await chat.messages(alice, id, null);
    await chat.sendText(alice, id, 'Tra 5 minuti', question.id);
    const [reply] = await chat.messages(bob, id, null);
    expect(reply.replyTo).toMatchObject({ id: question.id, kind: 'text', text: 'Arrivi?' });

    expect(await chat.editMessage(bob, reply.id, 'hack')).toEqual({ ok: false, error: 'rejected' });
    expect(await chat.editMessage(alice, reply.id, 'Tra 10 minuti')).toEqual({ ok: true, value: undefined });
    expect((await chat.messages(bob, id, null))[0]).toMatchObject({ kind: 'text', text: 'Tra 10 minuti', edited: true });

    await chat.sendPhoto(bob, id, photo(), null);
    const [picture] = await chat.messages(alice, id, null);
    expect(await chat.forward(carl, picture.id, [other.value])).toEqual({ ok: false, error: 'rejected' });
    expect(await chat.forward(alice, picture.id, [other.value])).toEqual({ ok: true, value: undefined });
    const [copy] = await chat.messages(carl, other.value, null);
    expect(copy).toMatchObject({ kind: 'photo', forwarded: true, senderId: alice.player.id });
    expect((await fetch((await chat.mediaLinks(carl, [copy.id])).get(copy.id)!.url)).status).toBe(200);
  });

  it('marks as unread, empties and removes a chat only for whoever asks', async () => {
    const { alice, bob, id } = await pair();
    await chat.sendText(bob, id, 'Ehi', null);
    await chat.markRead(alice, id);
    expect(await chat.markUnread(alice, id)).toEqual({ ok: true, value: undefined });
    expect((await chat.conversations(alice))[0]).toMatchObject({ unread: 0, marked: true });

    await chat.clear(alice, id, 'empty');
    expect((await chat.conversations(alice))[0]).toMatchObject({ last: null, marked: false });
    expect(await chat.messages(alice, id, null)).toEqual([]);
    expect(await chat.messages(bob, id, null)).toHaveLength(1);

    await chat.clear(alice, id, 'remove');
    expect(await chat.conversations(alice)).toEqual([]);
    await chat.sendText(bob, id, 'Ci sei?', null);
    const [back] = await chat.conversations(alice);
    expect(back).toMatchObject({ unread: 1, last: { text: 'Ci sei?' } });
    expect(await chat.messages(alice, id, null)).toHaveLength(1);
  });

  it('refuses messages when the admin switches the chat off', async () => {
    const { alice, id } = await pair();
    await backend.setFeature(admin, 'chat', false);
    expect(await chat.sendText(alice, id, 'ehi', null)).toEqual({ ok: false, error: 'disabled' });
    expect(await chat.sendVoice(alice, id, voice(), null)).toEqual({ ok: false, error: 'disabled' });
    await backend.setFeature(admin, 'chat', true);
  });
});
