"use client";

import { DayColumn } from "@/components/stripboard/day-column";
import { castNames, Strip } from "@/components/stripboard/strip";
import { Shell } from "@/components/shell";
import type { ProductionSnapshot } from "@/lib/queries";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button, Inspector, InspectorSection, StatusBadge, useToast } from "@filmset/ui";
import { Sparkles, Undo2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { persistBoard, type Board } from "./actions";

function findContainer(board: Board, itemId: string): string | undefined {
  if (itemId in board) return itemId;
  return Object.keys(board).find((key) => board[key]!.includes(itemId));
}

function StripboardPageContent({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  const searchParams = useSearchParams();
  const { production, scenes, shootDays, locations, issues, castMembers, characters } = snapshot;

  const castMemberCharacterIds = React.useMemo(() => Object.fromEntries(castMembers.map((c) => [c.id, c.characterId])), [castMembers]);
  const scenesById = React.useMemo(() => new Map(scenes.map((s) => [s.id, s])), [scenes]);
  const conflictSceneIds = React.useMemo(() => new Set(issues.flatMap((i) => i.affectedSceneIds)), [issues]);

  const initialBoard = React.useCallback((): Board => {
    const board: Board = { unscheduled: [] };
    for (const day of shootDays) board[day.id] = [...day.sceneIds];
    for (const scene of scenes) {
      if (scene.status === "Omitted") continue;
      if (!scene.shootDayId) board.unscheduled!.push(scene.id);
    }
    return board;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [board, setBoard] = React.useState<Board>(initialBoard);
  const [history, setHistory] = React.useState<Board[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    new Set(searchParams.get("scene") ? [searchParams.get("scene")!] : []),
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const dragStartBoardRef = React.useRef<Board | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function select(sceneId: string, additive: boolean) {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(sceneId)) next.delete(sceneId);
        else next.add(sceneId);
        return next;
      }
      return new Set([sceneId]);
    });
  }

  function persist(nextBoard: Board, fallbackBoard: Board) {
    persistBoard(production.id, nextBoard).catch(() => {
      setBoard(fallbackBoard);
      toast({ title: "Couldn't save schedule change", description: "The stripboard change wasn't saved — reverted.", tone: "danger" });
    });
  }

  function undo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      const current = board;
      setBoard(last);
      persist(last, current);
      return prev.slice(0, -1);
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    dragStartBoardRef.current = board;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeContainer = findContainer(board, String(active.id));
    const overContainer = findContainer(board, String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setBoard((prev) => {
      const activeItems = prev[activeContainer]!;
      const overItems = prev[overContainer]!;
      const overIndex = overItems.indexOf(String(over.id));
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== active.id),
        [overContainer]: [...overItems.slice(0, newIndex), String(active.id), ...overItems.slice(newIndex)],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    const startBoard = dragStartBoardRef.current;
    dragStartBoardRef.current = null;
    if (!startBoard) return;

    if (!over) {
      setBoard(startBoard);
      return;
    }

    const container = findContainer(board, String(active.id));
    if (!container) {
      setBoard(startBoard);
      return;
    }

    const items = board[container]!;
    const oldIndex = items.indexOf(String(active.id));
    const overIndex = items.indexOf(String(over.id));
    const finalBoard: Board =
      oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex
        ? { ...board, [container]: arrayMove(items, oldIndex, overIndex) }
        : board;

    if (JSON.stringify(finalBoard) !== JSON.stringify(startBoard)) {
      setHistory((prev) => [...prev.slice(-9), startBoard]);
      setBoard(finalBoard);
      persist(finalBoard, startBoard);
    }
  }

  const activeScene = activeId ? scenesById.get(activeId) : null;
  const primarySelected = selectedIds.size > 0 ? scenesById.get([...selectedIds][selectedIds.size - 1]!) : null;

  return (
    <Shell
      production={production}
      scenes={scenes}
      userEmail={userEmail ?? undefined}
      inspector={
        primarySelected ? (
          <Inspector
            objectType="Scene"
            title={`Scene ${primarySelected.number}`}
            subtitle={`${primarySelected.intExt}. ${primarySelected.setName.toUpperCase()} — ${primarySelected.dayNight}`}
            onClose={() => setSelectedIds(new Set())}
          >
            <InspectorSection label="Status">
              <StatusBadge tone={primarySelected.status === "Shot" ? "success" : "info"}>{primarySelected.status}</StatusBadge>
            </InspectorSection>
            <InspectorSection label="Pages">{primarySelected.pageCount}</InspectorSection>
            <InspectorSection label="Cast">{castNames(primarySelected, castMemberCharacterIds, characters) || "—"}</InspectorSection>
            <InspectorSection label="Synopsis">{primarySelected.synopsis}</InspectorSection>
            {conflictSceneIds.has(primarySelected.id) && (
              <InspectorSection label="Conflicts">
                {issues
                  .filter((i) => i.affectedSceneIds.includes(primarySelected.id))
                  .map((i) => (
                    <p key={i.id} className="text-[var(--color-status-warning)]">
                      {i.title}
                    </p>
                  ))}
              </InspectorSection>
            )}
          </Inspector>
        ) : undefined
      }
    >
      <div className="flex h-full flex-col gap-[var(--fs-space-16)] overflow-y-auto p-[var(--fs-space-24)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Stripboard</h1>
            <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">
              Drag the handle to reorder, or focus a strip and use arrow keys. {selectedIds.size > 0 && `${selectedIds.size} selected.`}
            </p>
          </div>
          <div className="flex items-center gap-[var(--fs-space-8)]">
            <Button variant="secondary" icon={<Undo2 className="size-[14px]" aria-hidden="true" />} onClick={undo} disabled={history.length === 0}>
              Undo
            </Button>
            <Button icon={<Sparkles className="size-[14px]" aria-hidden="true" />} onClick={() => (window.location.href = "/ai")}>
              Ask FilmSet AI to optimize
            </Button>
          </div>
        </div>

        <DndContext
          id="stripboard-dnd"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-[var(--fs-space-16)]">
            {shootDays.map((day) => (
              <DayColumn
                key={day.id}
                containerId={day.id}
                day={day}
                locationName={locations.find((l) => l.id === day.locationId)?.name}
                sceneIds={board[day.id] ?? []}
                scenesById={scenesById}
                castMemberCharacterIds={castMemberCharacterIds}
                characters={characters}
                selectedIds={selectedIds}
                conflictSceneIds={conflictSceneIds}
                onSelect={select}
              />
            ))}
            <DayColumn
              containerId="unscheduled"
              day={null}
              sceneIds={board.unscheduled ?? []}
              scenesById={scenesById}
              castMemberCharacterIds={castMemberCharacterIds}
              characters={characters}
              selectedIds={selectedIds}
              conflictSceneIds={conflictSceneIds}
              onSelect={select}
            />
          </div>
          <DragOverlay>
            {activeScene ? (
              <div className="w-[600px] rounded-md border border-[var(--color-action-primary)]">
                <Strip
                  scene={activeScene}
                  castLabel={castNames(activeScene, castMemberCharacterIds, characters)}
                  selected={false}
                  hasConflict={conflictSceneIds.has(activeScene.id)}
                  onSelect={() => {}}
                  dragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Shell>
  );
}

export function StripboardPageInner({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  return (
    <React.Suspense fallback={null}>
      <StripboardPageContent snapshot={snapshot} userEmail={userEmail} />
    </React.Suspense>
  );
}
