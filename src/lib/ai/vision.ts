import "server-only";

import { aiTraitSuggestionSchema, type AiTraitSuggestion } from "@/lib/validation/schemas";

/**
 * Optional AI Vision trait extraction (M6).
 *
 * Design decisions for a stable, safe hackathon submission:
 * - Uses a plain `fetch` to the Gemini REST API — NO SDK/npm dependency, so
 *   it can never break the build or the local demo.
 * - Server-only (`import "server-only"`); the `GEMINI_API_KEY` never reaches
 *   the browser.
 * - If the key is absent, `isAiVisionEnabled()` is false and
 *   `suggestTraitsFromImage` returns null — the app is fully functional
 *   without AI.
 * - Only the image bytes are sent. No GPS, no reporter contact, no user
 *   identity is ever included in the request (see `suggestTraitsFromPhoto`).
 * - The model response is validated with Zod (`aiTraitSuggestionSchema`);
 *   any malformed/unsafe response degrades to null rather than surfacing
 *   unvalidated content.
 * - Wording is advisory only. The model suggests *traits* of the cat in the
 *   photo; it never asserts the photo is the *same cat* as an existing
 *   profile — identity matching remains the deterministic engine's job with
 *   human confirmation.
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 12_000;

const PROMPT = [
  "You are helping a stray-cat rescue app describe a cat from a single photo.",
  "Look ONLY at the cat in the image and return a JSON object with EXACTLY these keys:",
  '  "coatColour": one of ["black","white","grey","orange","brown","calico","tabby","tortoiseshell","tuxedo","mixed","other"]',
  '  "furPattern": one of ["solid","tabby","bicolor","tricolor","pointed","spotted","other"]',
  '  "approximateSize": one of ["kitten","small","medium","large"]',
  '  "ageGroup": one of ["kitten","juvenile","adult","senior","unknown"]',
  '  "visibleInjuries": array of short strings (empty array if none visible)',
  '  "possiblePregnancy": boolean (true only if clearly visibly pregnant)',
  '  "distinguishingMarks": array of short strings (e.g. "white chest patch")',
  '  "confidence": one of ["low","medium","high"]',
  "Rules: only describe what is visible; use \"unknown\" / empty arrays / low confidence when unsure;",
  "do NOT identify the individual cat or guess its name; return ONLY the JSON object, no prose.",
].join("\n");

export function isAiVisionEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export type AiVisionResult =
  | { status: "disabled" }
  | { status: "ok"; suggestion: AiTraitSuggestion }
  | { status: "error"; message: string };

/**
 * Sends ONLY the image to Gemini and returns a Zod-validated trait
 * suggestion, or a disabled/error status. Never throws — all failure modes
 * are represented in the return type so callers degrade gracefully.
 */
export async function suggestTraitsFromImage(
  base64: string,
  mime: string
): Promise<AiVisionResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: "disabled" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mime, data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      return { status: "error", message: "The AI service is unavailable right now." };
    }

    const payload: unknown = await response.json();
    const text = extractText(payload);
    if (!text) return { status: "error", message: "The AI service returned no suggestion." };

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return { status: "error", message: "The AI service returned an unreadable suggestion." };
    }

    const validated = aiTraitSuggestionSchema.safeParse(parsedJson);
    if (!validated.success) {
      return { status: "error", message: "The AI suggestion couldn't be validated and was discarded." };
    }

    return { status: "ok", suggestion: validated.data };
  } catch {
    // Network error, timeout/abort, etc. — never let AI break the flow.
    return { status: "error", message: "Couldn't reach the AI service. You can still fill in traits manually." };
  } finally {
    clearTimeout(timeout);
  }
}

/** Safely pull the model's text output from the Gemini response shape. */
function extractText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const textPart = parts.find(
    (p): p is { text: string } => typeof (p as { text?: unknown })?.text === "string"
  );
  return textPart?.text ?? null;
}
