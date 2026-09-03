"use client";

import { Shell } from "@/components/shell";
import type { Production, Scene } from "@filmset/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  useToast,
} from "@filmset/ui";
import { Car, Pencil, Plus, Trash2, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  addDriverQualification,
  addLegPassenger,
  addMovementLeg,
  cancelMovement,
  createDriver,
  createMovement,
  createVehicle,
  deleteDriver,
  deleteDriverQualification,
  deleteMovementLeg,
  deleteVehicle,
  removeLegPassenger,
  updateVehicle,
  type DriverInput,
  type MovementLegInput,
  type VehicleInput,
} from "./actions";

export interface VehicleRow {
  id: string;
  type: string;
  identifier: string;
  capacity: number;
  notes: string;
}

export interface DriverRow {
  id: string;
  name: string;
  isExternal: boolean;
  qualifications: { id: string; type: string; expiryDate: string | null }[];
}

export interface MovementRow {
  id: string;
  date: string;
  purpose: string;
  status: string;
  legs: {
    id: string;
    pickupLocationId: string | null;
    pickupLabel: string;
    dropoffLocationId: string | null;
    dropoffLabel: string;
    scheduledTime: string;
    vehicleId: string | null;
    vehicleLabel: string | null;
    driverId: string | null;
    driverLabel: string | null;
    passengers: { id: string; name: string; personType: "CAST" | "CREW" }[];
  }[];
}

export interface PersonOption {
  id: string;
  name: string;
}

const VEHICLE_TYPES = ["PRODUCTION_VEHICLE", "CAST_CAR", "VIP_VEHICLE", "SHUTTLE", "BUS", "VAN", "EQUIPMENT_VEHICLE", "PICTURE_VEHICLE", "EXTERNAL_TAXI"];
const emptyVehicleForm: VehicleInput = { type: "PRODUCTION_VEHICLE", identifier: "", capacity: 4, notes: "" };

const movementStatusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PLANNED: "neutral",
  CONFIRMED: "warning",
  DRIVER_ASSIGNED: "warning",
  READY: "success",
  BOARDING: "success",
  EN_ROUTE: "success",
  ARRIVED: "success",
  COMPLETED: "neutral",
  CANCELLED: "danger",
};

