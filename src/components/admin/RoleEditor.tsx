"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserRole } from "@/actions/admin";
import { Button } from "@/components/ui/Button";

const ROLES = ["user", "volunteer", "org", "admin"] as const;
type RoleValue = (typeof ROLES)[number];

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function RoleEditor({
  userId,
  currentRole,
  currentApproved,
  isSelf,
  orgId,
}: {
  userId: string;
  currentRole: RoleValue;
  currentApproved: boolean;
  isSelf: boolean;
  orgId: string | null;
}) {
  const router = useRouter();
  const [role, setRole] = useState<RoleValue>(currentRole);
  const [approved, setApproved] = useState(currentApproved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wouldSelfDemote = isSelf && currentRole === "admin" && role !== "admin";

  async function handleSave() {
    setError(null);
    if (wouldSelfDemote) {
      setError("You cannot remove your own admin role. Ask another admin to do this.");
      return;
    }
    setLoading(true);
    const result = await updateUserRole({ userId, role, isApproved: approved, orgId });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as RoleValue)}
        disabled={isSelf && currentRole === "admin"}
        aria-label="Role"
        className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-50 disabled:text-gray-400"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{toLabel(r)}</option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
          className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-300"
        />
        Approved
      </label>

      <Button type="button" variant="secondary" onClick={handleSave} disabled={loading || (isSelf && currentRole === "admin" && role === "admin" && approved === currentApproved)}>
        {loading ? "Saving…" : "Save"}
      </Button>

      {isSelf && currentRole === "admin" && (
        <span className="text-xs text-gray-400">You cannot demote yourself.</span>
      )}
      {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
