import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Admin Supabase client using the SERVICE ROLE key. This BYPASSES Row Level
 * Security and must NEVER be imported into a client component. The
 * `server-only` import above makes the build fail if that ever happens.
 *
 * Use only for trusted privileged operations (e.g. admin moderation,
 * server-side profile provisioning) after the caller's role has been verified.
 */
export function createAdminClient() {
  const { url } = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env.local (server-only, see .env.example)."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
