"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Scene } from "@filmset/core";
import { characters } from "@filmset/db";
import { GripVertical, TriangleAlert } from "lucide-react";

export function castNames(scene: Scene, castMemberCharacterIds: Record<string, string>): string {
  return scene.castIds
    .map((id) => {
      const charId = castMemberCharacterIds[id];
      return characters.find((c) => c.id === charId)?.name;
    })
    .filter(Boolean)
    .join(", ");
}

export interface StripProps {
  scene: Scene;
  castLabel: string;
  selected: boolean;
  hasConflict: boolean;
  onSelect: (sceneId: string, additive: boolean) => void;
  dragging?: boolean;
}

export function Strip({ scene, castLabel, selected, hasConflict, onSelect, dragging }: StripProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => onSelect(scene.id, e.metaKey || e.ctrlKey)}
      className={`group flex items-center gap-[var(--fs-space-8)] border-b border-[var(--color-border-subtle)] px-[var(--fs-space-8)] py-[6px] text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)] ${
        selected
          ? "bg-[var(--color-background-elevated)] ring-1 ring-inset ring-[var(--color-action-primary)]"
          : "bg-[var(--color-background-surface)] hover:bg-[var(--color-background-elevated)]"
      } ${dragging ? "shadow-[var(--fs-shadow-lg)]" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`h-[20px] w-[3px] shrink-0 rounded-full ${scene.dayNight === "NIGHT" ? "bg-[var(--color-action-primary)]" : "bg-[var(--color-status-info)]"}`}
      />
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder Scene ${scene.number}`}
        className="flex shrink-0 cursor-grab items-center text-[var(--color-text-tertiary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] active:cursor-grabbing"
      >
        <GripVertical className="size-[14px]" aria-hidden="true" />
      </button>
      <span className="w-[28px] shrink-0 text-right font-medium tabular-nums text-[var(--color-text-primary)]">{scene.number}</span>
      <span className="w-[36px] shrink-0 text-[11px] font-semibold text-[var(--color-text-tertiary)]">{scene.intExt}</span>
      <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{scene.setName}</span>
      <span className="w-[44px] shrink-0 text-[11px] font-semibold text-[var(--color-text-tertiary)]">{scene.dayNight}</span>
      <span className="w-[48px] shrink-0 text-right tabular-nums text-[var(--color-text-secondary)]">{scene.pageCount}</span>
      <span className="hidden w-[160px] shrink-0 truncate text-[12px] text-[var(--color-text-tertiary)] lg:block">{castLabel}</span>
      <span className="flex w-[16px] shrink-0 justify-center">
        {hasConflict && <TriangleAlert className="size-[14px] text-[var(--color-status-warning)]" aria-label="Conflict" />}
      </span>
    </div>
  );
}
