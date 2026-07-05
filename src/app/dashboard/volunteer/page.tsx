import { requireRole } from "@/lib/auth/guards";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata = { title: "Volunteer Dashboard — PawPin" };

export default async function VolunteerDashboardPage() {
  const user = await requireRole(["volunteer", "admin"]);

  return (
    <PagePlaceholder
      title="Volunteer Dashboard"
      description={`Welcome, ${user.displayName || user.email}. Manage the cases you have claimed, feeding schedules, and TNR progress.`}
      milestone="M4/M5"
      plannedFeatures={[
        "My claimed cases with precise location access",
        "Today's feeding schedule and quick feeding logs",
        "TNR task tracking",
        "Case progress updates that append to the timeline",
      ]}
    />
  );
}
