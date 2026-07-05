import { describe, it, expect } from "vitest";
import {
  validateImageFile,
  detectImageType,
  MAX_IMAGE_BYTES,
} from "@/lib/validation/image";
import {
  signUpSchema,
  sightingSchema,
  commentSchema,
  linkSightingSchema,
  createCatFromSightingSchema,
  claimCaseSchema,
  caseUpdateSchema,
  feedingScheduleSchema,
  feedingLogSchema,
  tnrRecordSchema,
  adoptionSchema,
  followCatSchema,
  bookmarkCatSchema,
  updateUserRoleSchema,
  approveOrganizationSchema,
  rejectOrganizationSchema,
  reviewModerationFlagSchema,
  hideCommentSchema,
  unhideCommentSchema,
  closeCaseSchema,
  reopenCaseSchema,
  archiveCaseSchema,
  reassignCaseSchema,
  releaseClaimSchema,
} from "@/lib/validation/schemas";

describe("validateImageFile", () => {
  it("accepts a valid jpeg under the size limit", () => {
    expect(
      validateImageFile({ type: "image/jpeg", size: 1024, name: "cat.jpg" })
    ).toEqual({ ok: true });
  });

  it("rejects an unsupported mime type", () => {
    const result = validateImageFile({ type: "image/gif", size: 1024, name: "cat.gif" });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 8MB", () => {
    const result = validateImageFile({
      type: "image/png",
      size: MAX_IMAGE_BYTES + 1,
      name: "big.png",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a spoofed extension", () => {
    const result = validateImageFile({ type: "image/png", size: 10, name: "cat.exe" });
    expect(result.ok).toBe(false);
  });
});

describe("detectImageType (magic bytes)", () => {
  it("detects PNG signature", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageType(png)).toBe("image/png");
  });

  it("detects JPEG signature", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageType(jpeg)).toBe("image/jpeg");
  });

  it("returns null for unknown bytes", () => {
    const junk = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(detectImageType(junk)).toBeNull();
  });
});

