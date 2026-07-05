"use client";

import type { CatTraitsInput } from "@/lib/validation/schemas";
import { Input, Label } from "@/components/ui";

const COAT_COLORS = [
  "black", "white", "grey", "orange", "brown", "calico", "tabby",
  "tortoiseshell", "tuxedo", "mixed", "other",
] as const;
const FUR_PATTERNS = [
  "solid", "tabby", "bicolor", "tricolor", "pointed", "spotted", "other",
] as const;
const SIZE_CLASSES = ["kitten", "small", "medium", "large"] as const;
const AGE_GROUPS = ["kitten", "juvenile", "adult", "senior", "unknown"] as const;

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function Select({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {toLabel(opt)}
        </option>
      ))}
    </select>
  );
}

export function TraitPicker({
  traits,
  onChange,
}: {
  traits: CatTraitsInput;
  onChange: (traits: CatTraitsInput) => void;
}) {
  function update<K extends keyof CatTraitsInput>(key: K, value: CatTraitsInput[K]) {
    onChange({ ...traits, [key]: value });
  }

  function handleMarksChange(raw: string) {
    const marks = raw
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 10);
    update("distinguishingMarks", marks);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="coatColor">Coat colour</Label>
        <Select
          id="coatColor"
          value={traits.coatColor}
          options={COAT_COLORS}
          onChange={(v) => update("coatColor", v as CatTraitsInput["coatColor"])}
        />
      </div>
      <div>
        <Label htmlFor="furPattern">Fur pattern</Label>
        <Select
          id="furPattern"
          value={traits.furPattern}
          options={FUR_PATTERNS}
          onChange={(v) => update("furPattern", v as CatTraitsInput["furPattern"])}
        />
      </div>
      <div>
        <Label htmlFor="sizeClass">Size</Label>
        <Select
          id="sizeClass"
          value={traits.sizeClass}
          options={SIZE_CLASSES}
          onChange={(v) => update("sizeClass", v as CatTraitsInput["sizeClass"])}
        />
      </div>
      <div>
        <Label htmlFor="ageGroup">Age group</Label>
        <Select
          id="ageGroup"
          value={traits.ageGroup}
          options={AGE_GROUPS}
          onChange={(v) => update("ageGroup", v as CatTraitsInput["ageGroup"])}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="marks">Distinguishing marks (comma separated)</Label>
        <Input
          id="marks"
          type="text"
          placeholder="e.g. white chest patch, notched right ear"
          value={traits.distinguishingMarks.join(", ")}
          onChange={(e) => handleMarksChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id="earTipped"
          type="checkbox"
          checked={traits.earTipped}
          onChange={(e) => update("earTipped", e.target.checked)}
          className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-300"
        />
        <Label htmlFor="earTipped">Ear-tipped (already TNR&apos;d)</Label>
      </div>
    </div>
  );
}
