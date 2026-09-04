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
  createMenuItem,
  createVendor,
  deleteDietaryProfile,
  deleteDietaryRequirement,
  deleteMealService,
  deleteMenuItem,
  deleteVendor,
  removeServiceAssignment,
  updateDietaryProfile,
  updateMealServiceDetails,
  updateMenuItem,
  type CateringOrderItemInput,
  type DietaryPreferencesInput,
  type HospitalityDetailsInput,
  type MenuItemInput,
  type VendorInput,
} from "./actions";
import {
  MENU_CATEGORIES,
  MENU_DIET_TYPES,
  PACKAGING_TYPES,
  PROFILE_DIET_TYPES,
  SERVICE_STYLES,
  SPICE_LEVELS,
  CATERING_CURRENCIES,
} from "./constants";

export interface DietaryProfileRow {
  id: string;
  personType: "CAST" | "CREW";
  personId: string;
  personName: string;
  notes: string;
  dietType: string;
  beveragePreference: string;
  spicePreference: string;
  requirements: { id: string; type: string; severity: string }[];
}

export interface MealServiceRow {
  id: string;
  date: string;
  mealType: string;
  locationId: string | null;
  locationName: string | null;
  serviceStyle: string;
  packagingType: string;
  serviceTime: string;
  headcountConfirmed: number | null;
  hospitalityNotes: string;
  assignments: { id: string; name: string; personType: "CAST" | "CREW" }[];
  dietarySummary: Record<string, number>;
  orders: { id: string; vendorName: string | null; notes: string; status: string; items: { menuItemId: string; name: string; quantity: number }[] }[];
}

export interface VendorRow {
  id: string;
  name: string;
  contact: string;
  contractTerms: string;
}

export interface MenuItemRow {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  category: string;
  cuisine: string;
  dietType: string;
  spiceLevel: string;
  packagingType: string;
  price: string | null;
  currency: string;
  notes: string;
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

/** "NON_VEGETARIAN" -> "Non vegetarian", "PACKED_BOXES" -> "Packed boxes". */
function formatEnumLabel(value: string): string {
  const words = value.split("_").map((w) => w.toLowerCase());
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

const emptyPreferences: DietaryPreferencesInput = { notes: "", dietType: "", beveragePreference: "", spicePreference: "" };

function EnumSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">{label}</label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {formatEnumLabel(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  const [prefs, setPrefs] = React.useState<DietaryPreferencesInput>(emptyPreferences);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editPrefs, setEditPrefs] = React.useState<DietaryPreferencesInput>(emptyPreferences);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const people = personType === "CAST" ? castMembers : crewMembers;
  const assignedIds = new Set(profiles.filter((p) => p.personType === personType).map((p) => p.personId));
  const availablePeople = people.filter((p) => !assignedIds.has(p.id));

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDietaryProfile(productionId, personType, personId, prefs);
      toast({ tone: "success", title: "Dietary profile added" });
      setPersonId("");
      setPrefs(emptyPreferences);
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add profile", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(profile: DietaryProfileRow) {
    setEditingId(profile.id);
    setEditPrefs({ notes: profile.notes, dietType: profile.dietType, beveragePreference: profile.beveragePreference, spicePreference: profile.spicePreference });
  }

