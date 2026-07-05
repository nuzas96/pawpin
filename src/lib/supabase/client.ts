"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client. Uses the public anon key; all access is enforced by
 * Row Level Security. Safe to use in client components.
 */
export function createClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