describe("signUpSchema", () => {
  it("rejects short passwords", () => {
    const result = signUpSchema.safeParse({
      email: "a@b.com",
      password: "short",
      displayName: "Tester",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid input", () => {
    const result = signUpSchema.safeParse({
      email: "a@b.com",
      password: "longenough1",
      displayName: "Tester",
    });
    expect(result.success).toBe(true);
  });
});

describe("sightingSchema", () => {
  it("rejects out-of-range coordinates", () => {
    const result = sightingSchema.safeParse({
      lat: 200,
      lng: 0,
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid sighting with default traits", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a condition tag outside the allowed set", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      conditionTags: ["rabid"],
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple valid condition tags", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      conditionTags: ["hungry", "friendly", "tnr_needed"],
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional guest contact under the max length", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      guestContact: "+65 9123 4567",
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing latitude", () => {
    const result = sightingSchema.safeParse({
      lng: 103.8,
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });
});

describe("commentSchema", () => {
  it("requires a cat or case target", () => {
    const result = commentSchema.safeParse({ body: "hi" });
    expect(result.success).toBe(false);
  });
});


describe("linkSightingSchema", () => {
  it("requires both sightingId and catId as valid UUIDs", () => {
    const result = linkSightingSchema.safeParse({ sightingId: "not-a-uuid", catId: "also-not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload", () => {
    const result = linkSightingSchema.safeParse({
      sightingId: "11111111-1111-1111-1111-111111111111",
      catId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing catId", () => {
    const result = linkSightingSchema.safeParse({ sightingId: "11111111-1111-1111-1111-111111111111" });
    expect(result.success).toBe(false);
  });
});

describe("createCatFromSightingSchema", () => {
  it("requires a valid sightingId and traits", () => {
    const result = createCatFromSightingSchema.safeParse({ sightingId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload with default traits", () => {
    const result = createCatFromSightingSchema.safeParse({
      sightingId: "11111111-1111-1111-1111-111111111111",
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid coat colour in traits", () => {
    const result = createCatFromSightingSchema.safeParse({
      sightingId: "11111111-1111-1111-1111-111111111111",
      traits: { coatColor: "rainbow", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });
});


describe("claimCaseSchema", () => {
  it("requires a valid case UUID", () => {
    expect(claimCaseSchema.safeParse({ caseId: "not-a-uuid" }).success).toBe(false);
  });
  it("accepts a valid case id", () => {
    expect(claimCaseSchema.safeParse({ caseId: "11111111-1111-1111-1111-111111111111" }).success).toBe(true);
  });
});

describe("caseUpdateSchema", () => {
  it("rejects an empty note", () => {
    const result = caseUpdateSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      category: "progress",
      note: "",
    });
    expect(result.success).toBe(false);
  });
  it("rejects an invalid category", () => {
    const result = caseUpdateSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      category: "gossip",
      note: "hi",
    });
    expect(result.success).toBe(false);
  });
  it("accepts a valid update", () => {
    const result = caseUpdateSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      category: "medical",
      note: "Vet visit scheduled.",
    });
    expect(result.success).toBe(true);
  });
});

describe("feedingScheduleSchema", () => {
  it("rejects an empty schedule description", () => {
    const result = feedingScheduleSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      scheduleText: "",
    });
    expect(result.success).toBe(false);
  });
  it("defaults frequency to daily and accepts a valid schedule", () => {
    const result = feedingScheduleSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      scheduleText: "Every evening at 7pm",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.frequency).toBe("daily");
  });
  it("rejects an invalid frequency", () => {
    const result = feedingScheduleSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      frequency: "hourly",
      scheduleText: "Every hour",
    });
    expect(result.success).toBe(false);
  });
});

describe("feedingLogSchema (M4 foodType)", () => {
  it("accepts a log with a food type", () => {
    const result = feedingLogSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      foodType: "Wet food",
      notes: "Ate well",
    });
    expect(result.success).toBe(true);
  });
});

describe("tnrRecordSchema (expanded M4 statuses)", () => {
  it("accepts each new M4 status value", () => {
    const statuses = [
      "not_started", "trap_planned", "trapped", "surgery_scheduled",
      "neutered", "ear_tipped", "released",
    ];
    for (const tnrStatus of statuses) {
      const result = tnrRecordSchema.safeParse({
        caseId: "11111111-1111-1111-1111-111111111111",
        tnrStatus,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid TNR status", () => {
    const result = tnrRecordSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      tnrStatus: "vacationing",
    });
    expect(result.success).toBe(false);
  });
});

describe("adoptionSchema (M4 workflow)", () => {
  it("accepts each valid adoption status", () => {
    const statuses = ["not_available", "intake", "available", "application_received", "matched", "adopted"];
    for (const status of statuses) {
      const result = adoptionSchema.safeParse({
        catId: "11111111-1111-1111-1111-111111111111",
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid adoption status", () => {
    const result = adoptionSchema.safeParse({
      catId: "11111111-1111-1111-1111-111111111111",
      status: "inquiry",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional adopter contact under the max length", () => {
    const result = adoptionSchema.safeParse({
      catId: "11111111-1111-1111-1111-111111111111",
      status: "matched",
      adopterContact: "+1 555-0100",
    });
    expect(result.success).toBe(true);
  });
});

describe("followCatSchema / bookmarkCatSchema", () => {
  it("rejects an invalid cat id", () => {
    expect(followCatSchema.safeParse({ catId: "not-a-uuid" }).success).toBe(false);
    expect(bookmarkCatSchema.safeParse({ catId: "not-a-uuid" }).success).toBe(false);
  });
  it("accepts a valid cat id", () => {
    const catId = "11111111-1111-1111-1111-111111111111";
    expect(followCatSchema.safeParse({ catId }).success).toBe(true);
    expect(bookmarkCatSchema.safeParse({ catId }).success).toBe(true);
  });
});

describe("commentSchema (plain text contract)", () => {
  it("does not strip or escape input — the schema itself only validates length; rendering (not schema) enforces plain-text safety", () => {
    const result = commentSchema.safeParse({
      catId: "11111111-1111-1111-1111-111111111111",
      body: "<script>alert(1)</script>",
    });
    // The schema allows the raw string through — safety comes from rendering
    // as text (React auto-escaping), not from schema-level sanitisation.
    // This test documents that contract explicitly.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBe("<script>alert(1)</script>");
    }
  });
});

describe("updateUserRoleSchema", () => {
  it("rejects an invalid role", () => {
    const result = updateUserRoleSchema.safeParse({
      userId: "11111111-1111-1111-1111-111111111111",
      role: "superadmin",
      isApproved: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid role update", () => {
    const result = updateUserRoleSchema.safeParse({
      userId: "11111111-1111-1111-1111-111111111111",
      role: "volunteer",
      isApproved: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires isApproved to be a boolean", () => {
    const result = updateUserRoleSchema.safeParse({
      userId: "11111111-1111-1111-1111-111111111111",
      role: "volunteer",
      isApproved: "yes",
    });
    expect(result.success).toBe(false);
  });
});

describe("approveOrganizationSchema / rejectOrganizationSchema", () => {
  it("requires a valid org UUID", () => {
    expect(approveOrganizationSchema.safeParse({ orgId: "not-a-uuid" }).success).toBe(false);
    expect(rejectOrganizationSchema.safeParse({ orgId: "not-a-uuid" }).success).toBe(false);
  });

  it("accepts a valid org id with an optional note", () => {
    const orgId = "11111111-1111-1111-1111-111111111111";
    expect(approveOrganizationSchema.safeParse({ orgId, note: "Looks legitimate" }).success).toBe(true);
    expect(rejectOrganizationSchema.safeParse({ orgId, note: "Missing contact info" }).success).toBe(true);
  });

  it("accepts a valid org id with no note", () => {
    const orgId = "11111111-1111-1111-1111-111111111111";
    expect(approveOrganizationSchema.safeParse({ orgId }).success).toBe(true);
  });
});

describe("reviewModerationFlagSchema", () => {
  it("rejects an invalid action", () => {
    const result = reviewModerationFlagSchema.safeParse({
      flagId: "11111111-1111-1111-1111-111111111111",
      action: "delete_everything",
    });
    expect(result.success).toBe(false);
  });

  it("accepts each valid action", () => {
    const flagId = "11111111-1111-1111-1111-111111111111";
    for (const action of ["dismiss", "resolve", "hide_comment", "close_case"]) {
      expect(reviewModerationFlagSchema.safeParse({ flagId, action }).success).toBe(true);
    }
  });
});

describe("hideCommentSchema / unhideCommentSchema", () => {
  it("requires a valid comment UUID", () => {
    expect(hideCommentSchema.safeParse({ commentId: "not-a-uuid" }).success).toBe(false);
    expect(unhideCommentSchema.safeParse({ commentId: "not-a-uuid" }).success).toBe(false);
  });

  it("accepts a valid comment id, reason optional", () => {
    const commentId = "11111111-1111-1111-1111-111111111111";
    expect(hideCommentSchema.safeParse({ commentId }).success).toBe(true);
    expect(hideCommentSchema.safeParse({ commentId, reason: "Spam" }).success).toBe(true);
    expect(unhideCommentSchema.safeParse({ commentId }).success).toBe(true);
  });
});

describe("case governance schemas (close/reopen/archive/reassign/release)", () => {
  const caseId = "11111111-1111-1111-1111-111111111111";

  it("close/reopen/archive/release all require a valid case UUID", () => {
    expect(closeCaseSchema.safeParse({ caseId: "bad" }).success).toBe(false);
    expect(reopenCaseSchema.safeParse({ caseId: "bad" }).success).toBe(false);
    expect(archiveCaseSchema.safeParse({ caseId: "bad" }).success).toBe(false);
    expect(releaseClaimSchema.safeParse({ caseId: "bad" }).success).toBe(false);
  });

  it("close/reopen/archive/release accept a valid case id with optional note", () => {
    expect(closeCaseSchema.safeParse({ caseId }).success).toBe(true);
    expect(reopenCaseSchema.safeParse({ caseId, note: "Reopening after review" }).success).toBe(true);
    expect(archiveCaseSchema.safeParse({ caseId }).success).toBe(true);
    expect(releaseClaimSchema.safeParse({ caseId }).success).toBe(true);
  });

  it("reassignCaseSchema requires both caseId and newClaimedBy as valid UUIDs", () => {
    expect(reassignCaseSchema.safeParse({ caseId, newClaimedBy: "bad" }).success).toBe(false);
    expect(reassignCaseSchema.safeParse({ caseId }).success).toBe(false);
    expect(
      reassignCaseSchema.safeParse({ caseId, newClaimedBy: "22222222-2222-2222-2222-222222222222" }).success
    ).toBe(true);
  });
});
