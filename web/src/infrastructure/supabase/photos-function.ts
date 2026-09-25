import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeatureFailure, WriteFailure } from '../../application/ports';
import { err, ok, type Result } from '../../domain/result';

// Replies of supabase/functions/photos.
export type FunctionReply<T = unknown> = { status: 'ok' } & T;
type FunctionFailure = { status: 'unauthorized' | 'rejected' | 'disabled' | 'error' };

const PHOTOS_FUNCTION = 'photos';

export async function invokePhotos<T>(
  client: SupabaseClient,
  body: FormData | Record<string, unknown>,
): Promise<Result<FunctionReply<T>, FeatureFailure>> {
  const { data, error } = await client.functions.invoke(PHOTOS_FUNCTION, { body });
  if (error) return err('unavailable');
  const reply = data as FunctionReply<T> | FunctionFailure;
  if (reply.status === 'ok') return ok(reply as FunctionReply<T>);
  return err(reply.status === 'error' ? 'unavailable' : reply.status);
}

/** For operations no switch can turn off: "disabled" cannot happen, treat it as a refusal. */
export function asWriteFailure<T>(result: Result<T, FeatureFailure>): Result<T, WriteFailure> {
  return result.ok || result.error !== 'disabled' ? (result as Result<T, WriteFailure>) : err('rejected');
}

/** The function returns host-less links: the local stack's internal address is unreachable. */
export function absoluteUrl(base: string, path: string): string {
  return base.replace(/\/$/, '') + path;
}
