import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { FlagReviewActions } from "@/components/admin/FlagReviewActions";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Admin — Moderation Flags — PawPin" };

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export default async function AdminFlagsPage() {
  await requireRole(["admin"]);
  const supabase = createClient();

  const { data: openFlags, error } = await supabase
    .from("moderation_flags")
    .select("id, target_type, target_id, reason, details, reported_by, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const { data: recentlyResolved } = await supabase
    .from("moderation_flags")
    .select("id, target_type, reason, status, resolution_note, resolved_at")
    .neq("status", "open")
    .order("resolved_at", { ascending: false })
    .limit(10);

  const reporterIds = [...new Set((openFlags ?? []).map((f) => f.reported_by).filter(Boolean))] as string[];
  const { data: reporters } =
    reporterIds.length > 0 ? await supabase.from("profiles").select("id, display_name").in("id", reporterIds) : { data: [] };
  const nameByReporter = new Map((reporters ?? []).map((p) => [p.id, p.display_name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Moderation Flags</h1>
        <p className="mt-2 text-gray-600">
          {openFlags && openFlags.length > 0
            ? `${openFlags.length} open flag${openFlags.length === 1 ? "" : "s"} to review.`
            : "No open flags."}
        </p>
      </div>

      <AdminNav active="/admin/flags" />

      {error && (
        <Card className="border-red-200 bg-red-50"><p className="text-sm text-red-700">Could not load flags: {error.message}</p></Card>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Open flags</h2>
        {!openFlags || openFlags.length === 0 ? (
          <Card><p className="text-sm text-gray-600">Nothing to review right now.</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {openFlags.map((flag) => (
              <Card key={flag.id}>
                <div className="flex items-center justify-between">
                  <Badge>{toLabel(flag.target_type)}</Badge>
                  <Badge className="bg-red-100 text-red-800">{toLabel(flag.reason)}</Badge>
                </div>
                {flag.details && <p className="mt-2 text-sm text-gray-700">{flag.details}</p>}
                <p className="mt-1 text-xs text-gray-400">
                  Reported by {flag.reported_by ? nameByReporter.get(flag.reported_by) ?? "a user" : "a user"} ·{" "}
                  {new Date(flag.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-400">Target ID: {flag.target_id}</p>
                <div className="mt-3">
                  <FlagReviewActions flagId={flag.id} targetType={flag.target_type} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Recently reviewed</h2>
        {!recentlyResolved || recentlyResolved.length === 0 ? (
          <Card><p className="text-sm text-gray-600">No reviewed flags yet.</p></Card>
        ) : (
          <div className="space-y-2">
            {recentlyResolved.map((flag) => (
              <Card key={flag.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-sm text-gray-700">
                  <Badge>{toLabel(flag.target_type)}</Badge> {toLabel(flag.reason)} — {toLabel(flag.status)}
                  {flag.resolution_note && <span className="text-gray-500"> ({flag.resolution_note})</span>}
                </span>
                {flag.resolved_at && (
                  <span className="text-xs text-gray-400">{new Date(flag.resolved_at).toLocaleString()}</span>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
