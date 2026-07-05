import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = { title: "Volunteer Dashboard — PawPin" };

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

type CatJoin = { id: string; coat_color: string; fur_pattern: string } | null;
function normaliseCat(raw: unknown): CatJoin {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) return null;
  return row as CatJoin;
}

export default async function VolunteerDashboardPage() {
  const user = await requireRole(["volunteer", "admin"]);
  const supabase = createClient();

  const { data: claimedCasesRaw } = await supabase
    .from("cases")
    .select("id, status, priority, opened_at, cat:cats(id, coat_color, fur_pattern)")
    .eq("claimed_by", user.id)
    .order("opened_at", { ascending: false });

  const claimedCases = (claimedCasesRaw ?? []).map((c) => ({ ...c, cat: normaliseCat(c.cat) }));
  const claimedCaseIds = claimedCases.map((c) => c.id);

  const { data: openUrgentRaw } = await supabase
    .from("cases")
    .select("id, status, priority, opened_at, cat:cats(id, coat_color, fur_pattern)")
    .is("claimed_by", null)
    .in("priority", ["high", "critical"])
    .order("opened_at", { ascending: false })
    .limit(10);
  const openUrgentCases = (openUrgentRaw ?? []).map((c) => ({ ...c, cat: normaliseCat(c.cat) }));

  const { data: feedingSchedules } =
    claimedCaseIds.length > 0
      ? await supabase
          .from("feeding_schedules")
          .select("id, case_id, schedule_text, frequency, next_feeding_at, active")
          .in("case_id", claimedCaseIds)
          .eq("active", true)
      : { data: [] };

  const { data: tnrRecords } =
    claimedCaseIds.length > 0
      ? await supabase
          .from("tnr_records")
          .select("id, case_id, tnr_status, clinic")
          .in("case_id", claimedCaseIds)
          .in("tnr_status", [
            "not_started", "trap_planned", "trapped", "surgery_scheduled",
            "neutered", "ear_tipped", "recovering",
          ])
      : { data: [] };

  const claimedCatIds = claimedCases.map((c) => c.cat?.id).filter((id): id is string => Boolean(id));
  const { data: adoptionRecords } =
    claimedCatIds.length > 0
      ? await supabase
          .from("adoptions")
          .select("id, cat_id, status")
          .in("cat_id", claimedCatIds)
          .in("status", ["intake", "available", "application_received", "matched"])
      : { data: [] };

  const scheduleByCaseId = new Map((feedingSchedules ?? []).map((s) => [s.case_id, s]));
  const tnrByCaseId = new Map((tnrRecords ?? []).map((t) => [t.case_id, t]));
  const adoptionByCatId = new Map((adoptionRecords ?? []).map((a) => [a.cat_id, a]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Volunteer Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome, {user.displayName || user.email}. Here&apos;s what needs
          attention across the cases you&apos;re handling.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">
          Your claimed cases ({claimedCases.length})
        </h2>
        {claimedCases.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-600">
              You haven&apos;t claimed any cases yet. Check the open urgent
              cases below, or browse the{" "}
              <Link href="/cases" className="font-medium text-brand-600 hover:underline">case board</Link>.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {claimedCases.map((c) => {
              const schedule = scheduleByCaseId.get(c.id);
              const tnr = tnrByCaseId.get(c.id);
              const adoption = c.cat ? adoptionByCatId.get(c.cat.id) : undefined;
              return (
                <Card key={c.id}>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{toLabel(c.status)}</Badge>
                    <Badge>{toLabel(c.priority)} urgency</Badge>
                  </div>
                  <p className="mt-2 font-medium text-gray-900">
                    {c.cat ? `${toLabel(c.cat.coat_color)} ${toLabel(c.cat.fur_pattern)} cat` : "Cat unavailable"}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {schedule && (
                      <li>🍽️ Feeding: {toLabel(schedule.frequency)} — {schedule.schedule_text}</li>
                    )}
                    {tnr && <li>✂️ TNR: {toLabel(tnr.tnr_status)}</li>}
                    {adoption && <li>🏠 Adoption: {toLabel(adoption.status)}</li>}
                  </ul>
                  {c.cat && (
                    <Link
                      href={`/cats/${c.cat.id}`}
                      className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
                    >
                      Manage this case →
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Open urgent cases nearby</h2>
        {openUrgentCases.length === 0 ? (
          <Card><p className="text-sm text-gray-600">No unclaimed urgent cases right now.</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openUrgentCases.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap gap-2">
                  <Badge>{toLabel(c.priority)} urgency</Badge>
                  <Badge>Unclaimed</Badge>
                </div>
                <p className="mt-2 font-medium text-gray-900">
                  {c.cat ? `${toLabel(c.cat.coat_color)} ${toLabel(c.cat.fur_pattern)} cat` : "Cat unavailable"}
                </p>
                {c.cat && (
                  <ButtonLink href={`/cats/${c.cat.id}`} variant="secondary" className="mt-3">
                    View &amp; claim →
                  </ButtonLink>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Today&apos;s feeding tasks</h2>
        {feedingSchedules && feedingSchedules.length > 0 ? (
          <div className="space-y-2">
            {feedingSchedules.map((s) => (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-sm text-gray-700">
                  {toLabel(s.frequency)} — {s.schedule_text}
                  {s.next_feeding_at && ` (next: ${new Date(s.next_feeding_at).toLocaleString()})`}
                </span>
              </Card>
            ))}
          </div>
        ) : (
          <Card><p className="text-sm text-gray-600">No active feeding schedules on your claimed cases.</p></Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">TNR tasks</h2>
        {tnrRecords && tnrRecords.length > 0 ? (
          <div className="space-y-2">
            {tnrRecords.map((t) => (
              <Card key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-sm text-gray-700">
                  {toLabel(t.tnr_status)}{t.clinic ? ` — ${t.clinic}` : ""}
                </span>
              </Card>
            ))}
          </div>
        ) : (
          <Card><p className="text-sm text-gray-600">No in-progress TNR records on your claimed cases.</p></Card>
        )}
      </section>
    </div>
  );
}
