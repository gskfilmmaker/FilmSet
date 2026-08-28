"use client";

import { updateCastSizing, type CastSizingInput } from "@/app/cast/actions";
import { updateSceneContinuity } from "@/app/script/scene-actions";
import { buildCsv, downloadCsv } from "@/lib/csv";
import type { CastMember, Character, Scene } from "@filmset/core";
import { Button, Input, Textarea, useToast } from "@filmset/ui";
import { Check, Download, Pencil, Printer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

const SIZING_CSV_HEADER = ["Character", "Actor", "Height", "Shirt", "Pant", "Shoe", "Sizing Notes"];
const CONTINUITY_CSV_HEADER = ["Scene", "Set", "Int/Ext", "Day/Night", "Continuity Notes"];

function sizingInputFor(member: CastMember): CastSizingInput {
  return {
    height: member.height ?? "",
    shirtSize: member.shirtSize ?? "",
    pantSize: member.pantSize ?? "",
    shoeSize: member.shoeSize ?? "",
    sizingNotes: member.sizingNotes ?? "",
  };
}

function SizingRow({
  productionId,
  member,
  characterName,
}: {
  productionId: string;
  member: CastMember;
  characterName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<CastSizingInput>(() => sizingInputFor(member));
  const [saving, setSaving] = React.useState(false);

  function startEdit() {
    setForm(sizingInputFor(member));
    setEditing(true);
  }

  async function onSave() {
    setSaving(true);
    try {
      await updateCastSizing(productionId, member.id, form);
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save sizing", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-[var(--color-border-subtle)] print:hidden">
        <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-primary)]">{characterName}</td>
        <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)]">{member.actorName || "Not yet cast"}</td>
        <td className="py-[6px] pr-[var(--fs-space-8)]">
          <Input value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} containerClassName="w-[70px]" placeholder="5'10&quot;" />
        </td>
        <td className="py-[6px] pr-[var(--fs-space-8)]">
          <Input value={form.shirtSize} onChange={(e) => setForm({ ...form, shirtSize: e.target.value })} containerClassName="w-[60px]" placeholder="M" />
        </td>
        <td className="py-[6px] pr-[var(--fs-space-8)]">
          <Input value={form.pantSize} onChange={(e) => setForm({ ...form, pantSize: e.target.value })} containerClassName="w-[60px]" placeholder="32" />
        </td>
        <td className="py-[6px] pr-[var(--fs-space-8)]">
          <Input value={form.shoeSize} onChange={(e) => setForm({ ...form, shoeSize: e.target.value })} containerClassName="w-[60px]" placeholder="10" />
        </td>
        <td className="py-[6px] pr-[var(--fs-space-8)]">
          <Input value={form.sizingNotes} onChange={(e) => setForm({ ...form, sizingNotes: e.target.value })} placeholder="Wigs, prosthetics, allergies…" />
        </td>
        <td className="py-[6px]">
          <div className="flex items-center gap-[4px]">
            <Button variant="quiet" iconOnly icon={<Check className="size-[14px]" aria-hidden="true" />} aria-label="Save sizing" loading={saving} onClick={onSave} />
            <Button variant="quiet" iconOnly icon={<X className="size-[14px]" aria-hidden="true" />} aria-label="Cancel" disabled={saving} onClick={() => setEditing(false)} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--color-border-subtle)]">
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-primary)] print:text-black">{characterName}</td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.actorName || "Not yet cast"}</td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.height ?? "—"}</td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.shirtSize ?? "—"}</td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.pantSize ?? "—"}</td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.shoeSize ?? "—"}</td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.sizingNotes ?? "—"}</td>
      <td className="py-[6px] print:hidden">
        <Button variant="quiet" iconOnly icon={<Pencil className="size-[14px]" aria-hidden="true" />} aria-label={`Edit sizing for ${characterName}`} onClick={startEdit} />
      </td>
    </tr>
  );
}

