import { requireRole } from "@/lib/auth/guards";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata = { title: "Admin Dashboard — PawPin" };

export default async function AdminPage() {
  const user = await requireRole(["admin"]);

  return (
    <PagePlaceholder
      title="Admin Dashboard"
      description={`Welcome, ${user.displayName || user.email}. Moderate reports, review flagged content, approve organisations, and review audit logs.`}
      milestone="M5"
      plannedFeatures={[
        "Moderation queue for flagged content",
        "Approve rescue organisations",
        "Close and archive cases",
        "Read-only audit log viewer",
      ]}
    />
  );
}
