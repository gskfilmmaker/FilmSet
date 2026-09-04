"use client";

import { Button, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { Clock, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createTemporaryGrant, deleteTemporaryGrant, updateTemporaryGrant, type TemporaryGrantInput } from "./actions";
import { TEMPORARY_GRANT_STATUSES, type TemporaryGrantStatus } from "./constants";
import { humanizeEnum, toDateTimeLocalValue, toIsoStringOrNull } from "./format";
import type { PersonOption } from "./identities-section";

export interface TemporaryGrantRow {
  id: string;
  identityId: string;
  resourceId: string;
  validFrom: string;
  validUntil: string;
  reason: string | null;
  status: TemporaryGrantStatus;
}

const emptyForm: TemporaryGrantInput = {
  identityId: "",
  resourceId: "",
  validFrom: "",
  validUntil: "",
  reason: "",
  status: "PENDING",
};

const statusTone: Record<TemporaryGrantStatus, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "danger",
  EXPIRED: "neutral",
  REVOKED: "danger",
};

function TemporaryGrantForm({
  value,
  onChange,
  identityOptions,
  resourceOptions,
}: {
  value: TemporaryGrantInput;
  onChange: (next: TemporaryGrantInput) => void;
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
        onChange={(e) => onChange({ ...value, validFrom: e.target.value })}
        containerClassName="min-w-[190px]"
      />
      <Input
        label="Valid until"
        type="datetime-local"
        value={toDateTimeLocalValue(value.validUntil)}
        onChange={(e) => onChange({ ...value, validUntil: e.target.value })}
        containerClassName="min-w-[190px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Status</label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as TemporaryGrantStatus })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPORARY_GRANT_STATUSES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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

export function TemporaryGrantsSection({
  productionId,
  temporaryGrants,
  identityOptions,
  resourceOptions,
  canManage,
}: {
  productionId: string;
  temporaryGrants: TemporaryGrantRow[];
  identityOptions: PersonOption[];
  resourceOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<TemporaryGrantInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<TemporaryGrantInput>(emptyForm);
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
    if (!addForm.validFrom || !addForm.validUntil) {
      toast({ tone: "danger", title: "Valid-from and valid-until are both required" });
      return;
    }
    setSaving(true);
    try {
      await createTemporaryGrant(productionId, addForm);
      toast({ tone: "success", title: "Request added" });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add request", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(grant: TemporaryGrantRow) {
    setEditingId(grant.id);
    setEditForm({
      identityId: grant.identityId,
      resourceId: grant.resourceId,
      validFrom: toIsoStringOrNull(grant.validFrom) ?? "",
      validUntil: toIsoStringOrNull(grant.validUntil) ?? "",
      reason: grant.reason ?? "",
      status: grant.status,
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateTemporaryGrant(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onQuickStatus(grant: TemporaryGrantRow, status: TemporaryGrantStatus) {
    setPendingId(grant.id);
    try {
      await updateTemporaryGrant(productionId, grant.id, {
        identityId: grant.identityId,
        resourceId: grant.resourceId,
        validFrom: grant.validFrom,
        validUntil: grant.validUntil,
        reason: grant.reason,
        status,
      });
      router.refresh();
      toast({ tone: "success", title: status === "APPROVED" ? "Request approved" : "Request denied" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't update request", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(grant: TemporaryGrantRow) {
    setPendingId(grant.id);
    try {
      await deleteTemporaryGrant(productionId, grant.id);
      router.refresh();
      toast({ title: "Request removed" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove request", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {temporaryGrants.length === 0 && !adding && (
        <EmptyState
          icon={<Clock className="size-full" />}
          title="No temporary-access requests yet"
          description={
            !canManage
              ? "No temporary-access requests have been made for this production yet."
              : identityOptions.length === 0 || resourceOptions.length === 0
                ? "Add an identity and a resource first — a request always connects one to the other."
                : "Request short, time-boxed access to a resource for someone — e.g. a one-day visitor pass — subject to approval."
          }
          action={canManage ? <Button onClick={() => setAdding(true)} disabled={identityOptions.length === 0 || resourceOptions.length === 0}>Add request</Button> : undefined}
        />
      )}

      {temporaryGrants.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {temporaryGrants.map((grant) => (
            <React.Fragment key={grant.id}>
              {canManage && editingId === grant.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, grant.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <TemporaryGrantForm value={editForm} onChange={setEditForm} identityOptions={identityOptions} resourceOptions={resourceOptions} />
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
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <StatusBadge tone={statusTone[grant.status]}>{humanizeEnum(grant.status)}</StatusBadge>
                    {canManage && grant.status === "PENDING" && (
                      <>
                        <Button variant="secondary" loading={pendingId === grant.id} disabled={pendingId !== null} onClick={() => onQuickStatus(grant, "APPROVED")}>
                          Approve
                        </Button>
                        <Button variant="secondary" loading={pendingId === grant.id} disabled={pendingId !== null} onClick={() => onQuickStatus(grant, "DENIED")}>
                          Deny
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label="Edit request"
                          onClick={() => startEdit(grant)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label="Remove request"
                          loading={pendingId === grant.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(grant)}
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

      {canManage && temporaryGrants.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start" disabled={identityOptions.length === 0 || resourceOptions.length === 0}>
          Add request
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <TemporaryGrantForm value={addForm} onChange={setAddForm} identityOptions={identityOptions} resourceOptions={resourceOptions} />
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
