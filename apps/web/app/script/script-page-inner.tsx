"use client";

import { Shell } from "@/components/shell";
import type { ProductionSnapshot } from "@/lib/queries";
import { revisionColorSwatch, type BreakdownElement, type Scene } from "@filmset/core";
import {
  Button,
  Checkbox,
  Inspector,
  InspectorSection,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Textarea,
  useToast,
} from "@filmset/ui";
import { Check, FileUp, Pencil, Plus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { addBreakdownTag, confirmAllBreakdownElements, confirmBreakdownElement, rejectBreakdownElement } from "./actions";
import { ImportScriptForm } from "./import-script-form";
import { createScene, updateScene, type SceneInput } from "./scene-actions";

const INT_EXT: Scene["intExt"][] = ["INT", "EXT"];
const DAY_NIGHT: Scene["dayNight"][] = ["DAY", "NIGHT"];
const SCENE_STATUSES: Scene["status"][] = ["Draft", "Scheduled", "Shot", "Omitted", "Pickup", "Reshoot"];

function blankSceneInput(): SceneInput {
  return { number: "", intExt: "INT", setName: "", dayNight: "DAY", synopsis: "", status: "Draft", castMemberIds: [] };
}

function RevisionDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      title={`${color} revision`}
      className="size-[9px] shrink-0 rounded-full border border-[var(--color-border-standard)]"
      style={{ backgroundColor: revisionColorSwatch(color) }}
    />
  );
}

const CATEGORIES: BreakdownElement["category"][] = [
  "Props",
  "Wardrobe",
  "Vehicles",
  "Background",
  "Stunts",
  "Special Equipment",
  "Makeup/Hair",
];

function SceneNav({
  scenes,
  activeSceneId,
  onSelect,
  onNewScene,
  onImportRevision,
}: {
  scenes: ProductionSnapshot["scenes"];
  activeSceneId: string;
  onSelect: (id: string) => void;
  onNewScene: () => void;
  onImportRevision: () => void;
}) {
  return (
    <nav aria-label="Scenes" className="flex h-full w-[220px] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border-subtle)]">
      <button
        type="button"
        onClick={onNewScene}
        className="flex items-center gap-[var(--fs-space-4)] border-b border-[var(--color-border-subtle)] px-[var(--fs-space-12)] py-[var(--fs-space-8)] text-left text-[13px] font-medium text-[var(--color-action-primary)] outline-none hover:bg-[var(--color-background-elevated)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]"
      >
        <Plus className="size-[13px]" aria-hidden="true" />
        New Scene
      </button>
      <button
        type="button"
        onClick={onImportRevision}
        className="flex items-center gap-[var(--fs-space-4)] border-b border-[var(--color-border-subtle)] px-[var(--fs-space-12)] py-[var(--fs-space-8)] text-left text-[13px] font-medium text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-background-elevated)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]"
      >
        <FileUp className="size-[13px]" aria-hidden="true" />
        Import Revision
      </button>
      {scenes.map((scene) => (
        <button
          key={scene.id}
          type="button"
          onClick={() => onSelect(scene.id)}
          aria-current={scene.id === activeSceneId ? "true" : undefined}
          className={`flex flex-col gap-[2px] border-b border-[var(--color-border-subtle)] px-[var(--fs-space-12)] py-[var(--fs-space-8)] text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)] ${
            scene.id === activeSceneId
              ? "bg-[var(--color-background-elevated)]"
              : "hover:bg-[var(--color-background-elevated)]"
          }`}
        >
          <span className="flex items-center gap-[var(--fs-space-8)] text-[13px] font-medium text-[var(--color-text-primary)]">
            <span className="tabular-nums text-[var(--color-text-tertiary)]">{scene.number}</span>
            <span className="truncate">{scene.setName}</span>
            <RevisionDot color={scene.revisionColor} />
          </span>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {scene.intExt}. {scene.dayNight} · {scene.pageCount} pg
          </span>
        </button>
      ))}
    </nav>
  );
}

