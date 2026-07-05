import L from "leaflet";

/**
 * Leaflet's default marker icon URLs reference relative asset paths that
 * break under Next.js bundling. We rebuild the default icon using CDN-hosted
 * marker images (same ones Leaflet ships) so markers render correctly without
 * needing to copy icon files into /public.
 */
export function configureLeafletDefaultIcon() {
  const iconDefault = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: unknown;
  };
  delete iconDefault._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export const URGENCY_COLORS: Record<string, string> = {
  low: "#16a34a",
  medium: "#ca8a04",
  high: "#ea580c",
  critical: "#dc2626",
};

/** Build a coloured circle-marker divIcon for a given urgency level. */
export function urgencyDivIcon(urgency: string): L.DivIcon {
  const color = URGENCY_COLORS[urgency] ?? "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.2);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
