"use client";

import type { CrewMember } from "@filmset/core";
import { Button, EmptyState, Input, ToastAction, useToast } from "@filmset/ui";
import { ChevronDown, ChevronRight, HardHat, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createCrewMember, deleteCrewMember, updateCrewMember, type CrewMemberInput } from "./actions";

const emptyForm: CrewMemberInput = {
  name: "",
  department: "",
  role: "",
  email: "",
  phone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  agentName: "",
  agentPhone: "",
  agentEmail: "",
};

function hasContactDetails(value: CrewMemberInput): boolean {
  return Boolean(
    value.email || value.phone || value.emergencyContactName || value.emergencyContactPhone || value.agentName || value.agentPhone || value.agentEmail,
  );
}

function CrewForm({ value, onChange }: { value: CrewMemberInput; onChange: (next: CrewMemberInput) => void }) {
  const [expanded, setExpanded] = React.useState(() => hasContactDetails(value));

  return (
    <div className="flex flex-1 flex-col gap-[var(--fs-space-12)]">
      <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
        <Input
          label="Name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          containerClassName="min-w-[140px] flex-1"
        />
        <Input
          label="Department"
          placeholder="e.g. Camera"
          value={value.department}
          onChange={(e) => onChange({ ...value, department: e.target.value })}
          containerClassName="min-w-[140px]"
        />
        <Input
          label="Role"
          placeholder="e.g. 1st AC"
          value={value.role}
          onChange={(e) => onChange({ ...value, role: e.target.value })}
          containerClassName="min-w-[140px]"
        />
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
            label="Agent / rep"
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
    </div>
  );
}

export function CrewSection({ productionId, crewMembers }: { productionId: string; crewMembers: CrewMember[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<CrewMemberInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<CrewMemberInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCrewMember(productionId, addForm);
      toast({ tone: "success", title: "Crew member added", description: addForm.name });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add crew member", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(member: CrewMember) {
    setEditingId(member.id);
    setEditForm({
      name: member.name,
      department: member.department,
      role: member.role,
      email: member.email ?? "",
      phone: member.phone ?? "",
      emergencyContactName: member.emergencyContactName ?? "",
      emergencyContactPhone: member.emergencyContactPhone ?? "",
      agentName: member.agentName ?? "",
      agentPhone: member.agentPhone ?? "",
      agentEmail: member.agentEmail ?? "",
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateCrewMember(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(member: CrewMember) {
    setPendingId(member.id);
    const restore: CrewMemberInput = {
      name: member.name,
      department: member.department,
      role: member.role,
      email: member.email ?? "",
      phone: member.phone ?? "",
      emergencyContactName: member.emergencyContactName ?? "",
      emergencyContactPhone: member.emergencyContactPhone ?? "",
      agentName: member.agentName ?? "",
      agentPhone: member.agentPhone ?? "",
      agentEmail: member.agentEmail ?? "",
    };
    try {
      await deleteCrewMember(productionId, member.id);
      router.refresh();
      toast({
        title: "Crew member removed",
        description: member.name,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              try {
                await createCrewMember(productionId, restore);
                router.refresh();
              } catch {
                toast({ tone: "danger", title: "Couldn't undo", description: "Please add the crew member back manually." });
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch {
      toast({ tone: "danger", title: "Couldn't remove crew member", description: "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {crewMembers.length === 0 && !adding && (
        <EmptyState
          icon={<HardHat className="size-full" />}
          title="No crew yet"
          description="Add crew members to track department and role."
          action={<Button onClick={() => setAdding(true)}>Add crew member</Button>}
        />
      )}

      {crewMembers.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {crewMembers.map((member) =>
            editingId === member.id ? (
              <li key={member.id} className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                <form onSubmit={(e) => onSaveEdit(e, member.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                  <CrewForm value={editForm} onChange={setEditForm} />
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
                  <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{member.name}</p>
                  <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                    {member.department} — {member.role}
                    {(member.phone || member.email) && ` · ${[member.phone, member.email].filter(Boolean).join(" · ")}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                  <Button
                    variant="quiet"
                    iconOnly
                    icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                    aria-label={`Edit ${member.name}`}
                    onClick={() => startEdit(member)}
                    disabled={pendingId !== null}
                  />
                  <Button
                    variant="quiet"
                    iconOnly
                    icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                    aria-label={`Remove ${member.name}`}
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

      {crewMembers.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          Add crew member
        </Button>
      )}

      {adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row"
        >
          <CrewForm value={addForm} onChange={setAddForm} />
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
