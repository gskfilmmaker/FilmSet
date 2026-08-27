"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Character, Scene, ShootDay } from "@filmset/core";
import { StatusBadge } from "@filmset/ui";
import { Pencil } from "lucide-react";
import { castNames, Strip } from "./strip";

const dayStatusTone = {
  Wrapped: "neutral",
  "In Progress": "info",
  Scheduled: "success",
  Unconfirmed: "warning",
} as const;

export interface DayColumnProps {
  containerId: string;
  day: ShootDay | null;
  locationName?: string;
  sceneIds: string[];
  scenesById: Map<string, Scene>;
  castMemberCharacterIds: Record<string, string>;
  characters: Character[];
  selectedIds: Set<string>;
  conflictSceneIds: Set<string>;
  onSelect: (sceneId: string, additive: boolean) => void;
  onEdit?: (day: ShootDay) => void;
}

export function DayColumn({
  containerId,
  day,
  locationName,
  sceneIds,
  scenesById,
  castMemberCharacterIds,
  characters,
  selectedIds,
  conflictSceneIds,
  onSelect,
  onEdit,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  const totalPages = sceneIds.length;

  return (
    <div className={`flex flex-col rounded-lg border ${isOver ? "border-[var(--color-action-primary)]" : "border-[var(--color-border-subtle)]"}`}>
      <div className="flex items-center justify-between gap-[var(--fs-space-12)] border-b border-[var(--color-border-subtle)] bg-[var(--color-background-elevated)] px-[var(--fs-space-16)] py-[var(--fs-space-8)]">
        <div className="flex items-center gap-[var(--fs-space-12)]">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            {day ? `Day ${day.dayNumber}` : "Unscheduled"}
          </span>
          {day && <span className="text-[12px] text-[var(--color-text-tertiary)]">{day.date}</span>}
          {locationName && <span className="text-[12px] text-[var(--color-text-tertiary)]">· {locationName}</span>}
          {day && <span className="text-[12px] text-[var(--color-text-tertiary)]">· Call {day.callTime}</span>}
        </div>
        <div className="flex items-center gap-[var(--fs-space-8)]">
          <span className="text-[11px] tabular-nums text-[var(--color-text-tertiary)]">{totalPages} scenes</span>
          {day && <StatusBadge tone={dayStatusTone[day.status]}>{day.status}</StatusBadge>}
          {day && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(day)}
              aria-label={`Edit Day ${day.dayNumber}`}
              className="flex size-[24px] items-center justify-center rounded-md text-[var(--color-text-tertiary)] outline-none hover:bg-[var(--color-background-surface)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
            >
              <Pencil className="size-[13px]" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <SortableContext id={containerId} items={sceneIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-[48px]">
          {sceneIds.length === 0 && (
            <div className="px-[var(--fs-space-16)] py-[var(--fs-space-16)] text-center text-[12px] text-[var(--color-text-tertiary)]">
              Drop scenes here
            </div>
          )}
          {sceneIds.map((id) => {
            const scene = scenesById.get(id);
            if (!scene) return null;
            return (
              <Strip
                key={id}
                scene={scene}
                castLabel={castNames(scene, castMemberCharacterIds, characters)}
                selected={selectedIds.has(id)}
                hasConflict={conflictSceneIds.has(id)}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}
