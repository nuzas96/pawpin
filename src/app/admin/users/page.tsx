import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { RoleEditor } from "@/components/admin/RoleEditor";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Admin — Users — PawPin" };

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function AdminUsersPage() {
  const currentAdmin = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, org_id, is_approved, created_at")
    .order("created_at", { ascending: false });

  const orgIds = [...new Set((profiles ?? []).map((p) => p.org_id).filter(Boolean))] as string[];
  const { data: orgs } =
    orgIds.length > 0 ? await supabase.from("organizations").select("id, name").in("id", orgIds) : { data: [] };
  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const pendingCount = (profiles ?? []).filter((p) => !p.is_approved).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Users</h1>
        <p className="mt-2 text-gray-600">
          {pendingCount > 0
            ? `${pendingCount} account${pendingCount === 1 ? "" : "s"} pending approval.`
            : "All accounts are approved."}
        </p>
      </div>

      <AdminNav active="/admin/users" />

      {error ? (
        <Card className="border-red-200 bg-red-50"><p className="text-sm text-red-700">Could not load users: {error.message}</p></Card>
      ) : !profiles || profiles.length === 0 ? (
        <Card><p className="text-sm text-gray-600">No users found.</p></Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Manage</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-brand-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {p.display_name || "—"}
                    {p.id === currentAdmin.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3"><Badge>{toLabel(p.role)}</Badge></td>
                  <td className="px-4 py-3">
                    {p.is_approved ? (
                      <Badge className="bg-green-100 text-green-800">Approved</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.org_id ? orgNameById.get(p.org_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <RoleEditor
                      userId={p.id}
                      currentRole={p.role}
                      currentApproved={p.is_approved}
                      isSelf={p.id === currentAdmin.id}
                      orgId={p.org_id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
