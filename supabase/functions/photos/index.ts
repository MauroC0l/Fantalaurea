// The only code that touches photo and chat files (ADR 0008, 0012, 0015). It checks the app's own tokens, runs
// the service-only SQL functions and keeps the private bucket in sync with the database.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'photos';
// Long enough for a whole evening: phones cache links instead of asking again.
const LINK_TTL_SECONDS = 12 * 60 * 60;
const MAX_LINKS_PER_REQUEST = 100;
const MAX_FULL_BYTES = 15 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Reply = { status: string; [key: string]: unknown };

const UNAUTHORIZED: Reply = { status: 'unauthorized' };
const REJECTED: Reply = { status: 'rejected' };
const OK: Reply = { status: 'ok' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    return respond(await route(request));
  } catch (error) {
    console.error(error);
    return respond({ status: 'error' }, 500);
  }
});

function respond(reply: Reply, status = 200): Response {
  return new Response(JSON.stringify(reply), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function route(request: Request): Promise<Reply> {
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    const form = await request.formData();
    switch (form.get('op')) {
      case 'complete':
        return completeWithPhoto(form);
      case 'post':
        return createPost(form);
      case 'avatar':
        return setAvatar(form);
      case 'chat-photo':
        return sendChatPhoto(form);
      case 'chat-voice':
        return sendChatVoice(form);
      default:
        return REJECTED;
    }
  }
  const body = await request.json();
  switch (body.op) {
    case 'links':
      return links(body.token, body.photoIds);
    case 'undo':
      return undo(body.token, body.actionId);
    case 'delete-photo':
      return deletePhoto(body.token, body.photoId);
    case 'delete-post':
      return deletePost(body.token, body.postId);
    case 'album':
      return album(body.token);
    case 'remove-action':
      return removeAction(body.token, body.actionId);
    case 'reset':
      return resetEvening(body.token);
    case 'chat-media':
      return chatMedia(body.token, body.messageIds);
    case 'delete-message':
      return deleteMessage(body.token, body.messageId);
    default:
      return REJECTED;
  }
}

// ------------------------------------------------------------------ chat (ADR 0015)

const CHAT_BUCKET = 'chat';
const MAX_VOICE_BYTES = 3 * 1024 * 1024;
const MAX_VOICE_MS = 60_000;
const VOICE_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
};

type MediaReply = { status: string; recipientInbox?: string };

async function sendChatPhoto(form: FormData): Promise<Reply> {
  const playerId = await playerOf(form.get('token'));
  if (!playerId) return UNAUTHORIZED;
  const conversationId = form.get('conversationId');
  const full = form.get('full');
  const thumbnail = form.get('thumbnail');
  if (!isUuid(conversationId) || !isJpeg(full, MAX_FULL_BYTES) || !isJpeg(thumbnail, MAX_THUMBNAIL_BYTES)) return REJECTED;

  const mediaId = crypto.randomUUID();
  await uploadTo(CHAT_BUCKET, chatPhotoPath(mediaId), full, 'image/jpeg');
  await uploadTo(CHAT_BUCKET, chatThumbnailPath(mediaId), thumbnail, 'image/jpeg');
  const result = await call<MediaReply>('svc_send_media', {
    p_player: playerId,
    p_conversation: conversationId,
    p_kind: 'photo',
    p_media_id: mediaId,
    p_mime: 'image/jpeg',
    p_duration_ms: null,
  });
  if (result.status !== 'ok') await removeChatFiles([chatPhotoPath(mediaId), chatThumbnailPath(mediaId)]);
  return result;
}

