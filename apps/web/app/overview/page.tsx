"use client";

import { Shell } from "@/components/shell";
import {
  activities,
  approvals,
  documents,
  issues,
  locations,
  shootDays,
  theBandProduction,
  theBandScenes,
} from "@filmset/db";
import { Button, StatusBadge } from "@filmset/ui";
import type { IssueSeverity } from "@filmset/core";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const severityTone: Record<IssueSeverity, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border-subtle)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)] py-[var(--fs-space-12)]">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {action}
      </div>
      <div className="p-[var(--fs-space-16)]">{children}</div>
    </section>
  );
}

function StatusItem({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--fs-space-4)]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">{label}</span>
      <div className="flex items-center gap-[var(--fs-space-8)]">
        <span className="text-[15px] font-medium tabular-nums text-[var(--color-text-primary)]">{value}</span>
        {badge}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const today = shootDays.find((d) => d.status === "In Progress");
  const tomorrow = shootDays.find((d) => d.status === "Scheduled");
  const pendingApprovals = approvals.filter((a) => a.status === "Pending");
  const pendingDocs = documents.filter((d) => d.status === "Draft" || d.status === "Review");
  const camera = { budgeted: 4200000, actual: 4380000 };
  const variance = (((camera.actual - camera.budgeted) / camera.budgeted) * 100).toFixed(1);

  function sceneLabel(id: string) {
    const scene = theBandScenes.find((s) => s.id === id);
    return scene ? `${scene.intExt}. ${scene.setName} — ${scene.dayNight}, Scene ${scene.number}` : id;
  }

  return (
    <Shell>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex items-start justify-between gap-[var(--fs-space-16)]">
          <div>
            <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Overview</h1>
            <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">
              {theBandProduction.name} — Day {today?.dayNumber} of {today?.totalDays}
              {today && `, ${locations.find((l) => l.id === today.locationId)?.name ?? ""}`}
            </p>
          </div>
          <Link href="/ai">
            <Button icon={<Sparkles className="size-[14px]" aria-hidden="true" />}>What&apos;s at risk?</Button>
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-[var(--fs-space-24)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
          <StatusItem label="Schedule" value="On Track" badge={<StatusBadge tone="success">Day 18/38</StatusBadge>} />
          <StatusItem label="Budget" value={`Camera +${variance}%`} badge={<StatusBadge tone="warning">Over</StatusBadge>} />
          <StatusItem label="Script" value="Blue Revision" badge={<StatusBadge tone="neutral">Locked</StatusBadge>} />
          <StatusItem label="Cast" value="1 Conflict" badge={<StatusBadge tone="danger">Day 20</StatusBadge>} />
        </div>

        <div className="grid grid-cols-2 gap-[var(--fs-space-24)]">
          <SectionCard title="Today" action={<Link href="/shoot-day" className="text-[12px] text-[var(--color-action-primary)]">Open call sheet →</Link>}>
            {today ? (
              <div className="flex flex-col gap-[var(--fs-space-8)]">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  Day {today.dayNumber} — {today.date}
                </p>
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  Call {today.callTime} · {today.sceneIds.length} scenes
                </p>
                <ul className="mt-[4px] flex flex-col gap-[4px] text-[13px] text-[var(--color-text-secondary)]">
                  {today.sceneIds.map((id) => (
                    <li key={id}>{sceneLabel(id)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--color-text-tertiary)]">No shoot day in progress.</p>
            )}
          </SectionCard>

          <SectionCard title="Tomorrow" action={<Link href="/schedule" className="text-[12px] text-[var(--color-action-primary)]">View stripboard →</Link>}>
            {tomorrow ? (
              <div className="flex flex-col gap-[var(--fs-space-8)]">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  Day {tomorrow.dayNumber} — {tomorrow.date}
                </p>
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  Call {tomorrow.callTime} · {tomorrow.sceneIds.length} scenes
                </p>
                <ul className="mt-[4px] flex flex-col gap-[4px] text-[13px] text-[var(--color-text-secondary)]">
                  {tomorrow.sceneIds.map((id) => (
                    <li key={id}>{sceneLabel(id)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--color-text-tertiary)]">Nothing scheduled.</p>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Needs Attention">
          <div className="grid grid-cols-4 gap-[var(--fs-space-16)]">
            <StatusItem label="Documents" value={String(pendingDocs.length)} />
            <StatusItem label="Approvals" value={String(pendingApprovals.length)} />
            <StatusItem label="Location Permits" value="2" />
            <StatusItem label="Purchase Orders" value="3" />
          </div>
        </SectionCard>

        <SectionCard title="Issues" action={<Link href="/ai" className="text-[12px] text-[var(--color-action-primary)]">Ask FilmSet AI →</Link>}>
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {issues.map((issue) => (
              <li key={issue.id} className="flex items-start justify-between gap-[var(--fs-space-16)] py-[var(--fs-space-12)] first:pt-0 last:pb-0">
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{issue.title}</p>
                  <p className="mt-[2px] text-[12px] text-[var(--color-text-secondary)]">{issue.description}</p>
                </div>
                <StatusBadge tone={severityTone[issue.severity]} className="shrink-0">
                  {issue.severity}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Recent Changes">
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-center justify-between gap-[var(--fs-space-16)] py-[var(--fs-space-8)] first:pt-0 last:pb-0">
                <p className="text-[13px] text-[var(--color-text-primary)]">
                  {activity.description}
                  <span className="text-[var(--color-text-tertiary)]"> — {activity.actor}</span>
                </p>
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--color-text-tertiary)]">{activity.timestamp}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </Shell>
  );
}
