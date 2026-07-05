"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveOrganisation, rejectOrganisation } from "@/actions/organizations";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui";

export function OrgApprovalActions({ orgId, isApproved }: { orgId: string; isApproved: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setError(null);
    setLoading("approve");
    const result = await approveOrganisation({ orgId, note: note.trim() || undefined });
    setLoading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    setError(null);
    if (!window.confirm("Reject this organisation? It will not be able to access the org dashboard until re-approved.")) {
      return;
    }
    setLoading("reject");
    const result = await rejectOrganisation({ orgId, note: note.trim() || undefined });
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
        placeholder="Admin note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Admin note"
      />
      <div className="flex gap-2">
        <Button type="button" variant="primary" onClick={handleApprove} disabled={loading !== null || isApproved}>
          {loading === "approve" ? "Approving…" : isApproved ? "Approved" : "Approve"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleReject} disabled={loading !== null}>
          {loading === "reject" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
