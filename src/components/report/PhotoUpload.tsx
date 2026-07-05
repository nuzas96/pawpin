"use client";

import { useRef, useState } from "react";
import { validateImageFile } from "@/lib/validation/image";
import { Button } from "@/components/ui/Button";

export function PhotoUpload({
  onFileSelected,
}: {
  onFileSelected: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      setPreviewUrl(null);
      setFileName(null);
      onFileSelected(null);
      return;
    }

    const result = validateImageFile({ type: file.type, size: file.size, name: file.name });
    if (!result.ok) {
      setError(result.error);
      setPreviewUrl(null);
      setFileName(null);
      onFileSelected(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFileName(file.name);
    onFileSelected(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleClear() {
    setPreviewUrl(null);
    setFileName(null);
    setError(null);
    onFileSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          {fileName ? "Change photo" : "Add a photo"}
        </Button>
        {fileName && (
          <Button type="button" variant="ghost" onClick={handleClear}>
            Remove
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={handleChange}
          aria-label="Upload a photo of the cat"
        />
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Preview of the uploaded cat photo"
          className="h-48 w-full max-w-sm rounded-lg border border-brand-100 object-cover"
        />
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">JPG, PNG, or WEBP. Max 8 MB. Optional but helps carers identify the cat.</p>
    </div>
  );
}
