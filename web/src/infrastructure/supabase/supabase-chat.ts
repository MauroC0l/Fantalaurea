import type { PostgrestError, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  CHAT_PAGE_SIZE,
  SessionExpiredError,
  type Chat,
  type ChatMediaLinks,
  type FeatureFailure,
  type PhotoLimitFailure,
  type PreparedPhoto,
  type WriteFailure,
} from '../../application/ports';
import type {
  ChatMessage,
  ChatPeer,
  ConversationSummary,
  DeleteScope,
  MessageKind,
  QuotedMessage,
  VoiceRecording,
} from '../../domain/chat';
import type { PlayerSession } from '../../domain/player';
import { err, ok, type Result } from '../../domain/result';
import { absoluteUrl, asFeatureFailure, asWriteFailure, invokePhotos } from './photos-function';

// Shapes returned by supabase/migrations (chat_like_whatsapp) and supabase/functions/photos.
interface ConversationRow {
  id: string;
  other_id: string;
  other_nickname: string;
  other_avatar_id: string | null;
  last_kind: MessageKind | null;
  last_body: string | null;
  last_mine: boolean | null;
  last_deleted: boolean | null;
  last_at: string | null;
  unread: number;
  marked: boolean;
}
interface MessageRow {
  id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  duration_ms: number | null;
  created_at: string;
  edited: boolean;
  forwarded: boolean;
  deleted: boolean;
  reply_id: string | null;
  reply_sender_id: string | null;
  reply_kind: MessageKind | null;
  reply_body: string | null;
  reply_deleted: boolean | null;
}
type Status = 'unauthorized' | 'rejected' | 'disabled';
type SendReply = { status: 'ok'; recipientInbox: string } | { status: Status };
type EditReply = { status: 'ok'; conversationId: string; recipientInbox: string } | { status: Status };

const INVALID_AUTHORIZATION = '28000';
const MESSAGE_EVENT = 'message';
const TYPING_EVENT = 'typing';
const AUDIO_EXTENSIONS: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg' };

type Listener = (conversationId: string) => void;

/**
 * Private chat (ADR 0015, 0016). Every player listens on "inbox:<secret key>"; whoever changes a
 * conversation tells the other person there, without the content. "typing" travels the same way.
 */
export class SupabaseChat implements Chat {
  readonly #client: SupabaseClient;
  readonly #url: string;
  readonly #mediaCache = new Map<string, ChatMediaLinks>();
  readonly #messageListeners = new Set<Listener>();
  readonly #typingListeners = new Set<Listener>();
  readonly #outboxes = new Map<string, RealtimeChannel>();
  /** Filled by conversation(): typing is said before any message gives us the inbox. */
  readonly #peerInboxes = new Map<string, string>();
  #inbox: { key: string; channel: RealtimeChannel } | null = null;

  constructor(client: SupabaseClient, url: string) {
    this.#client = client;
    this.#url = url;
  }

  async conversations(session: PlayerSession): Promise<readonly ConversationSummary[]> {
    const rows = await this.#read<ConversationRow[]>('conversations', { p_token: session.token });
    return rows.map((row) => ({
      id: row.id,
      other: { id: row.other_id, nickname: row.other_nickname, avatarId: row.other_avatar_id },
      last:
        row.last_kind && row.last_at
          ? {
              kind: row.last_deleted ? 'deleted' : row.last_kind,
              text: row.last_body,
              mine: row.last_mine ?? false,
              at: new Date(row.last_at),
            }
          : null,
      unread: Number(row.unread),
      marked: row.marked,
    }));
  }

