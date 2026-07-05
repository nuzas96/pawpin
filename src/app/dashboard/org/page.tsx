import { requireRole } from "@/lib/auth/guards";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata = { title: "Organisation Dashboard — PawPin" };

export default async function OrgDashboardPage() {
  const user = await requireRole(["org", "admin"]);

  return (
    <PagePlaceholder
      title="Rescue Organisation Dashboard"
      description={`Welcome, ${user.displayName || user.email}. Monitor incoming reports, assign volunteers, and manage TNR and adoption workflows.`}
      milestone="M5"
      plannedFeatures={[
        "Incoming reports queue",
        "Assign volunteers to cases",
        "TNR and adoption pipelines",
        "Verify outcomes and organisation stats",
      ]}
    />
  );
}
