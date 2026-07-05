"use client";

import { useState } from "react";
import { isValidLatitude, isValidLongitude, publicAreaLabel } from "@/lib/geo/location";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui";

export function LocationCapture({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleUseCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser does not support GPS location. Please enter coordinates manually.");
      return;
    }
    setStatus("loading");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(position.coords.latitude, position.coords.longitude);
        setStatus("success");
      },
      (geoError) => {
        setStatus("error");
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission denied. Please enter coordinates manually."
            : "Could not get your location. Please enter coordinates manually."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleManualChange(field: "lat" | "lng", value: string) {
    const num = value === "" ? null : Number(value);
    if (field === "lat") onChange(num, lng);
    else onChange(lat, num);
  }

  const latValid = lat === null || isValidLatitude(lat);
  const lngValid = lng === null || isValidLongitude(lng);
  const hasCoords = lat !== null && lng !== null && latValid && lngValid;

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" onClick={handleUseCurrentLocation} disabled={status === "loading"}>
        {status === "loading" ? "Getting location…" : "📍 Use my current location"}
      </Button>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="lat">Latitude</Label>
          <Input
            id="lat"
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="e.g. 1.3521"
            value={lat ?? ""}
            onChange={(e) => handleManualChange("lat", e.target.value)}
          />
          {!latValid && <p className="mt-1 text-xs text-red-600">Latitude must be between -90 and 90.</p>}
        </div>
        <div>
          <Label htmlFor="lng">Longitude</Label>
          <Input
            id="lng"
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="e.g. 103.8198"
            value={lng ?? ""}
            onChange={(e) => handleManualChange("lng", e.target.value)}
          />
          {!lngValid && <p className="mt-1 text-xs text-red-600">Longitude must be between -180 and 180.</p>}
        </div>
      </div>

      {hasCoords && (
        <p className="text-sm text-gray-600">
          Public area label preview: <span className="font-medium">{publicAreaLabel(lat!, lng!)}</span>
        </p>
      )}

      <p className="rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
        🔒 Public map pins are approximate to protect cats and reporters. Your
        precise location is only visible to you and to volunteers/rescues who
        take on this case.
      </p>
    </div>
  );
}