async function sendChatVoice(form: FormData): Promise<Reply> {
  const playerId = await playerOf(form.get('token'));
  if (!playerId) return UNAUTHORIZED;
  const conversationId = form.get('conversationId');
  const audio = form.get('audio');
  const durationMs = Number(form.get('durationMs'));
  const mime = audio instanceof File ? audio.type.split(';')[0] : '';
  if (
    !isUuid(conversationId) ||
    !(audio instanceof File) ||
    audio.size === 0 ||
    audio.size > MAX_VOICE_BYTES ||
    !(mime in VOICE_EXTENSIONS) ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > MAX_VOICE_MS + 5_000
  ) {
    return REJECTED;
  }

  const mediaId = crypto.randomUUID();
  const path = voicePath(mediaId, mime);
  await uploadTo(CHAT_BUCKET, path, audio, mime);
  const result = await call<MediaReply>('svc_send_media', {
    p_player: playerId,
    p_conversation: conversationId,
    p_kind: 'voice',
    p_media_id: mediaId,
    p_mime: mime,
    p_duration_ms: Math.round(durationMs),
  });
  if (result.status !== 'ok') await removeChatFiles([path]);
  return result;
}

interface ChatMediaRow {
  message_id: string;
  kind: 'photo' | 'voice';
  media_id: string;
  media_mime: string;
}

/** Only the two people in the conversation get links to its media. */
async function chatMedia(token: unknown, messageIds: unknown): Promise<Reply> {
  const playerId = await playerOf(token);
  if (!playerId) return UNAUTHORIZED;
  if (!Array.isArray(messageIds) || messageIds.length > MAX_LINKS_PER_REQUEST || !messageIds.every(isUuid)) return REJECTED;
  const rows = await call<ChatMediaRow[]>('svc_chat_media', { p_player: playerId, p_message_ids: messageIds });
  const paths = rows.flatMap((row) =>
    row.kind === 'photo' ? [chatPhotoPath(row.media_id), chatThumbnailPath(row.media_id)] : [voicePath(row.media_id, row.media_mime)],
  );
  if (paths.length === 0) return { status: 'ok', media: {} };
  const { data, error } = await db.storage.from(CHAT_BUCKET).createSignedUrls(paths, LINK_TTL_SECONDS);
  if (error) throw error;
  const byPath = new Map(data.map((item) => [item.path, withoutHost(item.signedUrl)]));
  const media = Object.fromEntries(
    rows.map((row) => [
      row.message_id,
      row.kind === 'photo'
        ? { url: byPath.get(chatPhotoPath(row.media_id)), thumbnailUrl: byPath.get(chatThumbnailPath(row.media_id)) }
        : { url: byPath.get(voicePath(row.media_id, row.media_mime)) },
    ]),
  );
  return { status: 'ok', media };
}

async function deleteMessage(token: unknown, messageId: unknown): Promise<Reply> {
  const playerId = await playerOf(token);
  if (!playerId) return UNAUTHORIZED;
  if (!isUuid(messageId)) return REJECTED;
  const result = await call<{ status: string; kind?: string; mediaId?: string; mime?: string; recipientInbox?: string }>(
    'svc_delete_message',
    { p_player: playerId, p_message: messageId },
  );
  if (result.status !== 'ok') return { status: result.status };
  if (result.kind === 'photo' && result.mediaId) {
    await removeChatFiles([chatPhotoPath(result.mediaId), chatThumbnailPath(result.mediaId)]);
  }
  if (result.kind === 'voice' && result.mediaId && result.mime) await removeChatFiles([voicePath(result.mediaId, result.mime)]);
  return { status: 'ok', recipientInbox: result.recipientInbox };
}

/** Evening over: every chat file goes, whoever sent it. */
async function emptyChatBucket(): Promise<void> {
  for (const folder of ['photo', 'voice']) {
    // Bounded: a removal that keeps failing must not loop forever (1000 files per round).
    for (let round = 0; round < 50; round++) {
      const { data, error } = await db.storage.from(CHAT_BUCKET).list(folder, { limit: 1000 });
      if (error) throw error;
      if (data.length === 0) break;
      await removeChatFiles(data.map((file) => `${folder}/${file.name}`));
    }
  }
}

function chatPhotoPath(mediaId: string): string {
  return `photo/${mediaId}.jpg`;
}

function chatThumbnailPath(mediaId: string): string {
  return `photo/${mediaId}-thumb.jpg`;
}

function voicePath(mediaId: string, mime: string): string {
  return `voice/${mediaId}.${VOICE_EXTENSIONS[mime] ?? 'bin'}`;
}

