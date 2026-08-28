"use client";

import type { CastMember, Character } from "@filmset/core";
import {
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Textarea,
  ToastAction,
  useToast,
} from "@filmset/ui";
import { ChevronDown, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createCastMember, deleteCastMember, updateCastMember, type CastMemberInput } from "./actions";

const STATUSES: CastMember["status"][] = ["Confirmed", "Offer Out", "Unavailable"];
const CONTRACTS: CastMember["contract"][] = ["Signed", "Pending", "Missing"];

const statusTone: Record<CastMember["status"], "success" | "warning" | "danger"> = {
  Confirmed: "success",
  "Offer Out": "warning",
  Unavailable: "danger",
};
const contractTone: Record<CastMember["contract"], "success" | "warning" | "danger"> = {
  Signed: "success",
  Pending: "warning",
  Missing: "danger",
};

const emptyForm: CastMemberInput = {
  characterName: "",
  actorName: "",
  status: "Offer Out",
  contract: "Pending",
  email: "",
  phone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  agentName: "",
  agentPhone: "",
  agentEmail: "",
  height: "",
  shirtSize: "",
  pantSize: "",
  shoeSize: "",
  sizingNotes: "",
};

function hasContactDetails(value: CastMemberInput): boolean {
  return Boolean(
    value.email || value.phone || value.emergencyContactName || value.emergencyContactPhone || value.agentName || value.agentPhone || value.agentEmail,
  );
}

function hasSizingDetails(value: CastMemberInput): boolean {
  return Boolean(value.height || value.shirtSize || value.pantSize || value.shoeSize || value.sizingNotes);
}

