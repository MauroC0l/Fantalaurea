import { normalizeText } from './text';

export const MESSAGE_MAX = 1000;
export const VOICE_MAX_MS = 60_000;
export const FORWARD_MAX = 5;
/** "Sta scrivendo…" is said at most this often, and shown this long after the last signal. */
export const TYPING_SIGNAL_EVERY_MS = 2_500;
export const TYPING_SHOWN_MS = 5_000;

export interface ChatPeer {
  readonly id: string;
  readonly nickname: string;
  readonly avatarId: string | null;
}

export type MessageKind = 'text' | 'photo' | 'voice';

export interface LastMessage {
  readonly kind: MessageKind | 'deleted';
  readonly text: string | null;
  readonly mine: boolean;
  readonly at: Date;
}

export interface ConversationSummary {
  readonly id: string;
  readonly other: ChatPeer;
  /** null after "Svuota messaggi". */
  readonly last: LastMessage | null;
  readonly unread: number;
  /** "Segna come da leggere". */
  readonly marked: boolean;
}

/** What a reply shows of the message it answers. */
export interface QuotedMessage {
  readonly id: string;
  readonly senderId: string;
  readonly kind: MessageKind | 'deleted';
  readonly text: string | null;
}

interface MessageBase {
  readonly id: string;
  readonly senderId: string;
  readonly sentAt: Date;
  readonly forwarded: boolean;
  readonly replyTo: QuotedMessage | null;
}

export type ChatMessage =
  | (MessageBase & { readonly kind: 'text'; readonly text: string; readonly edited: boolean })
  | (MessageBase & { readonly kind: 'photo' })
  | (MessageBase & { readonly kind: 'voice'; readonly durationMs: number })
  /** Deleted for everyone: only the trace remains. */
  | (MessageBase & { readonly kind: 'deleted' });

export type MessageAction = 'reply' | 'copy' | 'edit' | 'forward' | 'delete';
export type DeleteScope = 'me' | 'everyone';

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

/** A chat marked "da leggere" counts as one unread message even when everything was read. */
export function unreadOf(conversation: ConversationSummary): number {
  return Math.max(conversation.unread, conversation.marked ? 1 : 0);
}

export function unreadTotal(conversations: readonly ConversationSummary[]): number {
  return conversations.reduce((sum, conversation) => sum + unreadOf(conversation), 0);
}

/** Oldest first for display, a fresher copy of the same message wins. */
export function mergeMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
}

export function previewOf(last: LastMessage | null): string {
  if (!last) return 'Nessun messaggio';
  if (last.kind === 'deleted') return last.mine ? 'Hai eliminato questo messaggio' : 'Messaggio eliminato';
  return (last.mine ? 'Tu: ' : '') + describe(last.kind, last.text);
}

export function quoteText(quote: QuotedMessage): string {
  return quote.kind === 'deleted' ? 'Messaggio eliminato' : describe(quote.kind, quote.text);
}

export function quoteOf(message: ChatMessage): QuotedMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    kind: message.kind,
    text: message.kind === 'text' ? message.text : null,
  };
}

/** What the long-press menu offers on a message, in display order. */
export function actionsFor(message: ChatMessage, myId: string): MessageAction[] {
  if (message.kind === 'deleted') return ['delete'];
  const mine = message.senderId === myId;
  return [
    'reply',
    ...(message.kind === 'text' ? (['copy'] as const) : []),
    ...(mine && message.kind === 'text' ? (['edit'] as const) : []),
    'forward',
    'delete',
  ];
}

/** Only the sender can delete for everyone, and only once. */
export function deleteScopesFor(message: ChatMessage, myId: string): DeleteScope[] {
  return message.senderId === myId && message.kind !== 'deleted' ? ['me', 'everyone'] : ['me'];
}

function describe(kind: MessageKind, text: string | null): string {
  if (kind === 'photo') return '📷 Foto';
  if (kind === 'voice') return '🎤 Messaggio vocale';
  return normalizeText(text ?? '');
}
