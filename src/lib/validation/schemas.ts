import { z } from "zod";

/**
 * Central Zod schemas — the single source of truth for validation, shared by
 * client forms and server-side mutation handlers. Server code must re-validate
 * with these schemas; never trust client input.
 */

// ---------------------------------------------------------------------------
// Enums (kept in sync with supabase/migrations/0001_extensions.sql)
// ---------------------------------------------------------------------------
export const coatColorEnum = z.enum([
  "black", "white", "grey", "orange", "brown", "calico", "tabby",
  "tortoiseshell", "tuxedo", "mixed", "other",
]);
export const furPatternEnum = z.enum([
  "solid", "tabby", "bicolor", "tricolor", "pointed", "spotted", "other",
]);
export const sizeClassEnum = z.enum(["kitten", "small", "medium", "large"]);
export const ageGroupEnum = z.enum(["kitten", "juvenile", "adult", "senior", "unknown"]);
export const urgencyEnum = z.enum(["low", "medium", "high", "critical"]);
export const tnrStatusEnum = z.enum([
  "not_started", "trapped", "neutered", "recovering", "returned",
]);
export const caseStatusEnum = z.enum([
  "reported", "under_review", "active", "tnr_in_progress", "medical",
  "ready_for_adoption", "adopted", "released", "closed",
]);
export const flagReasonEnum = z.enum([
  "spam", "inappropriate", "duplicate", "wrong_info", "abuse", "other",
]);
export const conditionTagEnum = z.enum([
  "healthy", "hungry", "injured", "sick", "pregnant", "kitten",
  "friendly", "fearful", "needs_feeding", "tnr_needed",
]);
export type ConditionTag = z.infer<typeof conditionTagEnum>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(60, "Display name is too long."),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ---------------------------------------------------------------------------
// Cat traits
// ---------------------------------------------------------------------------
export const catTraitsSchema = z.object({
  coatColor: coatColorEnum,
  furPattern: furPatternEnum,
  sizeClass: sizeClassEnum,
  ageGroup: ageGroupEnum.default("unknown"),
  earTipped: z.boolean().default(false),
  distinguishingMarks: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});
export type CatTraitsInput = z.infer<typeof catTraitsSchema>;

// ---------------------------------------------------------------------------
// Sighting / Report
// ---------------------------------------------------------------------------
export const sightingSchema = z.object({
  lat: z.number().min(-90, "Latitude must be between -90 and 90.").max(90, "Latitude must be between -90 and 90."),
  lng: z.number().min(-180, "Longitude must be between -180 and 180.").max(180, "Longitude must be between -180 and 180."),
  urgency: urgencyEnum.default("medium"),
  conditionTags: z.array(conditionTagEnum).max(conditionTagEnum.options.length).default([]),
  notes: z.string().trim().max(1000).optional(),
  photoId: z.string().uuid().optional(),
  catId: z.string().uuid().optional(),
  traits: catTraitsSchema,
  // Optional contact for guest reports only. Never required; documented in
  // docs/security-report.md as minimal, opt-in, carer-visible-only contact.
  guestContact: z.string().trim().max(200).optional(),
});
export type SightingInput = z.infer<typeof sightingSchema>;

/**
 * Full report-form payload validated on the client before submission and
 * re-validated on the server inside the server action. `lat`/`lng` come from
 * either the GPS capture or the manual fallback fields.
 */
export const reportFormSchema = sightingSchema;
export type ReportFormInput = z.infer<typeof reportFormSchema>;

// ---------------------------------------------------------------------------
// Comment (plain text only — never rendered as HTML)
// ---------------------------------------------------------------------------
export const commentSchema = z.object({
  catId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  body: z.string().trim().min(1, "Comment cannot be empty.").max(2000),
}).refine((v) => v.catId || v.caseId, {
  message: "A comment must target a cat or a case.",
});
export type CommentInput = z.infer<typeof commentSchema>;

// ---------------------------------------------------------------------------
// Case update
// ---------------------------------------------------------------------------
export const caseUpdateSchema = z.object({
  caseId: z.string().uuid(),
  status: caseStatusEnum,
  note: z.string().trim().max(1000).optional(),
});
export type CaseUpdateInput = z.infer<typeof caseUpdateSchema>;

// ---------------------------------------------------------------------------
// Feeding log
// ---------------------------------------------------------------------------
export const feedingLogSchema = z.object({
  caseId: z.string().uuid(),
  scheduleId: z.string().uuid().optional(),
  fedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
  photoId: z.string().uuid().optional(),
});
export type FeedingLogInput = z.infer<typeof feedingLogSchema>;

// ---------------------------------------------------------------------------
// TNR record
// ---------------------------------------------------------------------------
export const tnrRecordSchema = z.object({
  caseId: z.string().uuid(),
  tnrStatus: tnrStatusEnum,
  clinic: z.string().trim().max(120).optional(),
  trappedAt: z.string().datetime().optional(),
  neuteredAt: z.string().datetime().optional(),
  returnedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type TnrRecordInput = z.infer<typeof tnrRecordSchema>;

// ---------------------------------------------------------------------------
// Adoption record (minimal PII)
// ---------------------------------------------------------------------------
export const adoptionSchema = z.object({
  catId: z.string().uuid(),
  adopterContact: z.string().trim().max(200).optional(),
  status: z.enum(["inquiry", "pending", "approved", "finalized", "cancelled"]).default("inquiry"),
});
export type AdoptionInput = z.infer<typeof adoptionSchema>;

// ---------------------------------------------------------------------------
// Moderation flag
// ---------------------------------------------------------------------------
export const moderationFlagSchema = z.object({
  targetType: z.enum(["cat", "sighting", "comment"]),
  targetId: z.string().uuid(),
  reason: flagReasonEnum,
  details: z.string().trim().max(500).optional(),
});
export type ModerationFlagInput = z.infer<typeof moderationFlagSchema>;
