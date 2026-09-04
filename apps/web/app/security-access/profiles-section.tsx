"use client";

import { Button, EmptyState, Input, Textarea, useToast } from "@filmset/ui";
import { BookmarkCheck, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createProfile, deleteProfile, updateProfile, type ProfileInput } from "./actions";

export interface ProfileRow {
  id: string;
  name: string;
  description: string | null;
}

const emptyForm: ProfileInput = {
  name: "",
  description: "",
};

function ProfileForm({ value, onChange }: { value: ProfileInput; onChange: (next: ProfileInput) => void }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[160px] flex-1" />
      <Textarea
        label="Description"
        placeholder="Optional"
        value={value.description ?? ""}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        containerClassName="min-w-[200px] flex-1 basis-full"
        rows={2}
      />
    </div>
  );
}

export function ProfilesSection({
  productionId,
  profiles,
  canManage,
}: {
  productionId: string;
  profiles: ProfileRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<ProfileInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<ProfileInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createProfile(productionId, addForm);
      toast({ tone: "success", title: "Profile added", description: addForm.name });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add profile", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(profile: ProfileRow) {
    setEditingId(profile.id);
    setEditForm({ name: profile.name, description: profile.description ?? "" });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateProfile(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(profile: ProfileRow) {
    setPendingId(profile.id);
    try {
      await deleteProfile(productionId, profile.id);
      router.refresh();
      toast({ title: "Profile removed", description: profile.name });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove profile", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {profiles.length === 0 && !adding && (
        <EmptyState
          icon={<BookmarkCheck className="size-full" />}
          title="No profiles yet"
          description={
            canManage
              ? "Add a reusable access template (e.g. \"Cast\", \"Crane Operators\") — assign it to many identities instead of repeating the same rules per person, then add resource rules to it on the Profile Rules tab."
              : "No access profiles have been added for this production yet."
          }
          action={canManage ? <Button onClick={() => setAdding(true)}>Add profile</Button> : undefined}
        />
      )}

      {profiles.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {profiles.map((profile) => (
            <React.Fragment key={profile.id}>
              {canManage && editingId === profile.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, profile.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <ProfileForm value={editForm} onChange={setEditForm} />
                    <Button type="submit" loading={pendingId === profile.id} disabled={pendingId !== null}>
                      Save
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                      Cancel
                    </Button>
                  </form>
                </li>
              ) : (
                <li className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{profile.name}</p>
                    {profile.description && <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{profile.description}</p>}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                      <Button
                        variant="quiet"
                        iconOnly
                        icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                        aria-label={`Edit ${profile.name}`}
                        onClick={() => startEdit(profile)}
                        disabled={pendingId !== null}
                      />
                      <Button
                        variant="quiet"
                        iconOnly
                        icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                        aria-label={`Remove ${profile.name}`}
                        loading={pendingId === profile.id}
                        disabled={pendingId !== null}
                        onClick={() => onDelete(profile)}
                      />
                    </div>
                  )}
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      )}

      {canManage && profiles.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add profile
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <ProfileForm value={addForm} onChange={setAddForm} />
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
