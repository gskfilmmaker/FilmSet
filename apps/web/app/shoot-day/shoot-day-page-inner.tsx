"use client";

import { Shell } from "@/components/shell";
import { castNames } from "@/components/stripboard/strip";
import type { ProductionSnapshot } from "@/lib/queries";
import type { CallSheet, CastCallStatus, Scene, VehicleType } from "@filmset/core";
import {
  Button,
  Checkbox,
  EmptyState,
  Input,
  Inspector,
  InspectorSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from "@filmset/ui";
import { ChevronDown, ChevronRight, Cloud, MapPin, Pencil, Plus, Sunrise, Sunset, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { saveCallSheet, type CallSheetInput } from "./call-sheet-actions";

const CAST_CALL_STATUSES: CastCallStatus[] = ["Work", "Hold", "Travel", "Start", "Work/Finish", "Finish"];
const VEHICLE_TYPES: VehicleType[] = ["Truck", "Trailer", "Picture Car", "Action Vehicle", "Camera Vehicle", "Other"];

const progressTone = { Completed: "success", "In Progress": "info", Planned: "neutral", Dropped: "danger" } as const;

function sceneProgress(scene: Scene): keyof typeof progressTone {
  if (scene.status === "Shot") return "Completed";
  if (scene.status === "Scheduled") return "In Progress";
  return "Planned";
}

const emptyCallSheet: CallSheet = {
  shootDayId: "",
  weather: "—",
  sunrise: "—",
  sunset: "—",
  hospital: "—",
  parking: "—",
  basecamp: "—",
  timeline: [],
  notes: "",
  castCallTimes: [],
  crewCallTimes: [],
};

function callSheetToInput(
  callSheet: CallSheet,
  backgroundExtras: ProductionSnapshot["backgroundExtras"],
  standIns: ProductionSnapshot["standIns"],
  vehicles: ProductionSnapshot["vehicles"],
  transportRuns: ProductionSnapshot["transportRuns"],
): CallSheetInput {
  return {
    weather: callSheet.weather === "—" ? "" : callSheet.weather,
    sunrise: callSheet.sunrise === "—" ? "" : callSheet.sunrise,
    sunset: callSheet.sunset === "—" ? "" : callSheet.sunset,
    hospital: callSheet.hospital === "—" ? "" : callSheet.hospital,
    parking: callSheet.parking === "—" ? "" : callSheet.parking,
    basecamp: callSheet.basecamp === "—" ? "" : callSheet.basecamp,
    notes: callSheet.notes,
    timeline: callSheet.timeline.map((e) => ({ time: e.time, label: e.label })),
    castCallTimes: callSheet.castCallTimes.map((c) => ({ ...c })),
    crewCallTimes: callSheet.crewCallTimes.map((c) => ({ ...c })),
    backgroundExtras: backgroundExtras.map((e) => ({ ...e })),
    standIns: standIns.map((s) => ({ ...s })),
    vehicles: vehicles.map((v) => ({ ...v })),
    transportRuns: transportRuns.map((r) => ({ ...r })),
  };
}

/** Looks up a person's call-time override, falling back to "" (meaning: use the day's general crew call). */
function overrideFor(overrides: { personId: string; callTime: string }[], personId: string): string {
  return overrides.find((o) => o.personId === personId)?.callTime ?? "";
}

function setOverride(overrides: { personId: string; callTime: string }[], personId: string, callTime: string): { personId: string; callTime: string }[] {
  const trimmed = callTime.trim();
  const withoutPerson = overrides.filter((o) => o.personId !== personId);
  return trimmed ? [...withoutPerson, { personId, callTime: trimmed }] : withoutPerson;
}

function castEntryFor(entries: CallSheetInput["castCallTimes"], personId: string): CallSheetInput["castCallTimes"][number] {
  return (
    entries.find((e) => e.personId === personId) ?? {
      personId,
      callTime: "",
      status: null,
      onCall: false,
      pickupTime: null,
      makeupCallTime: null,
      hairCallTime: null,
      wardrobeCallTime: null,
      rehearsalCallTime: null,
    }
  );
}

function isCastEntryBlank(entry: CallSheetInput["castCallTimes"][number]): boolean {
  return (
    !entry.callTime.trim() &&
    !entry.status &&
    !entry.onCall &&
    !entry.pickupTime &&
    !entry.makeupCallTime &&
    !entry.hairCallTime &&
    !entry.wardrobeCallTime &&
    !entry.rehearsalCallTime
  );
}

function setCastEntry(
  entries: CallSheetInput["castCallTimes"],
  personId: string,
  patch: Partial<CallSheetInput["castCallTimes"][number]>,
): CallSheetInput["castCallTimes"] {
  const next = { ...castEntryFor(entries, personId), ...patch, personId };
  const without = entries.filter((e) => e.personId !== personId);
  return isCastEntryBlank(next) ? without : [...without, next];
}

function CallTimesEditor({
  people,
  overrides,
  onChange,
  dayCallTime,
}: {
  people: { id: string; label: string }[];
  overrides: { personId: string; callTime: string }[];
  onChange: (next: { personId: string; callTime: string }[]) => void;
  dayCallTime: string;
}) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col gap-[var(--fs-space-8)]">
      {people.map((person) => (
        <div key={person.id} className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
          <span className="flex-1 truncate text-[13px] text-[var(--color-text-secondary)]">{person.label}</span>
          <Input
            placeholder={dayCallTime || "06:00"}
            value={overrideFor(overrides, person.id)}
            onChange={(e) => onChange(setOverride(overrides, person.id, e.target.value))}
            containerClassName="w-full sm:w-[80px]"
          />
        </div>
      ))}
    </div>
  );
}

