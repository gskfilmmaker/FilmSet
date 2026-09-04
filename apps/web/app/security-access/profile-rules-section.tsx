"use client";

import { Button, Checkbox, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createProfileRule, deleteProfileRule, updateProfileRule, type ProfileRuleInput } from "./actions";
import { ASSURANCE_LEVELS, DAYS_OF_WEEK, type AssuranceLevel, type DayOfWeek } from "./constants";
import { humanizeEnum } from "./format";
import type { PersonOption } from "./identities-section";

export interface ProfileRuleRow {
  id: string;
  profileId: string;
  resourceId: string;
  daysOfWeek: DayOfWeek[] | null;
  timeStart: string | null;
  timeEnd: string | null;
  minimumAssuranceLevel: AssuranceLevel | null;
  escortRequired: boolean;
}

const emptyForm: ProfileRuleInput = {
  profileId: "",
  resourceId: "",
  daysOfWeek: null,
  timeStart: "",
  timeEnd: "",
  minimumAssuranceLevel: null,
  escortRequired: false,
};

function DayPicker({ value, onChange }: { value: DayOfWeek[] | null; onChange: (next: DayOfWeek[] | null) => void }) {
  const selected = new Set(value ?? []);
  function toggle(day: DayOfWeek) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(next.size > 0 ? DAYS_OF_WEEK.filter((d) => next.has(d)) : null);
  }
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Days (all if none picked)</label>
      <div className="flex gap-[4px]">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`h-[var(--fs-control-height)] rounded-md border px-[6px] text-[11px] font-medium transition-colors ${
              selected.has(day)
                ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-action-on-primary)]"
                : "border-[var(--color-border-standard)] bg-[var(--color-background-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileRuleForm({
  value,
  onChange,
  profileOptions,
  resourceOptions,
}: {
  value: ProfileRuleInput;
  onChange: (next: ProfileRuleInput) => void;
  profileOptions: PersonOption[];
  resourceOptions: PersonOption[];
}) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Profile</label>
        <Select value={value.profileId} onValueChange={(v) => onChange({ ...value, profileId: v })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {profileOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Resource</label>
        <Select value={value.resourceId} onValueChange={(v) => onChange({ ...value, resourceId: v })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {resourceOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DayPicker value={value.daysOfWeek} onChange={(d) => onChange({ ...value, daysOfWeek: d })} />
      <Input
        label="Time from"
        type="time"
        value={value.timeStart ?? ""}
        onChange={(e) => onChange({ ...value, timeStart: e.target.value || null })}
        containerClassName="w-[130px]"
      />
      <Input
        label="Time until"
        type="time"
        value={value.timeEnd ?? ""}
        onChange={(e) => onChange({ ...value, timeEnd: e.target.value || null })}
        containerClassName="w-[130px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Min. assurance</label>
        <Select
          value={value.minimumAssuranceLevel ?? "__none"}
          onValueChange={(v) => onChange({ ...value, minimumAssuranceLevel: v === "__none" ? null : (v as AssuranceLevel) })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Resource default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Resource default</SelectItem>
            {ASSURANCE_LEVELS.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-[6px] pb-[6px]">
        <Checkbox id="rule-escort" checked={value.escortRequired} onCheckedChange={(c) => onChange({ ...value, escortRequired: c === true })} />
        <label htmlFor="rule-escort" className="text-[13px] text-[var(--color-text-secondary)]">
          Escort required
        </label>
      </div>
    </div>
  );
}

export function ProfileRulesSection({
  productionId,
  rules,
  profileOptions,
  resourceOptions,
  canManage,
}: {
  productionId: string;
  rules: ProfileRuleRow[];
  profileOptions: PersonOption[];
  resourceOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<ProfileRuleInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<ProfileRuleInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function labelFor(options: PersonOption[], id: string): string {
    return options.find((o) => o.id === id)?.label ?? "Unknown";
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createProfileRule(productionId, addForm);
      toast({ tone: "success", title: "Rule added" });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add rule", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rule: ProfileRuleRow) {
    setEditingId(rule.id);
    setEditForm({
      profileId: rule.profileId,
      resourceId: rule.resourceId,
      daysOfWeek: rule.daysOfWeek,
      timeStart: rule.timeStart ?? "",
      timeEnd: rule.timeEnd ?? "",
      minimumAssuranceLevel: rule.minimumAssuranceLevel,
      escortRequired: rule.escortRequired,
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateProfileRule(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(rule: ProfileRuleRow) {
    setPendingId(rule.id);
    try {
      await deleteProfileRule(productionId, rule.id);
      router.refresh();
      toast({ title: "Rule removed" });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove rule", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {rules.length === 0 && !adding && (
        <EmptyState
          icon={<ListChecks className="size-full" />}
          title="No profile rules yet"
          description={
            !canManage
              ? "No profile rules have been added for this production yet."
              : profileOptions.length === 0
                ? "Add a profile on the Profiles tab first — a rule always belongs to one."
                : "Add a rule naming which resource a profile allows, and when."
          }
          action={canManage ? <Button onClick={() => setAdding(true)} disabled={profileOptions.length === 0}>Add rule</Button> : undefined}
        />
      )}

      {rules.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {rules.map((rule) => (
            <React.Fragment key={rule.id}>
              {canManage && editingId === rule.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, rule.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <ProfileRuleForm value={editForm} onChange={setEditForm} profileOptions={profileOptions} resourceOptions={resourceOptions} />
                    <Button type="submit" loading={pendingId === rule.id} disabled={pendingId !== null}>
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
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                      {labelFor(profileOptions, rule.profileId)} → {labelFor(resourceOptions, rule.resourceId)}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {rule.daysOfWeek ? rule.daysOfWeek.join(", ") : "Every day"}
                      {rule.timeStart && rule.timeEnd ? ` · ${rule.timeStart}–${rule.timeEnd}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    {rule.escortRequired && <StatusBadge tone="warning">Escort required</StatusBadge>}
                    {rule.minimumAssuranceLevel && <StatusBadge tone="neutral">{humanizeEnum(rule.minimumAssuranceLevel)}</StatusBadge>}
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label="Edit rule"
                          onClick={() => startEdit(rule)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label="Remove rule"
                          loading={pendingId === rule.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(rule)}
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

      {canManage && rules.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start" disabled={profileOptions.length === 0}>
          Add rule
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <ProfileRuleForm value={addForm} onChange={setAddForm} profileOptions={profileOptions} resourceOptions={resourceOptions} />
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
