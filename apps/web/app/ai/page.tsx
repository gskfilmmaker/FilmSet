"use client";

import { Shell } from "@/components/shell";
import type { AIRecommendation, IssueSeverity } from "@filmset/core";
import { aiRecommendations, issues } from "@filmset/db";
import { Button, StatusBadge, Toaster, toast } from "@filmset/ui";
import { Info, Sparkles } from "lucide-react";
import * as React from "react";

const severityTone: Record<IssueSeverity, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};
const severityOrder: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };

function ConfidenceTag({ level }: { level: "High confidence" | "Review recommended" }) {
  return (
    <span className="inline-flex items-center gap-[4px] text-[11px] text-[var(--color-text-tertiary)]">
      <Info className="size-[11px]" aria-hidden="true" />
      {level}
    </span>
  );
}

function RecommendationCard({ rec }: { rec: AIRecommendation }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)] py-[var(--fs-space-12)]">
        <div className="flex items-center gap-[var(--fs-space-8)]">
          <StatusBadge tone={severityTone[rec.severity]}>{rec.title}</StatusBadge>
          <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{rec.subject}</span>
        </div>
        <ConfidenceTag level={rec.severity === "high" ? "High confidence" : "Review recommended"} />
      </div>
      <div className="px-[var(--fs-space-16)] py-[var(--fs-space-12)]">
        <p className="text-[13px] text-[var(--color-text-primary)]">{rec.conflict}</p>
        <p className="mt-[4px] text-[12px] text-[var(--color-text-tertiary)]">Affects {rec.affected.join(" · ")}</p>

        <div className="mt-[var(--fs-space-16)] grid grid-cols-3 gap-[var(--fs-space-12)]">
          {rec.options.map((opt) => (
            <div key={opt.label} className="flex flex-col gap-[4px] rounded-md border border-[var(--color-border-subtle)] p-[var(--fs-space-12)]">
              <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)]">Option {opt.label}</span>
              <span className="text-[13px] text-[var(--color-text-primary)]">{opt.title}</span>
              <span className="text-[12px] text-[var(--color-text-secondary)]">{opt.impact}</span>
              <Button
                variant="tertiary"
                className="mt-[4px]"
                onClick={() => toast({ tone: "info", title: `Previewing Option ${opt.label}`, description: opt.title })}
              >
                Preview
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-[var(--fs-space-16)] flex items-center gap-[var(--fs-space-8)]">
          <Button variant="secondary" onClick={() => toast({ title: "Comparing all options", description: rec.title })}>
            Compare
          </Button>
          <Button variant="quiet" onClick={() => toast({ tone: "neutral", title: "Dismissed", description: rec.title })}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

const CANNED_ANSWERS: Record<string, { answer: string; action?: string }> = {
  "what happens if we move scene 47": {
    answer:
      "Moving Scene 47 shifts Day 18's remaining 2 scenes (48, 49) to a new call time. Cast availability for Abraham, Aisha, and Karim is unaffected on the days I checked. No downstream conflicts found.",
  },
  "what's at risk this week": {
    answer: `${issues.length} open issues this week — the highest priority is Farid's unavailability on Day 20. See the ranked list below.`,
  },
};

function QueryPanel() {
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<{ answer: string; action?: string } | null>(null);
  const [unknown, setUnknown] = React.useState(false);

  function ask(q: string) {
    const key = q.trim().toLowerCase().replace(/[?.]/g, "");
    const canned = CANNED_ANSWERS[key];
    if (canned) {
      setResult(canned);
      setUnknown(false);
    } else {
      setResult(null);
      setUnknown(true);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
      <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Ask FilmSet AI</h2>
      <form
        className="mt-[var(--fs-space-8)] flex gap-[var(--fs-space-8)]"
        onSubmit={(e) => {
          e.preventDefault();
          ask(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What happens if we move Scene 47?"
          className="h-[var(--fs-control-height)] flex-1 rounded-md border border-[var(--color-border-standard)] bg-[var(--color-background-surface)] px-[var(--fs-space-12)] text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus-visible:border-[var(--color-action-primary)]"
        />
        <Button type="submit">Ask</Button>
      </form>
      <div className="mt-[var(--fs-space-8)] flex gap-[var(--fs-space-8)]">
        {["What's at risk this week?", "What happens if we move Scene 47?", "What's the cost impact of the Highway permit delay?"].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setQuery(q);
              ask(q);
            }}
            className="rounded-[4px] border border-[var(--color-border-subtle)] px-[var(--fs-space-8)] py-[4px] text-[11px] text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]"
          >
            {q}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-[var(--fs-space-16)] rounded-md bg-[var(--color-background-elevated)] p-[var(--fs-space-12)] text-[13px] text-[var(--color-text-primary)]">
          {result.answer}
        </div>
      )}
      {unknown && (
        <div className="mt-[var(--fs-space-16)] rounded-md bg-[var(--color-background-elevated)] p-[var(--fs-space-12)]">
          <p className="text-[13px] text-[var(--color-text-primary)]">
            I can&apos;t determine the cost impact because the location rate for NH19 Highway hasn&apos;t been entered.
          </p>
          <Button variant="secondary" className="mt-[var(--fs-space-8)]">
            Add Location Rate
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AIPage() {
  const rankedIssues = [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <Shell>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div>
          <h1 className="flex items-center gap-[var(--fs-space-8)] text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">
            <Sparkles className="size-[20px] text-[var(--color-action-primary)]" aria-hidden="true" />
            Production Intelligence
          </h1>
          <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">
            {issues.length} issues require attention
          </p>
        </div>

        <div className="flex flex-col gap-[var(--fs-space-12)]">
          {aiRecommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>

        <section className="rounded-lg border border-[var(--color-border-subtle)]">
          <h2 className="border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)] py-[var(--fs-space-12)] text-[13px] font-semibold text-[var(--color-text-primary)]">
            All Risks
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {rankedIssues.map((issue) => (
              <li key={issue.id} className="flex items-start justify-between gap-[var(--fs-space-16)] px-[var(--fs-space-16)] py-[var(--fs-space-12)]">
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
        </section>

        <QueryPanel />
      </div>
      <Toaster />
    </Shell>
  );
}
