import type { PostgrestError, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  CHAT_PAGE_SIZE,
  SessionExpiredError,
  type Chat,
  type ChatMediaLinks,
  type FeatureFailure,
  type PreparedPhoto,
  type WriteFailure,
} from '../../application/ports';
import type { ChatMessage, ChatPeer, ConversationSummary, MessageKind, VoiceRecording } from '../../domain/chat';
import type { PlayerSession } from '../../domain/player';
import { err, ok, type Result } from '../../domain/result';
import { absoluteUrl, asWriteFailure, invokePhotos } from './photos-function';

// Shapes returned by supabase/migrations (features_and_chat) and supabase/functions/photos.
interface ConversationRow {
  id: string;
  other_id: string;
  other_nickname: string;
  other_avatar_id: string | null;
  last_kind: MessageKind;
  last_body: string | null;
  last_mine: boolean;
  last_at: string;
  unread: number;
}
interface MessageRow {
  id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  duration_ms: number | null;
  created_at: string;
}
type SendReply = { status: 'ok'; recipientInbox: string } | { status: 'unauthorized' | 'rejected' | 'disabled' };

const INVALID_AUTHORIZATION = '28000';
const INBOX_EVENT = 'message';
const AUDIO_EXTENSIONS: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg' };

/**
 * Private chat (ADR 0015). Every player listens on "inbox:<secret key>"; whoever sends or
 * deletes a message tells the recipient there, without the message itself.
 */
export class SupabaseChat implements Chat {
  readonly #client: SupabaseClient;
  readonly #url: string;
  readonly #mediaCache = new Map<string, ChatMediaLinks>();
  readonly #localListeners = new Set<(conversationId: string) => void>();
  readonly #outboxes = new Map<string, RealtimeChannel>();

  constructor(client: SupabaseClient, url: string) {
    this.#client = client;
    this.#url = url;
  }

  async conversations(session: PlayerSession): Promise<readonly ConversationSummary[]> {
    const rows = await this.#read<ConversationRow[]>('conversations', { p_token: session.token });
    return rows.map((row) => ({
      id: row.id,
      other: { id: row.other_id, nickname: row.other_nickname, avatarId: row.other_avatar_id },
      last: { kind: row.last_kind, text: row.last_body, mine: row.last_mine, at: new Date(row.last_at) },
      unread: Number(row.unread),
    }));
  }

  conversation(session: PlayerSession, conversationId: string): Promise<{ id: string; other: ChatPeer } | null> {
    return this.#read('conversation', { p_token: session.token, p_conversation: conversationId });
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
    const reply = data as { status: 'ok'; conversationId: string } | { status: 'unauthorized' | 'rejected' | 'disabled' };
    return reply.status === 'ok' ? ok(reply.conversationId) : err(reply.status);
  }

  async sendText(session: PlayerSession, conversationId: string, text: string): Promise<Result<void, FeatureFailure>> {
    const { data, error } = await this.#client.rpc('send_message', {
      p_token: session.token,
      p_conversation: conversationId,
      p_body: text,
    });
    if (error) return err('unavailable');
    return this.#afterSend(conversationId, data as SendReply);
  }

  async sendPhoto(session: PlayerSession, conversationId: string, photo: PreparedPhoto): Promise<Result<void, FeatureFailure>> {
    const form = mediaForm('chat-photo', session, conversationId);
    form.append('full', photo.full, 'full.jpg');
    form.append('thumbnail', photo.thumbnail, 'thumbnail.jpg');
    return this.#afterFunctionSend(conversationId, await invokePhotos<{ recipientInbox: string }>(this.#client, form));
  }

  async sendVoice(session: PlayerSession, conversationId: string, voice: VoiceRecording): Promise<Result<void, FeatureFailure>> {
    const form = mediaForm('chat-voice', session, conversationId);
    form.append('audio', new File([voice.blob], `voce.${AUDIO_EXTENSIONS[voice.mime] ?? 'bin'}`, { type: voice.mime }));
    form.append('durationMs', String(Math.round(voice.durationMs)));
    return this.#afterFunctionSend(conversationId, await invokePhotos<{ recipientInbox: string }>(this.#client, form));
  }

  async deleteMessage(session: PlayerSession, messageId: string): Promise<Result<void, WriteFailure>> {
    const reply = asWriteFailure(
      await invokePhotos<{ recipientInbox?: string }>(this.#client, { op: 'delete-message', token: session.token, messageId }),
    );
    if (!reply.ok) return reply;
    this.#mediaCache.delete(messageId);
    // Deletion does not say which conversation: listeners reload what they show.
    this.#notify('', reply.value.recipientInbox);
    return ok(undefined);
  }

  async markRead(session: PlayerSession, conversationId: string): Promise<void> {
    await this.#client.rpc('mark_read', { p_token: session.token, p_conversation: conversationId });
  }

  onInbox(session: PlayerSession, listener: (conversationId: string) => void): () => void {
    this.#localListeners.add(listener);
    const channel = this.#client
      .channel(`inbox:${session.inboxKey}`)
      .on('broadcast', { event: INBOX_EVENT }, ({ payload }) => listener((payload as { conversationId: string }).conversationId))
      .subscribe();
    return () => {
      this.#localListeners.delete(listener);
      void this.#client.removeChannel(channel);
    };
  }

  #afterSend(conversationId: string, reply: SendReply): Result<void, FeatureFailure> {
    if (reply.status !== 'ok') return err(reply.status);
    this.#notify(conversationId, reply.recipientInbox);
    return ok(undefined);
  }

  #afterFunctionSend(
    conversationId: string,
    reply: Result<{ status: 'ok'; recipientInbox: string }, FeatureFailure>,
  ): Result<void, FeatureFailure> {
    if (!reply.ok) return reply;
    this.#notify(conversationId, reply.value.recipientInbox);
    return ok(undefined);
  }

  /** This phone's screens at once, the other person through their inbox. */
  #notify(conversationId: string, recipientInbox: string | undefined): void {
    for (const listener of this.#localListeners) listener(conversationId);
    if (!recipientInbox) return;
    const topic = `inbox:${recipientInbox}`;
    let outbox = this.#outboxes.get(topic);
    if (!outbox) {
      outbox = this.#client.channel(topic);
      this.#outboxes.set(topic, outbox);
    }
    // A lost signal only delays the message until the next refresh.
    void outbox.httpSend(INBOX_EVENT, { conversationId }).catch(() => {});
  }

  async #read<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.#client.rpc(fn, args);
    if (error) throw toReadError(error);
    return data as T;
  }
}

function toReadError(error: PostgrestError): Error {
  return error.code === INVALID_AUTHORIZATION ? new SessionExpiredError() : new Error(error.message);
}

function mediaForm(op: string, session: PlayerSession, conversationId: string): FormData {
  const form = new FormData();
  form.append('op', op);
  form.append('token', session.token);
  form.append('conversationId', conversationId);
  return form;
}

function toMessage(row: MessageRow): ChatMessage {
  const base = { id: row.id, senderId: row.sender_id, sentAt: new Date(row.created_at) };
  if (row.kind === 'photo') return { ...base, kind: 'photo' };
  if (row.kind === 'voice') return { ...base, kind: 'voice', durationMs: row.duration_ms ?? 0 };
  return { ...base, kind: 'text', text: row.body ?? '' };
}
