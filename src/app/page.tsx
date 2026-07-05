import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui";

const STEPS = [
  { icon: "📷", title: "Spot & snap", text: "Photograph a stray cat you find." },
  { icon: "📍", title: "Drop a pin", text: "GPS captures the location, with manual fallback." },
  { icon: "🔎", title: "Possible match", text: "We suggest existing cat profiles it might be." },
  { icon: "🤝", title: "Coordinate care", text: "Volunteers and rescues handle feeding, TNR, and adoption." },
];

const FEATURES = [
  { title: "Persistent cat profiles", text: "Every sighting builds one continuous case history instead of isolated reports." },
  { title: "Privacy-first map", text: "The public sees approximate locations only. Precise GPS is restricted to authorised carers." },
  { title: "Explainable matching", text: "A transparent similarity score with reasons — always requiring human confirmation." },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 rounded-2xl bg-gradient-to-br from-brand-50 to-white p-8 md:grid-cols-2 md:p-12">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">
            Community stray cat rescue
          </p>
          <h1 className="text-4xl font-bold leading-tight text-brand-900 md:text-5xl">
            Drop a Pin,<br />Save a Stray.
          </h1>
          <p className="max-w-md text-lg text-gray-600">
            PawPin lets anyone report a stray cat in seconds, then connects
            volunteers and rescue organisations to coordinate feeding, medical
            care, TNR, and adoption — all tied to one persistent cat profile.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/report" variant="primary">Report a Stray</ButtonLink>
            <ButtonLink href="/map" variant="secondary">View Live Map</ButtonLink>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-brand-100 bg-white p-8 text-center shadow-sm">
            <div className="text-6xl" aria-hidden>🐾🗺️</div>
            <p className="mt-4 text-sm text-gray-500">
              A living map of cats in your community — protected by
              privacy-preserving approximate locations.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-brand-800">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <Card key={step.title}>
              <div className="text-3xl" aria-hidden>{step.icon}</div>
              <h3 className="mt-3 font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-brand-800">Why PawPin is different</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <h3 className="font-semibold text-brand-700">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{feature.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
