import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";

/**
 * Shared component for pages whose full functionality lands in later
 * milestones (M2+). It communicates scope honestly instead of showing fake
 * controls, satisfying the "no fake buttons" quality bar for M0/M1.
 */
export function PagePlaceholder({
  title,
  description,
  milestone,
  plannedFeatures,
  children,
}: {
  title: string;
  description: string;
  milestone: string;
  plannedFeatures: string[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-brand-800">{title}</h1>
        <Badge>Planned for {milestone}</Badge>
      </div>
      <p className="max-w-2xl text-gray-600">{description}</p>

      {children}

      <Card className="max-w-2xl">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-600">
          Planned functionality
        </h2>
        <ul className="space-y-1.5 text-sm text-gray-700">
          {plannedFeatures.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 text-brand-400">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-400">
          This is the M0/M1 foundation build. Data persistence, RLS, and schema
          are in place; this screen&apos;s interactive flow ships in {milestone}.
        </p>
      </Card>
    </div>
  );
}
