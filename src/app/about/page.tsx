import { Card } from "@/components/ui";

export const metadata = { title: "About & Impact — PawPin" };

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-brand-800">About PawPin</h1>
        <p className="max-w-2xl text-gray-600">
          PawPin — Drop a Pin, Save a Stray — is a location-based community
          platform for reporting stray cats and coordinating their care.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-brand-700">The problem</h2>
          <p className="mt-2 text-sm text-gray-600">
            Stray cat sightings are scattered across chat groups and social
            media. The same cat gets reported many times with no shared history,
            so feeding, TNR, and medical care are hard to coordinate — and
            posting exact locations publicly can put vulnerable animals at risk.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold text-brand-700">Our solution</h2>
          <p className="mt-2 text-sm text-gray-600">
            PawPin turns every sighting into part of one persistent cat profile.
            A transparent matching engine suggests possible repeat sightings,
            and role-based tools let volunteers and rescues coordinate care while
            the public map only ever shows approximate locations.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">How matching works</h2>
        <p className="max-w-2xl text-sm text-gray-600">
          When a new sighting is reported, PawPin compares coat colour, fur
          pattern, size, age group, distinguishing marks, distance, recency, and
          condition against existing profiles to produce a similarity score out
          of 100 with a plain-language explanation. Matches are always shown as a{" "}
          <strong>&ldquo;possible match&rdquo;</strong> and require{" "}
          <strong>human confirmation</strong> — PawPin never claims certain cat
          identification.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Privacy first</h2>
        <p className="max-w-2xl text-sm text-gray-600">
          Precise GPS coordinates are stored securely and are only readable by
          authorised carers on cases they are working. Everyone else — including
          guests — sees fuzzed, approximate locations. Uploaded photos have their
          location metadata removed. See our security report for details.
        </p>
      </section>
    </div>
  );
}
