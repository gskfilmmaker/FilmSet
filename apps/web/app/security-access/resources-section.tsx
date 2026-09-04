"use client";

import { Button, Checkbox, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { DoorClosed, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createResource, deleteResource, previewNextResourceCode, updateResource, type ResourceInput } from "./actions";
import {
  ASSURANCE_LEVELS,
  OCCUPANCY_POLICIES,
  OFFLINE_POLICIES,
  RESOURCE_TYPES,
  SECURITY_LEVELS,
  type AssuranceLevel,
  type OccupancyPolicy,
  type OfflinePolicy,
  type ResourceType,
  type SecurityLevel,
} from "./constants";
import { humanizeEnum } from "./format";
import type { PersonOption } from "./identities-section";

export interface ResourceRow {
  id: string;
  parentResourceId: string | null;
  locationId: string | null;
  resourceType: ResourceType;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  securityLevel: SecurityLevel;
  minimumAssuranceLevel: AssuranceLevel;
  capacity: number | null;
  occupancyPolicy: OccupancyPolicy;
  offlinePolicy: OfflinePolicy;
}

const emptyForm: ResourceInput = {
  parentResourceId: null,
  locationId: null,
  resourceType: "ZONE",
  name: "",
  code: "",
  description: "",
  active: true,
  securityLevel: "STANDARD",
  minimumAssuranceLevel: "LEVEL_1_BASIC",
  capacity: null,
  occupancyPolicy: "IGNORE",
  offlinePolicy: "DENY",
};

const securityLevelTone: Record<SecurityLevel, "success" | "warning" | "danger"> = {
  STANDARD: "success",
  ELEVATED: "warning",
  RESTRICTED: "danger",
};

function ResourceForm({
  value,
  onChange,
  resourceOptions,
  locationOptions,
  excludeId,
  codePreview,
}: {
  value: ResourceInput;
  onChange: (next: ResourceInput) => void;
  resourceOptions: PersonOption[];
  locationOptions: PersonOption[];
  excludeId: string | null;
  /** Next auto-assignable code, shown as a placeholder — null while editing an existing resource or still loading. */
  codePreview: string | null;
}) {
  const parentChoices = resourceOptions.filter((o) => o.id !== excludeId);
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[140px] flex-1" />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Type</label>
        <Select value={value.resourceType} onValueChange={(v) => onChange({ ...value, resourceType: v as ResourceType })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Parent resource</label>
        <Select value={value.parentResourceId ?? "__none"} onValueChange={(v) => onChange({ ...value, parentResourceId: v === "__none" ? null : v })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">None</SelectItem>
            {parentChoices.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Location</label>
        <Select value={value.locationId ?? "__none"} onValueChange={(v) => onChange({ ...value, locationId: v === "__none" ? null : v })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">None</SelectItem>
            {locationOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        label="Code"
        placeholder={codePreview ? `Auto: ${codePreview}` : "Optional"}
        value={value.code ?? ""}
        onChange={(e) => onChange({ ...value, code: e.target.value })}
        containerClassName="w-[130px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Security level</label>
        <Select value={value.securityLevel} onValueChange={(v) => onChange({ ...value, securityLevel: v as SecurityLevel })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECURITY_LEVELS.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Min. assurance</label>
        <Select value={value.minimumAssuranceLevel} onValueChange={(v) => onChange({ ...value, minimumAssuranceLevel: v as AssuranceLevel })}>
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
        label="Capacity"
        type="number"
        min={0}
        placeholder="Optional"
        value={value.capacity ?? ""}
        onChange={(e) => onChange({ ...value, capacity: e.target.value === "" ? null : Number(e.target.value) })}
        containerClassName="w-[100px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Occupancy policy</label>
        <Select value={value.occupancyPolicy} onValueChange={(v) => onChange({ ...value, occupancyPolicy: v as OccupancyPolicy })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OCCUPANCY_POLICIES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Offline policy</label>
        <Select value={value.offlinePolicy} onValueChange={(v) => onChange({ ...value, offlinePolicy: v as OfflinePolicy })}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OFFLINE_POLICIES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-[6px] pb-[6px]">
        <Checkbox id="resource-active" checked={value.active} onCheckedChange={(c) => onChange({ ...value, active: c === true })} />
        <label htmlFor="resource-active" className="text-[13px] text-[var(--color-text-secondary)]">
          Active
        </label>
      </div>
      <Input
        label="Description"
        placeholder="Optional"
        value={value.description ?? ""}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        containerClassName="min-w-[200px] flex-1 basis-full"
      />
    </div>
  );
}

export function ResourcesSection({
  productionId,
  resources,
  locationOptions,
  canManage,
}: {
  productionId: string;
  resources: ResourceRow[];
  locationOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<ResourceInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<ResourceInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [codePreview, setCodePreview] = React.useState<string | null>(null);

  const resourceOptions: PersonOption[] = resources.map((r) => ({ id: r.id, label: r.name }));

  React.useEffect(() => {
    if (!adding) {
      setCodePreview(null);
      return;
    }
    let cancelled = false;
    previewNextResourceCode(productionId).then((preview) => {
      if (!cancelled) setCodePreview(preview);
    });
    return () => {
      cancelled = true;
    };
  }, [adding, productionId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createResource(productionId, addForm);
      toast({ tone: "success", title: "Resource added", description: addForm.name });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add resource", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(resource: ResourceRow) {
    setEditingId(resource.id);
    setEditForm({
      parentResourceId: resource.parentResourceId,
      locationId: resource.locationId,
      resourceType: resource.resourceType,
      name: resource.name,
      code: resource.code ?? "",
      description: resource.description ?? "",
      active: resource.active,
      securityLevel: resource.securityLevel,
      minimumAssuranceLevel: resource.minimumAssuranceLevel,
      capacity: resource.capacity,
      occupancyPolicy: resource.occupancyPolicy,
      offlinePolicy: resource.offlinePolicy,
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateResource(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(resource: ResourceRow) {
    setPendingId(resource.id);
    try {
      await deleteResource(productionId, resource.id);
      router.refresh();
      toast({ title: "Resource removed", description: resource.name });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove resource", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {resources.length === 0 && !adding && (
        <EmptyState
          icon={<DoorClosed className="size-full" />}
          title="No resources yet"
          description={
            canManage
              ? "Add a gate, zone, room, or set — the physical spaces this domain controls access to."
              : "No resources have been added for this production yet."
          }
          action={canManage ? <Button onClick={() => setAdding(true)}>Add resource</Button> : undefined}
        />
      )}

      {resources.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {resources.map((resource) => (
            <React.Fragment key={resource.id}>
              {canManage && editingId === resource.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, resource.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <ResourceForm value={editForm} onChange={setEditForm} resourceOptions={resourceOptions} locationOptions={locationOptions} excludeId={resource.id} codePreview={null} />
                    <Button type="submit" loading={pendingId === resource.id} disabled={pendingId !== null}>
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
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{resource.name}</p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {humanizeEnum(resource.resourceType)}
                      {resource.parentResourceId ? ` · in ${resourceOptions.find((o) => o.id === resource.parentResourceId)?.label ?? "…"}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    {!resource.active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
                    <StatusBadge tone={securityLevelTone[resource.securityLevel]}>{humanizeEnum(resource.securityLevel)}</StatusBadge>
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Edit ${resource.name}`}
                          onClick={() => startEdit(resource)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Remove ${resource.name}`}
                          loading={pendingId === resource.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(resource)}
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

      {canManage && resources.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add resource
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <ResourceForm value={addForm} onChange={setAddForm} resourceOptions={resourceOptions} locationOptions={locationOptions} excludeId={null} codePreview={codePreview} />
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
