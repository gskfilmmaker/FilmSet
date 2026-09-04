"use client";

import { Button, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { Ban, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createRestriction, deleteRestriction, updateRestriction, type RestrictionInput } from "./actions";
import { toDateTimeLocalValue, toIsoStringOrNull } from "./format";
import type { PersonOption } from "./identities-section";

export interface RestrictionRow {
  id: string;
  identityId: string;
  resourceId: string | null;
  reason: string;
  validFrom: string | null;
  validUntil: string | null;
}

const emptyForm: RestrictionInput = {
  identityId: "",
  resourceId: null,
  reason: "",
  validFrom: null,
  validUntil: null,
};

function RestrictionForm({
  value,
  onChange,
  identityOptions,
  resourceOptions,
}: {
  value: RestrictionInput;
  onChange: (next: RestrictionInput) => void;
  identityOptions: PersonOption[];
  resourceOptions: PersonOption[];
}) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Identity</label>
        <Select value={value.identityId} onValueChange={(v) => onChange({ ...value, identityId: v })}>
          <SelectTrigger className="w-[170px]">
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
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Resource</label>
        <Select value={value.resourceId ?? "__all"} onValueChange={(v) => onChange({ ...value, resourceId: v === "__all" ? null : v })}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Everywhere" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Everywhere in this production</SelectItem>
            {resourceOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        label="Reason"
        value={value.reason}
        onChange={(e) => onChange({ ...value, reason: e.target.value })}
        containerClassName="min-w-[200px] flex-1"
      />
      <Input
        label="Valid from"
        type="datetime-local"
        value={toDateTimeLocalValue(value.validFrom)}
        onChange={(e) => onChange({ ...value, validFrom: e.target.value || null })}
        containerClassName="min-w-[190px]"
      />
      <Input
        label="Valid until"
        type="datetime-local"
        value={toDateTimeLocalValue(value.validUntil)}
        onChange={(e) => onChange({ ...value, validUntil: e.target.value || null })}
        containerClassName="min-w-[190px]"
      />
    </div>
  );
}

export function RestrictionsSection({
  productionId,
  restrictions,
  identityOptions,
  resourceOptions,
  canManage,
}: {
  productionId: string;
  restrictions: RestrictionRow[];
  identityOptions: PersonOption[];
  resourceOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<RestrictionInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<RestrictionInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function labelFor(id: string): string {
    return identityOptions.find((o) => o.id === id)?.label ?? "Unknown";
  }
  function resourceLabelFor(id: string | null): string {
    if (!id) return "Everywhere";
    return resourceOptions.find((o) => o.id === id)?.label ?? "Unknown";
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.identityId) {
      toast({ tone: "danger", title: "Choose an identity" });
      return;
    }
    if (!addForm.reason.trim()) {
      toast({ tone: "danger", title: "A reason is required" });
      return;
    }
    setSaving(true);
    try {
      await createRestriction(productionId, addForm);
      toast({ tone: "success", title: "Restriction added" });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add restriction", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(restriction: RestrictionRow) {
    setEditingId(restriction.id);
    setEditForm({
      identityId: restriction.identityId,
      resourceId: restriction.resourceId,
      reason: restriction.reason,
      validFrom: toIsoStringOrNull(restriction.validFrom),
      validUntil: toIsoStringOrNull(restriction.validUntil),
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (!editForm.reason.trim()) {
      toast({ tone: "danger", title: "A reason is required" });
      return;
    }
    setPendingId(id);
    try {
      await updateRestriction(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(restriction: RestrictionRow) {
    setPendingId(restriction.id);
    try {
      await deleteRestriction(productionId, restriction.id);
      router.refresh();
      toast({ title: "Restriction removed" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove restriction", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {restrictions.length === 0 && !adding && (
        <EmptyState
          icon={<Ban className="size-full" />}
          title="No restrictions yet"
          description={
            !canManage
              ? "No restrictions have been added for this production yet."
              : identityOptions.length === 0
                ? "Add an identity on the Identities tab first — a restriction always applies to one."
                : "Explicitly block an identity from a resource (or the whole production). A restriction always overrides any grant or profile."
          }
          action={canManage ? <Button onClick={() => setAdding(true)} disabled={identityOptions.length === 0}>Add restriction</Button> : undefined}
        />
      )}

      {restrictions.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {restrictions.map((restriction) => (
            <React.Fragment key={restriction.id}>
              {canManage && editingId === restriction.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, restriction.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <RestrictionForm value={editForm} onChange={setEditForm} identityOptions={identityOptions} resourceOptions={resourceOptions} />
                    <Button type="submit" loading={pendingId === restriction.id} disabled={pendingId !== null}>
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
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                      {labelFor(restriction.identityId)} — {resourceLabelFor(restriction.resourceId)}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{restriction.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <StatusBadge tone="danger">Blocked</StatusBadge>
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label="Edit restriction"
                          onClick={() => startEdit(restriction)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label="Remove restriction"
                          loading={pendingId === restriction.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(restriction)}
                        />
                      </>
                    )}
                  </div>
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      )}

      {canManage && restrictions.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start" disabled={identityOptions.length === 0}>
          Add restriction
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <RestrictionForm value={addForm} onChange={setAddForm} identityOptions={identityOptions} resourceOptions={resourceOptions} />
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
