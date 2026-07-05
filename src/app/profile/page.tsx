import { requireUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Card, Badge } from "@/components/ui";

export const metadata = { title: "Profile — PawPin" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-800">Your Profile</h1>

      <Card className="max-w-lg">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Display name</dt>
            <dd className="font-medium text-gray-900">{user.displayName || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Role</dt>
            <dd><Badge>{ROLE_LABELS[user.role]}</Badge></dd>
          </div>
        </dl>
      </Card>

      <p className="max-w-lg text-sm text-gray-500">
        Your reports, followed cats, bookmarks, and notifications will appear
        here in a later milestone (M4).
      </p>
    </div>
  );
}
