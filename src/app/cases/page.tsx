import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/guards";
import { hasAtLeast } from "@/lib/auth/roles";
import type { CaseStatus } from "@/types/database";
import { CaseList, type CaseListItem } from "@/components/cases/CaseList";
import { Card } from "@/components/ui";

export const metadata = { title: "Case Board — PawPin" };

export default async function CasesPage() {
  const supabase = createClient();
  const sessionUser = await getSessionUser();

  const { data, error } = await supabase
    .from("cases")
    .select("id, status, priority, opened_at, claimed_by, cat:cats(id, coat_color, fur_pattern, status)")
    .order("opened_at", { ascending: false })
    .limit(100);

  type CaseCatJoin = { id: string; coat_color: string; fur_pattern: string; status: CaseStatus };
  function normaliseCat(raw: unknown): CaseCatJoin | null {
    if (!raw) return null;
    return Array.isArray(raw) ? (raw[0] as CaseCatJoin | undefined) ?? null : (raw as CaseCatJoin);
  }

  const caseIds = (data ?? []).map((c) => c.id);
  const catIds = [...new Set(
    (data ?? [])
      .map((c) => normaliseCat(c.cat)?.id)
      .filter((id): id is string => Boolean(id))
  )];

  const [{ data: activeSchedules }, { data: activeTnr }, { data: activeAdoptions }] = await Promise.all([
    caseIds.length > 0
      ? supabase.from("feeding_schedules").select("case_id").in("case_id", caseIds).eq("active", true)
      : Promise.resolve({ data: [] }),
    caseIds.length > 0
      ? supabase
          .from("tnr_records")
          .select("case_id, tnr_status")
          .in("case_id", caseIds)
          .in("tnr_status", [
            "trap_planned", "trapped", "surgery_scheduled", "neutered",
            "ear_tipped", "recovering",
          ])
      : Promise.resolve({ data: [] }),
    catIds.length > 0
      ? supabase
          .from("adoptions")
          .select("cat_id, status")
          .in("cat_id", catIds)
          .in("status", ["intake", "available", "application_received", "matched"])
      : Promise.resolve({ data: [] }),
  ]);

  const feedingActiveCaseIds = new Set((activeSchedules ?? []).map((s) => s.case_id));
  const tnrActiveCaseIds = new Set((activeTnr ?? []).map((t) => t.case_id));
  const adoptionActiveCatIds = new Set((activeAdoptions ?? []).map((a) => a.cat_id));

  const cases: CaseListItem[] = (data ?? []).map((c) => {
    const cat = normaliseCat(c.cat);
    return {
      id: c.id,
      status: c.status,
      priority: c.priority,
      opened_at: c.opened_at,
      claimed_by: c.claimed_by,
      cat,
      feedingActive: feedingActiveCaseIds.has(c.id),
      tnrActive: tnrActiveCaseIds.has(c.id),
      adoptionActive: cat ? adoptionActiveCatIds.has(cat.id) : false,
    };
  });

  const canClaim = Boolean(sessionUser && hasAtLeast(sessionUser.role, "volunteer"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Case Board</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Every reported cat becomes a case here. Volunteers, rescue
          organisations, and admins can claim a case to coordinate its care.
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Could not load cases: {error.message}</p>
        </Card>
      ) : (
        <CaseList cases={cases} currentUserId={sessionUser?.id ?? null} canClaim={canClaim} />
      )}
    </div>
  );
}
