"use client";

import { ImportPanel } from "@/components/import-panel";
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
import { BedDouble, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  bookStay,
  cancelStay,
  createProperty,
  createRoomType,
  deleteProperty,
  deleteRoomType,
  updateProperty,
  updateStay,
  type BookStayInput,
  type PropertyInput,
} from "./actions";

export interface PropertyRow {
  id: string;
  name: string;
  type: string;
  address: string;
  notes: string;
  roomTypes: { id: string; name: string; capacity: number }[];
}

export interface StayRow {
  id: string;
  propertyId: string;
  propertyName: string;
  roomTypeId: string | null;
  roomTypeName: string | null;
  personType: "CAST" | "CREW";
  personId: string;
  personName: string;
  checkIn: string;
  checkOut: string;
  roomNumber: string | null;
  notes: string;
  status: string;
}

export interface PersonOption {
  id: string;
  name: string;
}

const emptyPropertyForm: PropertyInput = { name: "", type: "HOTEL", address: "", notes: "" };
const PROPERTY_TYPES = ["HOTEL", "APARTMENT", "HOUSE", "TRAILER", "OTHER"];

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  BOOKED: "success",
  REQUESTED: "warning",
  CANCELLED: "danger",
  COMPLETED: "neutral",
};

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PropertyForm({ value, onChange }: { value: PropertyInput; onChange: (next: PropertyInput) => void }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[160px] flex-1" />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Type</label>
        <Select value={value.type} onValueChange={(v) => onChange({ ...value, type: v })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input label="Address" value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })} containerClassName="min-w-[180px] flex-1" />
      <Input
        label="Notes"
        placeholder="Optional"
        value={value.notes}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        containerClassName="min-w-[160px] flex-1"
      />
    </div>
  );
}

