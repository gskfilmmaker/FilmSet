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
import { Camera, CheckCircle2, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  cancelEquipmentBooking,
  createCatalogItem,
  createEquipmentBooking,
  createEquipmentVendor,
  deleteCatalogItem,
  deleteEquipmentVendor,
  setCatalogItemDopApproval,
  setDirectorApproval,
  setDopApproval,
  setProducerApproval,
  updateCatalogItem,
  type EquipmentCatalogItemInput,
  type EquipmentVendorInput,
} from "./actions";
import { EQUIPMENT_CURRENCIES } from "./currency";

export interface VendorRow {
  id: string;
  name: string;
  contact: string;
  contractTerms: string;
}

export interface CatalogItemRow {
  id: string;
  vendorId: string;
  vendorName: string;
  department: string;
  category: string;
  name: string;
  dailyRate: string | null;
  currency: string;
  dopApproved: boolean;
  notes: string;
}

export interface BookingRow {
  id: string;
  shootDayId: string;
  catalogItemId: string;
  itemName: string;
  department: string;
  vendorName: string;
  quantity: number;
  rate: string | null;
  currency: string;
  dopApproved: boolean;
  directorApproved: boolean;
  producerApproved: boolean;
  notes: string;
}

export interface ShootDayOption {
  id: string;
  dayNumber: number;
  date: string;
}

const DEPARTMENTS = ["Camera", "Grip & Electric", "Sound"] as const;

function formatMoney(amount: string | null, currency: string) {
  if (!amount) return "—";
  const value = Number(amount);
  return currency ? `${currency} ${value.toFixed(2)}` : value.toFixed(2);
}

function lineCost(row: BookingRow): number {
  return Number(row.rate ?? 0) * row.quantity;
}