function CastCallRow({
  person,
  entry,
  onChange,
  dayCallTime,
}: {
  person: { id: string; label: string };
  entry: CallSheetInput["castCallTimes"][number];
  onChange: (patch: Partial<CallSheetInput["castCallTimes"][number]>) => void;
  dayCallTime: string;
}) {
  const [expanded, setExpanded] = React.useState(
    () => Boolean(entry.pickupTime || entry.makeupCallTime || entry.hairCallTime || entry.wardrobeCallTime || entry.rehearsalCallTime),
  );
  return (
    <div className="flex flex-col gap-[6px] rounded-md border border-[var(--color-border-subtle)] p-[var(--fs-space-8)]">
      <div className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
        <span className="flex-1 truncate text-[13px] text-[var(--color-text-secondary)]">{person.label}</span>
        <div className="flex items-center gap-[var(--fs-space-8)]">
          <Select value={entry.status ?? "none"} onValueChange={(v) => onChange({ status: v === "none" ? null : (v as CastCallStatus) })}>
            <SelectTrigger className="w-full sm:w-[92px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {CAST_CALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex shrink-0 items-center gap-[4px] text-[11px] text-[var(--color-text-tertiary)]">
            <Checkbox checked={entry.onCall} onCheckedChange={(checked) => onChange({ onCall: checked === true })} />
            O/C
          </label>
          <Input
            placeholder={dayCallTime || "06:00"}
            value={entry.callTime}
            onChange={(e) => onChange({ callTime: e.target.value })}
            containerClassName="w-[72px] shrink-0"
            disabled={entry.onCall}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-fit items-center gap-[2px] text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
      >
        {expanded ? <ChevronDown className="size-[12px]" aria-hidden="true" /> : <ChevronRight className="size-[12px]" aria-hidden="true" />}
        Pickup / Makeup / Hair / Wardrobe / Rehearsal
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-[6px] sm:grid-cols-3">
          <Input label="Pickup" value={entry.pickupTime ?? ""} onChange={(e) => onChange({ pickupTime: e.target.value || null })} />
          <Input label="Makeup" value={entry.makeupCallTime ?? ""} onChange={(e) => onChange({ makeupCallTime: e.target.value || null })} />
          <Input label="Hair" value={entry.hairCallTime ?? ""} onChange={(e) => onChange({ hairCallTime: e.target.value || null })} />
          <Input label="Wardrobe" value={entry.wardrobeCallTime ?? ""} onChange={(e) => onChange({ wardrobeCallTime: e.target.value || null })} />
          <Input label="Rehearsal" value={entry.rehearsalCallTime ?? ""} onChange={(e) => onChange({ rehearsalCallTime: e.target.value || null })} />
        </div>
      )}
    </div>
  );
}

function CastCallEditor({
  people,
  entries,
  onChange,
  dayCallTime,
}: {
  people: { id: string; label: string }[];
  entries: CallSheetInput["castCallTimes"];
  onChange: (next: CallSheetInput["castCallTimes"]) => void;
  dayCallTime: string;
}) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col gap-[var(--fs-space-8)]">
      {people.map((person) => (
        <CastCallRow
          key={person.id}
          person={person}
          entry={castEntryFor(entries, person.id)}
          onChange={(patch) => onChange(setCastEntry(entries, person.id, patch))}
          dayCallTime={dayCallTime}
        />
      ))}
    </div>
  );
}

