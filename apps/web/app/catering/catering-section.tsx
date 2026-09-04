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
import { ChefHat, Plus, ShieldAlert, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  addDietaryRequirement,
  addServiceAssignment,
  cancelCateringOrder,
  createCateringOrder,
  createDietaryProfile,
  createMealService,
  createVendor,
  deleteDietaryProfile,
  deleteDietaryRequirement,
  deleteMealService,
  deleteVendor,
  removeServiceAssignment,
  type VendorInput,
} from "./actions";

export interface DietaryProfileRow {
  id: string;
  personType: "CAST" | "CREW";
  personId: string;
  personName: string;
  notes: string;
  requirements: { id: string; type: string; severity: string }[];
}

export interface MealServiceRow {
  id: string;
  date: string;
  mealType: string;
  locationId: string | null;
  locationName: string | null;
  assignments: { id: string; name: string; personType: "CAST" | "CREW" }[];
  dietarySummary: Record<string, number>;
  orders: { id: string; vendorName: string | null; notes: string; status: string }[];
}

export interface VendorRow {
  id: string;
  name: string;
  contact: string;
  contractTerms: string;
}

export interface PersonOption {
  id: string;
  name: string;
}

const severityTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PREFERENCE: "neutral",
  MILD: "warning",
  SEVERE: "danger",
};

const orderStatusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  BOOKED: "success",
  REQUESTED: "warning",
  CANCELLED: "danger",
  COMPLETED: "neutral",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMealType(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function RequirementsEditor({ productionId, profile, onChanged }: { productionId: string; profile: DietaryProfileRow; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [type, setType] = React.useState("");
  const [severity, setSeverity] = React.useState<"PREFERENCE" | "MILD" | "SEVERE">("PREFERENCE");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setPendingId("new");
    try {
      await addDietaryRequirement(productionId, profile.id, type, severity);
      setType("");
      setSeverity("PREFERENCE");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add requirement", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(requirementId: string) {
    setPendingId(requirementId);
    try {
      await deleteDietaryRequirement(productionId, profile.id, requirementId);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove requirement", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--fs-space-8)] pl-[28px]">
      {profile.requirements.map((r) => (
        <StatusBadge key={r.id} tone={severityTone[r.severity] ?? "neutral"}>
          <span className="flex items-center gap-[4px]">
            {r.type}
            <button type="button" aria-label={`Remove ${r.type}`} onClick={() => onDelete(r.id)} disabled={pendingId !== null} className="hover:opacity-70">
              <X className="size-[10px]" aria-hidden="true" />
            </button>
          </span>
        </StatusBadge>
      ))}
      {adding ? (
        <form onSubmit={onAdd} className="flex items-end gap-[var(--fs-space-8)]">
          <Input label="Requirement" placeholder="e.g. Nut allergy" value={type} onChange={(e) => setType(e.target.value)} containerClassName="w-[160px]" />
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Severity</label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PREFERENCE">Preference</SelectItem>
                <SelectItem value="MILD">Mild</SelectItem>
                <SelectItem value="SEVERE">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" loading={pendingId === "new"} disabled={pendingId !== null}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={pendingId !== null}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button variant="quiet" icon={<Plus className="size-[12px]" aria-hidden="true" />} onClick={() => setAdding(true)}>
          Add requirement
        </Button>
      )}
    </div>
  );
}

function DietaryProfilesSection({
  productionId,
  profiles,
  castMembers,
  crewMembers,
  onChanged,
}: {
  productionId: string;
  profiles: DietaryProfileRow[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [personType, setPersonType] = React.useState<"CAST" | "CREW">("CREW");
  const [personId, setPersonId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const people = personType === "CAST" ? castMembers : crewMembers;
  const assignedIds = new Set(profiles.filter((p) => p.personType === personType).map((p) => p.personId));
  const availablePeople = people.filter((p) => !assignedIds.has(p.id));

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDietaryProfile(productionId, personType, personId, notes);
      toast({ tone: "success", title: "Dietary profile added" });
      setPersonId("");
      setNotes("");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add profile", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(profile: DietaryProfileRow) {
    setPendingId(profile.id);
    try {
      await deleteDietaryProfile(productionId, profile.id);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove profile", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      <div className="flex items-start gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-background-surface)] p-[var(--fs-space-12)]">
        <ShieldAlert className="size-[16px] shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          Named dietary/allergy information. Visible to Producers only — everyone else sees anonymized headcounts per meal service below.
        </p>
      </div>

      {profiles.length === 0 && !adding && (
        <EmptyState icon={<ChefHat className="size-full" />} title="No dietary profiles yet" description="Add a profile to track allergies and dietary requirements." action={<Button onClick={() => setAdding(true)}>Add profile</Button>} />
      )}

      {profiles.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {profiles.map((profile) => (
            <li key={profile.id} className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
              <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{profile.personName}</p>
                  {profile.notes && <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{profile.notes}</p>}
                </div>
                <Button
                  variant="quiet"
                  iconOnly
                  icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                  aria-label={`Remove ${profile.personName}'s profile`}
                  loading={pendingId === profile.id}
                  disabled={pendingId !== null}
                  onClick={() => onDelete(profile)}
                />
              </div>
              <RequirementsEditor productionId={productionId} profile={profile} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}

      {profiles.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add profile
        </Button>
      )}

      {adding && (
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap">
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Who</label>
            <Select value={personType} onValueChange={(v) => { setPersonType(v as "CAST" | "CREW"); setPersonId(""); }}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAST">Cast</SelectItem>
                <SelectItem value="CREW">Crew</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Person</label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a person" />
              </SelectTrigger>
              <SelectContent>
                {availablePeople.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} containerClassName="min-w-[160px] flex-1" />
          <Button type="submit" loading={saving} disabled={saving || !personId}>
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

const emptyVendorForm: VendorInput = { name: "", contact: "", contractTerms: "" };

function VendorsSection({ productionId, vendors, onChanged }: { productionId: string; vendors: VendorRow[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState<VendorInput>(emptyVendorForm);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createVendor(productionId, form);
      toast({ tone: "success", title: "Vendor added", description: form.name });
      setForm(emptyVendorForm);
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
      await deleteVendor(productionId, vendor.id);
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
        <EmptyState icon={<ChefHat className="size-full" />} title="No vendors yet" description="Add a catering vendor before creating an order." action={<Button onClick={() => setAdding(true)}>Add vendor</Button>} />
      )}
      {vendors.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {vendors.map((vendor) => (
            <li key={vendor.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{vendor.name}</p>
                {vendor.contact && <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{vendor.contact}</p>}
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
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} containerClassName="min-w-[160px] flex-1" />
          <Input label="Contact" placeholder="Optional" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} containerClassName="min-w-[160px] flex-1" />
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

function ServiceAssignments({ productionId, service, castMembers, crewMembers, onChanged }: { productionId: string; service: MealServiceRow; castMembers: PersonOption[]; crewMembers: PersonOption[]; onChanged: () => void }) {
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
      await addServiceAssignment(productionId, service.id, personType, personId);
      setPersonId("");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add person", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onRemove(assignmentId: string) {
    setPendingId(assignmentId);
    try {
      await removeServiceAssignment(productionId, service.id, assignmentId);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove person", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {service.assignments.map((a) => (
        <span key={a.id} className="flex items-center gap-[4px] rounded-full border border-[var(--color-border-subtle)] px-[8px] py-[1px] text-[11px] text-[var(--color-text-secondary)]">
          {a.name}
          <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onRemove(a.id)} disabled={pendingId !== null} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]">
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
          Person
        </Button>
      )}
    </div>
  );
}

function ServiceOrders({ productionId, service, vendors, onChanged }: { productionId: string; service: MealServiceRow; vendors: VendorRow[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [vendorId, setVendorId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCateringOrder(productionId, service.id, vendorId, "");
      toast({ tone: "success", title: "Order created" });
      setVendorId(null);
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't create order", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(orderId: string) {
    setSaving(true);
    try {
      await cancelCateringOrder(productionId, orderId, reason);
      toast({ title: "Order cancelled" });
      setReason("");
      setCancellingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't cancel order", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-[6px] pl-[16px]">
      {service.orders.map((order) => (
        <div key={order.id} className="flex items-center justify-between gap-[var(--fs-space-8)]">
          <p className="text-[12px] text-[var(--color-text-secondary)]">{order.vendorName ?? "No vendor set"}</p>
          <div className="flex items-center gap-[var(--fs-space-8)]">
            <StatusBadge tone={orderStatusTone[order.status] ?? "neutral"}>{order.status}</StatusBadge>
            {order.status !== "CANCELLED" && (
              <Button variant="quiet" iconOnly icon={<Trash2 className="size-[12px]" aria-hidden="true" />} aria-label="Cancel order" onClick={() => setCancellingId(order.id)} />
            )}
          </div>
        </div>
      ))}
      {adding ? (
        <form onSubmit={onAdd} className="flex items-center gap-[6px]">
          <Select value={vendorId ?? undefined} onValueChange={setVendorId}>
            <SelectTrigger className="h-[26px] w-[160px] text-[11px]">
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
          <Button type="submit" loading={saving} disabled={saving}>
            Order
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
            <X className="size-[12px]" aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <Button variant="quiet" icon={<Plus className="size-[10px]" aria-hidden="true" />} onClick={() => setAdding(true)}>
          Order from vendor
        </Button>
      )}

      <Dialog open={cancellingId !== null} onOpenChange={(open) => !open && setCancellingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this catering order?</DialogTitle>
          </DialogHeader>
          <Input label="Reason" placeholder="Optional" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancellingId(null)} disabled={saving}>
              Never mind
            </Button>
            <Button variant="destructive" loading={saving} disabled={saving} onClick={() => cancellingId && onCancel(cancellingId)}>
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewServiceDialog({ productionId, locations, open, onOpenChange, onCreated }: { productionId: string; locations: PersonOption[]; open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = React.useState("");
  const [mealType, setMealType] = React.useState<"BREAKFAST" | "LUNCH" | "DINNER" | "CRAFT">("LUNCH");
  const [locationId, setLocationId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDate("");
      setMealType("LUNCH");
      setLocationId(null);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMealService(productionId, date, mealType, locationId);
      toast({ tone: "success", title: "Meal service created" });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't create meal service", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New meal service</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)]">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Meal</label>
            <Select value={mealType} onValueChange={(v) => setMealType(v as typeof mealType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BREAKFAST">Breakfast</SelectItem>
                <SelectItem value="LUNCH">Lunch</SelectItem>
                <SelectItem value="DINNER">Dinner</SelectItem>
                <SelectItem value="CRAFT">Craft service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Location</label>
            <Select value={locationId ?? undefined} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
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
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving || !date}>
              Create service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MealServicesSection({
  productionId,
  mealServices,
  vendors,
  locations,
  castMembers,
  crewMembers,
  onChanged,
}: {
  productionId: string;
  mealServices: MealServiceRow[];
  vendors: VendorRow[];
  locations: PersonOption[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [newOpen, setNewOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onDelete(serviceId: string) {
    setPendingId(serviceId);
    try {
      await deleteMealService(productionId, serviceId);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove service", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {mealServices.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="size-full" />} title="No meal services yet" description="Create a meal service to plan a shoot day's food." action={<Button onClick={() => setNewOpen(true)}>New meal service</Button>} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
            {mealServices.map((service) => {
              const summaryEntries = Object.entries(service.dietarySummary);
              return (
                <li key={service.id} className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                        {formatMealType(service.mealType)} · {formatDate(service.date)}
                      </p>
                      <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{service.locationName ?? "No location set"}</p>
                    </div>
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                      aria-label="Remove meal service"
                      loading={pendingId === service.id}
                      disabled={pendingId !== null}
                      onClick={() => onDelete(service.id)}
                    />
                  </div>

                  {summaryEntries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-[6px] pl-[16px]">
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">Dietary summary (anonymized):</span>
                      {summaryEntries.map(([severity, count]) => (
                        <StatusBadge key={severity} tone={severityTone[severity] ?? "neutral"}>
                          {count} {severity.toLowerCase()}
                        </StatusBadge>
                      ))}
                    </div>
                  )}

                  <ServiceAssignments productionId={productionId} service={service} castMembers={castMembers} crewMembers={crewMembers} onChanged={onChanged} />
                  <ServiceOrders productionId={productionId} service={service} vendors={vendors} onChanged={onChanged} />
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" onClick={() => setNewOpen(true)} className="self-start">
            New meal service
          </Button>
        </>
      )}
      <NewServiceDialog productionId={productionId} locations={locations} open={newOpen} onOpenChange={setNewOpen} onCreated={onChanged} />
    </div>
  );
}

export function CateringSection({
  production,
  scenes,
  userEmail,
  productionId,
  isProducer,
  vendors,
  mealServices,
  dietaryProfiles,
  locations,
  castMembers,
  crewMembers,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | undefined;
  productionId: string;
  isProducer: boolean;
  vendors: VendorRow[];
  mealServices: MealServiceRow[];
  dietaryProfiles: DietaryProfileRow[];
  locations: PersonOption[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
}) {
  const router = useRouter();
  const onChanged = React.useCallback(() => router.refresh(), [router]);

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Catering</h1>

        {isProducer && (
          <section className="flex flex-col gap-[var(--fs-space-12)]">
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Dietary Profiles</h2>
            <DietaryProfilesSection productionId={productionId} profiles={dietaryProfiles} castMembers={castMembers} crewMembers={crewMembers} onChanged={onChanged} />
          </section>
        )}

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Vendors</h2>
            <ImportPanel productionId={productionId} entityType="vendor" />
          </div>
          <VendorsSection productionId={productionId} vendors={vendors} onChanged={onChanged} />
        </section>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Meal Services</h2>
          <MealServicesSection
            productionId={productionId}
            mealServices={mealServices}
            vendors={vendors}
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