function VendorsList({ productionId, vendors, onChanged }: { productionId: string; vendors: VendorRow[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState<EquipmentVendorInput>({ name: "", contact: "", contractTerms: "" });
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createEquipmentVendor(productionId, form);
      toast({ tone: "success", title: "Vendor added", description: form.name });
      setForm({ name: "", contact: "", contractTerms: "" });
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add vendor", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(vendor: VendorRow) {
    setPendingId(vendor.id);
    try {
      await deleteEquipmentVendor(productionId, vendor.id);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove vendor", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {vendors.length === 0 && !adding && (
        <EmptyState icon={<Package className="size-full" />} title="No equipment vendors yet" description="Add a rental house before building an approved equipment list." action={<Button onClick={() => setAdding(true)}>Add vendor</Button>} />
      )}

      {vendors.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {vendors.map((vendor) => (
            <li key={vendor.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{vendor.name}</p>
                <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{[vendor.contact, vendor.contractTerms].filter(Boolean).join(" · ") || "No contact on file"}</p>
              </div>
              <Button
                variant="quiet"
                iconOnly
                icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                aria-label={`Remove ${vendor.name}`}
                loading={pendingId === vendor.id}
                disabled={pendingId !== null}
                onClick={() => onDelete(vendor)}
              />
            </li>
          ))}
        </ul>
      )}

      {vendors.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add vendor
        </Button>
      )}

      {adding && (
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap">
          <Input label="Vendor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} containerClassName="min-w-[160px] flex-1" />
          <Input label="Contact" placeholder="Optional" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} containerClassName="min-w-[160px] flex-1" />
          <Input label="Contract terms" placeholder="Optional" value={form.contractTerms} onChange={(e) => setForm({ ...form, contractTerms: e.target.value })} containerClassName="min-w-[160px] flex-1" />
          <Button type="submit" loading={saving} disabled={saving || !form.name.trim()}>
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

const emptyCatalogForm: EquipmentCatalogItemInput = { vendorId: "", department: "Camera", category: "", name: "", dailyRate: "", currency: "", notes: "" };

function CatalogItemForm({ value, onChange, vendors }: { value: EquipmentCatalogItemInput; onChange: (next: EquipmentCatalogItemInput) => void; vendors: VendorRow[] }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <div className="flex min-w-[140px] flex-1 flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Vendor</label>
        <Select value={value.vendorId || undefined} onValueChange={(v) => onChange({ ...value, vendorId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a vendor" />
          </SelectTrigger>
          <SelectContent>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Department</label>
        <Select value={value.department} onValueChange={(v) => onChange({ ...value, department: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input label="Category" placeholder="Camera body, lens, dolly..." value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })} containerClassName="min-w-[140px] flex-1" />
      <Input label="Item" placeholder="ARRI Alexa 35" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[160px] flex-1" />
      <Input label="Daily rate" placeholder="Optional" value={value.dailyRate} onChange={(e) => onChange({ ...value, dailyRate: e.target.value })} containerClassName="w-[110px]" />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Currency</label>
        <Select value={value.currency || undefined} onValueChange={(v) => onChange({ ...value, currency: v })}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {EQUIPMENT_CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input label="Notes" placeholder="Optional" value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} containerClassName="min-w-[160px] flex-1" />
    </div>
  );
}

function CatalogList({
  productionId,
  vendors,
  catalogItems,
  canApproveDop,
  onChanged,
}: {
  productionId: string;
  vendors: VendorRow[];
  catalogItems: CatalogItemRow[];
  canApproveDop: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<EquipmentCatalogItemInput>(emptyCatalogForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<EquipmentCatalogItemInput>(emptyCatalogForm);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCatalogItem(productionId, addForm);
      toast({ tone: "success", title: "Item added", description: addForm.name });
      setAddForm(emptyCatalogForm);
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add item", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: CatalogItemRow) {
    setEditingId(item.id);
    setEditForm({ vendorId: item.vendorId, department: item.department, category: item.category, name: item.name, dailyRate: item.dailyRate ?? "", currency: item.currency, notes: item.notes });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateCatalogItem(productionId, id, editForm);
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(item: CatalogItemRow) {
    setPendingId(item.id);
    try {
      await deleteCatalogItem(productionId, item.id);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove item", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onToggleDop(item: CatalogItemRow) {
    setPendingId(item.id);
    try {
      await setCatalogItemDopApproval(productionId, item.id, !item.dopApproved);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't update approval", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {catalogItems.length === 0 && !adding && (
        <EmptyState
          icon={<Camera className="size-full" />}
          title="No approved equipment yet"
          description="Add items to a vendor's approved list — a Camera department head can then sign off on each."
          action={vendors.length > 0 ? <Button onClick={() => setAdding(true)}>Add item</Button> : undefined}
        />
      )}

      {catalogItems.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {catalogItems.map((item) => (
            <li key={item.id} className="p-[var(--fs-space-12)]">
              {editingId === item.id ? (
                <form onSubmit={(e) => onSaveEdit(e, item.id)} className="flex flex-1 flex-col items-end gap-[var(--fs-space-8)] sm:flex-row sm:flex-wrap">
                  <CatalogItemForm value={editForm} onChange={setEditForm} vendors={vendors} />
                  <Button type="submit" loading={pendingId === item.id} disabled={pendingId !== null}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                      {item.name} <span className="font-normal text-[var(--color-text-tertiary)]">· {item.department}</span>
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {[item.category, item.vendorName, formatMoney(item.dailyRate, item.currency) !== "—" ? `${formatMoney(item.dailyRate, item.currency)}/day` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    {item.dopApproved ? (
                      <StatusBadge tone="success">DOP approved</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Not approved</StatusBadge>
                    )}
                    {canApproveDop && (
                      <Button variant="quiet" loading={pendingId === item.id} disabled={pendingId !== null} onClick={() => onToggleDop(item)}>
                        {item.dopApproved ? "Revoke" : "Approve"}
                      </Button>
                    )}
                    <Button variant="quiet" iconOnly icon={<Pencil className="size-[14px]" aria-hidden="true" />} aria-label={`Edit ${item.name}`} onClick={() => startEdit(item)} disabled={pendingId !== null} />
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Remove ${item.name}`}
                      loading={pendingId === item.id}
                      disabled={pendingId !== null}
                      onClick={() => onDelete(item)}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {vendors.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add item
        </Button>
      )}

      {adding && (
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap">
          <CatalogItemForm value={addForm} onChange={setAddForm} vendors={vendors} />
          <Button type="submit" loading={saving} disabled={saving || !addForm.vendorId || !addForm.name.trim()}>
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

function AddBookingDialog({
  productionId,
  shootDayId,
  catalogItems,
  open,
  onOpenChange,
  onAdded,
}: {
  productionId: string;
  shootDayId: string;
  catalogItems: CatalogItemRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [catalogItemId, setCatalogItemId] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [rate, setRate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCatalogItemId("");
      setQuantity("1");
      setRate("");
      setNotes("");
    }
  }, [open]);

  const selectedItem = catalogItems.find((i) => i.id === catalogItemId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createEquipmentBooking(productionId, shootDayId, catalogItemId, Number(quantity) || 1, rate || (selectedItem?.dailyRate ?? ""), notes);
      toast({ tone: "success", title: "Equipment booked" });
      onOpenChange(false);
      onAdded();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't book equipment", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book equipment</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Item</label>
            <Select value={catalogItemId || undefined} onValueChange={setCatalogItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose from the approved list" />
              </SelectTrigger>
              <SelectContent>
                {catalogItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} · {i.department} {i.dopApproved ? "" : "(not DOP-approved)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-[var(--fs-space-8)]">
            <Input label="Quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} containerClassName="w-[100px]" />
            <Input label="Rate/day" placeholder={selectedItem?.dailyRate ?? "Optional"} value={rate} onChange={(e) => setRate(e.target.value)} containerClassName="flex-1" />
          </div>
          <Input label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving || !catalogItemId}>
              Book equipment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignOffButton({
  label,
  approved,
  canApprove,
  loading,
  onToggle,
}: {
  label: string;
  approved: boolean;
  canApprove: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  if (!canApprove) {
    return (
      <StatusBadge tone={approved ? "success" : "neutral"}>
        {approved ? <CheckCircle2 className="mr-[4px] inline size-[11px]" aria-hidden="true" /> : null}
        {label}
      </StatusBadge>
    );
  }
  return (
    <Button variant={approved ? "secondary" : "quiet"} loading={loading} disabled={loading} onClick={onToggle}>
      {approved ? <CheckCircle2 className="mr-[4px] size-[12px]" aria-hidden="true" /> : null}
      {label}
    </Button>
  );
}

function BookingRowItem({
  productionId,
  booking,
  canApproveDop,
  canApproveDirector,
  canApproveProducer,
  onChanged,
}: {
  productionId: string;
  booking: BookingRow;
  canApproveDop: boolean;
  canApproveDirector: boolean;
  canApproveProducer: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(kind: "dop" | "director" | "producer", approved: boolean) {
    setPending(kind);
    try {
      if (kind === "dop") await setDopApproval(productionId, booking.id, approved);
      else if (kind === "director") await setDirectorApproval(productionId, booking.id, approved);
      else await setProducerApproval(productionId, booking.id, approved);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't update sign-off", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPending(null);
    }
  }

  async function onCancel() {
    setPending("cancel");
    try {
      await cancelEquipmentBooking(productionId, booking.id, reason);
      toast({ title: "Booking cancelled" });
      setCancelOpen(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't cancel booking", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPending(null);
    }
  }

  return (
    <li className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-12)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
          {booking.quantity}× {booking.itemName} <span className="font-normal text-[var(--color-text-tertiary)]">· {booking.department}</span>
        </p>
        <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
          {booking.vendorName} · {formatMoney(booking.rate, booking.currency)}/day · {formatMoney(String(lineCost(booking)), booking.currency)} total
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-[6px]">
        <SignOffButton label="DOP" approved={booking.dopApproved} canApprove={canApproveDop} loading={pending === "dop"} onToggle={() => toggle("dop", !booking.dopApproved)} />
        <SignOffButton label="Director" approved={booking.directorApproved} canApprove={canApproveDirector} loading={pending === "director"} onToggle={() => toggle("director", !booking.directorApproved)} />
        <SignOffButton label="Producer" approved={booking.producerApproved} canApprove={canApproveProducer} loading={pending === "producer"} onToggle={() => toggle("producer", !booking.producerApproved)} />
        <Button variant="quiet" iconOnly icon={<Trash2 className="size-[12px]" aria-hidden="true" />} aria-label={`Cancel ${booking.itemName} booking`} disabled={pending !== null} onClick={() => setCancelOpen(true)} />
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel booking — {booking.itemName}</DialogTitle>
          </DialogHeader>
          <Input label="Reason" placeholder="e.g. Not needed this day" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={pending !== null}>
              Never mind
            </Button>
            <Button variant="destructive" loading={pending === "cancel"} disabled={pending !== null} onClick={onCancel}>
              Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function ShootDayGroup({
  productionId,
  day,
  bookings,
  catalogItems,
  canApproveDop,
  canApproveDirector,
  canApproveProducer,
  onChanged,
}: {
  productionId: string;
  day: ShootDayOption;
  bookings: BookingRow[];
  catalogItems: CatalogItemRow[];
  canApproveDop: boolean;
  canApproveDirector: boolean;
  canApproveProducer: boolean;
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const total = bookings.reduce((sum, b) => sum + lineCost(b), 0);
  const currency = bookings.find((b) => b.currency)?.currency ?? "";

  return (
    <div className="flex flex-col gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)]">
      <div className="flex items-center justify-between gap-[var(--fs-space-16)] border-b border-[var(--color-border-subtle)] p-[var(--fs-space-12)]">
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            Day {day.dayNumber} <span className="font-normal text-[var(--color-text-tertiary)]">· {day.date}</span>
          </p>
          {bookings.length > 0 && (
            <p className="text-[12px] text-[var(--color-text-tertiary)]">
              {bookings.length} item{bookings.length === 1 ? "" : "s"} · {formatMoney(String(total), currency)} total
            </p>
          )}
        </div>
        <Button variant="quiet" icon={<Plus className="size-[12px]" aria-hidden="true" />} onClick={() => setDialogOpen(true)} disabled={catalogItems.length === 0}>
          Book equipment
        </Button>
      </div>
      {bookings.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
          {bookings.map((b) => (
            <BookingRowItem key={b.id} productionId={productionId} booking={b} canApproveDop={canApproveDop} canApproveDirector={canApproveDirector} canApproveProducer={canApproveProducer} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <AddBookingDialog productionId={productionId} shootDayId={day.id} catalogItems={catalogItems} open={dialogOpen} onOpenChange={setDialogOpen} onAdded={onChanged} />
    </div>
  );
}

function BookingsByDay({
  productionId,
  shootDays,
  bookings,
  catalogItems,
  canApproveDop,
  canApproveDirector,
  canApproveProducer,
  onChanged,
}: {
  productionId: string;
  shootDays: ShootDayOption[];
  bookings: BookingRow[];
  catalogItems: CatalogItemRow[];
  canApproveDop: boolean;
  canApproveDirector: boolean;
  canApproveProducer: boolean;
  onChanged: () => void;
}) {
  const bookingsByDay = React.useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const list = map.get(b.shootDayId) ?? [];
      list.push(b);
      map.set(b.shootDayId, list);
    }
    return map;
  }, [bookings]);

  if (shootDays.length === 0) {
    return <EmptyState icon={<Package className="size-full" />} title="No shoot days yet" description="Create shoot days before booking equipment against them." />;
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-12)]">
      {shootDays.map((day) => (
        <ShootDayGroup
          key={day.id}
          productionId={productionId}
          day={day}
          bookings={bookingsByDay.get(day.id) ?? []}
          catalogItems={catalogItems}
          canApproveDop={canApproveDop}
          canApproveDirector={canApproveDirector}
          canApproveProducer={canApproveProducer}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

export function EquipmentSection({
  production,
  scenes,
  userEmail,
  productionId,
  shootDays,
  vendors,
  catalogItems,
  bookings,
  canApproveDop,
  canApproveDirector,
  canApproveProducer,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | undefined;
  productionId: string;
  shootDays: ShootDayOption[];
  vendors: VendorRow[];
  catalogItems: CatalogItemRow[];
  bookings: BookingRow[];
  canApproveDop: boolean;
  canApproveDirector: boolean;
  canApproveProducer: boolean;
}) {
  const router = useRouter();
  const onChanged = React.useCallback(() => router.refresh(), [router]);

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Equipment</h1>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Vendors</h2>
            <ImportPanel productionId={productionId} entityType="equipmentVendor" />
          </div>
          <VendorsList productionId={productionId} vendors={vendors} onChanged={onChanged} />
        </section>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Approved equipment list</h2>
            <ImportPanel productionId={productionId} entityType="equipmentCatalogItem" />
          </div>
          <CatalogList productionId={productionId} vendors={vendors} catalogItems={catalogItems} canApproveDop={canApproveDop} onChanged={onChanged} />
        </section>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Booked by shoot day</h2>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">Only book what a day actually needs — drop anything (a Steadicam, extra lighting) that isn&apos;t required to keep spend and truck load lean.</p>
          <BookingsByDay
            productionId={productionId}
            shootDays={shootDays}
            bookings={bookings}
            catalogItems={catalogItems}
            canApproveDop={canApproveDop}
            canApproveDirector={canApproveDirector}
            canApproveProducer={canApproveProducer}
            onChanged={onChanged}
          />
        </section>
      </div>
    </Shell>
  );
}
