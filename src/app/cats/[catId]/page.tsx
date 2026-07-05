import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCatPhotoPublicUrl } from "@/lib/storage/catPhotos";
import { publicAreaLabel } from "@/lib/geo/location";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Cat Profile — PawPin" };

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function CatProfilePage({ params }: { params: { catId: string } }) {
  const supabase = createClient();

  const { data: cat } = await supabase
    .from("cats")
    .select("*")
    .eq("id", params.catId)
    .maybeSingle();

  if (!cat) notFound();

  const { data: photo } = cat.primary_photo_id
    ? await supabase.from("photos").select("storage_path").eq("id", cat.primary_photo_id).maybeSingle()
    : { data: null };

  const photoUrl = photo ? getCatPhotoPublicUrl(supabase, photo.storage_path) : null;

  // Public sighting history: fuzzed coordinates only, via the safe public view.
  const { data: sightings } = await supabase
    .from("sighting_geo_public")
    .select("*")
    .eq("cat_id", cat.id)
    .order("created_at", { ascending: false });

  // Photo ids linked from each sighting (for the "linked sighting photos" gallery).
  const { data: sightingPhotoRows } = await supabase
    .from("sightings")
    .select("id, photo_id")
    .eq("cat_id", cat.id)
    .not("photo_id", "is", null);

  const linkedPhotoIds = [...new Set((sightingPhotoRows ?? []).map((s) => s.photo_id).filter(Boolean))] as string[];
  const { data: linkedPhotoRows } =
    linkedPhotoIds.length > 0
      ? await supabase.from("photos").select("id, storage_path").in("id", linkedPhotoIds)
      : { data: [] };
  const linkedPhotoUrls = (linkedPhotoRows ?? []).map((p) => getCatPhotoPublicUrl(supabase, p.storage_path));

  const { data: cases } = await supabase
    .from("cases")
    .select("id, status, priority, opened_at, closed_at")
    .eq("cat_id", cat.id)
    .order("opened_at", { ascending: false });

  const caseIds = (cases ?? []).map((c) => c.id);
  const { data: events } =
    caseIds.length > 0
      ? await supabase
          .from("case_events")
          .select("id, case_id, type, payload, created_at")
          .in("case_id", caseIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const sightingCount = sightings?.length ?? 0;
  const latestUrgency = sightings?.[0]?.urgency ?? "medium";
  const firstSeenAt = cat.first_seen_at;
  const lastSeenAt = cat.last_seen_at;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={`Photo of a ${toLabel(cat.coat_color)} ${toLabel(cat.fur_pattern)} cat`}
            className="h-64 w-full rounded-xl border border-brand-100 object-cover md:h-full"
          />
        ) : (
          <div className="flex h-64 w-full items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-4xl md:h-full">
            🐱
          </div>
        )}

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-brand-800">
            {toLabel(cat.coat_color)} {toLabel(cat.fur_pattern)} Cat
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge>{toLabel(cat.status)}</Badge>
            <Badge>{toLabel(latestUrgency)} urgency</Badge>
            <Badge>{toLabel(cat.size_class)}</Badge>
            <Badge>{toLabel(cat.age_group)}</Badge>
            {cat.ear_tipped && <Badge>Ear-tipped</Badge>}
          </div>
          {cat.distinguishing_marks.length > 0 && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Marks:</span> {cat.distinguishing_marks.join(", ")}
            </p>
          )}
          {sightings && sightings.length > 0 && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Public area:</span>{" "}
              {publicAreaLabel(sightings[0].fuzzed_lat, sightings[0].fuzzed_lng)}
            </p>
          )}

          <div className="flex flex-wrap gap-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            <span>👁️ Seen <strong>{sightingCount}</strong> time{sightingCount === 1 ? "" : "s"}</span>
            <span>🗓️ First seen <strong>{formatDate(firstSeenAt)}</strong></span>
            <span>🕓 Last seen <strong>{formatDate(lastSeenAt)}</strong></span>
          </div>

          <p className="rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
            🔒 Only an approximate area is shown publicly. Precise location is
            visible only to signed-in volunteers or rescues authorised on this case.
          </p>

          <p className="text-xs text-gray-500">
            This is a <strong>persistent cat profile</strong>: every confirmed
            sighting of this cat is linked here instead of creating a separate
            report, so carers can see the cat&apos;s full history in one place.
          </p>
        </div>
      </div>

      {linkedPhotoUrls.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-brand-800">Photos from sightings</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {linkedPhotoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt="Photo submitted with a sighting of this cat"
                className="h-24 w-24 flex-shrink-0 rounded-lg border border-brand-100 object-cover"
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Sighting history</h2>
        {!sightings || sightings.length === 0 ? (
          <Card><p className="text-sm text-gray-600">No sightings recorded yet.</p></Card>
        ) : (
          <div className="space-y-2">
            {sightings.map((s) => (
              <Card key={s.sighting_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {publicAreaLabel(s.fuzzed_lat, s.fuzzed_lng)}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</p>
                </div>
                <Badge>{toLabel(s.urgency)}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Case timeline</h2>
        {!events || events.length === 0 ? (
          <Card><p className="text-sm text-gray-600">No case activity recorded yet.</p></Card>
        ) : (
          <ol className="space-y-2 border-l border-brand-100 pl-4">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-400" />
                <p className="text-sm font-medium text-gray-900">{toLabel(e.type)}</p>
                <p className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</p>
                {typeof e.payload === "object" && e.payload && "message" in e.payload && (
                  <p className="text-sm text-gray-600">{String((e.payload as Record<string, unknown>).message)}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
