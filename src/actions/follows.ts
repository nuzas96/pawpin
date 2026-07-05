"use server";

import { createClient } from "@/lib/supabase/server";
import {
  followCatSchema,
  bookmarkCatSchema,
  type FollowCatInput,
  type BookmarkCatInput,
} from "@/lib/validation/schemas";

export type FollowActionResult = { ok: true } | { ok: false; error: string };

/**
 * Follow / unfollow / bookmark / unbookmark a cat. All four are direct table
 * writes: `follows_all`/`bookmarks_all` RLS already restricts every row to
 * `user_id = auth.uid()`, so no RPC is needed — a user can only ever create,
 * read, or delete their own follow/bookmark row.
 */
export async function followCat(input: FollowCatInput): Promise<FollowActionResult> {
  const parsed = followCatSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to follow a cat." };

  const { error } = await supabase
    .from("follows")
    .upsert({ user_id: user.id, cat_id: parsed.data.catId }, { onConflict: "user_id,cat_id" });

  if (error) return { ok: false, error: `Could not follow this cat: ${error.message}` };
  return { ok: true };
}

export async function unfollowCat(input: FollowCatInput): Promise<FollowActionResult> {
  const parsed = followCatSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to unfollow a cat." };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("user_id", user.id)
    .eq("cat_id", parsed.data.catId);

  if (error) return { ok: false, error: `Could not unfollow this cat: ${error.message}` };
  return { ok: true };
}

export async function bookmarkCat(input: BookmarkCatInput): Promise<FollowActionResult> {
  const parsed = bookmarkCatSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to bookmark a cat." };

  const { error } = await supabase
    .from("bookmarks")
    .upsert({ user_id: user.id, cat_id: parsed.data.catId }, { onConflict: "user_id,cat_id" });

  if (error) return { ok: false, error: `Could not bookmark this cat: ${error.message}` };
  return { ok: true };
}

export async function unbookmarkCat(input: BookmarkCatInput): Promise<FollowActionResult> {
  const parsed = bookmarkCatSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to unbookmark a cat." };

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .eq("cat_id", parsed.data.catId);

  if (error) return { ok: false, error: `Could not unbookmark this cat: ${error.message}` };
  return { ok: true };
}
