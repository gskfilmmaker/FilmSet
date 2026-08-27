"use client";

import { Shell } from "@/components/shell";
import type { ProductionSnapshot } from "@/lib/queries";
import type { AIRecommendation, IssueSeverity } from "@filmset/core";
import { Button, StatusBadge, Toaster, toast } from "@filmset/ui";
import { Check, Info, Sparkles, X } from "lucide-react";
import * as React from "react";
import {
  approveRecommendationOption,
  approveSuggestion,
  askFilmSetAI,
  dismissRecommendation,
  generateSuggestion,
  rejectSuggestion,
} from "./actions";
import type { SuggestedRecommendation } from "@/lib/ai";

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

function RecommendationCard({
  rec,
  productionId,
  onResolved,
}: {
  rec: AIRecommendation;
  productionId: string;
  onResolved: (id: string) => void;
}) {
  const [pendingLabel, setPendingLabel] = React.useState<string | null>(null);
  const [dismissing, setDismissing] = React.useState(false);

  async function approveOption(label: string, title: string) {
    setPendingLabel(label);
    try {
      await approveRecommendationOption(productionId, rec.id, label, title);
      toast({ tone: "success", title: `Approved Option ${label}`, description: title });
      onResolved(rec.id);
    } catch {
      toast({ tone: "danger", title: "Couldn't approve", description: "Please try again." });
    } finally {
      setPendingLabel(null);
    }
  }

  async function dismiss() {
    setDismissing(true);
    try {
      await dismissRecommendation(productionId, rec.id, rec.title);
      toast({ tone: "neutral", title: "Dismissed", description: rec.title });
      onResolved(rec.id);
    } catch {
      toast({ tone: "danger", title: "Couldn't dismiss", description: "Please try again." });
      setDismissing(false);
    }
  }

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
        {rec.explanation && (
          <p className="mt-[8px] rounded-md bg-[var(--color-background-elevated)] p-[var(--fs-space-8)] text-[12px] text-[var(--color-text-secondary)]">
            {rec.explanation}
          </p>
        )}

        <div className="mt-[var(--fs-space-16)] grid grid-cols-3 gap-[var(--fs-space-12)]">
          {rec.options.map((opt) => (
            <div key={opt.label} className="flex flex-col gap-[4px] rounded-md border border-[var(--color-border-subtle)] p-[var(--fs-space-12)]">
              <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)]">Option {opt.label}</span>
              <span className="text-[13px] text-[var(--color-text-primary)]">{opt.title}</span>
              <span className="text-[12px] text-[var(--color-text-secondary)]">{opt.impact}</span>
              <Button
                variant="primary"
                className="mt-[4px]"
                loading={pendingLabel === opt.label}
                disabled={pendingLabel !== null || dismissing}
                onClick={() => approveOption(opt.label, opt.title)}
              >
                Approve
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-[var(--fs-space-16)] flex items-center gap-[var(--fs-space-8)]">
          <Button variant="quiet" loading={dismissing} disabled={pendingLabel !== null || dismissing} onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuggestionPreviewCard({
  productionId,
  logId,
  suggestion,
  onDecided,
}: {
  productionId: string;
  logId: string;
  suggestion: SuggestedRecommendation;
  onDecided: (committed: AIRecommendation | null) => void;
}) {
  const [deciding, setDeciding] = React.useState(false);

  async function approve() {
    setDeciding(true);
    try {
      const recommendationId = await approveSuggestion(productionId, logId, suggestion);
      toast({ tone: "success", title: "Recommendation approved", description: "Added to your risk board." });
      onDecided({ id: recommendationId, ...suggestion, status: "pending" });
    } catch {
      toast({ tone: "danger", title: "Couldn't approve", description: "Please try again." });
      setDeciding(false);
    }
  }

  async function discard() {
    setDeciding(true);
    try {
      await rejectSuggestion(productionId, logId);
      onDecided(null);
    } catch {
      toast({ tone: "danger", title: "Couldn't discard", description: "Please try again." });
      setDeciding(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-[var(--color-action-primary)] bg-[var(--color-background-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)] py-[var(--fs-space-12)]">
        <div className="flex items-center gap-[var(--fs-space-8)]">
          <Sparkles className="size-[14px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-action-primary)]">
            Suggested — not yet on your board
          </span>
        </div>
        <StatusBadge tone={severityTone[suggestion.severity]}>{suggestion.title}</StatusBadge>
      </div>
      <div className="px-[var(--fs-space-16)] py-[var(--fs-space-12)]">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{suggestion.subject}</p>
        <p className="mt-[4px] text-[13px] text-[var(--color-text-primary)]">{suggestion.conflict}</p>
        <p className="mt-[8px] rounded-md bg-[var(--color-background-surface)] p-[var(--fs-space-8)] text-[12px] text-[var(--color-text-secondary)]">
          {suggestion.explanation}
        </p>
        <div className="mt-[var(--fs-space-12)] flex flex-col gap-[4px]">
          {suggestion.options.map((opt) => (
            <p key={opt.label} className="text-[12px] text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text-primary)]">Option {opt.label}:</span> {opt.title} — {opt.impact}
            </p>
          ))}
        </div>
        <div className="mt-[var(--fs-space-16)] flex items-center gap-[var(--fs-space-8)]">
          <Button icon={<Check className="size-[14px]" aria-hidden="true" />} loading={deciding} disabled={deciding} onClick={approve}>
            Approve &amp; add to board
          </Button>
          <Button variant="quiet" icon={<X className="size-[14px]" aria-hidden="true" />} disabled={deciding} onClick={discard}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}

function QueryPanel({ askAI }: { askAI: (question: string) => Promise<string> }) {
  const [query, setQuery] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await askAI(trimmed);
      setAnswer(result);
    } catch {
      setError("FilmSet AI couldn't answer that right now. Please try again.");
    } finally {
      setLoading(false);
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
        <Button type="submit" loading={loading} disabled={loading}>
          Ask
        </Button>
      </form>
      <div className="mt-[var(--fs-space-8)] flex gap-[var(--fs-space-8)]">
        {["What's at risk this week?", "What happens if we move Scene 47?", "Is our budget on track?"].map((q) => (
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

      {answer && (
        <div className="mt-[var(--fs-space-16)] rounded-md bg-[var(--color-background-elevated)] p-[var(--fs-space-12)] text-[13px] text-[var(--color-text-primary)]">
          {answer}
        </div>
      )}
      {error && (
        <div className="mt-[var(--fs-space-16)] rounded-md bg-[var(--color-background-elevated)] p-[var(--fs-space-12)] text-[13px] text-[var(--color-status-danger)]">
          {error}
        </div>
      )}
    </div>
  );
}

function AIPageContent({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  const { production, scenes, issues } = snapshot;
  const [recommendations, setRecommendations] = React.useState<AIRecommendation[]>(snapshot.aiRecommendations);
  const [pendingSuggestion, setPendingSuggestion] = React.useState<{ logId: string; suggestion: SuggestedRecommendation } | null>(null);
  const [suggesting, setSuggesting] = React.useState(false);

  const rankedIssues = [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  async function requestSuggestion() {
    setSuggesting(true);
    try {
      const result = await generateSuggestion();
      setPendingSuggestion(result);
    } catch {
      toast({ tone: "danger", title: "FilmSet AI is unavailable", description: "Couldn't generate a recommendation right now." });
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex items-start justify-between gap-[var(--fs-space-16)]">
          <div>
            <h1 className="flex items-center gap-[var(--fs-space-8)] text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">
              <Sparkles className="size-[20px] text-[var(--color-action-primary)]" aria-hidden="true" />
              Production Intelligence
            </h1>
            <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">{issues.length} issues require attention</p>
          </div>
          <Button
            icon={<Sparkles className="size-[14px]" aria-hidden="true" />}
            loading={suggesting}
            disabled={suggesting || pendingSuggestion !== null}
            onClick={requestSuggestion}
          >
            Analyze current risks
          </Button>
        </div>

        {pendingSuggestion && (
          <SuggestionPreviewCard
            productionId={production.id}
            logId={pendingSuggestion.logId}
            suggestion={pendingSuggestion.suggestion}
            onDecided={(committed) => {
              if (committed) setRecommendations((prev) => [committed, ...prev]);
              setPendingSuggestion(null);
            }}
          />
        )}

        <div className="flex flex-col gap-[var(--fs-space-12)]">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              productionId={production.id}
              onResolved={(id) => setRecommendations((prev) => prev.filter((r) => r.id !== id))}
            />
          ))}
          {recommendations.length === 0 && !pendingSuggestion && (
            <p className="text-[13px] text-[var(--color-text-tertiary)]">
              No active recommendations. Click &quot;Analyze current risks&quot; to have FilmSet AI review the production.
            </p>
          )}
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
            {rankedIssues.length === 0 && <li className="px-[var(--fs-space-16)] py-[var(--fs-space-12)] text-[13px] text-[var(--color-text-tertiary)]">No open issues.</li>}
          </ul>
        </section>

        <QueryPanel askAI={askFilmSetAI} />
      </div>
      <Toaster />
    </Shell>
  );
}

export function AIPageInner({ snapshot, userEmail }: { snapshot: ProductionSnapshot; userEmail: string | null }) {
  return <AIPageContent snapshot={snapshot} userEmail={userEmail} />;
}
