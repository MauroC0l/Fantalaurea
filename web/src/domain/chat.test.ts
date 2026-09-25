import { describe, expect, it } from 'vitest';
import {
  actionsFor,
  deleteScopesFor,
  mergeMessages,
  messageText,
  previewOf,
  quoteText,
  unreadTotal,
  type ChatMessage,
  type ConversationSummary,
} from './chat';

const base = { senderId: 'a', forwarded: false, replyTo: null };
const text = (id: string, minute: number, senderId = 'a'): ChatMessage => ({
  ...base,
  kind: 'text',
  id,
  senderId,
  sentAt: new Date(2026, 9, 2, 22, minute),
  text: id,
  edited: false,
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

  it('counts a chat marked "da leggere" as one unread message', () => {
    const summary = (unread: number, marked: boolean): ConversationSummary => ({
      id: `${unread}${marked}`,
      other: { id: 'o', nickname: 'O', avatarId: null },
      last: null,
      unread,
      marked,
    });
    expect(unreadTotal([summary(2, false), summary(0, true), summary(3, true)])).toBe(6);
  });

  it('describes the last message, also when deleted or cleared', () => {
    const at = new Date();
    expect(previewOf({ kind: 'voice', text: null, mine: true, at })).toBe('Tu: 🎤 Messaggio vocale');
    expect(previewOf({ kind: 'deleted', text: null, mine: false, at })).toBe('Messaggio eliminato');
    expect(previewOf(null)).toBe('Nessun messaggio');
    expect(quoteText({ id: 'x', senderId: 'a', kind: 'photo', text: null })).toBe('📷 Foto');
  });

  it('offers edit only on my texts and "delete for everyone" only on my messages', () => {
    expect(actionsFor(text('m', 1, 'me'), 'me')).toEqual(['reply', 'copy', 'edit', 'forward', 'delete']);
    expect(actionsFor(text('t', 1, 'other'), 'me')).toEqual(['reply', 'copy', 'forward', 'delete']);
    const voice: ChatMessage = { ...base, senderId: 'me', kind: 'voice', id: 'v', sentAt: new Date(), durationMs: 3000 };
    expect(actionsFor(voice, 'me')).toEqual(['reply', 'forward', 'delete']);
    expect(deleteScopesFor(voice, 'me')).toEqual(['me', 'everyone']);
    expect(deleteScopesFor(text('t', 1, 'other'), 'me')).toEqual(['me']);
    const gone: ChatMessage = { ...base, senderId: 'me', kind: 'deleted', id: 'd', sentAt: new Date() };
    expect(actionsFor(gone, 'me')).toEqual(['delete']);
    expect(deleteScopesFor(gone, 'me')).toEqual(['me']);
  });
});
