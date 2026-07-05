import { getSessionUser } from "@/lib/auth/guards";
import { ReportForm } from "@/components/report/ReportForm";

export const metadata = { title: "Report a Stray — PawPin" };

export default async function ReportPage() {
  const user = await getSessionUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Report a Stray Cat</h1>
        <p className="mt-2 max-w-xl text-gray-600">
          Add a photo, drop a pin, and describe the cat. PawPin creates a new
          cat profile and rescue case from your sighting right away —
          automatic matching to existing profiles is coming in the next
          milestone.
        </p>
      </div>
      <ReportForm isAuthenticated={Boolean(user)} />
    </div>
  );
}
