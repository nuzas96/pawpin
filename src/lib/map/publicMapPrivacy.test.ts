import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "@/types/database";

/**
 * These tests guard the privacy contract of the public map data source:
 * the `cats_map_public` view (and `sighting_geo_public`) must never expose
 * raw/precise coordinates. We cannot hit a live Supabase instance in unit
 * tests, so we assert two things statically:
 *   1. The TypeScript row type only has `fuzzed_lat`/`fuzzed_lng` fields.
 *   2. The SQL migration defining the view does not select `s.lat`/`s.lng`
 *      (or `lat`,`lng`) as raw output columns.
 */
describe("public map data privacy contract", () => {
  it("cats_map_public row type never exposes raw lat/lng keys", () => {
    type PublicRow = Database["public"]["Views"]["cats_map_public"]["Row"];
    const sampleRow: PublicRow = {
      cat_id: "00000000-0000-0000-0000-000000000000",
      status: "reported",
      coat_color: "orange",
      fur_pattern: "tabby",
      size_class: "medium",
      age_group: "adult",
      distinguishing_marks: [],
      ear_tipped: false,
      primary_photo_id: null,
      last_seen_at: new Date().toISOString(),
      urgency: "medium",
      condition_tags: [],
      fuzzed_lat: 1.35,
      fuzzed_lng: 103.82,
      last_sighting_at: new Date().toISOString(),
    };
    const keys = Object.keys(sampleRow);
    expect(keys).not.toContain("lat");
    expect(keys).not.toContain("lng");
    expect(keys).toContain("fuzzed_lat");
    expect(keys).toContain("fuzzed_lng");
  });

  it("sighting_geo_public row type never exposes raw lat/lng keys", () => {
    type PublicRow = Database["public"]["Views"]["sighting_geo_public"]["Row"];
    const sampleRow: PublicRow = {
      sighting_id: "00000000-0000-0000-0000-000000000000",
      cat_id: null,
      fuzzed_lat: 1.35,
      fuzzed_lng: 103.82,
      urgency: "medium",
      status: null,
      created_at: new Date().toISOString(),
    };
    const keys = Object.keys(sampleRow);
    expect(keys).not.toContain("lat");
    expect(keys).not.toContain("lng");
  });

  it("SQL view definitions select only fuzzed coordinates, never raw s.lat/s.lng", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../../supabase/migrations/0006_report_flow.sql"),
      "utf-8"
    );
    const viewMatch = sql.match(/create or replace view public\.cats_map_public as([\s\S]*?);/);
    expect(viewMatch).not.toBeNull();
    const viewBody = viewMatch![1];

    // Must use the fuzzing function for coordinates.
    expect(viewBody).toMatch(/fuzz_coordinate\(latest\.lat\)/);
    expect(viewBody).toMatch(/fuzz_coordinate\(latest\.lng\)/);

    // Must not select raw lat/lng as bare output columns (only inside the
    // fuzz_coordinate(...) calls or the lateral join's own internal select).
    const outputColumnLines = viewBody
      .split("\n")
      .filter((line) => /^\s*c\./.test(line) || /^\s*latest\.(lat|lng)\s*,/.test(line));
    const leaksRawLatLng = outputColumnLines.some((line) =>
      /latest\.(lat|lng)\s*,/.test(line) && !line.includes("fuzz_coordinate")
    );
    expect(leaksRawLatLng).toBe(false);
  });

  it("sighting_geo_public SQL view also only exposes fuzzed coordinates", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../../supabase/migrations/0003_functions.sql"),
      "utf-8"
    );
    const viewMatch = sql.match(/create or replace view public\.sighting_geo_public as([\s\S]*?);/);
    expect(viewMatch).not.toBeNull();
    const viewBody = viewMatch![1];
    expect(viewBody).toMatch(/fuzz_coordinate\(s\.lat\)/);
    expect(viewBody).toMatch(/fuzz_coordinate\(s\.lng\)/);
    expect(viewBody).not.toMatch(/\bs\.lat\b(?!\))/);
  });
});
