"use client";

import { buildCsv, downloadCsv } from "@/lib/csv";
import type { CastMember, Character, CrewMember } from "@filmset/core";
import { Button, StatusBadge } from "@filmset/ui";
import { Download, Printer } from "lucide-react";
import * as React from "react";

const CSV_HEADER = [
  "Section",
  "Name",
  "Role / Character",
  "Department",
  "Phone",
  "Email",
  "Emergency Contact",
  "Emergency Phone",
  "Agent / Manager",
  "Agent Phone",
  "Agent Email",
];

export function ContactSheetView({
  productionName,
  castMembers,
  characters,
  crewMembers,
  photoUrls,
}: {
  productionName: string;
  castMembers: CastMember[];
  characters: Character[];
  crewMembers: CrewMember[];
  photoUrls: Record<string, string>;
}) {
  const characterName = React.useCallback(
    (characterId: string) => characters.find((c) => c.id === characterId)?.name ?? "Unknown",
    [characters],
  );

  const departments = React.useMemo(() => {
    const byDepartment = new Map<string, CrewMember[]>();
    for (const member of crewMembers) {
      const list = byDepartment.get(member.department) ?? [];
      list.push(member);
      byDepartment.set(member.department, list);
    }
    for (const list of byDepartment.values()) {
      list.sort((a, b) => (a.isHod === b.isHod ? a.name.localeCompare(b.name) : a.isHod ? -1 : 1));
    }
    return [...byDepartment.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [crewMembers]);

  function onDownload() {
    const rows: string[][] = [CSV_HEADER];
    for (const member of castMembers) {
      rows.push([
        "Cast",
        member.actorName || "Not yet cast",
        characterName(member.characterId),
        "",
        member.phone ?? "",
        member.email ?? "",
        member.emergencyContactName ?? "",
        member.emergencyContactPhone ?? "",
        member.agentName ?? "",
        member.agentPhone ?? "",
        member.agentEmail ?? "",
      ]);
    }
    for (const [department, members] of departments) {
      for (const member of members) {
        rows.push([
          "Crew",
          member.name,
          member.isHod ? `${member.role} (HOD)` : member.role,
          department,
          member.phone ?? "",
          member.email ?? "",
          member.emergencyContactName ?? "",
          member.emergencyContactPhone ?? "",
          member.agentName ?? "",
          member.agentPhone ?? "",
          member.agentEmail ?? "",
        ]);
      }
    }
    downloadCsv(`${productionName.replace(/[^\w-]+/g, "-")}-contact-sheet.csv`, buildCsv(rows));
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)] print:p-0 print:text-black">
      <div className="flex items-center justify-between gap-[var(--fs-space-16)] print:hidden">
        <div>
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Contact Sheet</h1>
          <p className="text-[13px] text-[var(--color-text-secondary)]">{productionName} — Cast and Crew, grouped by department</p>
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

      <p className="hidden text-[18px] font-semibold print:block">{productionName} — Contact Sheet</p>

      <section className="flex flex-col gap-[var(--fs-space-8)]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)] print:text-black">Cast</h2>
        <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border-standard)] text-left text-[12px] text-[var(--color-text-tertiary)] print:text-black">
              <th className="py-[6px] pr-[var(--fs-space-8)] font-medium print:hidden"></th>
              <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Character</th>
              <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Actor</th>
              <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Phone</th>
              <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Email</th>
              <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Agent / manager</th>
            </tr>
          </thead>
          <tbody>
            {castMembers.map((member) => (
              <tr key={member.id} className="border-b border-[var(--color-border-subtle)]">
                <td className="py-[6px] pr-[var(--fs-space-8)] print:hidden">
                  {photoUrls[member.photoPath ?? ""] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed Supabase Storage URL, no benefit from next/image here
                    <img
                      src={photoUrls[member.photoPath ?? ""]}
                      alt={member.actorName || characterName(member.characterId)}
                      className="size-[28px] rounded-full object-cover"
                    />
                  ) : (
                    <span className="block size-[28px] rounded-full bg-[var(--color-background-elevated)]" aria-hidden="true" />
                  )}
                </td>
                <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-primary)] print:text-black">{characterName(member.characterId)}</td>
                <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.actorName || "Not yet cast"}</td>
                <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.phone ?? "—"}</td>
                <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.email ?? "—"}</td>
                <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">
                  {member.agentName ? [member.agentName, member.agentPhone].filter(Boolean).join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {departments.map(([department, members]) => (
        <section key={department} className="flex flex-col gap-[var(--fs-space-8)]">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)] print:text-black">{department}</h2>
          <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[440px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-standard)] text-left text-[12px] text-[var(--color-text-tertiary)] print:text-black">
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Name</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Role</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Phone</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-[var(--color-border-subtle)]">
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-primary)] print:text-black">
                    {member.name}
                    {member.isHod && (
                      <StatusBadge tone="info" className="ml-[6px] print:hidden">
                        HOD
                      </StatusBadge>
                    )}
                    {member.isHod && <span className="hidden print:inline"> (HOD)</span>}
                  </td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.role}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.phone ?? "—"}</td>
                  <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-secondary)] print:text-black">{member.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      ))}
    </div>
  );
}
