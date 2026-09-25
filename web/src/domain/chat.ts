import { normalizeText } from './text';

export const MESSAGE_MAX = 1000;
export const VOICE_MAX_MS = 60_000;

export interface ChatPeer {
  readonly id: string;
  readonly nickname: string;
  readonly avatarId: string | null;
}

export type MessageKind = 'text' | 'photo' | 'voice';

export interface ConversationSummary {
  readonly id: string;
  readonly other: ChatPeer;
  readonly last: { readonly kind: MessageKind; readonly text: string | null; readonly mine: boolean; readonly at: Date };
  readonly unread: number;
}

interface MessageBase {
  readonly id: string;
  readonly senderId: string;
  readonly sentAt: Date;
}

export type ChatMessage =
  | (MessageBase & { readonly kind: 'text'; readonly text: string })
  | (MessageBase & { readonly kind: 'photo' })
  | (MessageBase & { readonly kind: 'voice'; readonly durationMs: number });

export interface VoiceRecording {
  readonly blob: Blob;
  /** Without codec parameters, e.g. "audio/mp4". */
  readonly mime: string;
  readonly durationMs: number;
}

/** Text as it will be sent, or null when there is nothing (or too much) to send. */
export function messageText(raw: string): string | null {
  const text = raw.trim();
  if (text.length === 0 || [...text].length > MESSAGE_MAX) return null;
  return text;
}

export function unreadTotal(conversations: readonly ConversationSummary[]): number {
  return conversations.reduce((sum, conversation) => sum + conversation.unread, 0);
}

/** Oldest first for display, a fresher copy of the same message wins. */
export function mergeMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
}

export function previewOf(last: ConversationSummary['last']): string {
  const prefix = last.mine ? 'Tu: ' : '';
  if (last.kind === 'photo') return `${prefix}📷 Foto`;
  if (last.kind === 'voice') return `${prefix}🎤 Messaggio vocale`;
  return prefix + normalizeText(last.text ?? '');
}