function CastForm({ value, onChange }: { value: CastMemberInput; onChange: (next: CastMemberInput) => void }) {
  const [expanded, setExpanded] = React.useState(() => hasContactDetails(value));
  const [sizingExpanded, setSizingExpanded] = React.useState(() => hasSizingDetails(value));

  return (
    <div className="flex flex-1 flex-col gap-[var(--fs-space-12)]">
      <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
        <Input
          label="Character"
          value={value.characterName}
          onChange={(e) => onChange({ ...value, characterName: e.target.value })}
          containerClassName="min-w-[140px] flex-1"
        />
        <Input
          label="Actor"
          value={value.actorName}
          onChange={(e) => onChange({ ...value, actorName: e.target.value })}
          containerClassName="min-w-[140px] flex-1"
        />
        <div className="flex flex-col gap-[4px]">
          <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Status</label>
          <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as CastMember["status"] })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-[4px]">
          <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Contract</label>
          <Select value={value.contract} onValueChange={(v) => onChange({ ...value, contract: v as CastMember["contract"] })}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTRACTS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-fit items-center gap-[4px] text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        {expanded ? <ChevronDown className="size-[14px]" aria-hidden="true" /> : <ChevronRight className="size-[14px]" aria-hidden="true" />}
        Contact & agent details
      </button>

      {expanded && (
        <div className="flex flex-wrap items-end gap-[var(--fs-space-8)] rounded-md bg-[var(--color-background-surface)] p-[var(--fs-space-8)]">
          <Input
            label="Email"
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            containerClassName="min-w-[160px] flex-1"
          />
          <Input
            label="Phone"
            type="tel"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            containerClassName="min-w-[140px]"
          />
          <Input
            label="Emergency contact"
            value={value.emergencyContactName}
            onChange={(e) => onChange({ ...value, emergencyContactName: e.target.value })}
            containerClassName="min-w-[160px] flex-1"
          />
          <Input
            label="Emergency phone"
            type="tel"
            value={value.emergencyContactPhone}
            onChange={(e) => onChange({ ...value, emergencyContactPhone: e.target.value })}
            containerClassName="min-w-[140px]"
          />
          <Input
            label="Agent / manager"
            value={value.agentName}
            onChange={(e) => onChange({ ...value, agentName: e.target.value })}
            containerClassName="min-w-[160px] flex-1"
          />
          <Input
            label="Agent phone"
            type="tel"
            value={value.agentPhone}
            onChange={(e) => onChange({ ...value, agentPhone: e.target.value })}
            containerClassName="min-w-[140px]"
          />
          <Input
            label="Agent email"
            type="email"
            value={value.agentEmail}
            onChange={(e) => onChange({ ...value, agentEmail: e.target.value })}
            containerClassName="min-w-[160px] flex-1"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setSizingExpanded((v) => !v)}
        className="flex w-fit items-center gap-[4px] text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        {sizingExpanded ? <ChevronDown className="size-[14px]" aria-hidden="true" /> : <ChevronRight className="size-[14px]" aria-hidden="true" />}
        Wardrobe sizing
      </button>

      {sizingExpanded && (
        <div className="flex flex-col gap-[var(--fs-space-8)] rounded-md bg-[var(--color-background-surface)] p-[var(--fs-space-8)]">
          <div className="flex flex-wrap items-end gap-[var(--fs-space-8)]">
            <Input
              label="Height"
              placeholder={'e.g. 5\'10"'}
              value={value.height}
              onChange={(e) => onChange({ ...value, height: e.target.value })}
              containerClassName="min-w-[100px]"
            />
            <Input
              label="Shirt size"
              value={value.shirtSize}
              onChange={(e) => onChange({ ...value, shirtSize: e.target.value })}
              containerClassName="min-w-[100px]"
            />
            <Input
              label="Pant size"
              value={value.pantSize}
              onChange={(e) => onChange({ ...value, pantSize: e.target.value })}
              containerClassName="min-w-[100px]"
            />
            <Input
              label="Shoe size"
              value={value.shoeSize}
              onChange={(e) => onChange({ ...value, shoeSize: e.target.value })}
              containerClassName="min-w-[100px]"
            />
          </div>
          <Textarea
            label="Sizing notes"
            placeholder="Wigs, prosthetics, allergies, anything else wardrobe/hair/makeup should know"
            rows={2}
            value={value.sizingNotes}
            onChange={(e) => onChange({ ...value, sizingNotes: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export function CastSection({
  productionId,
  castMembers,
  characters,
}: {
  productionId: string;
  castMembers: CastMember[];
  characters: Character[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<CastMemberInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<CastMemberInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const characterName = React.useCallback(
    (characterId: string) => characters.find((c) => c.id === characterId)?.name ?? "Unknown",
    [characters],
  );

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCastMember(productionId, addForm);
      toast({ tone: "success", title: "Cast member added", description: addForm.actorName });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add cast member", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(member: CastMember) {
    setEditingId(member.id);
    setEditForm({
      characterName: characterName(member.characterId),
      actorName: member.actorName,
      status: member.status,
      contract: member.contract,
      email: member.email ?? "",
      phone: member.phone ?? "",
      emergencyContactName: member.emergencyContactName ?? "",
      emergencyContactPhone: member.emergencyContactPhone ?? "",
      agentName: member.agentName ?? "",
      agentPhone: member.agentPhone ?? "",
      agentEmail: member.agentEmail ?? "",
      height: member.height ?? "",
      shirtSize: member.shirtSize ?? "",
      pantSize: member.pantSize ?? "",
      shoeSize: member.shoeSize ?? "",
      sizingNotes: member.sizingNotes ?? "",
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateCastMember(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(member: CastMember) {
    setPendingId(member.id);
    const restore: CastMemberInput = {
      characterName: characterName(member.characterId),
      actorName: member.actorName,
      status: member.status,
      contract: member.contract,
      email: member.email ?? "",
      phone: member.phone ?? "",
      emergencyContactName: member.emergencyContactName ?? "",
      emergencyContactPhone: member.emergencyContactPhone ?? "",
      agentName: member.agentName ?? "",
      agentPhone: member.agentPhone ?? "",
      agentEmail: member.agentEmail ?? "",
      height: member.height ?? "",
      shirtSize: member.shirtSize ?? "",
      pantSize: member.pantSize ?? "",
      shoeSize: member.shoeSize ?? "",
      sizingNotes: member.sizingNotes ?? "",
    };
    try {
      await deleteCastMember(productionId, member.id);
      router.refresh();
      toast({
        title: "Cast member removed",
        description: restore.actorName || restore.characterName,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              try {
                await createCastMember(productionId, restore);
                router.refresh();
              } catch {
                toast({ tone: "danger", title: "Couldn't undo", description: "Please add the cast member back manually." });
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch {
      toast({ tone: "danger", title: "Couldn't remove cast member", description: "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {castMembers.length === 0 && !adding && (
        <EmptyState
          icon={<Users className="size-full" />}
          title="No cast yet"
          description="Add a cast member to track casting and contract status."
          action={<Button onClick={() => setAdding(true)}>Add cast member</Button>}
        />
      )}

      {castMembers.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {castMembers.map((member) =>
            editingId === member.id ? (
              <li key={member.id} className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                <form onSubmit={(e) => onSaveEdit(e, member.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                  <CastForm value={editForm} onChange={setEditForm} />
                  <Button type="submit" loading={pendingId === member.id} disabled={pendingId !== null}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                    Cancel
                  </Button>
                </form>
              </li>
            ) : (
              <li key={member.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                    {characterName(member.characterId)}
                  </p>
                  <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                    {member.actorName || <span className="italic">Not yet cast</span>}
                    {(member.phone || member.email) && ` · ${[member.phone, member.email].filter(Boolean).join(" · ")}`}
                  </p>
                  {member.agentName && (
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      Agent: {[member.agentName, member.agentPhone].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                  <StatusBadge tone={statusTone[member.status]}>{member.status}</StatusBadge>
                  <StatusBadge tone={contractTone[member.contract]}>{member.contract}</StatusBadge>
                  <Button
                    variant="quiet"
                    iconOnly
                    icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                    aria-label={`Edit ${member.actorName}`}
                    onClick={() => startEdit(member)}
                    disabled={pendingId !== null}
                  />
                  <Button
                    variant="quiet"
                    iconOnly
                    icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                    aria-label={`Remove ${member.actorName}`}
                    loading={pendingId === member.id}
                    disabled={pendingId !== null}
                    onClick={() => onDelete(member)}
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {castMembers.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add cast member
        </Button>
      )}

      {adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row"
        >
          <CastForm value={addForm} onChange={setAddForm} />
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