  async conversation(session: PlayerSession, conversationId: string): Promise<{ id: string; other: ChatPeer } | null> {
    const reply = await this.#read<{ id: string; otherInbox: string; other: ChatPeer } | null>('conversation', {
      p_token: session.token,
      p_conversation: conversationId,
    });
    if (!reply) return null;
    this.#peerInboxes.set(reply.id, reply.otherInbox);
    return { id: reply.id, other: reply.other };
  }

  async messages(session: PlayerSession, conversationId: string, before: Date | null): Promise<readonly ChatMessage[]> {
    const rows = await this.#read<MessageRow[]>('messages', {
      p_token: session.token,
      p_conversation: conversationId,
      p_before: before?.toISOString() ?? null,
      p_limit: CHAT_PAGE_SIZE,
    });
    return rows.map(toMessage);
  }

  /** Signed links last the evening: each message's media is asked for once. */
  async mediaLinks(session: PlayerSession, messageIds: readonly string[]): Promise<ReadonlyMap<string, ChatMediaLinks>> {
    const missing = [...new Set(messageIds)].filter((id) => !this.#mediaCache.has(id));
    if (missing.length > 0) {
      const reply = await invokePhotos<{ media: Record<string, ChatMediaLinks> }>(this.#client, {
        op: 'chat-media',
        token: session.token,
        messageIds: missing,
      });
      if (!reply.ok) {
        if (reply.error === 'unauthorized') throw new SessionExpiredError();
        throw new Error(`chat media: ${reply.error}`);
      }
      for (const [id, links] of Object.entries(reply.value.media)) {
        this.#mediaCache.set(id, {
          url: absoluteUrl(this.#url, links.url),
          thumbnailUrl: links.thumbnailUrl ? absoluteUrl(this.#url, links.thumbnailUrl) : undefined,
        });
      }
    }
    return new Map(messageIds.flatMap((id) => (this.#mediaCache.has(id) ? [[id, this.#mediaCache.get(id)!] as const] : [])));
  }

  async open(session: PlayerSession, otherPlayerId: string): Promise<Result<string, FeatureFailure>> {
    const { data, error } = await this.#client.rpc('open_conversation', { p_token: session.token, p_other: otherPlayerId });
    if (error) return err('unavailable');
    const reply = data as { status: 'ok'; conversationId: string } | { status: Status };
    return reply.status === 'ok' ? ok(reply.conversationId) : err(reply.status);
  }

  async sendText(
    session: PlayerSession,
    conversationId: string,
    text: string,
    replyTo: string | null,
  ): Promise<Result<void, FeatureFailure>> {
    const reply = await this.#write<SendReply>('send_message', {
      p_token: session.token,
      p_conversation: conversationId,
      p_body: text,
      p_reply_to: replyTo,
    });
    if (!reply.ok) return reply;
    if (reply.value.status !== 'ok') return err(reply.value.status);
    this.#notify(conversationId, reply.value.recipientInbox);
    return ok(undefined);
  }

  async sendPhoto(
    session: PlayerSession,
    conversationId: string,
    photo: PreparedPhoto,
    replyTo: string | null,
  ): Promise<Result<void, FeatureFailure | PhotoLimitFailure>> {
    const form = mediaForm('chat-photo', session, conversationId, replyTo);
    form.append('full', photo.full, 'full.jpg');
    form.append('thumbnail', photo.thumbnail, 'thumbnail.jpg');
    return this.#afterFunctionSend(conversationId, await invokePhotos<{ recipientInbox: string }>(this.#client, form));
  }

  async sendVoice(
    session: PlayerSession,
    conversationId: string,
    voice: VoiceRecording,
    replyTo: string | null,
  ): Promise<Result<void, FeatureFailure>> {
    const form = mediaForm('chat-voice', session, conversationId, replyTo);
    form.append('audio', new File([voice.blob], `voce.${AUDIO_EXTENSIONS[voice.mime] ?? 'bin'}`, { type: voice.mime }));
    form.append('durationMs', String(Math.round(voice.durationMs)));
    return this.#afterFunctionSend(conversationId, asFeatureFailure(await invokePhotos<{ recipientInbox: string }>(this.#client, form)));
  }

  async editMessage(session: PlayerSession, messageId: string, text: string): Promise<Result<void, FeatureFailure>> {
    const reply = await this.#write<EditReply>('edit_message', { p_token: session.token, p_message: messageId, p_body: text });
    if (!reply.ok) return reply;
    if (reply.value.status !== 'ok') return err(reply.value.status);
    this.#notify(reply.value.conversationId, reply.value.recipientInbox);
    return ok(undefined);
  }

  async deleteMessage(session: PlayerSession, messageId: string, scope: DeleteScope): Promise<Result<void, WriteFailure>> {
    if (scope === 'me') {
      const reply = await this.#write<string>('hide_message', { p_token: session.token, p_message: messageId });
      if (!reply.ok) return asWriteFailure(reply);
      return reply.value === 'ok' ? ok(undefined) : err('unauthorized');
    }
    const reply = asWriteFailure(
      await invokePhotos<{ conversationId: string; recipientInbox: string }>(this.#client, {
        op: 'delete-message',
        token: session.token,
        messageId,
      }),
    );
    if (!reply.ok) return reply;
    this.#mediaCache.delete(messageId);
    this.#notify(reply.value.conversationId, reply.value.recipientInbox);
    return ok(undefined);
  }

  async forward(
    session: PlayerSession,
    messageId: string,
    conversationIds: readonly string[],
  ): Promise<Result<void, FeatureFailure | PhotoLimitFailure>> {
    const reply = await invokePhotos<{ delivered: { conversationId: string; recipientInbox: string }[] }>(this.#client, {
      op: 'forward',
      token: session.token,
      messageId,
      conversationIds,
    });
    if (!reply.ok) return reply;
    for (const copy of reply.value.delivered) this.#notify(copy.conversationId, copy.recipientInbox);
    return reply.value.delivered.length > 0 ? ok(undefined) : err('unavailable');
  }

  async markRead(session: PlayerSession, conversationId: string): Promise<void> {
    await this.#client.rpc('mark_read', { p_token: session.token, p_conversation: conversationId });
  }

  async markUnread(session: PlayerSession, conversationId: string): Promise<Result<void, WriteFailure>> {
    return this.#listChange(await this.#write<string>('mark_unread', { p_token: session.token, p_conversation: conversationId }));
  }

  async clear(session: PlayerSession, conversationId: string, mode: 'empty' | 'remove'): Promise<Result<void, WriteFailure>> {
    return this.#listChange(
      await this.#write<string>('clear_conversation', {
        p_token: session.token,
        p_conversation: conversationId,
        p_remove: mode === 'remove',
      }),
    );
  }

  typing(_session: PlayerSession, conversationId: string): void {
    const inbox = this.#peerInboxes.get(conversationId);
    if (inbox) this.#signal(inbox, TYPING_EVENT, conversationId);
  }

  onInbox(session: PlayerSession, listener: Listener): () => void {
    return this.#listen(session, this.#messageListeners, listener);
  }

  onTyping(session: PlayerSession, listener: Listener): () => void {
    return this.#listen(session, this.#typingListeners, listener);
  }

  /** One channel per phone carries both events: two channels on the same topic would clash. */
  #listen(session: PlayerSession, listeners: Set<Listener>, listener: Listener): () => void {
    listeners.add(listener);
    if (this.#inbox?.key !== session.inboxKey) {
      if (this.#inbox) void this.#client.removeChannel(this.#inbox.channel);
      const channel = this.#client
        .channel(`inbox:${session.inboxKey}`)
        .on('broadcast', { event: MESSAGE_EVENT }, ({ payload }) => this.#emit(this.#messageListeners, payload))
        .on('broadcast', { event: TYPING_EVENT }, ({ payload }) => this.#emit(this.#typingListeners, payload))
        .subscribe();
      this.#inbox = { key: session.inboxKey, channel };
    }
    return () => {
      listeners.delete(listener);
      if (this.#messageListeners.size === 0 && this.#typingListeners.size === 0 && this.#inbox) {
        void this.#client.removeChannel(this.#inbox.channel);
        this.#inbox = null;
      }
    };
  }

  #emit(listeners: Set<Listener>, payload: unknown): void {
    const { conversationId } = payload as { conversationId: string };
    for (const listener of listeners) listener(conversationId);
  }

  /** Changes to the list itself concern only this phone. */
  #listChange(reply: Result<string, FeatureFailure>): Result<void, WriteFailure> {
    if (!reply.ok) return err(reply.error === 'disabled' ? 'rejected' : reply.error);
    if (reply.value === 'unauthorized') return err('unauthorized');
    if (reply.value !== 'ok') return err('rejected');
    for (const listener of this.#messageListeners) listener('');
    return ok(undefined);
  }

  #afterFunctionSend<E>(
    conversationId: string,
    reply: Result<{ status: 'ok'; recipientInbox: string }, E>,
  ): Result<void, E> {
    if (!reply.ok) return reply;
    this.#notify(conversationId, reply.value.recipientInbox);
    return ok(undefined);
  }

  /** This phone's screens at once, the other person through their inbox. */
  #notify(conversationId: string, recipientInbox: string | undefined): void {
    for (const listener of this.#messageListeners) listener(conversationId);
    if (recipientInbox) this.#signal(recipientInbox, MESSAGE_EVENT, conversationId);
  }

  #signal(inbox: string, event: string, conversationId: string): void {
    const topic = `inbox:${inbox}`;
    let outbox = this.#outboxes.get(topic);
    if (!outbox) {
      outbox = this.#client.channel(topic);
      this.#outboxes.set(topic, outbox);
    }
    // A lost signal only delays the change until the next refresh.
    void outbox.httpSend(event, { conversationId }).catch(() => {});
  }

  async #read<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.#client.rpc(fn, args);
    if (error) throw toReadError(error);
    return data as T;
  }

  async #write<T>(fn: string, args: Record<string, unknown>): Promise<Result<T, FeatureFailure>> {
    const { data, error } = await this.#client.rpc(fn, args);
    return error ? err('unavailable') : ok(data as T);
  }
}

