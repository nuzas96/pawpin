/**
 * Geo helpers for the report flow and map. No external geocoding service is
 * used in M2 (keeps the app dependency-free for judges) — the "public area
 * label" is derived from the already-fuzzed coordinate grid cell, which is
 * honest about precision and never leaks anything more precise than the
 * public map itself shows.
 */

/** Round a coordinate to a coarse grid cell (~1.1km at the equator, 2 dp). */
function gridCell(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/**
 * A coarse, human-readable label like "Area 1.35, 103.82" derived from the
 * fuzzed coordinate grid cell. This intentionally carries less precision than
 * even the fuzzed map pin, so it is safe to display anywhere.
 */
export function publicAreaLabel(lat: number, lng: number): string {
  return `Area ${gridCell(lat).toFixed(2)}, ${gridCell(lng).toFixed(2)}`;
}

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
