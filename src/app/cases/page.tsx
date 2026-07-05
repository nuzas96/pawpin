import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata = { title: "Case Board — PawPin" };

export default function CasesPage() {
  return (
    <PagePlaceholder
      title="Case Board"
      description="Track active cat cases across their lifecycle — from first report through TNR, medical care, and adoption."
      milestone="M4"
      plannedFeatures={[
        "Board grouped by case status",
        "Volunteers can claim unassigned cases",
        "Filter by urgency and proximity",
        "Links through to each cat's persistent profile and timeline",
      ]}
    />
  );
}