function RoomTypesEditor({ productionId, property, onChanged }: { productionId: string; property: PropertyRow; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [capacity, setCapacity] = React.useState("2");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setPendingId("new");
    try {
      await createRoomType(productionId, property.id, name, Number(capacity));
      setName("");
      setCapacity("2");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add room type", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(roomTypeId: string) {
    setPendingId(roomTypeId);
    try {
      await deleteRoomType(productionId, property.id, roomTypeId);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove room type", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--fs-space-8)] pl-[28px]">
      {property.roomTypes.map((rt) => (
        <span
          key={rt.id}
          className="flex items-center gap-[6px] rounded-full border border-[var(--color-border-subtle)] px-[var(--fs-space-8)] py-[2px] text-[12px] text-[var(--color-text-secondary)]"
        >
          {rt.name} · {rt.capacity} guest{rt.capacity === 1 ? "" : "s"}
          <button
            type="button"
            aria-label={`Remove room type ${rt.name}`}
            onClick={() => onDelete(rt.id)}
            disabled={pendingId !== null}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
          >
            <X className="size-[12px]" aria-hidden="true" />
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={onAdd} className="flex items-end gap-[var(--fs-space-8)]">
          <Input label="Room type" value={name} onChange={(e) => setName(e.target.value)} containerClassName="w-[140px]" />
          <Input label="Capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} containerClassName="w-[80px]" />
          <Button type="submit" loading={pendingId === "new"} disabled={pendingId !== null}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={pendingId !== null}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button variant="quiet" icon={<Plus className="size-[12px]" aria-hidden="true" />} onClick={() => setAdding(true)}>
          Add room type
        </Button>
      )}
    </div>
  );
}

function PropertiesList({ productionId, properties, onChanged }: { productionId: string; properties: PropertyRow[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<PropertyInput>(emptyPropertyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<PropertyInput>(emptyPropertyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createProperty(productionId, addForm);
      toast({ tone: "success", title: "Property added", description: addForm.name });
      setAddForm(emptyPropertyForm);
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add property", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(property: PropertyRow) {
    setEditingId(property.id);
    setEditForm({ name: property.name, type: property.type, address: property.address, notes: property.notes });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateProperty(productionId, id, editForm);
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(property: PropertyRow) {
    setPendingId(property.id);
    try {
      await deleteProperty(productionId, property.id);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove property", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {properties.length === 0 && !adding && (
        <EmptyState
          icon={<BedDouble className="size-full" />}
          title="No properties yet"
          description="Add a hotel, apartment, or other property before booking a stay."
          action={<Button onClick={() => setAdding(true)}>Add property</Button>}
        />
      )}

      {properties.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {properties.map((property) => (
            <li key={property.id} className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
              {editingId === property.id ? (
                <form onSubmit={(e) => onSaveEdit(e, property.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                  <PropertyForm value={editForm} onChange={setEditForm} />
                  <Button type="submit" loading={pendingId === property.id} disabled={pendingId !== null}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
                  <div className="flex min-w-0 items-center gap-[var(--fs-space-8)]">
                    <BedDouble className="size-[16px] shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{property.name}</p>
                      <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                        {property.type.charAt(0) + property.type.slice(1).toLowerCase()}
                        {property.address ? ` · ${property.address}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Edit ${property.name}`}
                      onClick={() => startEdit(property)}
                      disabled={pendingId !== null}
                    />
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Remove ${property.name}`}
                      loading={pendingId === property.id}
                      disabled={pendingId !== null}
                      onClick={() => onDelete(property)}
                    />
                  </div>
                </div>
              )}
              <RoomTypesEditor productionId={productionId} property={property} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}

      {properties.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add property
        </Button>
      )}

      {adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row"
        >
          <PropertyForm value={addForm} onChange={setAddForm} />
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

const emptyBookForm: BookStayInput = {
  propertyId: "",
  roomTypeId: null,
  personType: "CAST",
  personId: "",
  checkIn: "",
  checkOut: "",
  roomNumber: "",
  notes: "",
};

function BookStayDialog({
  productionId,
  properties,
  castMembers,
  crewMembers,
  open,
  onOpenChange,
  onBooked,
}: {
  productionId: string;
  properties: PropertyRow[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBooked: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<BookStayInput>(emptyBookForm);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(emptyBookForm);
  }, [open]);

  const selectedProperty = properties.find((p) => p.id === form.propertyId) ?? null;
  const people = form.personType === "CAST" ? castMembers : crewMembers;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await bookStay(productionId, form);
      toast({ tone: "success", title: "Stay booked" });
      onOpenChange(false);
      onBooked();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't book stay", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book a stay</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Property</label>
            <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v, roomTypeId: null })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProperty && selectedProperty.roomTypes.length > 0 && (
            <div className="flex flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Room type</label>
              <Select value={form.roomTypeId ?? undefined} onValueChange={(v) => setForm({ ...form, roomTypeId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Any room type" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProperty.roomTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-[var(--fs-space-8)]">
            <div className="flex flex-1 flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Who</label>
              <Select
                value={form.personType}
                onValueChange={(v) => setForm({ ...form, personType: v as "CAST" | "CREW", personId: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAST">Cast</SelectItem>
                  <SelectItem value="CREW">Crew</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-[2] flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Person</label>
              <Select value={form.personId} onValueChange={(v) => setForm({ ...form, personId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-[var(--fs-space-8)]">
            <Input
              label="Check-in"
              type="date"
              value={form.checkIn}
              onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
              containerClassName="flex-1"
            />
            <Input
              label="Check-out"
              type="date"
              value={form.checkOut}
              onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
              containerClassName="flex-1"
            />
          </div>

          <div className="flex gap-[var(--fs-space-8)]">
            <Input
              label="Room number"
              placeholder="Optional"
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              containerClassName="flex-1"
            />
            <Input
              label="Notes"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              containerClassName="flex-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving || !form.propertyId || !form.personId}>
              Book stay
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelStayDialog({
  productionId,
  stay,
  onOpenChange,
  onCancelled,
}: {
  productionId: string;
  stay: StayRow | null;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function onConfirm() {
    if (!stay) return;
    setSaving(true);
    try {
      await cancelStay(productionId, stay.id, reason);
      toast({ title: "Stay cancelled", description: stay.personName });
      setReason("");
      onOpenChange(false);
      onCancelled();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't cancel stay", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={stay !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel stay{stay ? ` for ${stay.personName}` : ""}</DialogTitle>
        </DialogHeader>
        <Input label="Reason" placeholder="Optional" value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Never mind
          </Button>
          <Button variant="destructive" loading={saving} disabled={saving} onClick={onConfirm}>
            Cancel stay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StaysList({
  productionId,
  stays,
  properties,
  castMembers,
  crewMembers,
  onChanged,
}: {
  productionId: string;
  stays: StayRow[];
  properties: PropertyRow[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [bookOpen, setBookOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState<StayRow | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({ checkIn: "", checkOut: "", roomNumber: "", roomTypeId: null as string | null });
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function startEdit(stay: StayRow) {
    setEditingId(stay.id);
    setEditForm({
      checkIn: toDateInputValue(stay.checkIn),
      checkOut: toDateInputValue(stay.checkOut),
      roomNumber: stay.roomNumber ?? "",
      roomTypeId: stay.roomTypeId,
    });
  }

  async function onSaveEdit(e: React.FormEvent, stayId: string) {
    e.preventDefault();
    setPendingId(stayId);
    try {
      await updateStay(productionId, stayId, editForm);
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {stays.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="size-full" />}
          title="No stays booked yet"
          description="Book a stay once you have at least one property set up."
          action={
            <Button onClick={() => setBookOpen(true)} disabled={properties.length === 0}>
              Book a stay
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
            {stays.map((stay) => (
              <li key={stay.id}>
                {editingId === stay.id ? (
                  <form onSubmit={(e) => onSaveEdit(e, stay.id)} className="flex flex-wrap items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                    <Input
                      label="Check-in"
                      type="date"
                      value={editForm.checkIn}
                      onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                      containerClassName="w-[150px]"
                    />
                    <Input
                      label="Check-out"
                      type="date"
                      value={editForm.checkOut}
                      onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                      containerClassName="w-[150px]"
                    />
                    <Input
                      label="Room number"
                      value={editForm.roomNumber}
                      onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                      containerClassName="w-[120px]"
                    />
                    <Button type="submit" loading={pendingId === stay.id} disabled={pendingId !== null}>
                      Save
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{stay.personName}</p>
                      <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                        {stay.propertyName}
                        {stay.roomTypeName ? ` · ${stay.roomTypeName}` : ""}
                        {stay.roomNumber ? ` · Room ${stay.roomNumber}` : ""} · {formatDate(stay.checkIn)} – {formatDate(stay.checkOut)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                      <StatusBadge tone={statusTone[stay.status] ?? "neutral"}>{stay.status}</StatusBadge>
                      {stay.status !== "CANCELLED" && (
                        <>
                          <Button
                            variant="quiet"
                            iconOnly
                            icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                            aria-label={`Edit stay for ${stay.personName}`}
                            onClick={() => startEdit(stay)}
                            disabled={pendingId !== null}
                          />
                          <Button
                            variant="quiet"
                            iconOnly
                            icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                            aria-label={`Cancel stay for ${stay.personName}`}
                            onClick={() => setCancelling(stay)}
                            disabled={pendingId !== null}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setBookOpen(true)} disabled={properties.length === 0} className="self-start">
            Book a stay
          </Button>
        </>
      )}

      <BookStayDialog
        productionId={productionId}
        properties={properties}
        castMembers={castMembers}
        crewMembers={crewMembers}
        open={bookOpen}
        onOpenChange={setBookOpen}
        onBooked={onChanged}
      />
      <CancelStayDialog productionId={productionId} stay={cancelling} onOpenChange={(open) => !open && setCancelling(null)} onCancelled={onChanged} />
    </div>
  );
}

export function AccommodationSection({
  production,
  scenes,
  userEmail,
  productionId,
  properties,
  stays,
  castMembers,
  crewMembers,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | undefined;
  productionId: string;
  properties: PropertyRow[];
  stays: StayRow[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
}) {
  const router = useRouter();
  const onChanged = React.useCallback(() => router.refresh(), [router]);

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Accommodation</h1>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Properties</h2>
            <ImportPanel productionId={productionId} entityType="property" />
          </div>
          <PropertiesList productionId={productionId} properties={properties} onChanged={onChanged} />
        </section>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Stays</h2>
          <StaysList
            productionId={productionId}
            stays={stays}
            properties={properties}
            castMembers={castMembers}
            crewMembers={crewMembers}
            onChanged={onChanged}
          />
        </section>
      </div>
    </Shell>
  );
}
