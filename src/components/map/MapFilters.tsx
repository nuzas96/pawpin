"use client";

import type { CaseStatus, UrgencyLevel } from "@/types/database";
import type { ConditionTag } from "@/lib/validation/schemas";

export type MapFilterState = {
  urgency: UrgencyLevel | "all";
  status: CaseStatus | "all";
  conditionTag: ConditionTag | "all";
};

const URGENCY_OPTIONS: (UrgencyLevel | "all")[] = ["all", "low", "medium", "high", "critical"];
const STATUS_OPTIONS: (CaseStatus | "all")[] = [
  "all", "reported", "under_review", "active", "tnr_in_progress", "medical",
  "ready_for_adoption", "adopted", "released", "closed",
];
const CONDITION_OPTIONS: (ConditionTag | "all")[] = [
  "all", "healthy", "hungry", "injured", "sick", "pregnant", "kitten",
  "friendly", "fearful", "needs_feeding", "tnr_needed",
];

function toLabel(value: string) {
  if (value === "all") return "All";
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {toLabel(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MapFilters({
  value,
  onChange,
}: {
  value: MapFilterState;
  onChange: (value: MapFilterState) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 rounded-xl border border-brand-100 bg-white p-4">
      <FilterSelect
        label="Urgency"
        value={value.urgency}
        options={URGENCY_OPTIONS}
        onChange={(urgency) => onChange({ ...value, urgency })}
      />
      <FilterSelect
        label="Status"
        value={value.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onChange({ ...value, status })}
      />
      <FilterSelect
        label="Condition"
        value={value.conditionTag}
        options={CONDITION_OPTIONS}
        onChange={(conditionTag) => onChange({ ...value, conditionTag })}
      />
    </div>
  );
}
