"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewModerationFlag } from "@/actions/moderation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui";

type ModerationAction = "dismiss" | "resolve" | "hide_comment" | "close_case";

export function FlagReviewActions({
  flagId,
  targetType,
}: {
  flagId: string;
  targetType: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<ModerationAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: ModerationAction) {
    setError(null);
    if (action === "close_case" && !window.confirm("Close the case associated with this cat? This is a visible governance action.")) {
      return;
    }
    setLoading(action);
    const result = await reviewModerationFlag({ flagId, action, note: note.trim() || undefined });
    setLoading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="Resolution note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Resolution note"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={() => handleAction("dismiss")} disabled={loading !== null}>
          {loading === "dismiss" ? "Dismissing…" : "Dismiss"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => handleAction("resolve")} disabled={loading !== null}>
          {loading === "resolve" ? "Resolving…" : "Mark resolved"}
        </Button>
        {targetType === "comment" && (
          <Button type="button" variant="primary" onClick={() => handleAction("hide_comment")} disabled={loading !== null}>
            {loading === "hide_comment" ? "Hiding…" : "Hide comment"}
          </Button>
        )}
        {targetType === "cat" && (
          <Button type="button" variant="primary" onClick={() => handleAction("close_case")} disabled={loading !== null}>
            {loading === "close_case" ? "Closing…" : "Close case"}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
