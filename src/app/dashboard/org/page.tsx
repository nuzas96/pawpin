import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Organisation Dashboard — PawPin" };

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

type CatJoin = { id: string; coat_color: string; fur_pattern: string } | null;
function normaliseCat(raw: unknown): CatJoin {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  return (row as CatJoin) ?? null;
}

export default async function OrgDashboardPage() {
  const user = await requireRole(["org", "admin"]);
  const supabase = createClient();

  // Resolve the caller's org_id (admins without an org see an org-agnostic
  // overview across all cases instead of being blocked).
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.org_id ?? null;

  let caseQuery = supabase
    .from("cases")
    .select("id, status, priority, claimed_by, opened_at, cat:cats(id, coat_color, fur_pattern)")
    .order("opened_at", { ascending: false })
    .limit(100);
  if (orgId) {
    caseQuery = caseQuery.eq("org_id", orgId);
  }
  const { data: casesRaw } = await caseQuery;
  const cases = (casesRaw ?? []).map((c) => ({ ...c, cat: normaliseCat(c.cat) }));

  const activeCases = cases.filter((c) => !["adopted", "released", "closed"].includes(c.status));
  const claimedCases = cases.filter((c) => c.claimed_by);
  const unclaimedCases = cases.filter((c) => !c.claimed_by);

  const caseIds = cases.map((c) => c.id);
  const catIds = cases.map((c) => c.cat?.id).filter((id): id is string => Boolean(id));

  const { data: tnrRecords } =
    caseIds.length > 0
      ? await supabase.from("tnr_records").select("case_id, tnr_status").in("case_id", caseIds)
      : { data: [] };

  const { data: adoptionRecords } =
    catIds.length > 0
      ? await supabase.from("adoptions").select("cat_id, status").in("cat_id", catIds)
      : { data: [] };

  const tnrPipeline = new Map<string, number>();
  for (const t of tnrRecords ?? []) {
    tnrPipeline.set(t.tnr_status, (tnrPipeline.get(t.tnr_status) ?? 0) + 1);
  }
  const adoptionPipeline = new Map<string, number>();
  for (const a of adoptionRecords ?? []) {
    adoptionPipeline.set(a.status, (adoptionPipeline.get(a.status) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Rescue Organisation Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome, {user.displayName || user.email}
          {orgId ? "" : " — no organisation is linked to your account yet, so this shows all cases."}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active cases</p>
          <p className="mt-1 text-3xl font-bold text-brand-800">{activeCases.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Claimed</p>
          <p className="mt-1 text-3xl font-bold text-brand-800">{claimedCases.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unclaimed</p>
          <p className="mt-1 text-3xl font-bold text-brand-800">{unclaimedCases.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total cases</p>
          <p className="mt-1 text-3xl font-bold text-brand-800">{cases.length}</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Unclaimed cases</h2>
        {unclaimedCases.length === 0 ? (
          <Card><p className="text-sm text-gray-600">All cases are claimed. 🎉</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unclaimedCases.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap gap-2">
                  <Badge>{toLabel(c.status)}</Badge>
                  <Badge>{toLabel(c.priority)} urgency</Badge>
                </div>
                <p className="mt-2 font-medium text-gray-900">
                  {c.cat ? `${toLabel(c.cat.coat_color)} ${toLabel(c.cat.fur_pattern)} cat` : "Cat unavailable"}
                </p>
                {c.cat && (
                  <Link href={`/cats/${c.cat.id}`} className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
                    View &amp; assign →
                  </Link>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-bold text-brand-800">TNR pipeline</h2>
          <Card>
            {tnrPipeline.size === 0 ? (
              <p className="text-sm text-gray-600">No TNR records yet.</p>
            ) : (
              <ul className="space-y-1 text-sm text-gray-700">
                {[...tnrPipeline.entries()].map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span>{toLabel(status)}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-bold text-brand-800">Adoption pipeline</h2>
          <Card>
            {adoptionPipeline.size === 0 ? (
              <p className="text-sm text-gray-600">No adoption records yet.</p>
            ) : (
              <ul className="space-y-1 text-sm text-gray-700">
                {[...adoptionPipeline.entries()].map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span>{toLabel(status)}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <Card>
        <p className="text-sm text-gray-600">
          Assigning a case to a specific volunteer (beyond claiming) and full
          organisation approval/admin tooling are planned for a later
          milestone. For now, volunteers self-claim unclaimed cases from the{" "}
          <Link href="/cases" className="font-medium text-brand-600 hover:underline">case board</Link>.
        </p>
      </Card>
    </div>
  );
}
