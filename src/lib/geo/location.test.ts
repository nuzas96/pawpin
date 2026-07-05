import { describe, it, expect } from "vitest";
import { isValidLatitude, isValidLongitude, publicAreaLabel } from "@/lib/geo/location";

describe("isValidLatitude", () => {
  it("accepts values within -90..90", () => {
    expect(isValidLatitude(1.35)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
  });

  it("rejects out-of-range or non-finite values", () => {
    expect(isValidLatitude(90.1)).toBe(false);
    expect(isValidLatitude(-90.1)).toBe(false);
    expect(isValidLatitude(NaN)).toBe(false);
    expect(isValidLatitude(Infinity)).toBe(false);
  });
});

describe("isValidLongitude", () => {
  it("accepts values within -180..180", () => {
    expect(isValidLongitude(103.82)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
  });

  it("rejects out-of-range or non-finite values", () => {
    expect(isValidLongitude(180.1)).toBe(false);
    expect(isValidLongitude(-180.1)).toBe(false);
    expect(isValidLongitude(NaN)).toBe(false);
  });
});

describe("publicAreaLabel", () => {
  it("produces a coarse, human-readable label", () => {
    expect(publicAreaLabel(1.352123, 103.819812)).toBe("Area 1.35, 103.82");
  });

  it("never reveals more precision than 2 decimal places (~1.1km)", () => {
    const label = publicAreaLabel(1.3521999, 103.8198111);
    const [, latPart, lngPart] = label.match(/Area (-?\d+\.\d+), (-?\d+\.\d+)/) ?? [];
    expect(latPart?.split(".")[1]?.length).toBeLessThanOrEqual(2);
    expect(lngPart?.split(".")[1]?.length).toBeLessThanOrEqual(2);
  });
});
