"use server";

import { createClient } from "@/lib/supabase/server";
import { commentSchema, type CommentInput } from "@/lib/validation/schemas";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

export type AddCommentResult =
  | { ok: true; commentId: string }
  | { ok: false; error: string };

/**
 * Add a comment to a cat profile or case. Comments are always stored and
 * later rendered as plain text — never as HTML — so no sanitisation beyond
 * trimming/length limits is needed; React escapes text content by default
 * and no component uses `dangerouslySetInnerHTML` for comment bodies.
 *
 * This is a direct table write (not an RPC): `comments_insert` RLS only
 * requires `author_id = auth.uid()`, which every authenticated user already
 * satisfies for their own comment — no additional role-based authorization
 * is needed here, unlike the claim/feeding/TNR/adoption RPCs.
 */
export async function addComment(input: CommentInput): Promise<AddCommentResult> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to comment." };

  const rate = checkRateLimit("comment", user.id, RATE_LIMITS.comment);
  if (!rate.ok) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const { data, error } = await supabase
    .from("comments")
    .insert({
      cat_id: parsed.data.catId ?? null,
      case_id: parsed.data.caseId ?? null,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: `Could not post comment: ${error?.message ?? "unknown error"}` };
  }

  return { ok: true, commentId: data.id };
}
