"use client";

import { useState } from "react";
import Link from "next/link";
import { createSighting } from "@/actions/sightings";
import {
  sightingSchema,
  type CatTraitsInput,
  type ConditionTag,
} from "@/lib/validation/schemas";
import { PhotoUpload } from "@/components/report/PhotoUpload";
import { LocationCapture } from "@/components/report/LocationCapture";
import { TraitPicker } from "@/components/report/TraitPicker";
import { UrgencyPicker, ConditionTagPicker } from "@/components/report/UrgencyAndConditionPicker";
import { Button } from "@/components/ui/Button";
import { Card, Label, Textarea, Input } from "@/components/ui";

const DEFAULT_TRAITS: CatTraitsInput = {
  coatColor: "orange",
  furPattern: "tabby",
  sizeClass: "medium",
  ageGroup: "unknown",
  earTipped: false,
  distinguishingMarks: [],
};

type FormState = "idle" | "submitting" | "success" | "error";

export function ReportForm({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [traits, setTraits] = useState<CatTraitsInput>(DEFAULT_TRAITS);
  const [urgency, setUrgency] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [conditionTags, setConditionTags] = useState<ConditionTag[]>([]);
  const [notes, setNotes] = useState("");
  const [guestContact, setGuestContact] = useState("");

  const [state, setState] = useState<FormState>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ catId: string; areaLabel: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (lat === null || lng === null) {
      setErrors(["Please capture a location (GPS or manual latitude/longitude)."]);
      return;
    }

    const payload = {
      lat,
      lng,
      urgency,
      conditionTags,
      notes: notes.trim() || undefined,
      traits,
      guestContact: guestContact.trim() || undefined,
    };

    const parsed = sightingSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }

    setState("submitting");

    try {
      let photoPayload:
        | { bytes: Uint8Array; type: string; size: number; name?: string }
        | undefined;

      if (photoFile) {
        const buffer = await photoFile.arrayBuffer();
        photoPayload = {
          bytes: new Uint8Array(buffer),
          type: photoFile.type,
          size: photoFile.size,
          name: photoFile.name,
        };
      }

      const response = await createSighting(parsed.data, photoPayload);

      if (!response.ok) {
        setState("error");
        setErrors([response.error]);
        return;
      }

      setResult({ catId: response.catId, areaLabel: response.areaLabel });
      setState("success");
    } catch (err) {
      setState("error");
      setErrors([err instanceof Error ? err.message : "Something went wrong. Please try again."]);
    }
  }

  if (!isAuthenticated) {
    return (
      <Card className="max-w-xl">
        <h2 className="font-semibold text-brand-800">Sign in to report a stray</h2>
        <p className="mt-2 text-sm text-gray-600">
          In this version of PawPin, submitting a report requires a free
          account so we can safely attribute the report and let you track its
          progress. Guest reporting without an account is planned for a later
          milestone.
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/auth/sign-up" className="text-sm font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
          <Link href="/auth/sign-in" className="text-sm font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    );
  }

  if (state === "success" && result) {
    return (
      <Card className="max-w-xl">
        <h2 className="text-lg font-semibold text-green-700">Report submitted 🎉</h2>
        <p className="mt-2 text-sm text-gray-700">
          Matching review will be added in the next milestone. For now, PawPin
          creates a new cat profile and rescue case from this sighting.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Public area: <span className="font-medium">{result.areaLabel}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/cats/${result.catId}`}>
            <Button type="button" variant="primary">View cat profile</Button>
          </Link>
          <Link href="/map">
            <Button type="button" variant="secondary">View on map</Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setState("idle");
              setResult(null);
              setPhotoFile(null);
              setLat(null);
              setLng(null);
              setTraits(DEFAULT_TRAITS);
              setUrgency("medium");
              setConditionTags([]);
              setNotes("");
              setGuestContact("");
            }}
          >
            Report another cat
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6" noValidate>
      <Card>
        <h2 className="mb-3 font-semibold text-brand-800">1. Photo</h2>
        <PhotoUpload onFileSelected={setPhotoFile} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-brand-800">2. Location</h2>
        <LocationCapture lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-brand-800">3. Urgency &amp; condition</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="urgency">Urgency</Label>
            <UrgencyPicker value={urgency} onChange={setUrgency} />
          </div>
          <div>
            <Label htmlFor="conditionTags">Condition tags</Label>
            <ConditionTagPicker value={conditionTags} onChange={setConditionTags} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-brand-800">4. Cat traits</h2>
        <TraitPicker traits={traits} onChange={setTraits} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-brand-800">5. Notes</h2>
        <Label htmlFor="notes">Additional notes (optional)</Label>
        <Textarea
          id="notes"
          rows={3}
          maxLength={1000}
          placeholder="Anything else that might help — behaviour, exact spot, time of day…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-4">
          <Label htmlFor="guestContact">Optional contact (only shown to carers on this case)</Label>
          <Input
            id="guestContact"
            type="text"
            placeholder="Phone or messaging handle (optional)"
            value={guestContact}
            onChange={(e) => setGuestContact(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-400">
            Only volunteers/rescues who take on this case can see this. Leave
            blank if you prefer not to share contact details.
          </p>
        </div>
      </Card>

      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <ul className="list-inside list-disc space-y-1">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <Button type="submit" disabled={state === "submitting"} className="w-full">
        {state === "submitting" ? "Submitting report…" : "Submit report"}
      </Button>
    </form>
  );
}
