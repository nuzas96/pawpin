import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata = { title: "Report a Stray — PawPin" };

export default function ReportPage() {
  return (
    <PagePlaceholder
      title="Report a Stray Cat"
      description="Report a stray cat in under a minute. Guests can report too — no account required. Photos are stored securely and location metadata is stripped for privacy."
      milestone="M2"
      plannedFeatures={[
        "Photo capture / upload with client + server image validation",
        "Automatic GPS capture with drag-to-adjust manual fallback",
        "Trait form: urgency, condition, coat colour, pattern, size, age, marks",
        "Server-side EXIF/GPS metadata stripping before storage",
        "Runs the matching engine and opens the Possible Match review",
      ]}
    />
  );
}