async function uploadTo(bucket: string, path: string, file: File, contentType: string): Promise<void> {
  const { error } = await db.storage.from(bucket).upload(path, file, { contentType });
  if (error) throw error;
}

async function removeChatFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db.storage.from(CHAT_BUCKET).remove(paths);
  if (error) console.error('orphan chat files', paths, error);
}

async function completeWithPhoto(form: FormData): Promise<Reply> {
  const playerId = await playerOf(form.get('token'));
  if (!playerId) return UNAUTHORIZED;
  const actionId = form.get('actionId');
  if (typeof actionId !== 'string') return REJECTED;
  const photoId = await uploadPair(form);
  if (!photoId) return REJECTED;

  const result = await call<{ status: string; replaced_photo_id: string | null }>('svc_complete_with_photo', {
    p_player_id: playerId,
    p_action_id: actionId,
    p_photo_id: photoId,
  });
  if (result.status !== 'ok') {
    await removeFiles([photoId]);
    return { status: result.status };
  }
  await removeFiles([result.replaced_photo_id]);
  return OK;
}

async function createPost(form: FormData): Promise<Reply> {
  const playerId = await playerOf(form.get('token'));
  if (!playerId) return UNAUTHORIZED;
  const caption = form.get('caption');
  const photoId = await uploadPair(form);
  if (!photoId) return REJECTED;

  const status = await call<string>('svc_create_post', {
    p_player_id: playerId,
    p_photo_id: photoId,
    p_caption: typeof caption === 'string' ? caption : '',
  });
  if (status !== 'ok') await removeFiles([photoId]);
  return { status };
}

async function setAvatar(form: FormData): Promise<Reply> {
  const playerId = await playerOf(form.get('token'));
  if (!playerId) return UNAUTHORIZED;
  const photoId = await uploadPair(form);
  if (!photoId) return REJECTED;
  const previous = await call<string | null>('svc_set_avatar', { p_player_id: playerId, p_photo_id: photoId });
  await removeFiles([previous]);
  return OK;
}

/** Any participant may see any photo of the evening (ADR 0012). */
async function links(token: unknown, photoIds: unknown): Promise<Reply> {
  if (!(await hasSession(token))) return UNAUTHORIZED;
  if (!Array.isArray(photoIds) || photoIds.length > MAX_LINKS_PER_REQUEST || !photoIds.every(isUuid)) return REJECTED;
  const known = await call<string[]>('svc_known_photos', { p_ids: photoIds });
  const signed = await signedLinks(known);
  return { status: 'ok', links: Object.fromEntries(signed) };
}

async function undo(token: unknown, actionId: unknown): Promise<Reply> {
  const playerId = await playerOf(token);
  if (!playerId) return UNAUTHORIZED;
  if (typeof actionId !== 'string') return REJECTED;
  const result = await call<{ status: string; photo_id: string | null }>('svc_undo', {
    p_player_id: playerId,
    p_action_id: actionId,
  });
  await removeFiles([result.photo_id]);
  return { status: result.status };
}

/** Players delete their own photos; the admin can delete any (moderation). */
async function deletePhoto(token: unknown, photoId: unknown): Promise<Reply> {
  if (!isUuid(photoId)) return REJECTED;
  const actor = await actorOf(token);
  if (!actor) return UNAUTHORIZED;
  const result = await call<{ status: string; undone: boolean }>('svc_delete_photo', {
    p_photo_id: photoId,
    p_player_id: actor.playerId,
  });
  if (result.status === 'ok') await removeFiles([photoId]);
  return result;
}

async function deletePost(token: unknown, postId: unknown): Promise<Reply> {
  if (!isUuid(postId)) return REJECTED;
  const actor = await actorOf(token);
  if (!actor) return UNAUTHORIZED;
  const photoId = await call<string | null>('svc_delete_post', { p_post_id: postId, p_player_id: actor.playerId });
  if (!photoId) return REJECTED;
  await removeFiles([photoId]);
  return OK;
}