function ContinuityRow({ productionId, scene }: { productionId: string; scene: Scene }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [notes, setNotes] = React.useState(scene.continuityNotes);
  const [saving, setSaving] = React.useState(false);

  function startEdit() {
    setNotes(scene.continuityNotes);
    setEditing(true);
  }

  async function onSave() {
    setSaving(true);
    try {
      await updateSceneContinuity(productionId, scene.id, notes);
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save continuity note", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-[var(--color-border-subtle)] print:hidden">
        <td className="py-[6px] pr-[var(--fs-space-8)] tabular-nums text-[var(--color-text-primary)]">{scene.number}</td>
        <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)]">
          {scene.intExt}. {scene.setName}
        </td>
        <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)]">{scene.dayNight}</td>
        <td className="py-[6px] pr-[var(--fs-space-8)]">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Torn sleeve, wet hair, bruise carries from Scene 12…" />
        </td>
        <td className="py-[6px]">
          <div className="flex items-center gap-[4px]">
            <Button variant="quiet" iconOnly icon={<Check className="size-[14px]" aria-hidden="true" />} aria-label="Save continuity note" loading={saving} onClick={onSave} />
            <Button variant="quiet" iconOnly icon={<X className="size-[14px]" aria-hidden="true" />} aria-label="Cancel" disabled={saving} onClick={() => setEditing(false)} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--color-border-subtle)]">
      <td className="py-[6px] pr-[var(--fs-space-8)] tabular-nums text-[var(--color-text-primary)] print:text-black">{scene.number}</td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">
        {scene.intExt}. {scene.setName}
      </td>
      <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{scene.dayNight}</td>
      <td className="py-[6px] text-[var(--color-text-secondary)] print:text-black">{scene.continuityNotes || "—"}</td>
      <td className="py-[6px] print:hidden">
        <Button variant="quiet" iconOnly icon={<Pencil className="size-[14px]" aria-hidden="true" />} aria-label={`Edit continuity note for Scene ${scene.number}`} onClick={startEdit} />
      </td>
    </tr>
  );
}

/**
 * The wardrobe/hair/makeup gap this closes: sizing lived buried in a
 * collapsed section on each Cast row, and continuity notes lived buried in
 * each Scene's form — nowhere combined them the way /contact-sheet combines
 * contact info, and neither could be entered from here directly. This is
 * the department's own workspace — sizing and continuity are logged right
 * here, matching how Wardrobe/Costume modules work in industry-standard
 * production tools (StudioBinder, Yamdu, Celtx Studio) rather than routing
 * through Cast's or Script's own edit forms.
 */
export function WardrobeView({
  productionId,
  productionName,
  castMembers,
  characters,
  scenes,
}: {
  productionId: string;
  productionName: string;
  castMembers: CastMember[];
  characters: Character[];
  scenes: Scene[];
}) {
  const characterName = (characterId: string) => characters.find((c) => c.id === characterId)?.name ?? "Unknown";

  function onDownload() {
    const rows: string[][] = [["Wardrobe Sizing"], SIZING_CSV_HEADER];
    for (const member of castMembers) {
      rows.push([
        characterName(member.characterId),
        member.actorName || "Not yet cast",
        member.height ?? "",
        member.shirtSize ?? "",
        member.pantSize ?? "",
        member.shoeSize ?? "",
        member.sizingNotes ?? "",
      ]);
    }
    rows.push([], ["Continuity Notes"], CONTINUITY_CSV_HEADER);
    for (const scene of scenes) {
      rows.push([scene.number, scene.setName, scene.intExt, scene.dayNight, scene.continuityNotes]);
    }
    downloadCsv(`${productionName.replace(/[^\w-]+/g, "-")}-wardrobe-report.csv`, buildCsv(rows));
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)] print:p-0 print:text-black">
      <div className="flex items-center justify-between gap-[var(--fs-space-16)] print:hidden">
        <div>
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Wardrobe &amp; Continuity</h1>
          <p className="text-[13px] text-[var(--color-text-secondary)]">{productionName} — Cast sizing and scene continuity notes, logged right here</p>
        </div>
        <div className="flex items-center gap-[var(--fs-space-8)]">
          <Button variant="secondary" icon={<Download className="size-[14px]" aria-hidden="true" />} onClick={onDownload}>
            Download CSV
          </Button>
          <Button variant="secondary" icon={<Printer className="size-[14px]" aria-hidden="true" />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <p className="hidden text-[18px] font-semibold print:block">{productionName} — Wardrobe &amp; Continuity</p>

      <section className="flex flex-col gap-[var(--fs-space-8)]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)] print:text-black">Wardrobe Sizing</h2>
        {castMembers.length > 0 ? (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-standard)] text-left text-[12px] text-[var(--color-text-tertiary)] print:text-black">
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Character</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Actor</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Height</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Shirt</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Pant</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Shoe</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Notes</th>
                <th className="py-[6px] font-medium print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {castMembers.map((member) => (
                <SizingRow key={member.id} productionId={productionId} member={member} characterName={characterName(member.characterId)} />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">No cast yet — add cast members on /cast first, then their sizing can be logged here.</p>
        )}
      </section>

      <section className="flex flex-col gap-[var(--fs-space-8)]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)] print:text-black">Continuity Notes</h2>
        {scenes.length > 0 ? (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-standard)] text-left text-[12px] text-[var(--color-text-tertiary)] print:text-black">
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Scene</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Set</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">D/N</th>
                <th className="py-[6px] font-medium">Notes</th>
                <th className="py-[6px] font-medium print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {scenes.map((scene) => (
                <ContinuityRow key={scene.id} productionId={productionId} scene={scene} />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">No scenes yet — import or add a script on /script first, then continuity can be logged here.</p>
        )}
      </section>
    </div>
  );
}
