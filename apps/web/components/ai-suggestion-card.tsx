"use client";

import { approveSuggestion, rejectSuggestion } from "@/app/ai/actions";
import type { SuggestedRecommendation } from "@/lib/ai";
import type { AIRecommendation, IssueSeverity } from "@filmset/core";
import { Button, StatusBadge, toast } from "@filmset/ui";
import { Check, Sparkles, X } from "lucide-react";
import * as React from "react";

const severityTone: Record<IssueSeverity, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

/**
 * The Preview step of the Suggest→Explain→Preview→Approve→Commit pipeline —
 * a not-yet-committed AI suggestion with Approve/Discard. Shared between
 * /ai (schedule/budget recommendations) and anywhere else a Suggest step
 * produces a SuggestedRecommendation, e.g. the location-photo-match feature
 * on /locations, so every AI suggestion in the app looks and behaves the
 * same way.
 */
export function SuggestionPreviewCard({
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
