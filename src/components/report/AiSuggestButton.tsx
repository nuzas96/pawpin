"use client";

import { useState } from "react";
import { suggestTraitsFromPhoto } from "@/actions/aiVision";
import type { AiTraitSuggestion } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/Button";

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Optional "Suggest traits with AI" control. Only rendered when the server
 * reports AI Vision is enabled (a `GEMINI_API_KEY` is configured). The photo
 * is sent to the server action, which forwards ONLY the image to Gemini and
 * returns Zod-validated, editable suggestions. All wording is advisory — the
 * user reviews/edits before submitting; nothing is auto-committed.
 */
export function AiSuggestButton({
  photoFile,
  onApply,
}: {
  photoFile: File | null;
  onApply: (suggestion: AiTraitSuggestion) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<AiTraitSuggestion | null>(null);

  async function handleSuggest() {
    setError(null);
    if (!photoFile) {
      setError("Add a photo first, then let AI suggest traits.");
      return;
    }
    setLoading(true);
    try {
      const base64 = await fileToBase64(photoFile);
      const result = await suggestTraitsFromPhoto({ base64, mime: photoFile.type as "image/jpeg" | "image/png" | "image/webp" });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.enabled) {
        setError("AI suggestions are not enabled on this deployment.");
        return;
      }
      if (!result.suggestion) {
        setError(result.message ?? "No AI suggestion was available. Please fill in traits manually.");
        return;
      }
      onApply(result.suggestion);
      setApplied(result.suggestion);
    } catch {
      setError("Something went wrong preparing the image. Please fill in traits manually.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" onClick={handleSuggest} disabled={loading}>
        {loading ? "Analysing photo…" : "✨ Suggest traits with AI"}
      </Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {applied && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
          <p className="font-medium">AI-suggested traits applied — please review before submitting.</p>
          <p className="mt-1">
            Confidence: <span className="font-medium">{applied.confidence}</span>. These are suggestions
            about the cat in the photo, not an identification of a specific cat — human confirmation
            required.
          </p>
          {applied.visibleInjuries.length > 0 && (
            <p className="mt-1">Possible visible injuries: {applied.visibleInjuries.join(", ")} (please verify).</p>
          )}
          {applied.possiblePregnancy && (
            <p className="mt-1">The AI thought the cat may be pregnant — please verify.</p>
          )}
          <p className="mt-1 text-brand-600">Edit any field below before submitting.</p>
        </div>
      )}
    </div>
  );
}
