import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** One client for the whole app: game, chat and realtime share its connection. */
export function createSupabaseClient(url: string, publishableKey: string): SupabaseClient {
  return createClient(url, publishableKey, { auth: { persistSession: false } });
}
