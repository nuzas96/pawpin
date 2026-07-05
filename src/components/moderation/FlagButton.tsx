"use client";

import { useState } from "react";
import { flagContent } from "@/actions/moderation";
import { Button } from "@/components/ui/Button";

const REASONS = ["spam", "inappropriate", "duplicate", "wrong_info", "abuse", "other"] as const;
type Reason = (typeof REASONS)[number];

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function FlagButton({
  targetType,
  targetId,
  label = "Flag",
}: {
  targetType: "cat" | "sighting" | "comment";
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("spam");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return <span className="text-xs text-gray-400">✓ Reported — thank you</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-gray-400 hover:text-red-600 hover:underline"
      >
        🚩 {label}
      </button>
    );
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const result = await flagContent({ targetType, targetId, reason, details: details.trim() || undefined });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-3">
      <p className="text-xs font-medium text-gray-700">Report this {targetType}</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as Reason)}
        className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>{toLabel(r)}</option>
        ))}
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Optional details"
        rows={2}
        maxLength={500}
        className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting…" : "Submit report"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
