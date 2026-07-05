"use client";

import { useState } from "react";
import type { PublicMatchCandidate } from "@/lib/matching/types";
import type { CatTraitsInput } from "@/lib/validation/schemas";
import { linkSightingToCatProfile, createCatProfileFromSighting } from "@/actions/matching";
import { MatchCard } from "@/components/matching/MatchCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui";

export function MatchReviewModal({
  sightingId,
  candidates,
  traits,
  onResolved,
}: {
  sightingId: string;
  candidates: PublicMatchCandidate[];
  traits: CatTraitsInput;
  onResolved: (result: { catId: string; wasLinked: boolean }) => void;
}) {
  const [busy, setBusy] = useState<"link" | "new" | null>(null);
  const [linkingCatId, setLinkingCatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLink(catId: string) {
    setError(null);
    setBusy("link");
    setLinkingCatId(catId);
    try {
      const result = await linkSightingToCatProfile({ sightingId, catId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onResolved({ catId: result.catId, wasLinked: true });
    } finally {
      setBusy(null);
      setLinkingCatId(null);
    }
  }

  async function handleCreateNew() {
    setError(null);
    setBusy("new");
    try {
      const result = await createCatProfileFromSighting({ sightingId, traits });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onResolved({ catId: result.catId, wasLinked: false });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Possible match review"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-xl sm:p-6">
        <div>
          <h2 className="text-xl font-bold text-brand-800">
            {candidates.length > 0 ? "Possible matches found" : "No likely match found"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            PawPin suggests possible matches using traits, time, and approximate
            location. A human must confirm before sightings are linked.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {candidates.length > 0 ? (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {candidates.map((candidate) => (
              <MatchCard
                key={candidate.candidateCatId}
                candidate={candidate}
                onLink={handleLink}
                linking={busy === "link" && linkingCatId === candidate.candidateCatId}
              />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-gray-600">
              We didn&apos;t find an existing cat profile that looks like a
              likely match nearby. You can create a new profile for this sighting.
            </p>
          </Card>
        )}

        <div className="flex flex-col gap-2 border-t border-brand-100 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant={candidates.length > 0 ? "secondary" : "primary"}
            onClick={handleCreateNew}
            disabled={busy !== null}
          >
            {busy === "new"
              ? "Creating profile…"
              : candidates.length > 0
                ? "None of these — create a new cat profile"
                : "Create a new cat profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
