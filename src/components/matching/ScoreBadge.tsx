import type { Confidence } from "@/lib/matching/types";

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-700 border-gray-300",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

/**
 * Displays a similarity score with a confidence band. Wording is
 * deliberately conservative — "possible match" framing, never certainty.
 */
export function ScoreBadge({
  score,
  confidence,
}: {
  score: number;
  confidence: Confidence;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
        {score}/100 similarity
      </span>
      <span
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[confidence]}`}
      >
        {CONFIDENCE_LABEL[confidence]}
      </span>
    </div>
  );
}
