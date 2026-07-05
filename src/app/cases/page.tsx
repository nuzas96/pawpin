import { createClient } from "@/lib/supabase/server";
import { CaseList, type CaseListItem } from "@/components/cases/CaseList";
import { Card } from "@/components/ui";

export const metadata = { title: "Case Board — PawPin" };

export default async function CasesPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cases")
    .select("id, status, priority, opened_at, cat:cats(id, coat_color, fur_pattern, status)")
    .order("opened_at", { ascending: false })
    .limit(100);

  const cases: CaseListItem[] = (data ?? []).map((c) => ({
    id: c.id,
    status: c.status,
    priority: c.priority,
    opened_at: c.opened_at,
    // Supabase's generated join type is an array even for a to-one relation
    // in some client versions; normalise defensively.
    cat: Array.isArray(c.cat) ? c.cat[0] ?? null : c.cat ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Case Board</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Every reported cat becomes a case here. Claiming and status updates
          for volunteers and rescues arrive in a later milestone — for now the
          board is read-only.
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Could not load cases: {error.message}</p>
        </Card>
      ) : (
        <CaseList cases={cases} />
      )}
    </div>
  );
}
