import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TimelineEntry = {
  id: string;
  kind: "sighting" | "case_event" | "feeding_log";
  createdAt: string;
  title: string;
  detail?: string;
};

/**
 * Assembles a combined, chronological timeline for a cat: public (fuzzed)
 * sightings, case_events (covers claims, updates, feeding schedule/TNR/
 * adoption changes — all of which are logged as case_events by the RPCs in
 * migration 0009), and feeding_logs. Sorted newest first.
 */
export async function getCatTimeline(
  supabase: SupabaseClient<Database>,
  catId: string
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  const { data: sightings } = await supabase
    .from("sighting_geo_public")
    .select("sighting_id, created_at, urgency")
    .eq("cat_id", catId);

  for (const s of sightings ?? []) {
    entries.push({
      id: `sighting-${s.sighting_id}`,
      kind: "sighting",
      createdAt: s.created_at,
      title: "Sighting reported",
      detail: `Urgency: ${s.urgency}`,
    });
  }

  const { data: cases } = await supabase
    .from("cases")
    .select("id")
    .eq("cat_id", catId);
  const caseIds = (cases ?? []).map((c) => c.id);

  if (caseIds.length > 0) {
    const { data: events } = await supabase
      .from("case_events")
      .select("id, type, payload, created_at")
      .in("case_id", caseIds);

    for (const e of events ?? []) {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      entries.push({
        id: `event-${e.id}`,
        kind: "case_event",
        createdAt: e.created_at,
        title: toLabel(e.type),
        detail: typeof payload.message === "string" ? payload.message : undefined,
      });
    }

    const { data: feedingLogs } = await supabase
      .from("feeding_logs")
      .select("id, fed_at, food_type, notes")
      .in("case_id", caseIds);

    for (const f of feedingLogs ?? []) {
      entries.push({
        id: `feeding-${f.id}`,
        kind: "feeding_log",
        createdAt: f.fed_at,
        title: "Feeding logged",
        detail: [f.food_type, f.notes].filter(Boolean).join(" — ") || undefined,
      });
    }
  }

  return entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function toLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}
