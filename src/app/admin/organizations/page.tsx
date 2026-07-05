import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { OrgApprovalActions } from "@/components/admin/OrgApprovalActions";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Admin — Organisations — PawPin" };

export default async function AdminOrganizationsPage() {
  await requireRole(["admin"]);
  const supabase = createClient();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, contact_email, is_approved, admin_note, created_at")
    .order("created_at", { ascending: false });

  const pending = (orgs ?? []).filter((o) => !o.is_approved);
  const approved = (orgs ?? []).filter((o) => o.is_approved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Organisations</h1>
        <p className="mt-2 text-gray-600">
          {pending.length > 0
            ? `${pending.length} organisation${pending.length === 1 ? "" : "s"} awaiting approval.`
            : "No pending organisations."}
        </p>
      </div>

      <AdminNav active="/admin/organizations" />

      {error && (
        <Card className="border-red-200 bg-red-50"><p className="text-sm text-red-700">Could not load organisations: {error.message}</p></Card>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Pending approval</h2>
        {pending.length === 0 ? (
          <Card><p className="text-sm text-gray-600">Nothing to review.</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pending.map((org) => (
              <Card key={org.id}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{org.name}</p>
                  <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                </div>
                {org.contact_email && <p className="mt-1 text-sm text-gray-600">{org.contact_email}</p>}
                <p className="mt-1 text-xs text-gray-400">Submitted {new Date(org.created_at).toLocaleDateString()}</p>
                {org.admin_note && <p className="mt-1 text-xs text-gray-500">Note: {org.admin_note}</p>}
                <div className="mt-3">
                  <OrgApprovalActions orgId={org.id} isApproved={org.is_approved} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Approved organisations</h2>
        {approved.length === 0 ? (
          <Card><p className="text-sm text-gray-600">No approved organisations yet.</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approved.map((org) => (
              <Card key={org.id}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{org.name}</p>
                  <Badge className="bg-green-100 text-green-800">Approved</Badge>
                </div>
                {org.contact_email && <p className="mt-1 text-sm text-gray-600">{org.contact_email}</p>}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
