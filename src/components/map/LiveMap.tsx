"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { usePublicMapData } from "@/lib/map/usePublicMapData";
import { MapFilters, type MapFilterState } from "@/components/map/MapFilters";
import { Card } from "@/components/ui";

// Leaflet touches `window` at import time, so the map must be client-only and
// never server-rendered.
const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] w-full items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 sm:h-[70vh]">
      Loading map…
    </div>
  ),
});

const DEFAULT_FILTERS: MapFilterState = { urgency: "all", status: "all", conditionTag: "all" };

export function LiveMap() {
  const data = usePublicMapData();
  const [filters, setFilters] = useState<MapFilterState>(DEFAULT_FILTERS);

  const filteredCats = useMemo(() => {
    if (data.status !== "ready") return [];
    return data.cats.filter((cat) => {
      if (filters.urgency !== "all" && cat.urgency !== filters.urgency) return false;
      if (filters.status !== "all" && cat.status !== filters.status) return false;
      if (filters.conditionTag !== "all" && !cat.condition_tags.includes(filters.conditionTag)) return false;
      return true;
    });
  }, [data, filters]);

  return (
    <div className="space-y-4">
      <MapFilters value={filters} onChange={setFilters} />

      <p className="rounded-lg bg-brand-50 px-4 py-2 text-xs text-brand-700">
        🔒 Public map pins are approximate to protect cats and reporters.
      </p>

      {data.status === "loading" && (
        <div className="flex h-[60vh] w-full items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 sm:h-[70vh]">
          Loading map…
        </div>
      )}

      {data.status === "error" && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Could not load map data: {data.message}</p>
        </Card>
      )}

      {data.status === "ready" && filteredCats.length === 0 && (
        <Card>
          <p className="text-sm text-gray-600">
            No cats match these filters yet. Try widening your filters, or{" "}
            <a href="/report" className="font-medium text-brand-600 hover:underline">
              report a stray
            </a>{" "}
            to add the first pin.
          </p>
        </Card>
      )}

      {data.status === "ready" && filteredCats.length > 0 && <MapView cats={filteredCats} />}
    </div>
  );
}
