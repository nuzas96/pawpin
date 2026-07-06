"use server";

import { createClient } from "@/lib/supabase/server";
import { aiVisionInputSchema, type AiVisionInput, type AiTraitSuggestion } from "@/lib/validation/schemas";
import { detectImageType, stripImageMetadata, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME } from "@/lib/validation/image";
import { isAiVisionEnabled, suggestTraitsFromImage } from "@/lib/ai/vision";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

export type SuggestTraitsResult =
  | { ok: true; enabled: boolean; suggestion: AiTraitSuggestion | null; message?: string }
  | { ok: false; error: string };

/**
 * Optional AI Vision trait suggestion for the report flow.
 *
 * - Requires a signed-in user and is rate-limited (external API cost).
 * - Re-validates the image server-side (magic bytes + size) — never trusts
 *   the client — before sending ONLY the image to Gemini.
 * - Sends no coordinates, contact, or identity to the AI.
 * - Returns `enabled: false` (not an error) when no `GEMINI_API_KEY` is set,
 *   so the UI can simply hide/soft-disable the feature.
 */
export async function suggestTraitsFromPhoto(input: AiVisionInput): Promise<SuggestTraitsResult> {
  const parsed = aiVisionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid image." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to use AI suggestions." };

  if (!isAiVisionEnabled()) {
    return { ok: true, enabled: false, suggestion: null };
  }

  const rate = checkRateLimit("ai", user.id, RATE_LIMITS.ai);
  if (!rate.ok) return { ok: false, error: RATE_LIMIT_MESSAGE };

  // Decode + re-validate server-side (defence in depth — the client is not trusted).
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(parsed.data.base64, "base64"));
  } catch {
    return { ok: false, error: "Could not read the image data." };
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image is empty or exceeds the 8 MB limit." };
  }
  const detected = detectImageType(bytes);
  if (!detected || !(ALLOWED_IMAGE_MIME as readonly string[]).includes(detected)) {
    return { ok: false, error: "This file doesn't look like a valid JPG or PNG image." };
  }

  const cleanBytes = stripImageMetadata(bytes, detected);
  if (!cleanBytes) {
    return { ok: false, error: "Could not safely process the image metadata." };
  }

  const cleanBase64 = Buffer.from(cleanBytes).toString("base64");
  const result = await suggestTraitsFromImage(cleanBase64, detected);

  if (result.status === "disabled") return { ok: true, enabled: false, suggestion: null };
  if (result.status === "error") {
    return { ok: true, enabled: true, suggestion: null, message: result.message };
  }
  return { ok: true, enabled: true, suggestion: result.suggestion };
}