function BackgroundExtrasEditor({ value, onChange }: { value: CallSheetInput["backgroundExtras"]; onChange: (next: CallSheetInput["backgroundExtras"]) => void }) {
  function update(index: number, patch: Partial<CallSheetInput["backgroundExtras"][number]>) {
    onChange(value.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...value, { id: crypto.randomUUID(), description: "", headcount: 1, callTime: null, instructions: null }]);
  }
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Background / Extras</label>
      <div className="flex flex-col gap-[var(--fs-space-8)]">
        {value.map((extra, i) => (
          <div key={extra.id} className="flex flex-col gap-[6px] rounded-md border border-[var(--color-border-subtle)] p-[var(--fs-space-8)]">
            <div className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
              <Input
                placeholder="e.g. Restaurant Patrons"
                value={extra.description}
                onChange={(e) => update(i, { description: e.target.value })}
                containerClassName="flex-1"
              />
              <div className="flex items-center gap-[var(--fs-space-8)]">
                <Input
                  type="number"
                  placeholder="#"
                  value={extra.headcount || ""}
                  onChange={(e) => update(i, { headcount: Number(e.target.value) || 0 })}
                  containerClassName="w-[64px]"
                />
                <Input
                  placeholder="Call"
                  value={extra.callTime ?? ""}
                  onChange={(e) => update(i, { callTime: e.target.value || null })}
                  containerClassName="w-[72px]"
                />
                <Button type="button" variant="quiet" iconOnly icon={<Trash2 className="size-[14px]" aria-hidden="true" />} aria-label="Remove" onClick={() => remove(i)} />
              </div>
            </div>
            <Input
              placeholder="Instructions (wardrobe, department notes...)"
              value={extra.instructions ?? ""}
              onChange={(e) => update(i, { instructions: e.target.value || null })}
            />
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" icon={<Plus className="size-[14px]" aria-hidden="true" />} onClick={add} className="mt-[var(--fs-space-4)] self-start">
        Add group
      </Button>
    </div>
  );
}

function StandInsEditor({
  value,
  onChange,
  castOnDay,
}: {
  value: CallSheetInput["standIns"];
  onChange: (next: CallSheetInput["standIns"]) => void;
  castOnDay: { id: string; label: string }[];
}) {
  function update(index: number, patch: Partial<CallSheetInput["standIns"][number]>) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...value, { id: crypto.randomUUID(), name: "", standsInForCastMemberId: null, phone: null, callTime: null }]);
  }
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Stand-ins</label>
      <div className="flex flex-col gap-[var(--fs-space-8)]">
        {value.map((standIn, i) => (
          <div key={standIn.id} className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
            <Input placeholder="Name" value={standIn.name} onChange={(e) => update(i, { name: e.target.value })} containerClassName="flex-1" />
            <div className="flex items-center gap-[var(--fs-space-8)]">
              <Select
                value={standIn.standsInForCastMemberId ?? "none"}
                onValueChange={(v) => update(i, { standsInForCastMemberId: v === "none" ? null : v })}
              >
                <SelectTrigger className="w-[160px] sm:w-[140px]">
                  <SelectValue placeholder="Stands in for…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {castOnDay.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Call" value={standIn.callTime ?? ""} onChange={(e) => update(i, { callTime: e.target.value || null })} containerClassName="w-[72px]" />
              <Button type="button" variant="quiet" iconOnly icon={<Trash2 className="size-[14px]" aria-hidden="true" />} aria-label="Remove" onClick={() => remove(i)} />
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" icon={<Plus className="size-[14px]" aria-hidden="true" />} onClick={add} className="mt-[var(--fs-space-4)] self-start">
        Add stand-in
      </Button>
    </div>
  );
}

function VehiclesEditor({ value, onChange }: { value: CallSheetInput["vehicles"]; onChange: (next: CallSheetInput["vehicles"]) => void }) {
  function update(index: number, patch: Partial<CallSheetInput["vehicles"][number]>) {
    onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...value, { id: crypto.randomUUID(), type: "Truck", description: "", driverName: null, driverPhone: null, notes: null }]);
  }
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Vehicles &amp; Equipment</label>
      <div className="flex flex-col gap-[var(--fs-space-8)]">
        {value.map((vehicle, i) => (
          <div key={vehicle.id} className="flex flex-col gap-[6px] rounded-md border border-[var(--color-border-subtle)] p-[var(--fs-space-8)]">
            <div className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
              <Select value={vehicle.type} onValueChange={(v) => update(i, { type: v })}>
                <SelectTrigger className="w-full sm:w-[132px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-[var(--fs-space-8)]">
                <Input
                  placeholder="Description"
                  value={vehicle.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  containerClassName="flex-1"
                />
                <Button type="button" variant="quiet" iconOnly icon={<Trash2 className="size-[14px]" aria-hidden="true" />} aria-label="Remove" onClick={() => remove(i)} />
              </div>
            </div>
            <div className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
              <Input
                placeholder="Driver"
                value={vehicle.driverName ?? ""}
                onChange={(e) => update(i, { driverName: e.target.value || null })}
                containerClassName="flex-1"
              />
              <Input
                placeholder="Driver phone"
                value={vehicle.driverPhone ?? ""}
                onChange={(e) => update(i, { driverPhone: e.target.value || null })}
                containerClassName="flex-1"
              />
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" icon={<Plus className="size-[14px]" aria-hidden="true" />} onClick={add} className="mt-[var(--fs-space-4)] self-start">
        Add vehicle
      </Button>
    </div>
  );
}

function TransportRunsEditor({ value, onChange }: { value: CallSheetInput["transportRuns"]; onChange: (next: CallSheetInput["transportRuns"]) => void }) {
  function update(index: number, patch: Partial<CallSheetInput["transportRuns"][number]>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...value, { id: crypto.randomUUID(), driverName: null, pickupTime: null, pickupLocation: null, dropoffLocation: null, passengers: null, notes: null }]);
  }
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Transport / Shuttle Runs</label>
      <div className="flex flex-col gap-[var(--fs-space-8)]">
        {value.map((run, i) => (
          <div key={run.id} className="flex flex-col gap-[6px] rounded-md border border-[var(--color-border-subtle)] p-[var(--fs-space-8)]">
            <div className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
              <Input
                placeholder="Driver"
                value={run.driverName ?? ""}
                onChange={(e) => update(i, { driverName: e.target.value || null })}
                containerClassName="flex-1"
              />
              <div className="flex items-center gap-[var(--fs-space-8)]">
                <Input
                  placeholder="Pickup time"
                  value={run.pickupTime ?? ""}
                  onChange={(e) => update(i, { pickupTime: e.target.value || null })}
                  containerClassName="w-[90px]"
                />
                <Button type="button" variant="quiet" iconOnly icon={<Trash2 className="size-[14px]" aria-hidden="true" />} aria-label="Remove" onClick={() => remove(i)} />
              </div>
            </div>
            <div className="flex flex-col gap-[6px] sm:flex-row sm:items-center sm:gap-[var(--fs-space-8)]">
              <Input
                placeholder="From"
                value={run.pickupLocation ?? ""}
                onChange={(e) => update(i, { pickupLocation: e.target.value || null })}
                containerClassName="flex-1"
              />
              <Input
                placeholder="To"
                value={run.dropoffLocation ?? ""}
                onChange={(e) => update(i, { dropoffLocation: e.target.value || null })}
                containerClassName="flex-1"
              />
            </div>
            <Input
              placeholder="Passengers"
              value={run.passengers ?? ""}
              onChange={(e) => update(i, { passengers: e.target.value || null })}
            />
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" icon={<Plus className="size-[14px]" aria-hidden="true" />} onClick={add} className="mt-[var(--fs-space-4)] self-start">
        Add run
      </Button>
    </div>
  );
}

function CallSheetForm({
  value,
  onChange,
  castOnDay,
  crewMembers,
  dayCallTime,
}: {
  value: CallSheetInput;
  onChange: (next: CallSheetInput) => void;
  castOnDay: { id: string; label: string }[];
  crewMembers: { id: string; label: string }[];
  dayCallTime: string;
}) {
  function updateEvent(index: number, patch: Partial<{ time: string; label: string }>) {
    onChange({ ...value, timeline: value.timeline.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
  }
  function removeEvent(index: number) {
    onChange({ ...value, timeline: value.timeline.filter((_, i) => i !== index) });
  }
  function addEvent() {
    onChange({ ...value, timeline: [...value.timeline, { time: "", label: "" }] });
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-12)]">
      <Input label="Weather" value={value.weather} onChange={(e) => onChange({ ...value, weather: e.target.value })} />
      <div className="flex gap-[var(--fs-space-8)]">
        <Input label="Sunrise" value={value.sunrise} onChange={(e) => onChange({ ...value, sunrise: e.target.value })} containerClassName="flex-1" />
        <Input label="Sunset" value={value.sunset} onChange={(e) => onChange({ ...value, sunset: e.target.value })} containerClassName="flex-1" />
      </div>
      <Input label="Hospital" value={value.hospital} onChange={(e) => onChange({ ...value, hospital: e.target.value })} />
      <Input label="Parking" value={value.parking} onChange={(e) => onChange({ ...value, parking: e.target.value })} />
      <Input label="Basecamp" value={value.basecamp} onChange={(e) => onChange({ ...value, basecamp: e.target.value })} />
      <Textarea label="Notes" rows={3} value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} />

      <div className="flex flex-col gap-[4px]">
        <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Timeline</label>
        <div className="flex flex-col gap-[var(--fs-space-8)]">
          {value.timeline.map((event, i) => (
            <div key={i} className="flex items-center gap-[var(--fs-space-8)]">
              <Input
                placeholder="06:00"
                value={event.time}
                onChange={(e) => updateEvent(i, { time: e.target.value })}
                containerClassName="w-[80px]"
              />
              <Input
                placeholder="Crew call"
                value={event.label}
                onChange={(e) => updateEvent(i, { label: e.target.value })}
                containerClassName="flex-1"
              />
              <Button
                type="button"
                variant="quiet"
                iconOnly
                icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                aria-label="Remove event"
                onClick={() => removeEvent(i)}
              />
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" icon={<Plus className="size-[14px]" aria-hidden="true" />} onClick={addEvent} className="mt-[var(--fs-space-4)] self-start">
          Add event
        </Button>
      </div>

      <div className="flex flex-col gap-[4px]">
        <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Cast call times</label>
        <p className="text-[12px] text-[var(--color-text-tertiary)]">Blank call uses the general crew call above.</p>
        <CastCallEditor
          people={castOnDay}
          entries={value.castCallTimes}
          onChange={(castCallTimes) => onChange({ ...value, castCallTimes })}
          dayCallTime={dayCallTime}
        />
        {castOnDay.length === 0 && <p className="text-[12px] text-[var(--color-text-tertiary)]">No cast scheduled for this day yet.</p>}
      </div>

      <div className="flex flex-col gap-[4px]">
        <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Crew call times</label>
        <p className="text-[12px] text-[var(--color-text-tertiary)]">Blank uses the general crew call above.</p>
        <CallTimesEditor
          people={crewMembers}
          overrides={value.crewCallTimes}
          onChange={(crewCallTimes) => onChange({ ...value, crewCallTimes })}
          dayCallTime={dayCallTime}
        />
      </div>

      <BackgroundExtrasEditor value={value.backgroundExtras} onChange={(backgroundExtras) => onChange({ ...value, backgroundExtras })} />
      <StandInsEditor value={value.standIns} onChange={(standIns) => onChange({ ...value, standIns })} castOnDay={castOnDay} />
      <VehiclesEditor value={value.vehicles} onChange={(vehicles) => onChange({ ...value, vehicles })} />
      <TransportRunsEditor value={value.transportRuns} onChange={(transportRuns) => onChange({ ...value, transportRuns })} />
    </div>
  );
}

function ShootDayPageContent({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const {
    production,
    scenes: allScenes,
    shootDays,
    locations,
    castMembers,
    characters,
    crewMembers,
    callSheets,
    backgroundExtras: allBackgroundExtras,
    standIns: allStandIns,
    vehicles: allVehicles,
    transportRuns: allTransportRuns,
  } = snapshot;
  const castMemberCharacterIds = React.useMemo(() => Object.fromEntries(castMembers.map((c) => [c.id, c.characterId])), [castMembers]);
  const castMemberActorNames = React.useMemo(
    () => Object.fromEntries(castMembers.filter((c) => c.actorName).map((c) => [c.id, c.actorName])),
    [castMembers],
  );
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  const [editingCallSheet, setEditingCallSheet] = React.useState(false);
  const [callSheetForm, setCallSheetForm] = React.useState<CallSheetInput | null>(null);
  const [savingCallSheet, setSavingCallSheet] = React.useState(false);
  const initialDayId = searchParams.get("day");
  const [selectedDayId, setSelectedDayId] = React.useState<string | null>(initialDayId);

  const day =
    (selectedDayId ? shootDays.find((d) => d.id === selectedDayId) : null) ??
    shootDays.find((d) => d.status === "In Progress") ??
    shootDays[0];

  if (!day) {
    return (
      <Shell production={production} scenes={allScenes} userEmail={userEmail ?? undefined}>
        <div className="flex h-full items-center justify-center p-[var(--fs-space-24)]">
          <EmptyState
            title="No shoot days scheduled yet"
            description="Add scenes to the stripboard and schedule a shoot day to see the call sheet here."
          />
        </div>
      </Shell>
    );
  }

  const location = locations.find((l) => l.id === day.locationId);
  const callSheet = callSheets.find((c) => c.shootDayId === day.id) ?? emptyCallSheet;
  const scenes = day.sceneIds.map((id) => allScenes.find((s) => s.id === id)).filter((s): s is Scene => Boolean(s));
  const selectedScene = selectedSceneId ? allScenes.find((s) => s.id === selectedSceneId) : null;
  const currentTimelineLabel = scenes.find((s) => sceneProgress(s) === "In Progress")?.number;
  const castOnDay = castMembers.filter((c) => scenes.some((s) => s.castIds.includes(c.id)));
  const castOnDayLabeled = castOnDay.map((c) => ({
    id: c.id,
    label: `${characters.find((ch) => ch.id === c.characterId)?.name ?? "Unknown"} — ${c.actorName || "Not yet cast"}`,
  }));
  const crewMembersLabeled = crewMembers.map((c) => ({ id: c.id, label: `${c.name} (${c.department})` }));
  const backgroundExtras = allBackgroundExtras.filter((e) => e.shootDayId === day.id);
  const standIns = allStandIns.filter((s) => s.shootDayId === day.id);
  const vehicles = allVehicles.filter((v) => v.shootDayId === day.id);
  const transportRuns = allTransportRuns.filter((r) => r.shootDayId === day.id);

  function startEditCallSheet() {
    setSelectedSceneId(null);
    setCallSheetForm(callSheetToInput(callSheet, backgroundExtras, standIns, vehicles, transportRuns));
    setEditingCallSheet(true);
  }

  async function saveCallSheetForm() {
    if (!callSheetForm || !day) return;
    setSavingCallSheet(true);
    try {
      await saveCallSheet(production.id, day.id, callSheetForm);
      setEditingCallSheet(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't save call sheet", description: err instanceof Error ? err.message : "Please try again.", tone: "danger" });
    } finally {
      setSavingCallSheet(false);
    }
  }

  return (
    <Shell
      production={production}
      scenes={allScenes}
      userEmail={userEmail ?? undefined}
      inspector={
        editingCallSheet && callSheetForm ? (
          <Inspector objectType="Call Sheet" title={`Day ${day.dayNumber}`} onClose={() => setEditingCallSheet(false)}>
            <CallSheetForm
              value={callSheetForm}
              onChange={setCallSheetForm}
              castOnDay={castOnDayLabeled}
              crewMembers={crewMembersLabeled}
              dayCallTime={day.callTime}
            />
            <div className="flex items-center gap-[var(--fs-space-8)]">
              <Button onClick={saveCallSheetForm} loading={savingCallSheet} disabled={savingCallSheet}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditingCallSheet(false)} disabled={savingCallSheet}>
                Cancel
              </Button>
            </div>
          </Inspector>
        ) : selectedScene ? (
          <Inspector
            objectType="Scene"
            title={`Scene ${selectedScene.number}`}
            subtitle={`${selectedScene.intExt}. ${selectedScene.setName.toUpperCase()} — ${selectedScene.dayNight}`}
            onClose={() => setSelectedSceneId(null)}
          >
            <InspectorSection label="Status">
              <StatusBadge tone={progressTone[sceneProgress(selectedScene)]}>{sceneProgress(selectedScene)}</StatusBadge>
            </InspectorSection>
            <InspectorSection label="Pages">{selectedScene.pageCount}</InspectorSection>
            <InspectorSection label="Cast">{castNames(selectedScene, castMemberCharacterIds, characters, castMemberActorNames) || "—"}</InspectorSection>
            <InspectorSection label="Synopsis">{selectedScene.synopsis}</InspectorSection>
            {selectedScene.continuityNotes && <InspectorSection label="Continuity">{selectedScene.continuityNotes}</InspectorSection>}
          </Inspector>
        ) : undefined
      }
    >
      <div className="flex h-full flex-col p-[var(--fs-space-24)]">
        <div className="mb-[var(--fs-space-16)] flex flex-col gap-[var(--fs-space-12)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">
              Shoot Day {day.dayNumber} <span className="text-[var(--color-text-tertiary)]">of {day.totalDays}</span>
            </h1>
            <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">
              {day.date} — {location?.name ?? "No location set"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[var(--fs-space-8)]">
            {shootDays.length > 1 && (
              <Select
                value={day.id}
                onValueChange={(id) => {
                  setSelectedDayId(id);
                  setSelectedSceneId(null);
                  setEditingCallSheet(false);
                }}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shootDays.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Day {d.dayNumber} — {d.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="secondary" icon={<Pencil className="size-[14px]" aria-hidden="true" />} onClick={startEditCallSheet}>
              Edit Call Sheet
            </Button>
            <StatusBadge tone="info">{day.status}</StatusBadge>
          </div>
        </div>

        <Tabs defaultValue="operational" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="operational">Operational View</TabsTrigger>
            <TabsTrigger value="document">Document View</TabsTrigger>
          </TabsList>

          <TabsContent value="operational" className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-[var(--fs-space-16)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)] sm:grid-cols-4">
              <HeaderStat icon={<Cloud className="size-[14px]" aria-hidden="true" />} label="Weather" value={callSheet.weather} />
              <HeaderStat icon={<Sunrise className="size-[14px]" aria-hidden="true" />} label="Crew Call" value={day.callTime} />
              <HeaderStat icon={<MapPin className="size-[14px]" aria-hidden="true" />} label="Basecamp" value={callSheet.basecamp} />
              <HeaderStat icon={<Sunset className="size-[14px]" aria-hidden="true" />} label="Sunset" value={callSheet.sunset} />
            </div>

            <div className="mt-[var(--fs-space-16)] grid grid-cols-1 gap-[var(--fs-space-16)] md:grid-cols-2">
              <section className="rounded-lg border border-[var(--color-border-subtle)]">
                <h2 className="border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)] py-[var(--fs-space-12)] text-[13px] font-semibold text-[var(--color-text-primary)]">
                  Live Timeline
                </h2>
                {callSheet.timeline.length > 0 ? (
                  <ol className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-16)]">
                    {callSheet.timeline.map((event) => {
                      const isCurrent = currentTimelineLabel ? event.label.includes(`Scene ${currentTimelineLabel}`) : false;
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
                ) : (
                  <p className="p-[var(--fs-space-16)] text-[13px] text-[var(--color-text-tertiary)]">No timeline published yet.</p>
                )}
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
                        <StatusBadge tone={progressTone[sceneProgress(scene)]}>{sceneProgress(scene)}</StatusBadge>
                      </button>
                    </li>
                  ))}
                  {scenes.length === 0 && <li className="px-[var(--fs-space-16)] py-[var(--fs-space-12)] text-[13px] text-[var(--color-text-tertiary)]">No scenes scheduled for this day.</li>}
                </ul>
              </section>
            </div>

            <section className="mt-[var(--fs-space-16)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
              <h2 className="mb-[var(--fs-space-8)] text-[13px] font-semibold text-[var(--color-text-primary)]">Notes</h2>
              <p className="text-[13px] text-[var(--color-text-secondary)]">{callSheet.notes || "No notes."}</p>
            </section>
          </TabsContent>

          <TabsContent value="document" className="min-h-0 flex-1 overflow-auto">
            <DocumentView
              production={production}
              day={day}
              location={location}
              scenes={scenes}
              callSheet={callSheet}
              castMembers={castMembers}
              characters={characters}
              crewMembers={crewMembers}
              castMemberCharacterIds={castMemberCharacterIds}
              backgroundExtras={backgroundExtras}
              standIns={standIns}
              vehicles={vehicles}
              transportRuns={transportRuns}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}

export function ShootDayPageInner({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  return (
    <React.Suspense fallback={null}>
      <ShootDayPageContent snapshot={snapshot} userEmail={userEmail} />
    </React.Suspense>
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
function DocumentView({
  production,
  day,
  location,
  scenes,
  callSheet,
  castMembers,
  characters,
  crewMembers,
  castMemberCharacterIds,
  backgroundExtras,
  standIns,
  vehicles,
  transportRuns,
}: {
  production: ProductionSnapshot["production"];
  day: ProductionSnapshot["shootDays"][number];
  location: ProductionSnapshot["locations"][number] | undefined;
  scenes: Scene[];
  callSheet: CallSheet;
  castMembers: ProductionSnapshot["castMembers"];
  characters: ProductionSnapshot["characters"];
  crewMembers: ProductionSnapshot["crewMembers"];
  castMemberCharacterIds: Record<string, string>;
  backgroundExtras: ProductionSnapshot["backgroundExtras"];
  standIns: ProductionSnapshot["standIns"];
  vehicles: ProductionSnapshot["vehicles"];
  transportRuns: ProductionSnapshot["transportRuns"];
}) {
  const castOnDay = castMembers.filter((c) => scenes.some((s) => s.castIds.includes(c.id)));
  const radioChannels = crewMembers.filter((c) => c.walkieChannel);

  return (
    <div className="mx-auto my-[var(--fs-space-24)] max-w-[720px] rounded-sm bg-white p-[var(--fs-space-48)] text-black shadow-[var(--fs-shadow-lg)]">
      <div className="flex items-start justify-between border-b-2 border-black pb-[var(--fs-space-12)]">
        <div>
          <h2 className="text-[18px] font-bold">{production.name}</h2>
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
          <p>{location?.name ?? "—"}</p>
          <p>{location?.address ?? "—"}</p>
        </div>
        <div>
          <p className="font-semibold">Weather</p>
          <p>{callSheet.weather}</p>
          <p>Sunrise {callSheet.sunrise} · Sunset {callSheet.sunset}</p>
        </div>
        <div>
          <p className="font-semibold">Hospital</p>
          <p>{callSheet.hospital}</p>
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

      {scenes.some((s) => s.continuityNotes) && (
        <div className="mt-[var(--fs-space-16)] text-[12px]">
          <p className="font-semibold">Continuity Notes (Wardrobe / Hair / Makeup)</p>
          <ul className="mt-[4px] flex flex-col gap-[2px]">
            {scenes
              .filter((s) => s.continuityNotes)
              .map((s) => (
                <li key={s.id}>
                  Scene {s.number}: {s.continuityNotes}
                </li>
              ))}
          </ul>
        </div>
      )}

      <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
        <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Cast Call Times</caption>
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-[4px] pr-[8px]">Character</th>
            <th className="py-[4px] pr-[8px]">Actor</th>
            <th className="py-[4px] pr-[8px]">Status</th>
            <th className="py-[4px] pr-[8px]">Pickup</th>
            <th className="py-[4px] pr-[8px]">MU</th>
            <th className="py-[4px] pr-[8px]">Hair</th>
            <th className="py-[4px] pr-[8px]">WD</th>
            <th className="py-[4px] pr-[8px]">Rhrsl</th>
            <th className="py-[4px]">On Set</th>
          </tr>
        </thead>
        <tbody>
          {castOnDay.map((c) => {
            const entry = callSheet.castCallTimes.find((e) => e.personId === c.id);
            return (
              <tr key={c.id} className="border-b border-gray-300">
                <td className="py-[4px] pr-[8px]">{characters.find((ch) => ch.id === c.characterId)?.name}</td>
                <td className="py-[4px] pr-[8px]">{c.actorName}</td>
                <td className="py-[4px] pr-[8px]">{entry?.status ?? "—"}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{entry?.pickupTime ?? "—"}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{entry?.makeupCallTime ?? "—"}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{entry?.hairCallTime ?? "—"}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{entry?.wardrobeCallTime ?? "—"}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{entry?.rehearsalCallTime ?? "—"}</td>
                <td className="py-[4px] tabular-nums font-semibold">{entry?.onCall ? "On Call" : entry?.callTime || day.callTime}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {standIns.length > 0 && (
        <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
          <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Stand-ins</caption>
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-[4px] pr-[8px]">Name</th>
              <th className="py-[4px] pr-[8px]">Stands in for</th>
              <th className="py-[4px] pr-[8px]">Phone</th>
              <th className="py-[4px]">Call</th>
            </tr>
          </thead>
          <tbody>
            {standIns.map((s) => (
              <tr key={s.id} className="border-b border-gray-300">
                <td className="py-[4px] pr-[8px]">{s.name}</td>
                <td className="py-[4px] pr-[8px]">
                  {characters.find((ch) => ch.id === castMembers.find((c) => c.id === s.standsInForCastMemberId)?.characterId)?.name ?? "—"}
                </td>
                <td className="py-[4px] pr-[8px]">{s.phone ?? "—"}</td>
                <td className="py-[4px] tabular-nums">{s.callTime ?? day.callTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {backgroundExtras.length > 0 && (
        <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
          <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Background / Extras</caption>
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-[4px] pr-[8px]">Description</th>
              <th className="py-[4px] pr-[8px]">#</th>
              <th className="py-[4px] pr-[8px]">Call</th>
              <th className="py-[4px]">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {backgroundExtras.map((e) => (
              <tr key={e.id} className="border-b border-gray-300">
                <td className="py-[4px] pr-[8px]">{e.description}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{e.headcount}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{e.callTime ?? day.callTime}</td>
                <td className="py-[4px]">{e.instructions ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
        <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Crew</caption>
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-[4px] pr-[8px]">Department</th>
            <th className="py-[4px] pr-[8px]">Name</th>
            <th className="py-[4px] pr-[8px]">Role</th>
            <th className="py-[4px] pr-[8px]">Ch.</th>
            <th className="py-[4px]">Call</th>
          </tr>
        </thead>
        <tbody>
          {crewMembers.map((c) => (
            <tr key={c.id} className="border-b border-gray-300">
              <td className="py-[4px] pr-[8px]">{c.department}</td>
              <td className="py-[4px] pr-[8px]">{c.name}</td>
              <td className="py-[4px] pr-[8px]">{c.role}</td>
              <td className="py-[4px] pr-[8px] tabular-nums">{c.walkieChannel ?? "—"}</td>
              <td className="py-[4px] tabular-nums">{overrideFor(callSheet.crewCallTimes, c.id) || day.callTime}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {radioChannels.length > 0 && (
        <div className="mt-[var(--fs-space-16)] text-[12px]">
          <p className="font-semibold">Radio Plan</p>
          <ul className="mt-[4px] flex flex-col gap-[2px]">
            {[...radioChannels]
              .sort((a, b) => (a.walkieChannel ?? "").localeCompare(b.walkieChannel ?? "", undefined, { numeric: true }))
              .map((c) => (
                <li key={c.id}>
                  Ch {c.walkieChannel} — {c.department} ({c.name})
                </li>
              ))}
          </ul>
        </div>
      )}

      {vehicles.length > 0 && (
        <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
          <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Vehicles &amp; Equipment</caption>
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-[4px] pr-[8px]">Type</th>
              <th className="py-[4px] pr-[8px]">Description</th>
              <th className="py-[4px] pr-[8px]">Driver</th>
              <th className="py-[4px]">Driver Phone</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b border-gray-300">
                <td className="py-[4px] pr-[8px]">{v.type}</td>
                <td className="py-[4px] pr-[8px]">{v.description}</td>
                <td className="py-[4px] pr-[8px]">{v.driverName ?? "—"}</td>
                <td className="py-[4px]">{v.driverPhone ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {transportRuns.length > 0 && (
        <table className="mt-[var(--fs-space-24)] w-full border-collapse text-[12px]">
          <caption className="mb-[var(--fs-space-8)] text-left font-semibold">Transport / Shuttle Runs</caption>
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-[4px] pr-[8px]">Driver</th>
              <th className="py-[4px] pr-[8px]">Pickup</th>
              <th className="py-[4px] pr-[8px]">From</th>
              <th className="py-[4px] pr-[8px]">To</th>
              <th className="py-[4px]">Passengers</th>
            </tr>
          </thead>
          <tbody>
            {transportRuns.map((r) => (
              <tr key={r.id} className="border-b border-gray-300">
                <td className="py-[4px] pr-[8px]">{r.driverName ?? "—"}</td>
                <td className="py-[4px] pr-[8px] tabular-nums">{r.pickupTime ?? "—"}</td>
                <td className="py-[4px] pr-[8px]">{r.pickupLocation ?? "—"}</td>
                <td className="py-[4px] pr-[8px]">{r.dropoffLocation ?? "—"}</td>
                <td className="py-[4px]">{r.passengers ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-[var(--fs-space-24)] text-[12px]">{callSheet.notes}</p>

      <div className="mt-[var(--fs-space-24)] flex items-center justify-between border-t border-gray-300 pt-[var(--fs-space-8)] text-[10px] text-gray-500">
        <span>Confidential — Cast &amp; Crew Only</span>
        <span>Generated {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}
