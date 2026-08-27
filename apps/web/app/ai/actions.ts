"use server";

import { requireProductionMember, requireCurrentProduction } from "@/lib/authz";
import { answerQuestion, suggestRecommendation, type SuggestedRecommendation } from "@/lib/ai";
import { getProductionSnapshot } from "@/lib/queries";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

/**
 * The Suggest→Explain→Preview→Approve→Commit pipeline (FilmSet.pdf, AI
 * governance section): every function here except `approve*` and
 * `dismissRecommendation` is read-only — the model never writes to
 * production data directly. A suggestion only reaches `ai_recommendations`
 * (or `activities`) after a human calls one of the approve actions below.
 * Every write runs through runAsUser so RLS applies to it exactly like any
 * other user-initiated change.
 */

// --- Suggest + Explain (read-only) ---

export async function generateSuggestion(): Promise<{ logId: string; suggestion: SuggestedRecommendation }> {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const suggestion = await suggestRecommendation(snapshot);

  const logId = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.aiSuggestionLog).values({
      id: logId,
      productionId: production.id,
      requestedBy: user.id,
      kind: "recommendation",
      input: { snapshotSummary: "production risk analysis" },
      suggestion,
      explanation: suggestion.explanation,
      status: "suggested",
    }),
  );

  return { logId, suggestion };
}

export async function askFilmSetAI(question: string): Promise<string> {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  return answerQuestion(snapshot, question);
}

// --- Approve + Commit ---

/** User approved the AI's suggestion as-is — it becomes a live recommendation on the board. */
export async function approveSuggestion(productionId: string, logId: string, suggestion: SuggestedRecommendation) {
  const user = await requireUser();
  const membership = await requireProductionMember(productionId);
  const recommendationId = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      await tx.insert(schema.aiRecommendations).values({
        id: recommendationId,
        productionId,
        severity: suggestion.severity,
        title: suggestion.title,
        subject: suggestion.subject,
        conflict: suggestion.conflict,
        explanation: suggestion.explanation,
        affected: suggestion.affected,
        options: suggestion.options,
        status: "pending",
      });
      await tx
        .update(schema.aiSuggestionLog)
        .set({ status: "approved", decidedAt: new Date() })
        .where(and(eq(schema.aiSuggestionLog.id, logId), eq(schema.aiSuggestionLog.productionId, productionId)));
      await tx.insert(schema.activities).values({
        id: crypto.randomUUID(),
        productionId,
        actor: membership.role,
        description: `Approved AI recommendation: ${suggestion.title} — ${suggestion.subject}`,
      });
    }),
  );

  return recommendationId;
}

/** User discarded the AI's suggestion — nothing is written except the audit log. */
export async function rejectSuggestion(productionId: string, logId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.aiSuggestionLog)
      .set({ status: "rejected", decidedAt: new Date() })
      .where(and(eq(schema.aiSuggestionLog.id, logId), eq(schema.aiSuggestionLog.productionId, productionId))),
  );
}

/** User chose one concrete option on an already-approved recommendation — the decision is committed to the activity log. */
export async function approveRecommendationOption(productionId: string, recommendationId: string, optionLabel: string, optionTitle: string) {
  const user = await requireUser();
  const membership = await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      await tx
        .update(schema.aiRecommendations)
        .set({ status: "resolved" })
        .where(and(eq(schema.aiRecommendations.id, recommendationId), eq(schema.aiRecommendations.productionId, productionId)));
      await tx.insert(schema.activities).values({
        id: crypto.randomUUID(),
        productionId,
        actor: membership.role,
        description: `Approved Option ${optionLabel}: ${optionTitle}`,
      });
    }),
  );
}

export async function dismissRecommendation(productionId: string, recommendationId: string, title: string) {
  const user = await requireUser();
  const membership = await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      await tx
        .update(schema.aiRecommendations)
        .set({ status: "dismissed" })
        .where(and(eq(schema.aiRecommendations.id, recommendationId), eq(schema.aiRecommendations.productionId, productionId)));
      await tx.insert(schema.activities).values({
        id: crypto.randomUUID(),
        productionId,
        actor: membership.role,
        description: `Dismissed AI recommendation: ${title}`,
      });
    }),
  );
}
