import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Admin Dashboard — PawPin" };

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export default async function AdminPage() {
  const user = await requireRole(["admin"]);
  const supabase = createClient();

  const [
    { count: totalUsers },
    { count: pendingVolunteers },
    { count: pendingOrgs },
    { count: openFlags },
    { count: activeCases },
    { count: closedCases },
    { data: recentAuditLogs },
    { data: recentSightings },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "volunteer").eq("is_approved", false),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("is_approved", false),
    supabase.from("moderation_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("cases").select("id", { count: "exact", head: true }).in("status", [
      "reported", "under_review", "active", "tnr_in_progress", "medical", "ready_for_adoption",
    ]),
    supabase.from("cases").select("id", { count: "exact", head: true }).in("status", ["closed", "archived"]),
    supabase.from("audit_logs").select("id, actor_id, action, entity, entity_id, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("sightings").select("id, reporter_id, urgency, created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  const actorIds = [...new Set((recentAuditLogs ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actorProfiles } =
    actorIds.length > 0 ? await supabase.from("profiles").select("id, display_name").in("id", actorIds) : { data: [] };
  const nameByActor = new Map((actorProfiles ?? []).map((p) => [p.id, p.display_name]));

  const stats = [
    { label: "Total users", value: totalUsers ?? 0, href: "/admin/users" },
    { label: "Pending volunteer approvals", value: pendingVolunteers ?? 0, href: "/admin/users" },
    { label: "Pending organisations", value: pendingOrgs ?? 0, href: "/admin/organizations" },
    { label: "Open moderation flags", value: openFlags ?? 0, href: "/admin/flags" },
    { label: "Active cases", value: activeCases ?? 0, href: "/cases" },
    { label: "Closed / archived cases", value: closedCases ?? 0, href: "/cases" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome, {user.displayName || user.email}.</p>
      </div>

      <AdminNav active="/admin" />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
              <p className="mt-1 text-3xl font-bold text-brand-800">{stat.value}</p>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-bold text-brand-800">Recent audit logs</h2>
          <Card>
            {recentAuditLogs && recentAuditLogs.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {recentAuditLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-50 pb-2 last:border-0 last:pb-0">
                    <span>
                      <Badge>{toLabel(log.action)}</Badge>{" "}
                      <span className="text-gray-600">{toLabel(log.entity)}</span>
                      {log.actor_id && <span className="text-gray-400"> by {nameByActor.get(log.actor_id) ?? "a user"}</span>}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">No audit log entries yet.</p>
            )}
            <Link href="/admin/audit-logs" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
              View full audit log →
            </Link>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold text-brand-800">Recent reports</h2>
          <Card>
            {recentSightings && recentSightings.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {recentSightings.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-50 pb-2 last:border-0 last:pb-0">
                    <Badge>{toLabel(s.urgency)}</Badge>
                    <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">No sightings reported yet.</p>
            )}
            <Link href="/cases" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
              View case board →
            </Link>
          </Card>
        </section>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold text-brand-800">Quick links</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/admin/users" className="font-medium text-brand-600 hover:underline">Review user approvals</Link>
          <Link href="/admin/organizations" className="font-medium text-brand-600 hover:underline">Review organisations</Link>
          <Link href="/admin/flags" className="font-medium text-brand-600 hover:underline">Review moderation flags</Link>
          <Link href="/admin/audit-logs" className="font-medium text-brand-600 hover:underline">Browse audit logs</Link>
        </div>
      </Card>
    </div>
  );
}
