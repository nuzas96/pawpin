"use server";

import { createClient } from "@/lib/supabase/server";
import {
  moderationFlagSchema,
  reviewModerationFlagSchema,
  hideCommentSchema,
  unhideCommentSchema,
  type ModerationFlagInput,
  type ReviewModerationFlagInput,
  type HideCommentInput,
  type UnhideCommentInput,
} from "@/lib/validation/schemas";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

export type FlagContentResult = { ok: true; flagId: string } | { ok: false; error: string };
export type ReviewFlagResult = { ok: true; flagId: string } | { ok: false; error: string };
export type HideCommentResult = { ok: true; commentId: string } | { ok: false; error: string };

/**
 * File a moderation flag against a cat profile, sighting, or comment. This is
 * a direct table write — `mod_flags_insert` RLS only requires
 * `reported_by = auth.uid()`, which every authenticated user already
 * satisfies for their own report; no RPC/role check is needed here.
 */
export async function flagContent(input: ModerationFlagInput): Promise<FlagContentResult> {
  const parsed = moderationFlagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid report." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to flag content." };

  const rate = checkRateLimit("flag", user.id, RATE_LIMITS.flag);
  if (!rate.ok) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const { data, error } = await supabase
    .from("moderation_flags")
    .insert({
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
      reported_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: `Could not submit this report: ${error?.message ?? "unknown error"}` };
  }

  return { ok: true, flagId: data.id };
}

/**
 * Admin reviews a moderation flag: dismiss, resolve, resolve-and-hide-comment,
 * or resolve-and-close-case. Delegates to the `review_moderation_flag` RPC
 * (admin-only), which applies the side effect (if any) and the flag's new
 * status atomically, and writes an audit_logs row.
 */
export async function reviewModerationFlag(input: ReviewModerationFlagInput): Promise<ReviewFlagResult> {
  const parsed = reviewModerationFlagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("review_moderation_flag", {
    p_flag_id: parsed.data.flagId,
    p_action: parsed.data.action,
    p_note: parsed.data.note ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not review this flag." };
  }

  return { ok: true, flagId: data };
}

/**
 * Hide a comment (admin-only). Delegates to the `hide_comment` RPC, which
 * sets `is_hidden = true` and writes an audit_logs row. Comment text is never
 * modified — it remains plain text, simply excluded from `comments_select`
 * for non-admin/non-author viewers via the existing `is_hidden` RLS check.
 */
export async function hideComment(input: HideCommentInput): Promise<HideCommentResult> {
  const parsed = hideCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("hide_comment", {
    p_comment_id: parsed.data.commentId,
    p_reason: parsed.data.reason ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not hide this comment." };
  }

  return { ok: true, commentId: data };
}

/** Unhide a previously hidden comment (admin-only). */
export async function unhideComment(input: UnhideCommentInput): Promise<HideCommentResult> {
  const parsed = unhideCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("unhide_comment", {
    p_comment_id: parsed.data.commentId,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not unhide this comment." };
  }

  return { ok: true, commentId: data };
}
