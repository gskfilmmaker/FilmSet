"use client";

import { PhotoAvatar } from "@/components/photo-avatar";
import { SuggestionPreviewCard } from "@/components/ai-suggestion-card";
import type { SuggestedRecommendation } from "@/lib/ai";
import type { Location } from "@filmset/core";
import {
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  ToastAction,
  useToast,
} from "@filmset/ui";
import { MapPin, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createLocation, deleteLocation, updateLocation, uploadLocationPhoto, suggestLocationPhotoMatch, type LocationInput } from "./actions";

const PERMIT_STATUSES: Location["permitStatus"][] = ["Confirmed", "Pending", "Missing"];
const permitTone: Record<Location["permitStatus"], "success" | "warning" | "danger"> = {
  Confirmed: "success",
  Pending: "warning",
  Missing: "danger",
};

const emptyForm: LocationInput = { name: "", address: "", permitStatus: "Pending", permitExpiry: "" };

function LocationForm({
  value,
  onChange,
}: {
  value: LocationInput;
  onChange: (next: LocationInput) => void;
}) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input
        label="Name"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        containerClassName="min-w-[140px] flex-1"
      />
      <Input
        label="Address"
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
        containerClassName="min-w-[180px] flex-1"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Permit</label>
        <Select value={value.permitStatus} onValueChange={(v) => onChange({ ...value, permitStatus: v as Location["permitStatus"] })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERMIT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        label="Permit expiry"
        placeholder="Optional"
        value={value.permitExpiry ?? ""}
        onChange={(e) => onChange({ ...value, permitExpiry: e.target.value })}
        containerClassName="min-w-[140px]"
      />
    </div>
  );
}

/** A photo picker dedicated to the AI-match feature — separate from the location's own PhotoAvatar, since matching is a one-off "what could this photo be" check, not necessarily the photo you keep on file. */
function AskAiMatchButton({ onPick, disabled }: { onPick: (file: File) => void; disabled: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ tone: "danger", title: "Please choose an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ tone: "danger", title: "Photo must be under 5MB." });
      return;
    }
    onPick(file);
  }

  return (
    <>
      <Button
        variant="quiet"
        iconOnly
        icon={<Sparkles className="size-[14px]" aria-hidden="true" />}
        aria-label="Ask AI which scenes a photo of this location could match"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      />
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </>
  );
}

export function LocationsSection({
  productionId,
  locations,
  photoUrls,
}: {
  productionId: string;
  locations: Location[];
  photoUrls: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<LocationInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<LocationInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [matching, setMatching] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<Record<string, { logId: string; suggestion: SuggestedRecommendation }>>({});

  async function onAskAiMatch(locationId: string, file: File) {
    setMatching(locationId);
    try {
      const formData = new FormData();
      formData.set("photo", file);
      const result = await suggestLocationPhotoMatch(productionId, locationId, formData);
      setSuggestions((prev) => ({ ...prev, [locationId]: result }));
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't get an AI match", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setMatching(null);
    }
  }

  function onSuggestionDecided(locationId: string) {
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[locationId];
      return next;
    });
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createLocation(productionId, addForm);
      toast({ tone: "success", title: "Location added", description: addForm.name });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add location", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(location: Location) {
    setEditingId(location.id);
    setEditForm({
      name: location.name,
      address: location.address,
      permitStatus: location.permitStatus,
      permitExpiry: location.permitExpiry ?? "",
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateLocation(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(location: Location) {
    setPendingId(location.id);
    const restore: LocationInput = {
      name: location.name,
      address: location.address,
      permitStatus: location.permitStatus,
      permitExpiry: location.permitExpiry ?? "",
    };
    try {
      await deleteLocation(productionId, location.id);
      router.refresh();
      toast({
        title: "Location removed",
        description: location.name,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              try {
                await createLocation(productionId, restore);
                router.refresh();
              } catch {
                toast({ tone: "danger", title: "Couldn't undo", description: "Please add the location back manually." });
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove location", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {locations.length === 0 && !adding && (
        <EmptyState
          icon={<MapPin className="size-full" />}
          title="No locations yet"
          description="Add a location to track its address and permit status."
          action={<Button onClick={() => setAdding(true)}>Add location</Button>}
        />
      )}

      {locations.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {locations.map((location) => (
            <React.Fragment key={location.id}>
              {editingId === location.id ? (
                <li className="flex flex-col items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)] sm:flex-row">
                  <form
                    onSubmit={(e) => onSaveEdit(e, location.id)}
                    className="flex w-full flex-1 flex-col items-end gap-[var(--fs-space-8)] sm:w-auto sm:flex-row"
                  >
                    <LocationForm value={editForm} onChange={setEditForm} />
                    <Button type="submit" loading={pendingId === location.id} disabled={pendingId !== null}>
                      Save
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                      Cancel
                    </Button>
                  </form>
                </li>
              ) : (
                <li className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                  <div className="flex min-w-0 items-center gap-[var(--fs-space-12)]">
                    <PhotoAvatar
                      photoUrl={photoUrls[location.photoPath ?? ""] ?? null}
                      fallbackLabel={location.name}
                      alt={location.name}
                      onUpload={(file) => {
                        const formData = new FormData();
                        formData.set("photo", file);
                        return uploadLocationPhoto(productionId, location.id, formData).then(() => {});
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{location.name}</p>
                      <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{location.address}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <StatusBadge tone={permitTone[location.permitStatus]}>{location.permitStatus}</StatusBadge>
                    {location.permitExpiry && (
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">exp. {location.permitExpiry}</span>
                    )}
                    <AskAiMatchButton onPick={(file) => onAskAiMatch(location.id, file)} disabled={matching !== null} />
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Edit ${location.name}`}
                      onClick={() => startEdit(location)}
                      disabled={pendingId !== null}
                    />
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Remove ${location.name}`}
                      loading={pendingId === location.id}
                      disabled={pendingId !== null}
                      onClick={() => onDelete(location)}
                    />
                  </div>
                </li>
              )}
              {matching === location.id && (
                <li className="p-[var(--fs-space-12)]">
                  <p className="text-[12px] text-[var(--color-text-tertiary)]">FilmSet AI is comparing this photo against your scenes…</p>
                </li>
              )}
              {suggestions[location.id] && (
                <li className="p-[var(--fs-space-12)]">
                  <SuggestionPreviewCard
                    productionId={productionId}
                    logId={suggestions[location.id]!.logId}
                    suggestion={suggestions[location.id]!.suggestion}
                    onDecided={() => onSuggestionDecided(location.id)}
                  />
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      )}

      {locations.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add location
        </Button>
      )}

      {adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row"
        >
          <LocationForm value={addForm} onChange={setAddForm} />
          <Button type="submit" loading={saving} disabled={saving}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
