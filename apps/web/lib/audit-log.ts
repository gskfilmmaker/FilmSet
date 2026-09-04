import "server-only";
import type { Tx } from "@filmset/db/server";
import { schema } from "@filmset/db/server";
import crypto from "node:crypto";

export type AuditAction = "INSERT" | "UPDATE" | "DELETE" | "RESTORE";

/**
 * Appends one row to access_audit_log — the generic, tamper-resistant trail
 * across every table in the Security & Access domain (ISO/IEC 27001 A.8.15 /
 * NIST 800-53 AU-2: security-relevant events recorded and unable to be
 * altered through the app — see docs/security/AUDIT_TRAIL_ACCESS_CONTROL.md).
 * Callers pass whole-row snapshots for `before`/`after`; there is no update
 * or delete policy on this table, so once written a row can't be revised.
 */
export async function recordAudit(
  db: Tx,
  params: {
    productionId: string;
    tableName: string;
    recordId: string;
    action: AuditAction;
    actor: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await db.insert(schema.accessAuditLog).values({
    id: crypto.randomUUID(),
    productionId: params.productionId,
    tableName: params.tableName,
    recordId: params.recordId,
    action: params.action,
    actor: params.actor,
    before: (params.before ?? null) as Record<string, unknown> | null,
    after: (params.after ?? null) as Record<string, unknown> | null,
  });
}
