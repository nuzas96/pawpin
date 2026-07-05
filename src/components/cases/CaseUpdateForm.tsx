"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addCaseUpdate } from "@/actions/cases";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui";

const CATEGORIES = ["progress", "medical", "feeding", "tnr", "adoption", "general"] as const;
type Category = (typeof CATEGORIES)[number];

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function CaseUpdateForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("progress");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!note.trim()) {
      setError("Please write an update before posting.");
      return;
    }
    setLoading(true);
    const result = await addCaseUpdate({ caseId, category, note: note.trim() });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="update-category">Update type</Label>
        <select
          id="update-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{toLabel(c)}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="update-note">Update</Label>
        <Textarea
          id="update-note"
          rows={3}
          maxLength={1000}
          placeholder="What's changed? (plain text only)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Posting…" : "Post update"}
      </Button>
    </form>
  );
}
