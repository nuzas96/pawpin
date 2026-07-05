"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdoptionRecord } from "@/actions/adoption";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui";

const ADOPTION_STATUSES = [
  "not_available", "intake", "available", "application_received", "matched", "adopted",
] as const;
type AdoptionStatusValue = (typeof ADOPTION_STATUSES)[number];

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

/**
 * This form is shown only to authorised carers (server-gated by
 * has_cat_access before rendering). It writes adopter contact but never
 * displays a previously-stored value back — the RLS-protected `adoptions`
 * row is never selected for display here, keeping the contact field
 * effectively write-only from this UI.
 */
export function AdoptionForm({
  catId,
  currentStatus,
}: {
  catId: string;
  currentStatus?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AdoptionStatusValue>(
    (currentStatus as AdoptionStatusValue) ?? "not_available"
  );
  const [adopterContact, setAdopterContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateAdoptionRecord({
      catId,
      status,
      adopterContact: adopterContact.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAdopterContact("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="adoption-status">Adoption status</Label>
        <select
          id="adoption-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdoptionStatusValue)}
          className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {ADOPTION_STATUSES.map((s) => (
            <option key={s} value={s}>{toLabel(s)}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="adopter-contact">Adopter contact (private, optional)</Label>
        <Input
          id="adopter-contact"
          type="text"
          placeholder="Never shown publicly — visible only to carers on this case"
          value={adopterContact}
          onChange={(e) => setAdopterContact(e.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Saving…" : "Update adoption status"}
      </Button>
    </form>
  );
}
