"use client";

import { Button, Checkbox, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { DoorOpen, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createCheckpoint, deleteCheckpoint, previewNextCheckpointCode, updateCheckpoint, type CheckpointInput } from "./actions";
import { ANTI_PASSBACK_MODES, DIRECTION_MODES, type AntiPassbackMode, type DirectionMode } from "./constants";
import { humanizeEnum } from "./format";
import type { PersonOption } from "./identities-section";

export interface CheckpointRow {
  id: string;
  resourceId: string;
  name: string;
  code: string | null;
  directionMode: DirectionMode;
  active: boolean;
  antiPassbackMode: AntiPassbackMode;
  requiresOperatorConfirmation: boolean;
}

const emptyForm: CheckpointInput = {
  resourceId: "",
  name: "",
  code: "",
  directionMode: "BOTH",
  active: true,
  antiPassbackMode: "OFF",
  requiresOperatorConfirmation: false,
};

function CheckpointForm({
  value,
  onChange,
  resourceOptions,
  codePreview,
}: {
  value: CheckpointInput;
  onChange: (next: CheckpointInput) => void;
  resourceOptions: PersonOption[];
  /** Next auto-assignable code, shown as a placeholder — null while editing an existing checkpoint or still loading. */
  codePreview: string | null;
}) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[140px] flex-1" />
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
      <Input
        label="Code"
        placeholder={codePreview ? `Auto: ${codePreview}` : "Optional"}
        value={value.code ?? ""}
        onChange={(e) => onChange({ ...value, code: e.target.value })}
        containerClassName="w-[130px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Direction</label>
        <Select value={value.directionMode} onValueChange={(v) => onChange({ ...value, directionMode: v as DirectionMode })}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIRECTION_MODES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Anti-passback</label>
        <Select value={value.antiPassbackMode} onValueChange={(v) => onChange({ ...value, antiPassbackMode: v as AntiPassbackMode })}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANTI_PASSBACK_MODES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanizeEnum(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-[6px] pb-[6px]">
        <Checkbox id="checkpoint-active" checked={value.active} onCheckedChange={(c) => onChange({ ...value, active: c === true })} />
        <label htmlFor="checkpoint-active" className="text-[13px] text-[var(--color-text-secondary)]">
          Active
        </label>
      </div>
      <div className="flex items-center gap-[6px] pb-[6px]">
        <Checkbox
          id="checkpoint-operator-confirm"
          checked={value.requiresOperatorConfirmation}
          onCheckedChange={(c) => onChange({ ...value, requiresOperatorConfirmation: c === true })}
        />
        <label htmlFor="checkpoint-operator-confirm" className="text-[13px] text-[var(--color-text-secondary)]">
          Requires operator confirmation
        </label>
      </div>
    </div>
  );
}

export function CheckpointsSection({
  productionId,
  checkpoints,
  resourceOptions,
  canManage,
}: {
  productionId: string;
  checkpoints: CheckpointRow[];
  resourceOptions: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<CheckpointInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<CheckpointInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [codePreview, setCodePreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!adding) {
      setCodePreview(null);
      return;
    }
    let cancelled = false;
    previewNextCheckpointCode(productionId).then((preview) => {
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
      await createCheckpoint(productionId, addForm);
      toast({ tone: "success", title: "Checkpoint added", description: addForm.name });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add checkpoint", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(checkpoint: CheckpointRow) {
    setEditingId(checkpoint.id);
    setEditForm({
      resourceId: checkpoint.resourceId,
      name: checkpoint.name,
      code: checkpoint.code ?? "",
      directionMode: checkpoint.directionMode,
      active: checkpoint.active,
      antiPassbackMode: checkpoint.antiPassbackMode,
      requiresOperatorConfirmation: checkpoint.requiresOperatorConfirmation,
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateCheckpoint(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(checkpoint: CheckpointRow) {
    setPendingId(checkpoint.id);
    try {
      await deleteCheckpoint(productionId, checkpoint.id);
      router.refresh();
      toast({ title: "Checkpoint removed", description: checkpoint.name });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove checkpoint", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {checkpoints.length === 0 && !adding && (
        <EmptyState
          icon={<DoorOpen className="size-full" />}
          title="No checkpoints yet"
          description={
            !canManage
              ? "No checkpoints have been added for this production yet."
              : resourceOptions.length === 0
                ? "Add a resource on the Resources tab first — a checkpoint always guards one."
                : "Add a checkpoint — a physical gate or entrance where verification actually happens — for one of your resources."
          }
          action={canManage ? <Button onClick={() => setAdding(true)} disabled={resourceOptions.length === 0}>Add checkpoint</Button> : undefined}
        />
      )}

      {checkpoints.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {checkpoints.map((checkpoint) => (
            <React.Fragment key={checkpoint.id}>
              {canManage && editingId === checkpoint.id ? (
                <li className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, checkpoint.id)} className="flex flex-1 items-end gap-[var(--fs-space-8)]">
                    <CheckpointForm value={editForm} onChange={setEditForm} resourceOptions={resourceOptions} codePreview={null} />
                    <Button type="submit" loading={pendingId === checkpoint.id} disabled={pendingId !== null}>
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
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{checkpoint.name}</p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {resourceOptions.find((o) => o.id === checkpoint.resourceId)?.label ?? "Unknown resource"} · {humanizeEnum(checkpoint.directionMode)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    {!checkpoint.active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
                    {checkpoint.antiPassbackMode !== "OFF" && (
                      <StatusBadge tone={checkpoint.antiPassbackMode === "DENY" ? "danger" : "warning"}>Anti-passback {humanizeEnum(checkpoint.antiPassbackMode)}</StatusBadge>
                    )}
                    {canManage && (
                      <>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Edit ${checkpoint.name}`}
                          onClick={() => startEdit(checkpoint)}
                          disabled={pendingId !== null}
                        />
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Remove ${checkpoint.name}`}
                          loading={pendingId === checkpoint.id}
                          disabled={pendingId !== null}
                          onClick={() => onDelete(checkpoint)}
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

      {canManage && checkpoints.length > 0 && !adding && (
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start" disabled={resourceOptions.length === 0}>
          Add checkpoint
        </Button>
      )}

      {canManage && adding && (
        <form
          onSubmit={onAdd}
          className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap"
        >
          <CheckpointForm value={addForm} onChange={setAddForm} resourceOptions={resourceOptions} codePreview={codePreview} />
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
