import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../domain/chat';
import { layoutMessages } from './chat-layout';

const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute);
const message = (id: string, senderId: string, sentAt: Date): ChatMessage => ({
  kind: 'text',
  id,
  senderId,
  sentAt,
  text: id,
  edited: false,
  forwarded: false,
  replyTo: null,
});

describe('chat layout', () => {
  it('groups one person’s close messages and splits by day', () => {
    const rows = layoutMessages(
      [
        message('a', 'x', at(1, 23, 50)),
        message('b', 'x', at(1, 23, 52)),
        message('c', 'x', at(2, 0, 1)),
        message('d', 'y', at(2, 0, 2)),
        message('e', 'y', at(2, 0, 30)),
      ],
      at(2, 12, 0),
    );
    expect(rows.map((r) => r.day)).toEqual(['Ieri', null, 'Oggi', null, null]);
    expect(rows.map((r) => [r.groupStart, r.groupEnd])).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [true, true],
      [true, true],
    ]);
  });
});
