"use client";

import { Button, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from "@filmset/ui";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createGrant, deleteGrant, updateGrant, type GrantInput } from "./actions";
import { DAYS_OF_WEEK, type DayOfWeek } from "./constants";
import { toDateTimeLocalValue, toIsoStringOrNull } from "./format";
import type { PersonOption } from "./identities-section";

export interface GrantRow {
  id: string;
  identityId: string;
  resourceId: string;
  validFrom: string | null;
  validUntil: string | null;
  daysOfWeek: DayOfWeek[] | null;
  timeStart: string | null;
  timeEnd: string | null;
  reason: string | null;
}

const emptyForm: GrantInput = {
  identityId: "",
  resourceId: "",
  validFrom: null,
  validUntil: null,
  daysOfWeek: null,
  timeStart: "",
  timeEnd: "",
  reason: "",
};

function DayPicker({ value, onChange }: { value: DayOfWeek[] | null; onChange: (next: DayOfWeek[] | null) => void }) {
  const selected = new Set(value ?? []);
  function toggle(day: DayOfWeek) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(next.size > 0 ? DAYS_OF_WEEK.filter((d) => next.has(d)) : null);
  }
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Days (all if none picked)</label>
      <div className="flex gap-[4px]">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`h-[var(--fs-control-height)] rounded-md border px-[6px] text-[11px] font-medium transition-colors ${
              selected.has(day)
                ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-action-on-primary)]"
                : "border-[var(--color-border-standard)] bg-[var(--color-background-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
}

function GrantForm({
  value,
  onChange,
  identityOptions,
  resourceOptions,
}: {
  value: GrantInput;
  onChange: (next: GrantInput) => void;
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
        <Select value={value.resourceId} onValueChange={(v) => onChange({ ...value, resourceId: v })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {resourceOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
      <DayPicker value={value.daysOfWeek} onChange={(d) => onChange({ ...value, daysOfWeek: d })} />
      <Input label="Time from" type="time" value={value.timeStart ?? ""} onChange={(e) => onChange({ ...value, timeStart: e.target.value || null })} containerClassName="w-[130px]" />
      <Input label="Time until" type="time" value={value.timeEnd ?? ""} onChange={(e) => onChange({ ...value, timeEnd: e.target.value || null })} containerClassName="w-[130px]" />
      <Input
        label="Reason"
        placeholder="Optional"
        value={value.reason ?? ""}
        onChange={(e) => onChange({ ...value, reason: e.target.value })}
        containerClassName="min-w-[200px] flex-1 basis-full"
      />
    </div>
  );
}

export function GrantsSection({
  productionId,
  grants,
  identityOptions,
  resourceOptions,
  canManage,
}: {
  productionId: string;
  grants: GrantRow[];
  identityOptions: PersonOption[];
  resourceOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<GrantInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<GrantInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function labelFor(options: PersonOption[], id: string): string {
    return options.find((o) => o.id === id)?.label ?? "Unknown";
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.identityId || !addForm.resourceId) {
      toast({ tone: "danger", title: "Choose both an identity and a resource" });
      return;
    }
    setSaving(true);
    try {
      await createGrant(productionId, addForm);
      toast({ tone: "success", title: "Grant added" });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add grant", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(grant: GrantRow) {
    setEditingId(grant.id);
    setEditForm({
      identityId: grant.identityId,
      resourceId: grant.resourceId,
      validFrom: toIsoStringOrNull(grant.validFrom),
      validUntil: toIsoStringOrNull(grant.validUntil),
      daysOfWeek: grant.daysOfWeek,
      timeStart: grant.timeStart ?? "",
      timeEnd: grant.timeEnd ?? "",
      reason: grant.reason ?? "",
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateGrant(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(grant: GrantRow) {
    setPendingId(grant.id);
    try {
      await deleteGrant(productionId, grant.id);
      router.refresh();
      toast({ title: "Grant removed" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove grant", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {grants.length === 0 && !adding && (
        <EmptyState
          icon={<KeyRound className="size-full" />}
          title="No individual grants yet"
          description={
            !canManage
              ? "No individual access overrides have been added for this production yet."
              : identityOptions.length === 0 || resourceOptions.length === 0
                ? "Add an identity and a resource first — a grant always connects one to the other."
                : "Grant one identity access to one resource directly, without needing a profile — useful for a one-off exception."
          }
          action={canManage ? <Button onClick={() => setAdding(true)} disabled={identityOptions.length === 0 || resourceOptions.length === 0}>Add grant</Button> : undefined}
        />
      )}

      {grants.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {grants.map((grant) => (
            <React.Fragment key={grant.id}>
              {canManage && editingId === grant.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, grant.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <GrantForm value={editForm} onChange={setEditForm} identityOptions={identityOptions} resourceOptions={resourceOptions} />
                    <Button type="submit" loading={pendingId === grant.id} disabled={pendingId !== null}>
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
                      {labelFor(identityOptions, grant.identityId)} → {labelFor(resourceOptions, grant.resourceId)}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{grant.reason || "No reason given"}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                      <Button
                        variant="quiet"
                        iconOnly
                        icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                        aria-label="Edit grant"
                        onClick={() => startEdit(grant)}
                        disabled={pendingId !== null}
                      />
                      <Button
                        variant="quiet"
                        iconOnly
                        icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                        aria-label="Remove grant"
                        loading={pendingId === grant.id}
                        disabled={pendingId !== null}
                        onClick={() => onDelete(grant)}
                      />
                    </div>
                  )}
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      )}

      {canManage && grants.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start" disabled={identityOptions.length === 0 || resourceOptions.length === 0}>
          Add grant
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <GrantForm value={addForm} onChange={setAddForm} identityOptions={identityOptions} resourceOptions={resourceOptions} />
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
