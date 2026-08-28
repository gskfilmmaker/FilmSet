"use client";

import type { CastMember, Character, Scene } from "@filmset/core";
import { Button } from "@filmset/ui";
import { Download, Printer } from "lucide-react";

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SIZING_CSV_HEADER = ["Character", "Actor", "Height", "Shirt", "Pant", "Shoe", "Sizing Notes"];
const CONTINUITY_CSV_HEADER = ["Scene", "Set", "Int/Ext", "Day/Night", "Continuity Notes"];

/**
 * The wardrobe/hair/makeup gap this closes: sizing lived buried in a
 * collapsed section on each Cast row, and continuity notes lived buried in
 * each Scene's form — nowhere combined them the way /contact-sheet combines
 * contact info. This is that same "one document" treatment for the
 * departments that need sizing + continuity at a glance, not a person's
 * phone number.
 */
export function WardrobeView({
  productionName,
  castMembers,
  characters,
  scenes,
}: {
  productionName: string;
  castMembers: CastMember[];
  characters: Character[];
  scenes: Scene[];
}) {
  const characterName = (characterId: string) => characters.find((c) => c.id === characterId)?.name ?? "Unknown";
  const sizedCast = castMembers.filter((c) => c.height || c.shirtSize || c.pantSize || c.shoeSize || c.sizingNotes);
  const notedScenes = scenes.filter((s) => s.continuityNotes.trim());

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
    for (const scene of notedScenes) {
      rows.push([scene.number, scene.setName, scene.intExt, scene.dayNight, scene.continuityNotes]);
    }
    downloadCsv(`${productionName.replace(/[^\w-]+/g, "-")}-wardrobe-report.csv`, buildCsv(rows));
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)] print:p-0 print:text-black">
      <div className="flex items-center justify-between gap-[var(--fs-space-16)] print:hidden">
        <div>
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Wardrobe &amp; Continuity</h1>
          <p className="text-[13px] text-[var(--color-text-secondary)]">{productionName} — Cast sizing and scene continuity notes, in one place</p>
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
        {sizedCast.length > 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {sizedCast.map((member) => (
                <tr key={member.id} className="border-b border-[var(--color-border-subtle)]">
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-primary)] print:text-black">{characterName(member.characterId)}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.actorName || "Not yet cast"}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.height ?? "—"}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.shirtSize ?? "—"}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.pantSize ?? "—"}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.shoeSize ?? "—"}</td>
                  <td className="py-[6px] text-[var(--color-text-secondary)] print:text-black">{member.sizingNotes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">No sizing recorded yet — add it from a cast member's "Wardrobe sizing" section on /cast.</p>
        )}
      </section>

      <section className="flex flex-col gap-[var(--fs-space-8)]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)] print:text-black">Continuity Notes</h2>
        {notedScenes.length > 0 ? (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-standard)] text-left text-[12px] text-[var(--color-text-tertiary)] print:text-black">
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Scene</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Set</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">D/N</th>
                <th className="py-[6px] font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {notedScenes.map((scene) => (
                <tr key={scene.id} className="border-b border-[var(--color-border-subtle)]">
                  <td className="py-[6px] pr-[var(--fs-space-8)] tabular-nums text-[var(--color-text-primary)] print:text-black">{scene.number}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">
                    {scene.intExt}. {scene.setName}
                  </td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{scene.dayNight}</td>
                  <td className="py-[6px] text-[var(--color-text-secondary)] print:text-black">{scene.continuityNotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">No continuity notes recorded yet — add one from a scene's edit form on /script.</p>
        )}
      </section>
    </div>
  );
}
