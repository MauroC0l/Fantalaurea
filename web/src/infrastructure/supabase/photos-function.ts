import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeatureFailure, PhotoLimitFailure, WriteFailure } from '../../application/ports';
import { err, ok, type Result } from '../../domain/result';

// Replies of supabase/functions/photos.
export type FunctionReply<T = unknown> = { status: 'ok' } & T;
type FunctionFailure = { status: 'unauthorized' | 'rejected' | 'disabled' | 'photo-limit' | 'error' };
export type FunctionFailureReason = FeatureFailure | PhotoLimitFailure;

const PHOTOS_FUNCTION = 'photos';

export async function invokePhotos<T>(
  client: SupabaseClient,
  body: FormData | Record<string, unknown>,
): Promise<Result<FunctionReply<T>, FunctionFailureReason>> {
  const { data, error } = await client.functions.invoke(PHOTOS_FUNCTION, { body });
  if (error) return err('unavailable');
  const reply = data as FunctionReply<T> | FunctionFailure;
  if (reply.status === 'ok') return ok(reply as FunctionReply<T>);
  return err(reply.status === 'error' ? 'unavailable' : reply.status);
}

/** For operations that no switch or limit can stop: those answers cannot happen, treat them as a refusal. */
export function asWriteFailure<T>(result: Result<T, FunctionFailureReason>): Result<T, WriteFailure> {
  return result.ok || (result.error !== 'disabled' && result.error !== 'photo-limit')
    ? (result as Result<T, WriteFailure>)
    : err('rejected');
}

/** For operations a switch can stop but the photo limit cannot (text, voice notes). */
export function asFeatureFailure<T>(result: Result<T, FunctionFailureReason>): Result<T, FeatureFailure> {
  return result.ok || result.error !== 'photo-limit' ? (result as Result<T, FeatureFailure>) : err('rejected');
}

/** For uploads with no switch of their own (action photos): only the photo limit can stop them. */
export function asPhotoWrite<T>(result: Result<T, FunctionFailureReason>): Result<T, WriteFailure | PhotoLimitFailure> {
  return result.ok || result.error !== 'disabled' ? (result as Result<T, WriteFailure | PhotoLimitFailure>) : err('rejected');
}

/** The function returns host-less links: the local stack's internal address is unreachable. */
export function absoluteUrl(base: string, path: string): string {
  return base.replace(/\/$/, '') + path;
}