async function album(token: unknown): Promise<Reply> {
  if (!(await isAdmin(token))) return UNAUTHORIZED;
  const rows = await call<AlbumRow[]>('svc_photos', {});
  const signed = await signedLinks(rows.map((row) => row.photo_id));
  return {
    status: 'ok',
    photos: rows.map((row) => ({
      id: row.photo_id,
      source: row.source,
      title: row.title,
      nickname: row.player_nickname,
      realName: row.player_real_name,
      takenAt: row.taken_at,
      ...signed.get(row.photo_id),
    })),
  };
}

async function removeAction(token: unknown, actionId: unknown): Promise<Reply> {
  if (!(await isAdmin(token))) return UNAUTHORIZED;
  if (typeof actionId !== 'string') return REJECTED;
  const photoIds = await call<string[] | null>('svc_remove_action', { p_action_id: actionId });
  if (photoIds === null) return REJECTED;
  await removeFiles(photoIds);
  return OK;
}

async function resetEvening(token: unknown): Promise<Reply> {
  if (!(await isAdmin(token))) return UNAUTHORIZED;
  await removeFiles(await call<string[]>('svc_reset_evening', {}));
  await emptyChatBucket();
  return OK;
}

interface AlbumRow {
  photo_id: string;
  source: 'action' | 'post';
  title: string;
  player_nickname: string;
  player_real_name: string;
  taken_at: string;
}

/** Stores the full photo and its thumbnail; returns the new photo id, or null if invalid. */
async function uploadPair(form: FormData): Promise<string | null> {
  const full = form.get('full');
  const thumbnail = form.get('thumbnail');
  if (!isJpeg(full, MAX_FULL_BYTES) || !isJpeg(thumbnail, MAX_THUMBNAIL_BYTES)) return null;
  const photoId = crypto.randomUUID();
  await upload(fullPath(photoId), full);
  await upload(thumbnailPath(photoId), thumbnail);
  return photoId;
}

/**
 * Links are returned without host: inside the local stack the function sees an internal
 * address the browser cannot reach, so the app prefixes its own Supabase URL.
 */
async function signedLinks(photoIds: string[]): Promise<Map<string, { thumbnailUrl: string; fullUrl: string }>> {
  if (photoIds.length === 0) return new Map();
  const paths = photoIds.flatMap((id) => [thumbnailPath(id), fullPath(id)]);
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, LINK_TTL_SECONDS);
  if (error) throw error;
  const byPath = new Map(data.map((item) => [item.path, withoutHost(item.signedUrl)]));
  return new Map(
    photoIds.map((id) => [id, { thumbnailUrl: byPath.get(thumbnailPath(id))!, fullUrl: byPath.get(fullPath(id))! }]),
  );
}

function withoutHost(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

/** playerId null = the admin. */
async function actorOf(token: unknown): Promise<{ playerId: string | null } | null> {
  if (await isAdmin(token)) return { playerId: null };
  const playerId = await playerOf(token);
  return playerId ? { playerId } : null;
}

async function hasSession(token: unknown): Promise<boolean> {
  if (!isUuid(token)) return false;
  return call<boolean>('has_session', { p_token: token });
}

async function playerOf(token: unknown): Promise<string | null> {
  if (!isUuid(token)) return null;
  return call<string | null>('player_of', { p_token: token });
}

async function isAdmin(token: unknown): Promise<boolean> {
  if (!isUuid(token)) return false;
  return call<boolean>('is_admin', { p_token: token });
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

async function upload(path: string, file: File): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: 'image/jpeg' });
  if (error) throw error;
}

async function removeFiles(photoIds: (string | null)[]): Promise<void> {
  const paths = photoIds.filter((id): id is string => id !== null).flatMap((id) => [fullPath(id), thumbnailPath(id)]);
  if (paths.length === 0) return;
  const { error } = await db.storage.from(BUCKET).remove(paths);
  if (error) console.error('orphan photo files', paths, error);
}

function fullPath(photoId: string): string {
  return `full/${photoId}.jpg`;
}

function thumbnailPath(photoId: string): string {
  return `thumb/${photoId}.jpg`;
}

function isJpeg(value: FormDataEntryValue | null, maxBytes: number): value is File {
  return value instanceof File && value.type === 'image/jpeg' && value.size > 0 && value.size <= maxBytes;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
