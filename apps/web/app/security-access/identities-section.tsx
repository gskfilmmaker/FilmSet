"use client";

import { Button, Checkbox, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, Textarea, useToast } from "@filmset/ui";
import { IdCard, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createIdentity, deleteIdentity, updateIdentity, type IdentityInput } from "./actions";
import { PERSON_CATEGORIES, SECURITY_CLASSES, type PersonCategory, type SecurityClass } from "./constants";
import { humanizeEnum } from "./format";

export interface IdentityRow {
  id: string;
  personCategory: PersonCategory;
  castMemberId: string | null;
  crewMemberId: string | null;
  displayName: string | null;
  company: string | null;
  securityClass: SecurityClass;
  active: boolean;
  notes: string | null;
}

export interface PersonOption {
  id: string;
  label: string;
}

const emptyForm: IdentityInput = {
  personCategory: "EXTERNAL",
  castMemberId: null,
  crewMemberId: null,
  displayName: "",
  company: "",
  securityClass: "VISITOR",
  active: true,
  notes: "",
};

function IdentityForm({
  value,
  onChange,
  castOptions,
  crewOptions,
}: {
  value: IdentityInput;
  onChange: (next: IdentityInput) => void;
  castOptions: PersonOption[];
  crewOptions: PersonOption[];
}) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Source</label>
        <Select value={value.personCategory} onValueChange={(v) => onChange({ ...value, personCategory: v as PersonCategory })}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSON_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.personCategory === "CAST" && (
        <div className="flex flex-col gap-[4px]">
          <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Cast member</label>
          <Select value={value.castMemberId ?? ""} onValueChange={(v) => onChange({ ...value, castMemberId: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {castOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {value.personCategory === "CREW" && (
        <div className="flex flex-col gap-[4px]">
          <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Crew member</label>
          <Select value={value.crewMemberId ?? ""} onValueChange={(v) => onChange({ ...value, crewMemberId: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {crewOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {value.personCategory === "EXTERNAL" && (
        <>
          <Input
            label="Name"
            value={value.displayName ?? ""}
            onChange={(e) => onChange({ ...value, displayName: e.target.value })}
            containerClassName="min-w-[140px] flex-1"
          />
          <Input
            label="Company"
            placeholder="Optional"
            value={value.company ?? ""}
            onChange={(e) => onChange({ ...value, company: e.target.value })}
            containerClassName="min-w-[140px] flex-1"
          />
        </>
      )}

      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Security class</label>
        <Select value={value.securityClass} onValueChange={(v) => onChange({ ...value, securityClass: v as SecurityClass })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECURITY_CLASSES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-[6px] pb-[6px]">
        <Checkbox id="identity-active" checked={value.active} onCheckedChange={(c) => onChange({ ...value, active: c === true })} />
        <label htmlFor="identity-active" className="text-[13px] text-[var(--color-text-secondary)]">
          Active
        </label>
      </div>

      <Textarea
        label="Notes"
        placeholder="Optional"
        value={value.notes ?? ""}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        containerClassName="min-w-[200px] flex-1 basis-full"
        rows={2}
      />
    </div>
  );
}

function identityLabel(identity: IdentityRow, castOptions: PersonOption[], crewOptions: PersonOption[]): string {
  if (identity.personCategory === "CAST") return castOptions.find((o) => o.id === identity.castMemberId)?.label ?? "Unknown cast member";
  if (identity.personCategory === "CREW") return crewOptions.find((o) => o.id === identity.crewMemberId)?.label ?? "Unknown crew member";
  return identity.displayName ?? "Unnamed";
}

export function IdentitiesSection({
  productionId,
  identities,
  castOptions,
  crewOptions,
  canManage,
}: {
  productionId: string;
  identities: IdentityRow[];
  castOptions: PersonOption[];
  crewOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<IdentityInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<IdentityInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createIdentity(productionId, addForm);
      toast({ tone: "success", title: "Identity added" });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add identity", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(identity: IdentityRow) {
    setEditingId(identity.id);
    setEditForm({
      personCategory: identity.personCategory,
      castMemberId: identity.castMemberId,
      crewMemberId: identity.crewMemberId,
      displayName: identity.displayName ?? "",
      company: identity.company ?? "",
      securityClass: identity.securityClass,
      active: identity.active,
      notes: identity.notes ?? "",
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateIdentity(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(identity: IdentityRow) {
    setPendingId(identity.id);
    try {
      await deleteIdentity(productionId, identity.id);
      router.refresh();
      toast({ title: "Identity removed" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove identity", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {identities.length === 0 && !adding && (
        <EmptyState
          icon={<IdCard className="size-full" />}
          title="No identities yet"
          description={
            canManage
              ? "Add an identity to represent a person this access-control domain tracks — cast, crew, or an external visitor/vendor."
              : "No identities have been added for this production yet."
          }
          action={canManage ? <Button onClick={() => setAdding(true)}>Add identity</Button> : undefined}
        />
      )}

      {identities.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {identities.map((identity) => (
            <React.Fragment key={identity.id}>
              {canManage && editingId === identity.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, identity.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <IdentityForm value={editForm} onChange={setEditForm} castOptions={castOptions} crewOptions={crewOptions} />
                    <Button type="submit" loading={pendingId === identity.id} disabled={pendingId !== null}>
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
                      {identityLabel(identity, castOptions, crewOptions)}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {humanizeEnum(identity.personCategory)}
                      {identity.personCategory === "EXTERNAL" && identity.company ? ` · ${identity.company}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <StatusBadge tone={identity.active ? "success" : "neutral"}>{identity.active ? "Active" : "Inactive"}</StatusBadge>
                    <StatusBadge tone="neutral">{humanizeEnum(identity.securityClass)}</StatusBadge>
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Edit ${identityLabel(identity, castOptions, crewOptions)}`}
                          onClick={() => startEdit(identity)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Remove ${identityLabel(identity, castOptions, crewOptions)}`}
                          loading={pendingId === identity.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(identity)}
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

      {canManage && identities.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add identity
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <IdentityForm value={addForm} onChange={setAddForm} castOptions={castOptions} crewOptions={crewOptions} />
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
