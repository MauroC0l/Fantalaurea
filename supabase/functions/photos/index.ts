// The only code that touches photo files (ADR 0008). It checks the app's own tokens, runs the
// service-only SQL functions and keeps the private bucket in sync with the database.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'photos';
const LINK_TTL_SECONDS = 60 * 60;
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
    return completeWithPhoto(await request.formData());
  }
  const body = await request.json();
  switch (body.op) {
    case 'undo':
      return undo(body.token, body.actionId);
    case 'delete-photo':
      return deletePhoto(body.token, body.photoId);
    case 'own-photos':
      return ownPhotos(body.token);
    case 'album':
      return album(body.token);
    case 'remove-action':
      return removeAction(body.token, body.actionId);
    case 'reset':
      return resetEvening(body.token);
    default:
      return REJECTED;
  }
}

async function completeWithPhoto(form: FormData): Promise<Reply> {
  const playerId = await playerOf(form.get('token'));
  if (!playerId) return UNAUTHORIZED;
  const actionId = form.get('actionId');
  const full = form.get('full');
  const thumbnail = form.get('thumbnail');
  if (typeof actionId !== 'string' || !isJpeg(full, MAX_FULL_BYTES) || !isJpeg(thumbnail, MAX_THUMBNAIL_BYTES)) {
    return REJECTED;
  }

  const photoId = crypto.randomUUID();
  await upload(fullPath(photoId), full);
  await upload(thumbnailPath(photoId), thumbnail);

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

/** Players delete their own photos; the admin can delete any. */
async function deletePhoto(token: unknown, photoId: unknown): Promise<Reply> {
  if (!isUuid(photoId)) return REJECTED;
  const admin = await isAdmin(token);
  const playerId = admin ? null : await playerOf(token);
  if (!admin && !playerId) return UNAUTHORIZED;

  const result = await call<{ status: string; undone: boolean }>('svc_delete_photo', {
    p_photo_id: photoId,
    p_player_id: playerId,
  });
  if (result.status === 'ok') await removeFiles([photoId]);
  return result;
}

async function ownPhotos(token: unknown): Promise<Reply> {
  const playerId = await playerOf(token);
  if (!playerId) return UNAUTHORIZED;
  const rows = await photoRows(playerId);
  const links = await signedLinks(rows.map((row) => row.photo_id));
  return {
    status: 'ok',
    photos: rows.map((row) => ({ id: row.photo_id, actionId: row.action_id, ...links.get(row.photo_id) })),
  };
}

async function album(token: unknown): Promise<Reply> {
  if (!(await isAdmin(token))) return UNAUTHORIZED;
  const rows = await photoRows(null);
  const links = await signedLinks(rows.map((row) => row.photo_id));
  return {
    status: 'ok',
    photos: rows.map((row) => ({
      id: row.photo_id,
      actionTitle: row.action_title,
      nickname: row.player_nickname,
      realName: row.player_real_name,
      takenAt: row.completed_at,
      ...links.get(row.photo_id),
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
  return OK;
}

interface PhotoRow {
  photo_id: string;
  action_id: string;
  action_title: string;
  player_nickname: string;
  player_real_name: string;
  completed_at: string;
}

function photoRows(playerId: string | null): Promise<PhotoRow[]> {
  return call<PhotoRow[]>('svc_photos', { p_player_id: playerId });
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
