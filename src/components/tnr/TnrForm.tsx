"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTnrRecord } from "@/actions/tnr";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui";

const TNR_STATUSES = [
  "not_started", "trap_planned", "trapped", "surgery_scheduled",
  "neutered", "ear_tipped", "released",
] as const;
type TnrStatusValue = (typeof TNR_STATUSES)[number];

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function TnrForm({
  caseId,
  currentStatus,
}: {
  caseId: string;
  currentStatus?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TnrStatusValue>(
    (currentStatus as TnrStatusValue) ?? "not_started"
  );
  const [clinic, setClinic] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateTnrRecord({
      caseId,
      tnrStatus: status,
      clinic: clinic.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="tnr-status">TNR status</Label>
        <select
          id="tnr-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TnrStatusValue)}
          className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {TNR_STATUSES.map((s) => (
            <option key={s} value={s}>{toLabel(s)}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="tnr-clinic">Clinic (optional)</Label>
        <Input
          id="tnr-clinic"
          type="text"
          placeholder="e.g. Community Vet Clinic"
          value={clinic}
          onChange={(e) => setClinic(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="tnr-notes">Notes (optional)</Label>
        <Textarea
          id="tnr-notes"
          rows={2}
          maxLength={1000}
          placeholder="Recovering well; ear-tipped…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Saving…" : "Update TNR status"}
      </Button>
      {status === "released" && (
        <p className="text-xs text-gray-500">
          Setting status to &ldquo;Released&rdquo; will update this cat&apos;s
          status too, unless it has already been adopted or closed.
        </p>
      )}
    </form>
  );
}
