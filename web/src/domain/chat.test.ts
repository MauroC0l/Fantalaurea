import { describe, expect, it } from 'vitest';
import { mergeMessages, messageText, previewOf, unreadTotal, type ChatMessage, type ConversationSummary } from './chat';

const text = (id: string, minute: number): ChatMessage => ({
  kind: 'text',
  id,
  senderId: 'a',
  sentAt: new Date(2026, 9, 2, 22, minute),
  text: id,
});

describe('chat', () => {
  it('sends trimmed text, nothing empty and nothing over 1000 characters', () => {
    expect(messageText('  ciao  ')).toBe('ciao');
    expect(messageText('   ')).toBeNull();
    expect(messageText('x'.repeat(1001))).toBeNull();
  });

  it('keeps messages oldest first without duplicates', () => {
    const merged = mergeMessages([text('b', 2), text('a', 1)], [text('c', 3), text('b', 2)]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('adds up unread messages and describes the last one', () => {
    const summary = (unread: number, last: ConversationSummary['last']): ConversationSummary => ({
      id: String(unread),
      other: { id: 'o', nickname: 'O', avatarId: null },
      last,
      unread,
    });
    const at = new Date();
    expect(unreadTotal([summary(2, { kind: 'text', text: 'x', mine: false, at }), summary(3, { kind: 'photo', text: null, mine: true, at })])).toBe(5);
    expect(previewOf({ kind: 'voice', text: null, mine: true, at })).toBe('Tu: 🎤 Messaggio vocale');
  });
});
