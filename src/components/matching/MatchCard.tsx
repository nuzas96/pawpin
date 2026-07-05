"use client";

import type { PublicMatchCandidate } from "@/lib/matching/types";
import { ScoreBadge } from "@/components/matching/ScoreBadge";
import { Badge, Card } from "@/components/ui";
import { Button } from "@/components/ui/Button";

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function MatchCard({
  candidate,
  onLink,
  linking,
}: {
  candidate: PublicMatchCandidate;
  onLink: (catId: string) => void;
  linking: boolean;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex gap-4">
        {candidate.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photoUrl}
            alt={`Photo of a ${toLabel(candidate.coatColor)} ${toLabel(candidate.furPattern)} cat`}
            className="h-20 w-20 flex-shrink-0 rounded-lg border border-brand-100 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-2xl">
            🐱
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-gray-900">
            {toLabel(candidate.coatColor)} {toLabel(candidate.furPattern)} cat
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{toLabel(candidate.status)}</Badge>
          </div>
          <p className="text-xs text-gray-500">
            Last seen {timeAgo(candidate.lastSeenAt)} · {candidate.areaLabel}
          </p>
        </div>
      </div>

      <ScoreBadge score={candidate.similarityScore} confidence={candidate.confidence} />

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Why this might be a match
        </p>
        <ul className="space-y-1">
          {candidate.reasons.map((reason) => (
            <li key={reason.signal} className="text-sm text-gray-700">
              <span className="font-medium">{reason.signal}:</span> {reason.detail}
            </li>
          ))}
        </ul>
      </div>

      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={linking}
        onClick={() => onLink(candidate.candidateCatId)}
      >
        {linking ? "Linking…" : "Link to this cat"}
      </Button>
    </Card>
  );
}
