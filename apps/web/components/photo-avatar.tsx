"use client";

import { useToast } from "@filmset/ui";
import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

const MAX_BYTES = 5 * 1024 * 1024;

function initialsOf(label: string): string {
  return label
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Circular click-to-upload photo — a headshot or set photo, resolved server-side to a signed Storage URL. */
export function PhotoAvatar({
  photoUrl,
  fallbackLabel,
  alt,
  onUpload,
  size = 40,
}: {
  photoUrl: string | null;
  fallbackLabel: string;
  alt: string;
  onUpload: (file: File) => Promise<void>;
  size?: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ tone: "danger", title: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ tone: "danger", title: "Photo must be under 5MB." });
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't upload photo", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      aria-label={`Upload photo for ${alt}`}
      disabled={uploading}
      className="relative shrink-0 overflow-hidden rounded-full border border-[var(--color-border-standard)] bg-[var(--color-background-elevated)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed Supabase Storage URL, no benefit from next/image here
        <img src={photoUrl} alt={alt} className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-[11px] font-semibold text-[var(--color-text-tertiary)]">
          {initialsOf(fallbackLabel) || <Camera className="size-[14px]" aria-hidden="true" />}
        </span>
      )}
      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-background-overlay)]">
          <Loader2 className="size-[14px] animate-spin text-[var(--color-text-inverse)]" aria-hidden="true" />
        </span>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </button>
  );
}
