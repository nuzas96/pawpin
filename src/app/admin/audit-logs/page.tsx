import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { AuditLogTable, type AuditLogRow } from "@/components/admin/AuditLogTable";
import { Card } from "@/components/ui";

export const metadata = { title: "Admin — Audit Logs — PawPin" };

export default async function AdminAuditLogsPage() {
  await requireRole(["admin"]);
  const supabase = createClient();

  const { data: rawLogs, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity, entity_id, diff, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const actorIds = [...new Set((rawLogs ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } =
    actorIds.length > 0 ? await supabase.from("profiles").select("id, display_name").in("id", actorIds) : { data: [] };
  const nameByActor = new Map((actors ?? []).map((p) => [p.id, p.display_name]));

  const logs: AuditLogRow[] = (rawLogs ?? []).map((l) => ({
    id: l.id,
    actor_id: l.actor_id,
    actorName: l.actor_id ? nameByActor.get(l.actor_id) ?? null : null,
    action: l.action,
    entity: l.entity,
    entity_id: l.entity_id,
    diff: (l.diff ?? {}) as Record<string, unknown>,
    created_at: l.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Audit Logs</h1>
        <p className="mt-2 text-gray-600">
          Read-only record of admin and coordination actions. Most recent 200 entries.
        </p>
      </div>

      <AdminNav active="/admin/audit-logs" />

      {error ? (
        <Card className="border-red-200 bg-red-50"><p className="text-sm text-red-700">Could not load audit logs: {error.message}</p></Card>
      ) : (
        <AuditLogTable logs={logs} />
      )}
    </div>
  );
}
