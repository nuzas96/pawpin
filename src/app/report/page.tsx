import { getSessionUser } from "@/lib/auth/guards";
import { isAiVisionEnabled } from "@/lib/ai/vision";
import { ReportForm } from "@/components/report/ReportForm";

export const metadata = { title: "Report a Stray — PawPin" };

export default async function ReportPage() {
  const user = await getSessionUser();
  const aiEnabled = isAiVisionEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-800">Report a Stray Cat</h1>
        <p className="mt-2 max-w-xl text-gray-600">
          Add a photo, drop a pin, and describe the cat. PawPin checks for
          possible matches to existing cat profiles so repeat sightings build
          one continuous history — you always confirm the match yourself.
        </p>
      </div>
      <ReportForm isAuthenticated={Boolean(user)} aiEnabled={aiEnabled} />
    </div>
  );
}
