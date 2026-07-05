"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeCase, reopenCase, archiveCase, reassignCase, releaseClaim } from "@/actions/caseGovernance";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui";

type GovernanceAction = "close" | "reopen" | "archive" | "release" | "reassign";

const CONFIRM_MESSAGES: Record<Exclude<GovernanceAction, "reassign">, string> = {
  close: "Close this case? This marks the case as resolved.",
  reopen: "Reopen this case? It will be set back to active.",
  archive: "Archive this case? Use this for stale or no-longer-actionable cases.",
  release: "Release your claim on this case? It will return to the unclaimed pool.",
};

export function CaseGovernanceActions({
  caseId,
  status,
  isClaimedByMe,
  canReassign,
}: {
  caseId: string;
  status: string;
  isClaimedByMe: boolean;
  canReassign: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<GovernanceAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState("");
  const [showReassign, setShowReassign] = useState(false);

  async function run(action: Exclude<GovernanceAction, "reassign">, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    if (!window.confirm(CONFIRM_MESSAGES[action])) return;
    setLoading(action);
    const result = await fn();
    setLoading(null);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleReassign() {
    setError(null);
    if (!reassignTarget.trim()) {
      setError("Enter the target user's ID.");
      return;
    }
    setLoading("reassign");
    const result = await reassignCase({ caseId, newClaimedBy: reassignTarget.trim() });
    setLoading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowReassign(false);
    setReassignTarget("");
    router.refresh();
  }

  const canReopen = status === "closed" || status === "archived";
  const canClose = status !== "closed";
  const canArchive = status !== "archived";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Case governance</p>
      <div className="flex flex-wrap gap-2">
        {canClose && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => run("close", () => closeCase({ caseId }))}
            disabled={loading !== null}
          >
            {loading === "close" ? "Closing…" : "Close case"}
          </Button>
        )}
        {canReopen && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => run("reopen", () => reopenCase({ caseId }))}
            disabled={loading !== null}
          >
            {loading === "reopen" ? "Reopening…" : "Reopen case"}
          </Button>
        )}
        {canArchive && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => run("archive", () => archiveCase({ caseId }))}
            disabled={loading !== null}
          >
            {loading === "archive" ? "Archiving…" : "Archive case"}
          </Button>
        )}
        {isClaimedByMe && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => run("release", () => releaseClaim({ caseId }))}
            disabled={loading !== null}
          >
            {loading === "release" ? "Releasing…" : "Release my claim"}
          </Button>
        )}
        {canReassign && (
          <Button type="button" variant="ghost" onClick={() => setShowReassign((v) => !v)} disabled={loading !== null}>
            Reassign…
          </Button>
        )}
      </div>

      {showReassign && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            placeholder="Target user ID"
            value={reassignTarget}
            onChange={(e) => setReassignTarget(e.target.value)}
            className="max-w-xs"
          />
          <Button type="button" variant="primary" onClick={handleReassign} disabled={loading !== null}>
            {loading === "reassign" ? "Reassigning…" : "Confirm reassign"}
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
