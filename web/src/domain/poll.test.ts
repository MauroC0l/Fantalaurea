import { describe, expect, it } from 'vitest';
import { canVote, DEFAULT_POLL_RULES, isOpen, leadingOptions, shareOf, validatePollDraft, type Poll } from './poll';

const now = new Date(2026, 9, 2, 23, 0);

function poll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'p',
    question: 'Miglior outfit?',
    creator: null,
    rules: DEFAULT_POLL_RULES,
    closesAt: null,
    closed: false,
    createdAt: now,
    canManage: false,
    voterCount: 3,
    myVotes: [],
    resultsVisible: true,
    options: [
      { id: 'a', label: 'Giulia', votes: 2, voters: null },
      { id: 'b', label: 'Marco', votes: 1, voters: null },
      { id: 'c', label: 'Anna', votes: 0, voters: null },
    ],
    ...overrides,
  };
}

describe('polls', () => {
  it('trims the draft, drops empty options and refuses duplicates', () => {
    const draft = { question: '  Chi vince?  ', options: ['Io', ' ', 'Tu '], rules: DEFAULT_POLL_RULES, durationMinutes: null };
    expect(validatePollDraft(draft)).toEqual({ ok: true, value: { ...draft, question: 'Chi vince?', options: ['Io', 'Tu'] } });
    expect(validatePollDraft({ ...draft, options: ['Io', 'io'] })).toEqual({ ok: false, error: ['duplicate-options'] });
    expect(validatePollDraft({ ...draft, question: 'x', options: ['Solo'] })).toEqual({
      ok: false,
      error: ['question-too-short', 'too-few-options'],
    });
  });

  it('is closed by hand or when its time is up', () => {
    expect(isOpen(poll(), now)).toBe(true);
    expect(isOpen(poll({ closed: true }), now)).toBe(false);
    expect(isOpen(poll({ closesAt: new Date(now.getTime() - 1) }), now)).toBe(false);
  });

  it('lets you vote again only if the rules allow changing your vote', () => {
    expect(canVote(poll({ myVotes: ['a'] }), now)).toBe(true);
    expect(canVote(poll({ myVotes: ['a'], rules: { ...DEFAULT_POLL_RULES, voteChange: false } }), now)).toBe(false);
  });

  it('computes shares and the leading options', () => {
    const p = poll();
    expect(p.options.map((o) => shareOf(o, p))).toEqual([67, 33, 0]);
    expect([...leadingOptions(p)]).toEqual(['a']);
    expect([...leadingOptions(poll({ options: [{ id: 'a', label: 'A', votes: 0, voters: null }] }))]).toEqual([]);
  });
});
