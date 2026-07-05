"use client";

import type { ConditionTag } from "@/lib/validation/schemas";

const URGENCY_LEVELS = ["low", "medium", "high", "critical"] as const;
type Urgency = (typeof URGENCY_LEVELS)[number];

const CONDITION_TAGS: ConditionTag[] = [
  "healthy", "hungry", "injured", "sick", "pregnant", "kitten",
  "friendly", "fearful", "needs_feeding", "tnr_needed",
];

const URGENCY_STYLES: Record<Urgency, string> = {
  low: "border-green-300 bg-green-50 text-green-800",
  medium: "border-yellow-300 bg-yellow-50 text-yellow-800",
  high: "border-orange-300 bg-orange-50 text-orange-800",
  critical: "border-red-300 bg-red-50 text-red-800",
};

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function UrgencyPicker({
  value,
  onChange,
}: {
  value: Urgency;
  onChange: (value: Urgency) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Urgency">
      {URGENCY_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          onClick={() => onChange(level)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            value === level ? URGENCY_STYLES[level] : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {toLabel(level)}
        </button>
      ))}
    </div>
  );
}

export function ConditionTagPicker({
  value,
  onChange,
}: {
  value: ConditionTag[];
  onChange: (value: ConditionTag[]) => void;
}) {
  function toggle(tag: ConditionTag) {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else {
      onChange([...value, tag]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Condition tags">
      {CONDITION_TAGS.map((tag) => {
        const selected = value.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(tag)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "border-brand-400 bg-brand-100 text-brand-800"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {toLabel(tag)}
          </button>
        );
      })}
    </div>
  );
}
