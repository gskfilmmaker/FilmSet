"use server";

import { requireCurrentProduction } from "@/lib/authz";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  href: string;
}

/** Pending AI recommendations awaiting a decision + pending approvals — the two things on Overview that already mean "needs a human." */
export async function getNotifications(): Promise<NotificationItem[]> {
  const { user, production } = await requireCurrentProduction();

  const [recommendations, approvals] = await runAsUser(user.id, (db) =>
    Promise.all([
      db
        .select({ id: schema.aiRecommendations.id, title: schema.aiRecommendations.title, subject: schema.aiRecommendations.subject })
        .from(schema.aiRecommendations)
        .where(and(eq(schema.aiRecommendations.productionId, production.id), eq(schema.aiRecommendations.status, "pending"))),
      db
        .select({ id: schema.approvals.id, title: schema.approvals.title })
        .from(schema.approvals)
        .where(and(eq(schema.approvals.productionId, production.id), eq(schema.approvals.status, "Pending"))),
    ]),
  );

  return [
    ...recommendations.map((r) => ({ id: `ai-${r.id}`, title: r.title, description: r.subject, href: "/ai" })),
    ...approvals.map((a) => ({ id: `approval-${a.id}`, title: "Approval needed", description: a.title, href: "/overview" })),
  ];
}