function TagSelectionPopover({ onTag }: { onTag: (category: BreakdownElement["category"]) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-[4px] rounded-[4px] border border-[var(--color-action-primary)] bg-[var(--color-background-elevated)] px-[6px] py-[2px] text-[11px] font-medium text-[var(--color-action-primary)] shadow-[var(--fs-shadow-sm)]"
        >
          <Plus className="size-[11px]" aria-hidden="true" />
          Tag as…
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-[4px]">
        <p className="px-[var(--fs-space-8)] py-[4px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">
          Tag selected text
        </p>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              onTag(c);
              setOpen(false);
            }}
            className="flex h-[28px] w-full items-center rounded-[4px] px-[var(--fs-space-8)] text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-background-surface)]"
          >
            {c}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Screenplay({
  sceneId,
  pages,
  onTagSelection,
}: {
  sceneId: string;
  pages: ProductionSnapshot["scriptPages"];
  onTagSelection: (text: string, category: BreakdownElement["category"]) => void;
}) {
  const scenePages = pages.filter((p) => p.sceneId === sceneId);
  const [selection, setSelection] = React.useState<{ text: string; x: number; y: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  function handleMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !sel || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setSelection({
      text,
      x: rect.left - containerRect.left + rect.width / 2 + container.scrollLeft,
      y: rect.top - containerRect.top + container.scrollTop,
    });
  }

  if (scenePages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-[var(--fs-space-24)] text-center text-[13px] text-[var(--color-text-tertiary)]">
        No screenplay content imported for this scene yet.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto bg-[var(--color-background-surface)] px-[var(--fs-space-48)] py-[var(--fs-space-32)]" onMouseUp={handleMouseUp}>
      <div className="mx-auto max-w-[560px] select-text font-mono text-[13px] leading-[22px] text-[var(--color-text-primary)]">
        {scenePages.map((page) =>
          page.elements.map((el, i) => {
            if (el.type === "slugline") return <p key={i} className="mb-[12px] mt-[20px] font-semibold uppercase first:mt-0">{el.text}</p>;
            if (el.type === "action") return <p key={i} className="mb-[12px]">{el.text}</p>;
            if (el.type === "character") return <p key={i} className="mb-[2px] ml-[140px] uppercase">{el.text}</p>;
            if (el.type === "parenthetical") return <p key={i} className="mb-[2px] ml-[110px] text-[var(--color-text-secondary)]">{el.text}</p>;
            if (el.type === "dialogue") return <p key={i} className="mb-[12px] ml-[80px] max-w-[280px]">{el.text}</p>;
            return <p key={i} className="mb-[12px] text-right uppercase">{el.text}</p>;
          }),
        )}
      </div>
      {selection && (
        <div className="absolute z-[var(--fs-z-dropdown)] -translate-x-1/2 -translate-y-full" style={{ left: selection.x, top: selection.y - 8 }}>
          <TagSelectionPopover
            onTag={(category) => {
              onTagSelection(selection.text, category);
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          />
        </div>
      )}
    </div>
  );
}

function BreakdownRow({
  element,
  onConfirm,
  onReject,
}: {
  element: BreakdownElement;
  onConfirm?: () => void;
  onReject?: () => void;
}) {
  const isSuggested = element.source === "ai-suggested";
  return (
    <li className="flex items-center justify-between gap-[var(--fs-space-8)]">
      <span className="flex items-center gap-[var(--fs-space-8)] text-[13px] text-[var(--color-text-primary)]">
        <span
          aria-hidden="true"
          className={`size-[7px] rounded-full ${isSuggested ? "border border-[var(--color-text-tertiary)]" : "bg-[var(--color-text-primary)]"}`}
        />
        {element.label}
      </span>
      {isSuggested && (
        <span className="flex items-center gap-[4px]">
          <button type="button" onClick={onConfirm} aria-label={`Confirm ${element.label}`} className="flex size-[20px] items-center justify-center rounded-[4px] text-[var(--color-status-success)] hover:bg-[var(--color-background-surface)]">
            <Check className="size-[13px]" aria-hidden="true" />
          </button>
          <button type="button" onClick={onReject} aria-label={`Reject ${element.label}`} className="flex size-[20px] items-center justify-center rounded-[4px] text-[var(--color-status-danger)] hover:bg-[var(--color-background-surface)]">
            <X className="size-[13px]" aria-hidden="true" />
          </button>
        </span>
      )}
    </li>
  );
}

function SceneForm({
  value,
  onChange,
  castMembers,
  characters,
}: {
  value: SceneInput;
  onChange: (next: SceneInput) => void;
  castMembers: ProductionSnapshot["castMembers"];
  characters: ProductionSnapshot["characters"];
}) {
  function toggleCast(id: string, checked: boolean) {
    onChange({ ...value, castMemberIds: checked ? [...value.castMemberIds, id] : value.castMemberIds.filter((c) => c !== id) });
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-12)]">
      <Input label="Number" value={value.number} onChange={(e) => onChange({ ...value, number: e.target.value })} />
      <Input label="Location" value={value.setName} onChange={(e) => onChange({ ...value, setName: e.target.value })} />
      <div className="flex gap-[var(--fs-space-8)]">
        <div className="flex flex-1 flex-col gap-[4px]">
          <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Int/Ext</label>
          <Select value={value.intExt} onValueChange={(v) => onChange({ ...value, intExt: v as Scene["intExt"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INT_EXT.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-[4px]">
          <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Day/Night</label>
          <Select value={value.dayNight} onValueChange={(v) => onChange({ ...value, dayNight: v as Scene["dayNight"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NIGHT.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Status</label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as Scene["status"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENE_STATUSES.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        label="Synopsis"
        rows={3}
        value={value.synopsis}
        onChange={(e) => onChange({ ...value, synopsis: e.target.value })}
      />
      {castMembers.length > 0 && (
        <div className="flex flex-col gap-[4px]">
          <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Cast</label>
          <ul className="flex flex-col gap-[6px]">
            {castMembers.map((c) => {
              const characterName = characters.find((ch) => ch.id === c.characterId)?.name ?? c.actorName;
              return (
                <li key={c.id} className="flex items-center gap-[var(--fs-space-8)]">
                  <Checkbox
                    id={`cast-${c.id}`}
                    checked={value.castMemberIds.includes(c.id)}
                    onCheckedChange={(checked) => toggleCast(c.id, checked === true)}
                  />
                  <label htmlFor={`cast-${c.id}`} className="text-[13px] text-[var(--color-text-primary)]">
                    {characterName} <span className="text-[var(--color-text-tertiary)]">— {c.actorName}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScriptPageContent({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialScene = searchParams.get("scene");
  const { production, scenes, scriptPages } = snapshot;
  const [activeSceneId, setActiveSceneId] = React.useState(initialScene ?? scenes[0]?.id ?? "");
  const [elements, setElements] = React.useState<BreakdownElement[]>(snapshot.breakdownElements);
  const [sceneFormMode, setSceneFormMode] = React.useState<"none" | "edit" | "create">("none");
  const [sceneFormValue, setSceneFormValue] = React.useState<SceneInput>(blankSceneInput());
  const [savingScene, setSavingScene] = React.useState(false);
  const [showRevisionImport, setShowRevisionImport] = React.useState(false);
  const { toast } = useToast();

  const scene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const sceneElements = elements.filter((e) => e.sceneId === activeSceneId);
  const suggested = sceneElements.filter((e) => e.source === "ai-suggested");
  const confirmed = sceneElements.filter((e) => e.source === "confirmed");

  function reportFailure(message: string, revert: () => void) {
    revert();
    toast({ title: "Couldn't save change", description: message, tone: "danger" });
  }

  async function confirmElement(id: string) {
    const prev = elements;
    setElements((cur) => cur.map((e) => (e.id === id ? { ...e, source: "confirmed" } : e)));
    try {
      await confirmBreakdownElement(production.id, id);
    } catch {
      reportFailure("Confirming this element failed. Please try again.", () => setElements(prev));
    }
  }

  async function rejectElement(id: string) {
    const prev = elements;
    setElements((cur) => cur.filter((e) => e.id !== id));
    try {
      await rejectBreakdownElement(production.id, id);
    } catch {
      reportFailure("Rejecting this element failed. Please try again.", () => setElements(prev));
    }
  }

  async function confirmAll() {
    const prev = elements;
    setElements((cur) => cur.map((e) => (e.sceneId === activeSceneId ? { ...e, source: "confirmed" } : e)));
    try {
      await confirmAllBreakdownElements(production.id, activeSceneId);
    } catch {
      reportFailure("Confirming all elements failed. Please try again.", () => setElements(prev));
    }
  }

  async function addTag(text: string, category: BreakdownElement["category"]) {
    const prev = elements;
    const tempId = `bd_temp_${Date.now()}`;
    const label = text.slice(0, 60);
    setElements((cur) => [...cur, { id: tempId, sceneId: activeSceneId, category, label, source: "confirmed" }]);
    try {
      const id = await addBreakdownTag(production.id, activeSceneId, category, label);
      setElements((cur) => cur.map((e) => (e.id === tempId ? { ...e, id } : e)));
    } catch {
      reportFailure("Adding this tag failed. Please try again.", () => setElements(prev));
    }
  }

  function startEditScene() {
    if (!scene) return;
    setSceneFormValue({
      number: scene.number,
      intExt: scene.intExt,
      setName: scene.setName,
      dayNight: scene.dayNight,
      synopsis: scene.synopsis,
      status: scene.status,
      castMemberIds: scene.castIds,
    });
    setSceneFormMode("edit");
  }

  function startCreateScene() {
    setSceneFormValue(blankSceneInput());
    setSceneFormMode("create");
  }

  async function saveScene() {
    setSavingScene(true);
    try {
      if (sceneFormMode === "create") {
        const id = await createScene(production.id, sceneFormValue);
        setSceneFormMode("none");
        setActiveSceneId(id);
      } else if (scene) {
        await updateScene(production.id, scene.id, sceneFormValue);
        setSceneFormMode("none");
      }
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't save scene", description: err instanceof Error ? err.message : "Please try again.", tone: "danger" });
    } finally {
      setSavingScene(false);
    }
  }

  if (!scene) {
    return (
      <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
        <div className="flex flex-1 items-center justify-center overflow-y-auto">
          <ImportScriptForm productionId={production.id} onImported={() => router.refresh()} mode="new" />
        </div>
      </Shell>
    );
  }

  if (showRevisionImport) {
    return (
      <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <button
            type="button"
            onClick={() => setShowRevisionImport(false)}
            className="self-start px-[var(--fs-space-24)] pt-[var(--fs-space-16)] text-[13px] text-[var(--color-action-primary)] hover:underline"
          >
            ← Back to script
          </button>
          <div className="flex flex-1 items-center justify-center">
            <ImportScriptForm
              productionId={production.id}
              mode="revision"
              onImported={() => {
                setShowRevisionImport(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      production={production}
      scenes={scenes}
      userEmail={userEmail ?? undefined}
      inspector={
        sceneFormMode !== "none" ? (
          <Inspector objectType="Scene" title={sceneFormMode === "create" ? "New Scene" : `Scene ${scene.number}`}>
            <SceneForm value={sceneFormValue} onChange={setSceneFormValue} castMembers={snapshot.castMembers} characters={snapshot.characters} />
            <div className="flex items-center gap-[var(--fs-space-8)]">
              <Button onClick={saveScene} loading={savingScene} disabled={savingScene}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setSceneFormMode("none")} disabled={savingScene}>
                Cancel
              </Button>
            </div>
          </Inspector>
        ) : (
          <Inspector
            objectType="Scene"
            title={`Scene ${scene.number}`}
            subtitle={`${scene.intExt}. ${scene.setName.toUpperCase()} — ${scene.dayNight}`}
            headerActions={
              <button
                type="button"
                onClick={startEditScene}
                aria-label="Edit scene"
                className="flex size-[28px] items-center justify-center rounded-md text-[var(--color-text-tertiary)] outline-none hover:bg-[var(--color-background-surface)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                <Pencil className="size-[14px]" aria-hidden="true" />
              </button>
            }
          >
            <InspectorSection label="Status">
              <StatusBadge tone={scene.status === "Shot" ? "success" : scene.status === "Omitted" ? "neutral" : "info"}>{scene.status}</StatusBadge>
            </InspectorSection>
            <InspectorSection label="Revision">
              <span className="flex items-center gap-[var(--fs-space-8)]">
                <RevisionDot color={scene.revisionColor} />
                {scene.revisionColor}
              </span>
            </InspectorSection>
            <InspectorSection label="Synopsis">{scene.synopsis || <span className="text-[var(--color-text-tertiary)]">None yet.</span>}</InspectorSection>
            <InspectorSection
              label="AI Suggested"
              action={
                suggested.length > 0 && (
                  <button type="button" onClick={confirmAll} className="text-[11px] font-medium text-[var(--color-action-primary)] hover:underline">
                    Confirm all
                  </button>
                )
              }
            >
              {suggested.length > 0 ? (
                <ul className="flex flex-col gap-[var(--fs-space-8)]">
                  {suggested.map((el) => (
                    <BreakdownRow key={el.id} element={el} onConfirm={() => confirmElement(el.id)} onReject={() => rejectElement(el.id)} />
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-[var(--color-text-tertiary)]">Nothing pending review.</p>
              )}
            </InspectorSection>
            <InspectorSection label="Confirmed">
              {confirmed.length > 0 ? (
                <ul className="flex flex-col gap-[var(--fs-space-8)]">
                  {confirmed.map((el) => (
                    <BreakdownRow key={el.id} element={el} />
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-[var(--color-text-tertiary)]">No confirmed elements yet.</p>
              )}
            </InspectorSection>
          </Inspector>
        )
      }
    >
      <div className="flex h-full min-h-0">
        <SceneNav
          scenes={scenes}
          activeSceneId={activeSceneId}
          onSelect={setActiveSceneId}
          onNewScene={startCreateScene}
          onImportRevision={() => setShowRevisionImport(true)}
        />
        <Screenplay sceneId={activeSceneId} pages={scriptPages} onTagSelection={addTag} />
      </div>
    </Shell>
  );
}

export function ScriptPageInner({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  return (
    <React.Suspense fallback={null}>
      <ScriptPageContent snapshot={snapshot} userEmail={userEmail} />
    </React.Suspense>
  );
}