function formatTypeLabel(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function VehicleForm({ value, onChange }: { value: VehicleInput; onChange: (next: VehicleInput) => void }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Identifier" placeholder="Van #1, plate, etc." value={value.identifier} onChange={(e) => onChange({ ...value, identifier: e.target.value })} containerClassName="min-w-[140px] flex-1" />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Type</label>
        <Select value={value.type} onValueChange={(v) => onChange({ ...value, type: v })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {formatTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        label="Capacity"
        type="number"
        min={1}
        value={String(value.capacity)}
        onChange={(e) => onChange({ ...value, capacity: Number(e.target.value) || 1 })}
        containerClassName="w-[90px]"
      />
      <Input label="Notes" placeholder="Optional" value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} containerClassName="min-w-[160px] flex-1" />
    </div>
  );
}

function VehiclesList({ productionId, vehicles, onChanged }: { productionId: string; vehicles: VehicleRow[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<VehicleInput>(emptyVehicleForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<VehicleInput>(emptyVehicleForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createVehicle(productionId, addForm);
      toast({ tone: "success", title: "Vehicle added", description: addForm.identifier });
      setAddForm(emptyVehicleForm);
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add vehicle", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(vehicle: VehicleRow) {
    setEditingId(vehicle.id);
    setEditForm({ type: vehicle.type, identifier: vehicle.identifier, capacity: vehicle.capacity, notes: vehicle.notes });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateVehicle(productionId, id, editForm);
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(vehicle: VehicleRow) {
    setPendingId(vehicle.id);
    try {
      await deleteVehicle(productionId, vehicle.id);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove vehicle", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {vehicles.length === 0 && !adding && (
        <EmptyState
          icon={<Truck className="size-full" />}
          title="No vehicles yet"
          description="Add a vehicle before booking a movement."
          action={<Button onClick={() => setAdding(true)}>Add vehicle</Button>}
        />
      )}

      {vehicles.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {vehicles.map((vehicle) => (
            <li key={vehicle.id} className="p-[var(--fs-space-12)]">
              {editingId === vehicle.id ? (
                <form onSubmit={(e) => onSaveEdit(e, vehicle.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                  <VehicleForm value={editForm} onChange={setEditForm} />
                  <Button type="submit" loading={pendingId === vehicle.id} disabled={pendingId !== null}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
                  <div className="flex min-w-0 items-center gap-[var(--fs-space-8)]">
                    <Truck className="size-[16px] shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{vehicle.identifier}</p>
                      <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                        {formatTypeLabel(vehicle.type)} · {vehicle.capacity} seat{vehicle.capacity === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <Button variant="quiet" iconOnly icon={<Pencil className="size-[14px]" aria-hidden="true" />} aria-label={`Edit ${vehicle.identifier}`} onClick={() => startEdit(vehicle)} disabled={pendingId !== null} />
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Remove ${vehicle.identifier}`}
                      loading={pendingId === vehicle.id}
                      disabled={pendingId !== null}
                      onClick={() => onDelete(vehicle)}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {vehicles.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add vehicle
        </Button>
      )}

      {adding && (
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row">
          <VehicleForm value={addForm} onChange={setAddForm} />
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

function QualificationsEditor({ productionId, driver, onChanged }: { productionId: string; driver: DriverRow; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [type, setType] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setPendingId("new");
    try {
      await addDriverQualification(productionId, driver.id, type, expiry || null);
      setType("");
      setExpiry("");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add qualification", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(qualificationId: string) {
    setPendingId(qualificationId);
    try {
      await deleteDriverQualification(productionId, driver.id, qualificationId);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove qualification", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--fs-space-8)] pl-[28px]">
      {driver.qualifications.map((q) => (
        <span key={q.id} className="flex items-center gap-[6px] rounded-full border border-[var(--color-border-subtle)] px-[var(--fs-space-8)] py-[2px] text-[12px] text-[var(--color-text-secondary)]">
          {q.type}
          {q.expiryDate ? ` · exp. ${new Date(q.expiryDate).toLocaleDateString()}` : ""}
          <button type="button" aria-label={`Remove qualification ${q.type}`} onClick={() => onDelete(q.id)} disabled={pendingId !== null} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]">
            <X className="size-[12px]" aria-hidden="true" />
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={onAdd} className="flex items-end gap-[var(--fs-space-8)]">
          <Input label="Qualification" value={type} onChange={(e) => setType(e.target.value)} containerClassName="w-[160px]" />
          <Input label="Expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} containerClassName="w-[140px]" />
          <Button type="submit" loading={pendingId === "new"} disabled={pendingId !== null}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={pendingId !== null}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button variant="quiet" icon={<Plus className="size-[12px]" aria-hidden="true" />} onClick={() => setAdding(true)}>
          Add qualification
        </Button>
      )}
    </div>
  );
}

function DriversList({
  productionId,
  drivers,
  crewMembers,
  onChanged,
}: {
  productionId: string;
  drivers: DriverRow[];
  crewMembers: PersonOption[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<DriverInput>({ crewMemberId: null, externalName: "", notes: "" });
  const [useExternal, setUseExternal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDriver(productionId, useExternal ? { ...addForm, crewMemberId: null } : { ...addForm, externalName: "" });
      toast({ tone: "success", title: "Driver added" });
      setAddForm({ crewMemberId: null, externalName: "", notes: "" });
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add driver", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(driver: DriverRow) {
    setPendingId(driver.id);
    try {
      await deleteDriver(productionId, driver.id);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove driver", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {drivers.length === 0 && !adding && (
        <EmptyState icon={<Car className="size-full" />} title="No drivers yet" description="Add a driver before assigning one to a movement leg." action={<Button onClick={() => setAdding(true)}>Add driver</Button>} />
      )}

      {drivers.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {drivers.map((driver) => (
            <li key={driver.id} className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
              <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
                <div className="flex min-w-0 items-center gap-[var(--fs-space-8)]">
                  <Car className="size-[16px] shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{driver.name}</p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{driver.isExternal ? "External" : "Crew"}</p>
                  </div>
                </div>
                <Button
                  variant="quiet"
                  iconOnly
                  icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                  aria-label={`Remove ${driver.name}`}
                  loading={pendingId === driver.id}
                  disabled={pendingId !== null}
                  onClick={() => onDelete(driver)}
                />
              </div>
              <QualificationsEditor productionId={productionId} driver={driver} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}

      {drivers.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add driver
        </Button>
      )}

      {adding && (
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row">
          <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
            <div className="flex flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Kind</label>
              <Select value={useExternal ? "external" : "crew"} onValueChange={(v) => setUseExternal(v === "external")}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crew">Crew</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {useExternal ? (
              <Input label="Name" value={addForm.externalName} onChange={(e) => setAddForm({ ...addForm, externalName: e.target.value })} containerClassName="min-w-[160px] flex-1" />
            ) : (
              <div className="flex min-w-[160px] flex-1 flex-col gap-[4px]">
                <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Crew member</label>
                <Select value={addForm.crewMemberId ?? undefined} onValueChange={(v) => setAddForm({ ...addForm, crewMemberId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a crew member" />
                  </SelectTrigger>
                  <SelectContent>
                    {crewMembers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
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

const emptyLegForm: MovementLegInput = { pickupLocationId: null, pickupNotes: "", dropoffLocationId: null, dropoffNotes: "", scheduledTime: "", vehicleId: null, driverId: null };

function AddLegDialog({
  productionId,
  movementId,
  vehicles,
  drivers,
  locations,
  open,
  onOpenChange,
  onAdded,
}: {
  productionId: string;
  movementId: string;
  vehicles: VehicleRow[];
  drivers: DriverRow[];
  locations: PersonOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<MovementLegInput>(emptyLegForm);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(emptyLegForm);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addMovementLeg(productionId, movementId, form);
      toast({ tone: "success", title: "Leg added" });
      onOpenChange(false);
      onAdded();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add leg", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a leg</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex gap-[var(--fs-space-8)]">
            <div className="flex flex-1 flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Pickup</label>
              <Select value={form.pickupLocationId ?? undefined} onValueChange={(v) => setForm({ ...form, pickupLocationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label="Or notes"
              placeholder="e.g. Airport arrivals"
              value={form.pickupNotes}
              onChange={(e) => setForm({ ...form, pickupNotes: e.target.value, pickupLocationId: e.target.value ? null : form.pickupLocationId })}
              containerClassName="flex-1"
            />
          </div>
          <div className="flex gap-[var(--fs-space-8)]">
            <div className="flex flex-1 flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Dropoff</label>
              <Select value={form.dropoffLocationId ?? undefined} onValueChange={(v) => setForm({ ...form, dropoffLocationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label="Or notes"
              placeholder="e.g. Set"
              value={form.dropoffNotes}
              onChange={(e) => setForm({ ...form, dropoffNotes: e.target.value, dropoffLocationId: e.target.value ? null : form.dropoffLocationId })}
              containerClassName="flex-1"
            />
          </div>
          <Input label="Scheduled time" type="datetime-local" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
          <div className="flex gap-[var(--fs-space-8)]">
            <div className="flex flex-1 flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Vehicle</label>
              <Select value={form.vehicleId ?? undefined} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.identifier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Driver</label>
              <Select value={form.driverId ?? undefined} onValueChange={(v) => setForm({ ...form, driverId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving || !form.scheduledTime}>
              Add leg
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LegPassengers({ productionId, leg, castMembers, crewMembers, onChanged }: { productionId: string; leg: MovementRow["legs"][number]; castMembers: PersonOption[]; crewMembers: PersonOption[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [personType, setPersonType] = React.useState<"CAST" | "CREW">("CREW");
  const [personId, setPersonId] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const people = personType === "CAST" ? castMembers : crewMembers;

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setPendingId("new");
    try {
      await addLegPassenger(productionId, leg.id, personType, personId);
      setPersonId("");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add passenger", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onRemove(passengerId: string) {
    setPendingId(passengerId);
    try {
      await removeLegPassenger(productionId, leg.id, passengerId);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove passenger", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-[6px] pl-[16px]">
      {leg.passengers.map((p) => (
        <span key={p.id} className="flex items-center gap-[4px] rounded-full border border-[var(--color-border-subtle)] px-[8px] py-[1px] text-[11px] text-[var(--color-text-secondary)]">
          {p.name}
          <button type="button" aria-label={`Remove passenger ${p.name}`} onClick={() => onRemove(p.id)} disabled={pendingId !== null} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]">
            <X className="size-[10px]" aria-hidden="true" />
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={onAdd} className="flex items-center gap-[6px]">
          <Select value={personType} onValueChange={(v) => setPersonType(v as "CAST" | "CREW")}>
            <SelectTrigger className="h-[26px] w-[80px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CAST">Cast</SelectItem>
              <SelectItem value="CREW">Crew</SelectItem>
            </SelectContent>
          </Select>
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger className="h-[26px] w-[140px] text-[11px]">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" loading={pendingId === "new"} disabled={pendingId !== null || !personId}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={pendingId !== null}>
            <X className="size-[12px]" aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <Button variant="quiet" icon={<Plus className="size-[10px]" aria-hidden="true" />} onClick={() => setAdding(true)}>
          Passenger
        </Button>
      )}
    </div>
  );
}

function MovementCard({
  productionId,
  movement,
  vehicles,
  drivers,
  locations,
  castMembers,
  crewMembers,
  onChanged,
}: {
  productionId: string;
  movement: MovementRow;
  vehicles: VehicleRow[];
  drivers: DriverRow[];
  locations: PersonOption[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [legDialogOpen, setLegDialogOpen] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [pendingLegId, setPendingLegId] = React.useState<string | null>(null);

  async function onCancel() {
    setSaving(true);
    try {
      await cancelMovement(productionId, movement.id, reason);
      toast({ title: "Movement cancelled" });
      setReason("");
      setCancelDialogOpen(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't cancel movement", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteLeg(legId: string) {
    setPendingLegId(legId);
    try {
      await deleteMovementLeg(productionId, movement.id, legId);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove leg", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingLegId(null);
    }
  }

  return (
    <li className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
      <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{movement.purpose}</p>
          <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{formatDateTime(movement.date)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
          <StatusBadge tone={movementStatusTone[movement.status] ?? "neutral"}>{movement.status}</StatusBadge>
          {movement.status !== "CANCELLED" && (
            <>
              <Button variant="quiet" onClick={() => setLegDialogOpen(true)}>
                Add leg
              </Button>
              <Button variant="quiet" iconOnly icon={<Trash2 className="size-[14px]" aria-hidden="true" />} aria-label={`Cancel ${movement.purpose}`} onClick={() => setCancelDialogOpen(true)} />
            </>
          )}
        </div>
      </div>

      {movement.legs.length > 0 && (
        <ul className="flex flex-col gap-[var(--fs-space-8)] pl-[16px]">
          {movement.legs.map((leg) => (
            <li key={leg.id} className="flex flex-col gap-[4px] border-l-2 border-[var(--color-border-subtle)] pl-[var(--fs-space-8)]">
              <div className="flex items-center justify-between gap-[var(--fs-space-8)]">
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  {leg.pickupLabel} → {leg.dropoffLabel} · {formatDateTime(leg.scheduledTime)}
                  {leg.vehicleLabel ? ` · ${leg.vehicleLabel}` : ""}
                  {leg.driverLabel ? ` · ${leg.driverLabel}` : ""}
                </p>
                {movement.status !== "CANCELLED" && (
                  <Button
                    variant="quiet"
                    iconOnly
                    icon={<Trash2 className="size-[12px]" aria-hidden="true" />}
                    aria-label="Remove leg"
                    loading={pendingLegId === leg.id}
                    disabled={pendingLegId !== null}
                    onClick={() => onDeleteLeg(leg.id)}
                  />
                )}
              </div>
              <LegPassengers productionId={productionId} leg={leg} castMembers={castMembers} crewMembers={crewMembers} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}

      <AddLegDialog
        productionId={productionId}
        movementId={movement.id}
        vehicles={vehicles}
        drivers={drivers}
        locations={locations}
        open={legDialogOpen}
        onOpenChange={setLegDialogOpen}
        onAdded={onChanged}
      />

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel movement — {movement.purpose}</DialogTitle>
          </DialogHeader>
          <Input label="Reason" placeholder="Optional" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelDialogOpen(false)} disabled={saving}>
              Never mind
            </Button>
            <Button variant="destructive" loading={saving} disabled={saving} onClick={onCancel}>
              Cancel movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function NewMovementDialog({ productionId, open, onOpenChange, onCreated }: { productionId: string; open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDate("");
      setPurpose("");
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMovement(productionId, date, purpose);
      toast({ tone: "success", title: "Movement created" });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't create movement", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New movement</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)]">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Purpose" placeholder="e.g. Airport pickup, cast to set" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving || !date || !purpose}>
              Create movement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementsList({
  productionId,
  movements,
  vehicles,
  drivers,
  locations,
  castMembers,
  crewMembers,
  onChanged,
}: {
  productionId: string;
  movements: MovementRow[];
  vehicles: VehicleRow[];
  drivers: DriverRow[];
  locations: PersonOption[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
  onChanged: () => void;
}) {
  const [newOpen, setNewOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {movements.length === 0 ? (
        <EmptyState icon={<Car className="size-full" />} title="No movements yet" description="Create a movement to start planning transport." action={<Button onClick={() => setNewOpen(true)}>New movement</Button>} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
            {movements.map((movement) => (
              <MovementCard
                key={movement.id}
                productionId={productionId}
                movement={movement}
                vehicles={vehicles}
                drivers={drivers}
                locations={locations}
                castMembers={castMembers}
                crewMembers={crewMembers}
                onChanged={onChanged}
              />
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setNewOpen(true)} className="self-start">
            New movement
          </Button>
        </>
      )}
      <NewMovementDialog productionId={productionId} open={newOpen} onOpenChange={setNewOpen} onCreated={onChanged} />
    </div>
  );
}

export function TransportSection({
  production,
  scenes,
  userEmail,
  productionId,
  vehicles,
  drivers,
  movements,
  locations,
  castMembers,
  crewMembers,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | undefined;
  productionId: string;
  vehicles: VehicleRow[];
  drivers: DriverRow[];
  movements: MovementRow[];
  locations: PersonOption[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
}) {
  const router = useRouter();
  const onChanged = React.useCallback(() => router.refresh(), [router]);

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Transport</h1>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Vehicles</h2>
          <VehiclesList productionId={productionId} vehicles={vehicles} onChanged={onChanged} />
        </section>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Drivers</h2>
          <DriversList productionId={productionId} drivers={drivers} crewMembers={crewMembers} onChanged={onChanged} />
        </section>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Movements</h2>
          <MovementsList
            productionId={productionId}
            movements={movements}
            vehicles={vehicles}
            drivers={drivers}
            locations={locations}
            castMembers={castMembers}
            crewMembers={crewMembers}
            onChanged={onChanged}
          />
        </section>
      </div>
    </Shell>
  );
}
