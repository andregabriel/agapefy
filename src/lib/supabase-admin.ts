import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = "https://vvgqqlrujmyxzzygsizc.supabase.co";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';

let adminClient: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (!adminClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase Service Role configuration.');
    }
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return adminClient;
}
