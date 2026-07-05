"use server";

import { createClient } from "@/lib/supabase/server";
import {
  feedingScheduleSchema,
  feedingLogSchema,
  type FeedingScheduleInput,
  type FeedingLogInput,
} from "@/lib/validation/schemas";

export type CreateFeedingScheduleResult =
  | { ok: true; scheduleId: string }
  | { ok: false; error: string };

export type AddFeedingLogResult =
  | { ok: true; logId: string }
  | { ok: false; error: string };

/**
 * Create a feeding schedule for a case. Delegates to the
 * `create_feeding_schedule` RPC (requires case access) which also appends a
 * "Feeding schedule created" case_events row.
 */
export async function createFeedingSchedule(
  input: FeedingScheduleInput
): Promise<CreateFeedingScheduleResult> {
  const parsed = feedingScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to create a feeding schedule." };

  const { data, error } = await supabase.rpc("create_feeding_schedule", {
    p_case_id: parsed.data.caseId,
    p_frequency: parsed.data.frequency,
    p_schedule_text: parsed.data.scheduleText,
    p_location_note: parsed.data.locationNote ?? null,
    p_next_feeding_at: parsed.data.nextFeedingAt ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create the feeding schedule." };
  }

  return { ok: true, scheduleId: data };
}

/**
 * Record a completed feeding. Delegates to the `add_feeding_log` RPC
 * (requires case access) which also appends a "Feeding completed"
 * case_events row.
 */
export async function addFeedingLog(input: FeedingLogInput): Promise<AddFeedingLogResult> {
  const parsed = feedingLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to log a feeding." };

  const { data, error } = await supabase.rpc("add_feeding_log", {
    p_case_id: parsed.data.caseId,
    p_schedule_id: parsed.data.scheduleId ?? null,
    p_fed_at: parsed.data.fedAt ?? null,
    p_food_type: parsed.data.foodType ?? null,
    p_notes: parsed.data.notes ?? null,
    p_photo_id: parsed.data.photoId ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not record this feeding." };
  }

  return { ok: true, logId: data };
}
