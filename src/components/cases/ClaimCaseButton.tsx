"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimCase } from "@/actions/cases";
import { Button } from "@/components/ui/Button";

export function ClaimCaseButton({
  caseId,
  eligible,
  alreadyClaimedByMe,
}: {
  caseId: string;
  eligible: boolean;
  alreadyClaimedByMe: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyClaimedByMe) {
    return <span className="text-sm font-medium text-green-700">✓ You&apos;re handling this case</span>;
  }

  if (!eligible) {
    return (
      <p className="text-xs text-gray-500">
        Only volunteers and rescue organisations can claim cases. Interested
        in helping directly?{" "}
        <a href="/about" className="font-medium text-brand-600 hover:underline">
          Learn how to become a volunteer
        </a>
        .
      </p>
    );
  }

  async function handleClaim() {
    setLoading(true);
    setError(null);
    const result = await claimCase({ caseId });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="primary" onClick={handleClaim} disabled={loading}>
        {loading ? "Claiming…" : "I can help — claim this case"}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
