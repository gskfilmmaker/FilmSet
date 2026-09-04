"use client";

import { Button, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from "@filmset/ui";
import { UserCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { assignProfile, unassignProfile, type IdentityProfileInput } from "./actions";
import type { PersonOption } from "./identities-section";

export interface IdentityProfileRow {
  id: string;
  identityId: string;
  profileId: string;
}

const emptyForm: IdentityProfileInput = { identityId: "", profileId: "" };

export function IdentityProfilesSection({
  productionId,
  assignments,
  identityOptions,
  profileOptions,
  canManage,
}: {
  productionId: string;
  assignments: IdentityProfileRow[];
  identityOptions: PersonOption[];
  profileOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<IdentityProfileInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function labelFor(options: PersonOption[], id: string): string {
    return options.find((o) => o.id === id)?.label ?? "Unknown";
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.identityId || !addForm.profileId) {
      toast({ tone: "danger", title: "Choose both an identity and a profile", description: "Both fields are required to assign a profile." });
      return;
    }
    setSaving(true);
    try {
      await assignProfile(productionId, addForm);
      toast({ tone: "success", title: "Profile assigned" });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't assign profile", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onUnassign(assignment: IdentityProfileRow) {
    setPendingId(assignment.id);
    try {
      await unassignProfile(productionId, assignment.id);
      router.refresh();
      toast({ title: "Profile unassigned" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't unassign profile", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {assignments.length === 0 && !adding && (
        <EmptyState
          icon={<UserCheck className="size-full" />}
          title="No profiles assigned yet"
          description={
            !canManage
              ? "No identities have an access profile assigned yet."
              : profileOptions.length === 0
                ? "Add a profile on the Profiles tab first — an assignment always attaches one to an identity."
                : "Assign a profile to an identity — a quick way to grant the same set of resource rules to many people at once."
          }
          action={canManage ? <Button onClick={() => setAdding(true)} disabled={profileOptions.length === 0}>Assign profile</Button> : undefined}
        />
      )}

      {assignments.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
              <p className="min-w-0 truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                {labelFor(identityOptions, assignment.identityId)} — {labelFor(profileOptions, assignment.profileId)}
              </p>
              {canManage && (
                <Button
                  variant="quiet"
                  iconOnly
                  icon={<X className="size-[14px]" aria-hidden="true" />}
                  aria-label="Unassign"
                  loading={pendingId === assignment.id}
                  disabled={pendingId !== null}
                  onClick={() => onUnassign(assignment)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && assignments.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start" disabled={profileOptions.length === 0}>
          Assign profile
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Identity</label>
            <Select value={addForm.identityId} onValueChange={(v) => setAddForm({ ...addForm, identityId: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {identityOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Profile</label>
            <Select value={addForm.profileId} onValueChange={(v) => setAddForm({ ...addForm, profileId: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {profileOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" loading={saving} disabled={saving}>
            Assign
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
