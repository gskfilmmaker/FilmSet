"use client";

import { Button, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { Pencil, Trash2, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createDevice, deleteDevice, updateDevice, DEVICE_STATUSES, DEVICE_TYPES, type DeviceInput, type DeviceStatus, type DeviceType } from "./actions";
import { humanizeEnum } from "./format";
import type { PersonOption } from "./identities-section";

export interface DeviceRow {
  id: string;
  checkpointId: string | null;
  name: string;
  deviceType: DeviceType;
  deviceIdentifier: string;
  status: DeviceStatus;
}

const emptyForm: DeviceInput = {
  checkpointId: null,
  name: "",
  deviceType: "MOBILE_SCANNER",
  deviceIdentifier: "",
  status: "PENDING",
};

const statusTone: Record<DeviceStatus, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "neutral",
  TRUSTED: "success",
  SUSPENDED: "warning",
  REVOKED: "danger",
};

function DeviceForm({ value, onChange, checkpointOptions }: { value: DeviceInput; onChange: (next: DeviceInput) => void; checkpointOptions: PersonOption[] }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[140px] flex-1" />
      <Input
        label="Device identifier"
        placeholder="Serial / hardware id"
        value={value.deviceIdentifier}
        onChange={(e) => onChange({ ...value, deviceIdentifier: e.target.value })}
        containerClassName="min-w-[160px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Type</label>
        <Select value={value.deviceType} onValueChange={(v) => onChange({ ...value, deviceType: v as DeviceType })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEVICE_TYPES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Checkpoint</label>
        <Select value={value.checkpointId ?? "__none"} onValueChange={(v) => onChange({ ...value, checkpointId: v === "__none" ? null : v })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Unassigned</SelectItem>
            {checkpointOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Trust status</label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as DeviceStatus })}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEVICE_STATUSES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function DevicesSection({
  productionId,
  devices,
  checkpointOptions,
  canManage,
}: {
  productionId: string;
  devices: DeviceRow[];
  checkpointOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<DeviceInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<DeviceInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDevice(productionId, addForm);
      toast({ tone: "success", title: "Device added", description: addForm.name });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add device", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(device: DeviceRow) {
    setEditingId(device.id);
    setEditForm({
      checkpointId: device.checkpointId,
      name: device.name,
      deviceType: device.deviceType,
      deviceIdentifier: device.deviceIdentifier,
      status: device.status,
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateDevice(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(device: DeviceRow) {
    setPendingId(device.id);
    try {
      await deleteDevice(productionId, device.id);
      router.refresh();
      toast({ title: "Device removed", description: device.name });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove device", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {devices.length === 0 && !adding && (
        <EmptyState
          icon={<Smartphone className="size-full" />}
          title="No devices yet"
          description={
            canManage
              ? "Add a scanning device. Trust is granted directly here for now — the secure enrollment-token flow is a later phase (see docs/security/DEVICE_TRUST_ACCESS_CONTROL.md)."
              : "No devices have been added for this production yet."
          }
          action={canManage ? <Button onClick={() => setAdding(true)}>Add device</Button> : undefined}
        />
      )}

      {devices.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {devices.map((device) => (
            <React.Fragment key={device.id}>
              {canManage && editingId === device.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, device.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <DeviceForm value={editForm} onChange={setEditForm} checkpointOptions={checkpointOptions} />
                    <Button type="submit" loading={pendingId === device.id} disabled={pendingId !== null}>
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
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{device.name}</p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {humanizeEnum(device.deviceType)}
                      {device.checkpointId ? ` · ${checkpointOptions.find((o) => o.id === device.checkpointId)?.label ?? "…"}` : " · Unassigned"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <StatusBadge tone={statusTone[device.status]}>{humanizeEnum(device.status)}</StatusBadge>
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Edit ${device.name}`}
                          onClick={() => startEdit(device)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Remove ${device.name}`}
                          loading={pendingId === device.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(device)}
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

      {canManage && devices.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add device
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <DeviceForm value={addForm} onChange={setAddForm} checkpointOptions={checkpointOptions} />
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
