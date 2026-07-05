import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata = { title: "Live Cat Map — PawPin" };

export default function MapPage() {
  return (
    <PagePlaceholder
      title="Live Cat Map"
      description="An interactive map of reported stray cats. Guests and registered users see approximate locations only; precise coordinates are restricted to authorised carers."
      milestone="M2"
      plannedFeatures={[
        "React Leaflet map with OpenStreetMap tiles and clustered markers",
        "Status- and urgency-colour-coded pins",
        "Filter by status, urgency, coat colour, and time window",
        "Reads from the sighting_geo_public view (fuzzed coordinates)",
        "Click a pin to open a mini cat profile card",
      ]}
    />
  );
}