  async function onSaveEdit(profileId: string) {
    setSaving(true);
    try {
      await updateDietaryProfile(productionId, profileId, editPrefs);
      toast({ tone: "success", title: "Preferences updated" });
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't update preferences", description: err instanceof Error ? err.message : "Please try again." });
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
          Named dietary/allergy information and food &amp; beverage preferences. Visible to Producers only — everyone else sees anonymized headcounts per meal service below.
        </p>
      </div>

      {profiles.length === 0 && !adding && (
        <EmptyState icon={<ChefHat className="size-full" />} title="No dietary profiles yet" description="Add a profile to track allergies, diet type, and beverage preferences." action={<Button onClick={() => setAdding(true)}>Add profile</Button>} />
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
                <div className="flex items-center gap-[4px]">
                  <Button variant="quiet" onClick={() => startEdit(profile)}>
                    Preferences
                  </Button>
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
              </div>
              {(profile.dietType || profile.beveragePreference || profile.spicePreference) && (
                <div className="flex flex-wrap items-center gap-[6px] pl-[28px]">
                  {profile.dietType && <StatusBadge tone="info">{formatEnumLabel(profile.dietType)}</StatusBadge>}
                  {profile.spicePreference && <StatusBadge tone="neutral">{formatEnumLabel(profile.spicePreference)} spice</StatusBadge>}
                  {profile.beveragePreference && <span className="text-[11px] text-[var(--color-text-tertiary)]">{profile.beveragePreference}</span>}
                </div>
              )}
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
          <EnumSelect label="Diet" value={prefs.dietType} onChange={(v) => setPrefs({ ...prefs, dietType: v })} options={PROFILE_DIET_TYPES} placeholder="Optional" />
          <EnumSelect label="Spice" value={prefs.spicePreference} onChange={(v) => setPrefs({ ...prefs, spicePreference: v })} options={SPICE_LEVELS} placeholder="Optional" />
          <Input label="Beverage preference" placeholder="Optional" value={prefs.beveragePreference} onChange={(e) => setPrefs({ ...prefs, beveragePreference: e.target.value })} containerClassName="min-w-[160px] flex-1" />
          <Input label="Notes" placeholder="Optional" value={prefs.notes} onChange={(e) => setPrefs({ ...prefs, notes: e.target.value })} containerClassName="min-w-[160px] flex-1" />
          <Button type="submit" loading={saving} disabled={saving || !personId}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
            Cancel
          </Button>
        </form>
      )}

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Food &amp; beverage preferences</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-[var(--fs-space-12)]">
            <div className="flex flex-wrap gap-[var(--fs-space-8)]">
              <EnumSelect label="Diet" value={editPrefs.dietType} onChange={(v) => setEditPrefs({ ...editPrefs, dietType: v })} options={PROFILE_DIET_TYPES} placeholder="Not set" />
              <EnumSelect label="Spice" value={editPrefs.spicePreference} onChange={(v) => setEditPrefs({ ...editPrefs, spicePreference: v })} options={SPICE_LEVELS} placeholder="Not set" />
            </div>
            <Input label="Beverage preference" placeholder="e.g. No alcohol, still water only" value={editPrefs.beveragePreference} onChange={(e) => setEditPrefs({ ...editPrefs, beveragePreference: e.target.value })} />
            <Input label="Notes" placeholder="Optional" value={editPrefs.notes} onChange={(e) => setEditPrefs({ ...editPrefs, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} disabled={saving} onClick={() => editingId && onSaveEdit(editingId)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

const emptyMenuItemForm: MenuItemInput = { vendorId: "", name: "", category: "", cuisine: "", dietType: "", spiceLevel: "", packagingType: "", price: "", currency: "", notes: "" };

function formatMenuPrice(price: string | null, currency: string) {
  if (!price) return null;
  return currency ? `${currency} ${Number(price).toFixed(2)}` : Number(price).toFixed(2);
}

function MenuItemForm({ value, onChange, vendors }: { value: MenuItemInput; onChange: (next: MenuItemInput) => void; vendors: VendorRow[] }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Item" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[160px] flex-1" />
      <div className="flex min-w-[140px] flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Vendor</label>
        <Select value={value.vendorId || undefined} onValueChange={(v) => onChange({ ...value, vendorId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Optional" />
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
      <EnumSelect label="Category" value={value.category} onChange={(v) => onChange({ ...value, category: v })} options={MENU_CATEGORIES} placeholder="Optional" />
      <Input label="Cuisine" placeholder="Optional" value={value.cuisine} onChange={(e) => onChange({ ...value, cuisine: e.target.value })} containerClassName="w-[120px]" />
      <EnumSelect label="Diet" value={value.dietType} onChange={(v) => onChange({ ...value, dietType: v })} options={MENU_DIET_TYPES} placeholder="Optional" />
      <EnumSelect label="Spice" value={value.spiceLevel} onChange={(v) => onChange({ ...value, spiceLevel: v })} options={SPICE_LEVELS} placeholder="Optional" />
      <EnumSelect label="Packaging" value={value.packagingType} onChange={(v) => onChange({ ...value, packagingType: v })} options={PACKAGING_TYPES} placeholder="Optional" />
      <Input label="Price" placeholder="Optional" value={value.price} onChange={(e) => onChange({ ...value, price: e.target.value })} containerClassName="w-[90px]" />
      <div className="flex w-[90px] flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Currency</label>
        <Select value={value.currency || undefined} onValueChange={(v) => onChange({ ...value, currency: v })}>
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {CATERING_CURRENCIES.map((c) => (
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

function MenuItemsSection({ productionId, items, vendors, onChanged }: { productionId: string; items: MenuItemRow[]; vendors: VendorRow[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState<MenuItemInput>(emptyMenuItemForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<MenuItemInput>(emptyMenuItemForm);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMenuItem(productionId, form);
      toast({ tone: "success", title: "Menu item added", description: form.name });
      setForm(emptyMenuItemForm);
      setAdding(false);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add item", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: MenuItemRow) {
    setEditingId(item.id);
    setEditForm({
      vendorId: item.vendorId,
      name: item.name,
      category: item.category,
      cuisine: item.cuisine,
      dietType: item.dietType,
      spiceLevel: item.spiceLevel,
      packagingType: item.packagingType,
      price: item.price ?? "",
      currency: item.currency,
      notes: item.notes,
    });
  }

  async function onSaveEdit(id: string) {
    setSaving(true);
    try {
      await updateMenuItem(productionId, id, editForm);
      toast({ tone: "success", title: "Menu item updated" });
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't update item", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: MenuItemRow) {
    setPendingId(item.id);
    try {
      await deleteMenuItem(productionId, item.id);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove item", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {items.length === 0 && !adding && (
        <EmptyState icon={<UtensilsCrossed className="size-full" />} title="No menu items yet" description="Build a menu catalog to itemize catering orders." action={<Button onClick={() => setAdding(true)}>Add item</Button>} />
      )}

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[6px]">
                  <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{item.name}</p>
                  {item.category && <StatusBadge tone="neutral">{formatEnumLabel(item.category)}</StatusBadge>}
                  {item.dietType && <StatusBadge tone="info">{formatEnumLabel(item.dietType)}</StatusBadge>}
                  {item.spiceLevel && <StatusBadge tone="warning">{formatEnumLabel(item.spiceLevel)}</StatusBadge>}
                </div>
                <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                  {[item.vendorName, item.cuisine, item.packagingType && formatEnumLabel(item.packagingType), formatMenuPrice(item.price, item.currency)].filter(Boolean).join(" · ") || "No details on file"}
                </p>
              </div>
              <div className="flex items-center gap-[4px]">
                <Button variant="quiet" iconOnly icon={<Plus className="size-[14px] rotate-45" aria-hidden="true" />} aria-label={`Edit ${item.name}`} onClick={() => startEdit(item)} />
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
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add item
        </Button>
      )}

      {adding && (
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)]">
          <MenuItemForm value={form} onChange={setForm} vendors={vendors} />
          <div className="flex gap-[var(--fs-space-8)]">
            <Button type="submit" loading={saving} disabled={saving || !form.name.trim()}>
              Add
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit menu item</DialogTitle>
          </DialogHeader>
          <MenuItemForm value={editForm} onChange={setEditForm} vendors={vendors} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} disabled={saving || !editForm.name.trim()} onClick={() => editingId && onSaveEdit(editingId)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ServiceOrders({ productionId, service, vendors, menuItems, onChanged }: { productionId: string; service: MealServiceRow; vendors: VendorRow[]; menuItems: MenuItemRow[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [vendorId, setVendorId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<CateringOrderItemInput[]>([]);
  const [pickerItemId, setPickerItemId] = React.useState("");
  const [pickerQuantity, setPickerQuantity] = React.useState("1");
  const [saving, setSaving] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  function addItemLine() {
    if (!pickerItemId) return;
    const quantity = Math.max(1, Number(pickerQuantity) || 1);
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === pickerItemId);
      if (existing) return prev.map((i) => (i.menuItemId === pickerItemId ? { ...i, quantity: i.quantity + quantity } : i));
      return [...prev, { menuItemId: pickerItemId, quantity }];
    });
    setPickerItemId("");
    setPickerQuantity("1");
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCateringOrder(productionId, service.id, vendorId, "", items);
      toast({ tone: "success", title: "Order created" });
      setVendorId(null);
      setItems([]);
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
        <div key={order.id} className="flex flex-col gap-[2px]">
          <div className="flex items-center justify-between gap-[var(--fs-space-8)]">
            <p className="text-[12px] text-[var(--color-text-secondary)]">{order.vendorName ?? "No vendor set"}</p>
            <div className="flex items-center gap-[var(--fs-space-8)]">
              <StatusBadge tone={orderStatusTone[order.status] ?? "neutral"}>{order.status}</StatusBadge>
              {order.status !== "CANCELLED" && (
                <Button variant="quiet" iconOnly icon={<Trash2 className="size-[12px]" aria-hidden="true" />} aria-label="Cancel order" onClick={() => setCancellingId(order.id)} />
              )}
            </div>
          </div>
          {order.items.length > 0 && (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
          )}
        </div>
      ))}
      {adding ? (
        <form onSubmit={onAdd} className="flex flex-col gap-[6px]">
          <div className="flex items-center gap-[6px]">
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
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-[6px]">
              {items.map((i) => (
                <span key={i.menuItemId} className="flex items-center gap-[4px] rounded-full border border-[var(--color-border-subtle)] px-[8px] py-[1px] text-[11px] text-[var(--color-text-secondary)]">
                  {i.quantity}× {menuItemById.get(i.menuItemId)?.name ?? "Unknown item"}
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => setItems((prev) => prev.filter((p) => p.menuItemId !== i.menuItemId))}
                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                  >
                    <X className="size-[10px]" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {menuItems.length > 0 && (
            <div className="flex items-center gap-[6px]">
              <Select value={pickerItemId || undefined} onValueChange={setPickerItemId}>
                <SelectTrigger className="h-[26px] w-[160px] text-[11px]">
                  <SelectValue placeholder="Add a menu item" />
                </SelectTrigger>
                <SelectContent>
                  {menuItems.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input aria-label="Quantity" type="number" min={1} value={pickerQuantity} onChange={(e) => setPickerQuantity(e.target.value)} containerClassName="w-[60px]" className="h-[26px] text-[11px]" />
              <Button type="button" variant="quiet" icon={<Plus className="size-[10px]" aria-hidden="true" />} onClick={addItemLine} disabled={!pickerItemId}>
                Add item
              </Button>
            </div>
          )}
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

const emptyHospitality: HospitalityDetailsInput = { serviceStyle: "", packagingType: "", serviceTime: "", headcountConfirmed: "", hospitalityNotes: "" };

function HospitalityFields({ value, onChange }: { value: HospitalityDetailsInput; onChange: (next: HospitalityDetailsInput) => void }) {
  return (
    <>
      <div className="flex flex-wrap gap-[var(--fs-space-8)]">
        <EnumSelect label="Service style" value={value.serviceStyle} onChange={(v) => onChange({ ...value, serviceStyle: v })} options={SERVICE_STYLES} placeholder="Optional" />
        <EnumSelect label="Packaging" value={value.packagingType} onChange={(v) => onChange({ ...value, packagingType: v })} options={PACKAGING_TYPES} placeholder="Optional" />
      </div>
      <div className="flex flex-wrap gap-[var(--fs-space-8)]">
        <Input label="Service time" placeholder="e.g. 12:30 PM" value={value.serviceTime} onChange={(e) => onChange({ ...value, serviceTime: e.target.value })} containerClassName="flex-1" />
        <Input label="Confirmed headcount" placeholder="Optional" type="number" min={0} value={value.headcountConfirmed} onChange={(e) => onChange({ ...value, headcountConfirmed: e.target.value })} containerClassName="w-[140px]" />
      </div>
      <Input label="Hospitality notes" placeholder="Setup, staffing, or other requirements" value={value.hospitalityNotes} onChange={(e) => onChange({ ...value, hospitalityNotes: e.target.value })} />
    </>
  );
}

function NewServiceDialog({ productionId, locations, open, onOpenChange, onCreated }: { productionId: string; locations: PersonOption[]; open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = React.useState("");
  const [mealType, setMealType] = React.useState<"BREAKFAST" | "LUNCH" | "DINNER" | "CRAFT">("LUNCH");
  const [locationId, setLocationId] = React.useState<string | null>(null);
  const [hospitality, setHospitality] = React.useState<HospitalityDetailsInput>(emptyHospitality);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDate("");
      setMealType("LUNCH");
      setLocationId(null);
      setHospitality(emptyHospitality);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMealService(productionId, date, mealType, locationId, hospitality);
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
          <HospitalityFields value={hospitality} onChange={setHospitality} />
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
  menuItems,
  locations,
  castMembers,
  crewMembers,
  onChanged,
}: {
  productionId: string;
  mealServices: MealServiceRow[];
  vendors: VendorRow[];
  menuItems: MenuItemRow[];
  locations: PersonOption[];
  castMembers: PersonOption[];
  crewMembers: PersonOption[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [newOpen, setNewOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editHospitality, setEditHospitality] = React.useState<HospitalityDetailsInput>(emptyHospitality);
  const [saving, setSaving] = React.useState(false);

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

  function startEditHospitality(service: MealServiceRow) {
    setEditingId(service.id);
    setEditHospitality({
      serviceStyle: service.serviceStyle,
      packagingType: service.packagingType,
      serviceTime: service.serviceTime,
      headcountConfirmed: service.headcountConfirmed?.toString() ?? "",
      hospitalityNotes: service.hospitalityNotes,
    });
  }

  async function onSaveHospitality(serviceId: string) {
    setSaving(true);
    try {
      await updateMealServiceDetails(productionId, serviceId, editHospitality);
      toast({ tone: "success", title: "Service details updated" });
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't update details", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
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
                        {service.serviceTime && ` · ${service.serviceTime}`}
                      </p>
                      <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{service.locationName ?? "No location set"}</p>
                    </div>
                    <div className="flex items-center gap-[4px]">
                      <Button variant="quiet" onClick={() => startEditHospitality(service)}>
                        Service details
                      </Button>
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
                  </div>

                  {(service.serviceStyle || service.packagingType || service.headcountConfirmed !== null || service.hospitalityNotes) && (
                    <div className="flex flex-wrap items-center gap-[6px] pl-[16px]">
                      {service.serviceStyle && <StatusBadge tone="neutral">{formatEnumLabel(service.serviceStyle)}</StatusBadge>}
                      {service.packagingType && <StatusBadge tone="neutral">{formatEnumLabel(service.packagingType)}</StatusBadge>}
                      {service.headcountConfirmed !== null && <span className="text-[11px] text-[var(--color-text-tertiary)]">{service.headcountConfirmed} confirmed</span>}
                      {service.hospitalityNotes && <span className="text-[11px] text-[var(--color-text-tertiary)]">{service.hospitalityNotes}</span>}
                    </div>
                  )}

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
                  <ServiceOrders productionId={productionId} service={service} vendors={vendors} menuItems={menuItems} onChanged={onChanged} />
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

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Service details</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-[var(--fs-space-12)]">
            <HospitalityFields value={editHospitality} onChange={setEditHospitality} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} disabled={saving} onClick={() => editingId && onSaveHospitality(editingId)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  menuItems,
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
  menuItems: MenuItemRow[];
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
          <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Menu</h2>
            <ImportPanel productionId={productionId} entityType="cateringMenuItem" />
          </div>
          <MenuItemsSection productionId={productionId} items={menuItems} vendors={vendors} onChanged={onChanged} />
        </section>

        <section className="flex flex-col gap-[var(--fs-space-12)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Meal Services</h2>
          <MealServicesSection
            productionId={productionId}
            mealServices={mealServices}
            vendors={vendors}
            menuItems={menuItems}
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
