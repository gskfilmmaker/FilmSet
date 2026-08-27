"use client";

import { Shell } from "@/components/shell";
import { castNames } from "@/components/stripboard/strip";
import {
  callSheetDay18,
  castMembers,
  characters,
  crewMembers,
  locations,
  shootDays,
  theBandProduction,
  theBandScenes,
} from "@filmset/db";
import { Inspector, InspectorSection, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger } from "@filmset/ui";
import { Cloud, MapPin, Sunrise, Sunset } from "lucide-react";
import * as React from "react";

const castMemberCharacterIds = Object.fromEntries(castMembers.map((c) => [c.id, c.characterId]));

const CURRENT_TIMELINE_LABEL = "Scene 48";
const SCENE_PROGRESS: Record<string, "Completed" | "In Progress" | "Planned"> = {
  scene_47: "Completed",
  scene_48: "In Progress",
  scene_49: "Planned",
};
const progressTone = { Completed: "success", "In Progress": "info", Planned: "neutral", Dropped: "danger" } as const;

export default function ShootDayPage() {
  const day = shootDays.find((d) => d.id === callSheetDay18.shootDayId)!;
  const location = locations.find((l) => l.id === day.locationId)!;
  const scenes = day.sceneIds.map((id) => theBandScenes.find((s) => s.id === id)!);
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  const selectedScene = selectedSceneId ? theBandScenes.find((s) => s.id === selectedSceneId) : null;

  return (
    <Shell
      inspector={
        selectedScene ? (
          <Inspector
            objectType="Scene"
            title={`Scene ${selectedScene.number}`}
            subtitle={`${selectedScene.intExt}. ${selectedScene.setName.toUpperCase()} — ${selectedScene.dayNight}`}
            onClose={() => setSelectedSceneId(null)}
          >
            <InspectorSection label="Status">
              <StatusBadge tone={progressTone[SCENE_PROGRESS[selectedScene.id] ?? "Planned"]}>
                {SCENE_PROGRESS[selectedScene.id] ?? "Planned"}
              </StatusBadge>
            </InspectorSection>
            <InspectorSection label="Pages">{selectedScene.pageCount}</InspectorSection>
            <InspectorSection label="Cast">{castNames(selectedScene, castMemberCharacterIds) || "—"}</InspectorSection>
            <InspectorSection label="Synopsis">{selectedScene.synopsis}</InspectorSection>
          </Inspector>
        ) : undefined
      }
    >
      <div className="flex h-full flex-col p-[var(--fs-space-24)]">
        <div className="mb-[var(--fs-space-16)] flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">
              Shoot Day {day.dayNumber} <span className="text-[var(--color-text-tertiary)]">of {day.totalDays}</span>
            </h1>
            <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">
              {day.date} — {location.name}
            </p>
          </div>
          <StatusBadge tone="info">{day.status}</StatusBadge>
        </div>

        <Tabs defaultValue="operational" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="operational">Operational View</TabsTrigger>
            <TabsTrigger value="document">Document View</TabsTrigger>
          </TabsList>

          <TabsContent value="operational" className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-[var(--fs-space-16)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
              <HeaderStat icon={<Cloud className="size-[14px]" aria-hidden="true" />} label="Weather" value={callSheetDay18.weather} />
              <HeaderStat icon={<Sunrise className="size-[14px]" aria-hidden="true" />} label="Crew Call" value={day.callTime} />
              <HeaderStat icon={<MapPin className="size-[14px]" aria-hidden="true" />} label="Basecamp" value={callSheetDay18.basecamp} />
              <HeaderStat icon={<Sunset className="size-[14px]" aria-hidden="true" />} label="Sunset" value={callSheetDay18.sunset} />
            </div>

            <div className="mt-[var(--fs-space-16)] grid grid-cols-2 gap-[var(--fs-space-16)]">
              <section className="rounded-lg border border-[var(--color-border-subtle)]">
                <h2 className="border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)] py-[var(--fs-space-12)] text-[13px] font-semibold text-[var(--color-text-primary)]">
                  Live Timeline
                </h2>
                <ol className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-16)]">
                  {callSheetDay18.timeline.map((event) => {
                    const isCurrent = event.label.includes(CURRENT_TIMELINE_LABEL);
                    return (
                      <li key={event.time} className="flex items-center gap-[var(--fs-space-12)]">
                        <span
                          aria-hidden="true"
                          className={`size-[8px] shrink-0 rounded-full ${isCurrent ? "bg-[var(--color-action-primary)]" : "bg-[var(--color-border-strong)]"}`}
                        />
                        <span className="w-[52px] shrink-0 tabular-nums text-[12px] text-[var(--color-text-tertiary)]">{event.time}</span>
                        <span className={`text-[13px] ${isCurrent ? "font-medium text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                          {event.label}
                          {isCurrent && <span className="ml-[var(--fs-space-8)] text-[11px] text-[var(--color-action-primary)]">Now</span>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="rounded-lg border border-[var(--color-border-subtle)]">
                <h2 className="border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)] py-[var(--fs-space-12)] text-[13px] font-semibold text-[var(--color-text-primary)]">
                  Scenes Today
                </h2>
                <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
                  {scenes.map((scene) => (
                    <li key={scene.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSceneId(scene.id)}
                        className="flex w-full items-center justify-between gap-[var(--fs-space-12)] px-[var(--fs-space-16)] py-[var(--fs-space-12)] text-left outline-none hover:bg-[var(--color-background-elevated)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]"
                      >
                        <div>
                          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                            Scene {scene.number} — {scene.setName}
                          </p>
                          <p className="mt-[2px] text-[12px] text-[var(--color-text-tertiary)]">{scene.pageCount} pages</p>
                        </div>
                        <StatusBadge tone={progressTone[SCENE_PROGRESS[scene.id] ?? "Planned"]}>
                          {SCENE_PROGRESS[scene.id] ?? "Planned"}
                        </StatusBadge>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="mt-[var(--fs-space-16)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
              <h2 className="mb-[var(--fs-space-8)] text-[13px] font-semibold text-[var(--color-text-primary)]">Notes</h2>
              <p className="text-[13px] text-[var(--color-text-secondary)]">{callSheetDay18.notes}</p>
            </section>
          </TabsContent>

          <TabsContent value="document" className="min-h-0 flex-1 overflow-y-auto">
            <DocumentView />
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}

function HeaderStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-[var(--fs-space-8)]">
      <span className="mt-[2px] text-[var(--color-text-tertiary)]">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">{label}</p>
        <p className="text-[13px] text-[var(--color-text-primary)]">{value}</p>
      </div>
    </div>
  );
}

/**
 * Predictable and printable (§30) — deliberately opts out of the app theme
 * (literal paper colors, not tokens) since it represents a fixed physical
 * artifact rather than application UI. A document vs. application-data
 * distinction (§61), made visual.
 */
function DocumentView() {
  const day = shootDays.find((d) => d.id === callSheetDay18.shootDayId)!;
  const location = locations.find((l) => l.id === day.locationId)!;
  const scenes = day.sceneIds.map((id) => theBandScenes.find((s) => s.id === id)!);
  const castOnDay = castMembers.filter((c) => scenes.some((s) => s.castIds.includes(c.id)));

  return (
    <div className="mx-auto my-[var(--fs-space-24)] max-w-[720px] rounded-sm bg-white p-[var(--fs-space-48)] text-black shadow-[var(--fs-shadow-lg)]">
      <div className="flex items-start justify-between border-b-2 border-black pb-[var(--fs-space-12)]">
        <div>
          <h2 className="text-[18px] font-bold">{theBandProduction.name}</h2>
          <p className="text-[12px]">Call Sheet — Day {day.dayNumber} of {day.totalDays}</p>
        </div>
        <div className="text-right text-[12px]">
          <p>{day.date}</p>
          <p>Crew Call {day.callTime}</p>
        </div>
      </div>

      <div className="mt-[var(--fs-space-16)] grid grid-cols-3 gap-[var(--fs-space-16)] text-[12px]">
        <div>
          <p className="font-semibold">Location</p>
          <p>{location.name}</p>
          <p>{location.address}</p>
        </div>
        <div>
          <p className="font-semibold">Weather</p>
          <p>{callSheetDay18.weather}</p>
          <p>Sunrise {callSheetDay18.sunrise} · Sunset {callSheetDay18.sunset}</p>
        </div>
        <div>
          <p className="font-semibold">Hospital</p>
          <p>{callSheetDay18.hospital}</p>
        </div>
      </div>

      <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
        <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Scenes</caption>
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-[4px] pr-[8px]">#</th>
            <th className="py-[4px] pr-[8px]">Set</th>
            <th className="py-[4px] pr-[8px]">D/N</th>
            <th className="py-[4px] pr-[8px]">Pages</th>
            <th className="py-[4px]">Cast</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene) => (
            <tr key={scene.id} className="border-b border-gray-300">
              <td className="py-[4px] pr-[8px] tabular-nums">{scene.number}</td>
              <td className="py-[4px] pr-[8px]">
                {scene.intExt}. {scene.setName}
              </td>
              <td className="py-[4px] pr-[8px]">{scene.dayNight}</td>
              <td className="py-[4px] pr-[8px] tabular-nums">{scene.pageCount}</td>
              <td className="py-[4px]">
                {scene.castIds
                  .map((id) => characters.find((c) => c.id === castMemberCharacterIds[id])?.name)
                  .filter(Boolean)
                  .join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
        <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Cast Call Times</caption>
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-[4px] pr-[8px]">Character</th>
            <th className="py-[4px] pr-[8px]">Actor</th>
            <th className="py-[4px]">Call</th>
          </tr>
        </thead>
        <tbody>
          {castOnDay.map((c) => (
            <tr key={c.id} className="border-b border-gray-300">
              <td className="py-[4px] pr-[8px]">{characters.find((ch) => ch.id === c.characterId)?.name}</td>
              <td className="py-[4px] pr-[8px]">{c.actorName}</td>
              <td className="py-[4px] tabular-nums">{day.callTime}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
        <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Crew</caption>
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-[4px] pr-[8px]">Department</th>
            <th className="py-[4px] pr-[8px]">Name</th>
            <th className="py-[4px]">Role</th>
          </tr>
        </thead>
        <tbody>
          {crewMembers.map((c) => (
            <tr key={c.id} className="border-b border-gray-300">
              <td className="py-[4px] pr-[8px]">{c.department}</td>
              <td className="py-[4px] pr-[8px]">{c.name}</td>
              <td className="py-[4px]">{c.role}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-[var(--fs-space-24)] text-[12px]">{callSheetDay18.notes}</p>

      <div className="mt-[var(--fs-space-24)] flex items-center justify-between border-t border-gray-300 pt-[var(--fs-space-8)] text-[10px] text-gray-500">
        <span>Confidential — Cast &amp; Crew Only</span>
        <span>Generated Today, 05:30 · Rev 3</span>
      </div>
    </div>
  );
}
