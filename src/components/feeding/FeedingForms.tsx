"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFeedingSchedule, addFeedingLog } from "@/actions/feeding";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui";

const FREQUENCIES = ["once", "daily", "weekly", "custom"] as const;
type Frequency = (typeof FREQUENCIES)[number];

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function FeedingScheduleForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [scheduleText, setScheduleText] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [nextFeedingAt, setNextFeedingAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!scheduleText.trim()) {
      setError("Describe the feeding schedule (e.g. \"Daily at 7pm\").");
      return;
    }
    setLoading(true);
    const result = await createFeedingSchedule({
      caseId,
      frequency,
      scheduleText: scheduleText.trim(),
      locationNote: locationNote.trim() || undefined,
      nextFeedingAt: nextFeedingAt ? new Date(nextFeedingAt).toISOString() : undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setScheduleText("");
    setLocationNote("");
    setNextFeedingAt("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="feeding-frequency">Frequency</Label>
        <select
          id="feeding-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{toLabel(f)}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="schedule-text">Schedule description</Label>
        <Input
          id="schedule-text"
          type="text"
          placeholder="e.g. Daily at 7pm"
          value={scheduleText}
          onChange={(e) => setScheduleText(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="location-note">Feeding spot (optional)</Label>
        <Input
          id="location-note"
          type="text"
          placeholder="e.g. Behind Block 123 void deck"
          value={locationNote}
          onChange={(e) => setLocationNote(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="next-feeding">Next feeding (optional)</Label>
        <Input
          id="next-feeding"
          type="datetime-local"
          value={nextFeedingAt}
          onChange={(e) => setNextFeedingAt(e.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Creating…" : "Create feeding schedule"}
      </Button>
    </form>
  );
}

export function FeedingLogForm({ caseId, scheduleId }: { caseId: string; scheduleId?: string }) {
  const router = useRouter();
  const [foodType, setFoodType] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await addFeedingLog({
      caseId,
      scheduleId,
      foodType: foodType.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFoodType("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="food-type">Food type (optional)</Label>
        <Input
          id="food-type"
          type="text"
          placeholder="e.g. Wet food, dry kibble"
          value={foodType}
          onChange={(e) => setFoodType(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="feeding-notes">Notes (optional)</Label>
        <Textarea
          id="feeding-notes"
          rows={2}
          maxLength={500}
          placeholder="Ate well, seemed alert…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? "Logging…" : "Log feeding now"}
      </Button>
    </form>
  );
}
