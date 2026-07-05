import { LiveMap } from "@/components/map/LiveMap";

export const metadata = { title: "Live Cat Map — PawPin" };

export default function MapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Live Cat Map</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Reported cats near you. Locations are approximate to protect the
          cats and the people who report them.
        </p>
      </div>
      <LiveMap />
    </div>
  );
}
