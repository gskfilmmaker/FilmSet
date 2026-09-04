"use client";

import { Button, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { CreditCard, IdCard, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createCredential, deleteCredential, updateCredential, type CredentialInput } from "./actions";
import {
  ASSURANCE_LEVELS,
  CREDENTIAL_STATUSES,
  CREDENTIAL_TYPES,
  SECURITY_CLASSES,
  type AssuranceLevel,
  type CredentialStatus,
  type CredentialType,
  type SecurityClass,
} from "./constants";
import { humanizeEnum, toDateTimeLocalValue } from "./format";
import type { PersonOption } from "./identities-section";

export interface CredentialRow {
  id: string;
  identityId: string;
  credentialType: CredentialType;
  credentialClass: SecurityClass;
  credentialNumber: string;
  status: CredentialStatus;
  assuranceLevel: AssuranceLevel;
  validFrom: string | null;
  validUntil: string | null;
}

const emptyForm: CredentialInput = {
  identityId: "",
  credentialType: "QR",
  credentialClass: "VISITOR",
  credentialNumber: "",
  status: "DRAFT",
  assuranceLevel: "LEVEL_1_BASIC",
  validFrom: null,
  validUntil: null,
};

const statusTone: Record<CredentialStatus, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  ACTIVE: "success",
  SUSPENDED: "warning",
  LOST: "danger",
  REVOKED: "danger",
  EXPIRED: "danger",
  REPLACED: "neutral",
};

function CredentialForm({ value, onChange, identityOptions }: { value: CredentialInput; onChange: (next: CredentialInput) => void; identityOptions: PersonOption[] }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Identity</label>
        <Select value={value.identityId} onValueChange={(v) => onChange({ ...value, identityId: v })}>
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
      <Input
        label="Credential number"
        placeholder="e.g. VMPA-CR-000482"
        value={value.credentialNumber}
        onChange={(e) => onChange({ ...value, credentialNumber: e.target.value })}
        containerClassName="min-w-[160px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Type</label>
        <Select value={value.credentialType} onValueChange={(v) => onChange({ ...value, credentialType: v as CredentialType })}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CREDENTIAL_TYPES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Class</label>
        <Select value={value.credentialClass} onValueChange={(v) => onChange({ ...value, credentialClass: v as SecurityClass })}>
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
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Status</label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as CredentialStatus })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CREDENTIAL_STATUSES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Assurance</label>
        <Select value={value.assuranceLevel} onValueChange={(v) => onChange({ ...value, assuranceLevel: v as AssuranceLevel })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSURANCE_LEVELS.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
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
    </div>
  );
}

export function CredentialsSection({
  productionId,
  credentials,
  identityOptions,
  canManage,
}: {
  productionId: string;
  credentials: CredentialRow[];
  identityOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<CredentialInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<CredentialInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCredential(productionId, addForm);
      toast({ tone: "success", title: "Credential added" });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add credential", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(credential: CredentialRow) {
    setEditingId(credential.id);
    setEditForm({
      identityId: credential.identityId,
      credentialType: credential.credentialType,
      credentialClass: credential.credentialClass,
      credentialNumber: credential.credentialNumber,
      status: credential.status,
      assuranceLevel: credential.assuranceLevel,
      validFrom: credential.validFrom,
      validUntil: credential.validUntil,
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateCredential(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(credential: CredentialRow) {
    setPendingId(credential.id);
    try {
      await deleteCredential(productionId, credential.id);
      router.refresh();
      toast({ title: "Credential removed" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove credential", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  function identityLabelFor(identityId: string): string {
    return identityOptions.find((o) => o.id === identityId)?.label ?? "Unknown identity";
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {credentials.length === 0 && !adding && (
        <EmptyState
          icon={<CreditCard className="size-full" />}
          title="No credentials yet"
          description={
            !canManage
              ? "No credentials have been issued for this production yet."
              : identityOptions.length === 0
                ? "Add an identity on the Identities tab first — a credential is always issued to one."
                : "Issue a credential to an identity. The QR value itself is generated automatically and never shown here — see docs/security/QR_SECURITY_ACCESS_CONTROL.md."
          }
          action={canManage ? <Button onClick={() => setAdding(true)} disabled={identityOptions.length === 0}>Add credential</Button> : undefined}
        />
      )}

      {credentials.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {credentials.map((credential) => (
            <React.Fragment key={credential.id}>
              {canManage && editingId === credential.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, credential.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <CredentialForm value={editForm} onChange={setEditForm} identityOptions={identityOptions} />
                    <Button type="submit" loading={pendingId === credential.id} disabled={pendingId !== null}>
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
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{credential.credentialNumber}</p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {identityLabelFor(credential.identityId)} · {humanizeEnum(credential.credentialType)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <StatusBadge tone={statusTone[credential.status]}>{humanizeEnum(credential.status)}</StatusBadge>
                    <StatusBadge tone="neutral">{humanizeEnum(credential.assuranceLevel)}</StatusBadge>
                    <Link
                      href={`/security-access/badge/${credential.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View badge for ${credential.credentialNumber}`}
                      className="inline-flex size-[var(--fs-control-height)] items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]"
                    >
                      <IdCard className="size-[14px]" aria-hidden="true" />
                    </Link>
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Edit ${credential.credentialNumber}`}
                          onClick={() => startEdit(credential)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Remove ${credential.credentialNumber}`}
                          loading={pendingId === credential.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(credential)}
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

      {canManage && credentials.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start" disabled={identityOptions.length === 0}>
          Add credential
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <CredentialForm value={addForm} onChange={setAddForm} identityOptions={identityOptions} />
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