function toReadError(error: PostgrestError): Error {
  return error.code === INVALID_AUTHORIZATION ? new SessionExpiredError() : new Error(error.message);
}

function mediaForm(op: string, session: PlayerSession, conversationId: string, replyTo: string | null): FormData {
  const form = new FormData();
  form.append('op', op);
  form.append('token', session.token);
  form.append('conversationId', conversationId);
  if (replyTo) form.append('replyTo', replyTo);
  return form;
}

function toMessage(row: MessageRow): ChatMessage {
  const base = {
    id: row.id,
    senderId: row.sender_id,
    sentAt: new Date(row.created_at),
    forwarded: row.forwarded,
    replyTo: toQuote(row),
  };
  if (row.deleted) return { ...base, kind: 'deleted' };
  if (row.kind === 'photo') return { ...base, kind: 'photo' };
  if (row.kind === 'voice') return { ...base, kind: 'voice', durationMs: row.duration_ms ?? 0 };
  return { ...base, kind: 'text', text: row.body ?? '', edited: row.edited };
}

function toQuote(row: MessageRow): QuotedMessage | null {
  if (!row.reply_id || !row.reply_sender_id || !row.reply_kind) return null;
  return {
    id: row.reply_id,
    senderId: row.reply_sender_id,
    kind: row.reply_deleted ? 'deleted' : row.reply_kind,
    text: row.reply_body,
  };
}
