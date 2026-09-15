import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

/**
 * Service-role client. It bypasses RLS, so it stays on the server and is never
 * handed to the browser. The bucket is private; the browser only receives
 * short-lived signed URLs minted here after an ownership/role check.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
