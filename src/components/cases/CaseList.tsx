"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CaseStatus, UrgencyLevel } from "@/types/database";
import { Badge, Card } from "@/components/ui";
import { Button } from "@/components/ui/Button";

export type CaseListItem = {
  id: string;
  status: CaseStatus;
  priority: UrgencyLevel;
  opened_at: string;
  cat: {
    id: string;
    coat_color: string;
    fur_pattern: string;
    status: CaseStatus;
  } | null;
};

const STATUS_OPTIONS: (CaseStatus | "all")[] = [
  "all", "reported", "under_review", "active", "tnr_in_progress", "medical",
  "ready_for_adoption", "adopted", "released", "closed",
];
const URGENCY_OPTIONS: (UrgencyLevel | "all")[] = ["all", "low", "medium", "high", "critical"];

function toLabel(value: string) {
  if (value === "all") return "All";
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function CaseList({ cases }: { cases: CaseListItem[] }) {
  const [status, setStatus] = useState<CaseStatus | "all">("all");
  const [urgency, setUrgency] = useState<UrgencyLevel | "all">("all");

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        if (status !== "all" && c.status !== status) return false;
        if (urgency !== "all" && c.priority !== urgency) return false;
        return true;
      }),
    [cases, status, urgency]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-xl border border-brand-100 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus | "all")}
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{toLabel(opt)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Urgency</span>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as UrgencyLevel | "all")}
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {URGENCY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{toLabel(opt)}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-600">No cases match these filters.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap gap-2">
                <Badge>{toLabel(c.status)}</Badge>
                <Badge>{toLabel(c.priority)} urgency</Badge>
              </div>
              <p className="mt-3 font-medium text-gray-900">
                {c.cat ? `${toLabel(c.cat.coat_color)} ${toLabel(c.cat.fur_pattern)} cat` : "Cat profile unavailable"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Opened {new Date(c.opened_at).toLocaleDateString()}
              </p>
              <div className="mt-4 flex items-center gap-2">
                {c.cat && (
                  <Link href={`/cats/${c.cat.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    View cat profile →
                  </Link>
                )}
              </div>
              <Button type="button" variant="secondary" disabled className="mt-3 w-full cursor-not-allowed opacity-60">
                Claim case (available in M4)
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
