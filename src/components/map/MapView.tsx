"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { configureLeafletDefaultIcon, urgencyDivIcon } from "@/lib/map/leafletConfig";
import type { PublicMapCat } from "@/lib/map/usePublicMapData";
import { Badge } from "@/components/ui";

// Default centre: fallback to a neutral world view if there are no cats yet.
const DEFAULT_CENTER: [number, number] = [1.3521, 103.8198];

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function MapView({ cats }: { cats: PublicMapCat[] }) {
  useEffect(() => {
    configureLeafletDefaultIcon();
  }, []);

  const center: [number, number] =
    cats.length > 0 ? [cats[0].fuzzed_lat, cats[0].fuzzed_lng] : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={cats.length > 0 ? 13 : 11}
      scrollWheelZoom
      className="h-[60vh] w-full rounded-xl border border-brand-100 sm:h-[70vh]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {cats.map((cat) => (
        <Marker
          key={cat.cat_id}
          position={[cat.fuzzed_lat, cat.fuzzed_lng]}
          icon={urgencyDivIcon(cat.urgency)}
        >
          <Popup>
            <div className="min-w-[180px] space-y-1.5">
              <p className="font-semibold text-brand-800">
                {toLabel(cat.coat_color)} {toLabel(cat.fur_pattern)} cat
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge>{toLabel(cat.status)}</Badge>
                <Badge>{toLabel(cat.urgency)} urgency</Badge>
              </div>
              <p className="text-xs text-gray-500">
                Area ~{cat.fuzzed_lat.toFixed(2)}, {cat.fuzzed_lng.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">Last seen {timeAgo(cat.last_sighting_at)}</p>
              {cat.distinguishing_marks.length > 0 && (
                <p className="text-xs text-gray-600">Marks: {cat.distinguishing_marks.join(", ")}</p>
              )}
              <Link href={`/cats/${cat.cat_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                View cat profile →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
