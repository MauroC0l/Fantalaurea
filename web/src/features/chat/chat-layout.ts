import type { ChatMessage } from '../../domain/chat';
import { formatDay, startOfDay } from '../labels';

const GROUP_GAP_MS = 5 * 60_000;

export interface MessageRow {
  readonly message: ChatMessage;
  /** Set on the first message of each day. */
  readonly day: string | null;
  readonly groupStart: boolean;
  readonly groupEnd: boolean;
}

/** Day dividers and bubble groups: same person, same day, a few minutes apart. */
export function layoutMessages(messages: readonly ChatMessage[], now: Date = new Date()): MessageRow[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const newDay = !previous || startOfDay(previous.sentAt) !== startOfDay(message.sentAt);
    return {
      message,
      day: newDay ? formatDay(message.sentAt, now) : null,
      groupStart: newDay || !together(previous, message),
      groupEnd: !next || !together(message, next) || startOfDay(next.sentAt) !== startOfDay(message.sentAt),
    };
  });
}

function together(a: ChatMessage, b: ChatMessage): boolean {
  return a.senderId === b.senderId && b.sentAt.getTime() - a.sentAt.getTime() < GROUP_GAP_MS;
}
