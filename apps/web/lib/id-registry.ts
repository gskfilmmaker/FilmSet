import "server-only";
import type { Tx } from "@filmset/db/server";
import { schema } from "@filmset/db/server";
import { and, eq, sql } from "drizzle-orm";
import { deriveShortCode, formatEntityNumber, type EntityType } from "./id-format";

export type { EntityType };
export { deriveShortCode, formatEntityNumber } from "./id-format";

/**
 * The human-readable IDs this app itself issues — credential numbers,
 * resource codes, checkpoint codes — as opposed to identifiers merely
 * captured from someone else's paperwork (vendor invoice numbers, hotel
 * room numbers), which stay free text since auto-generating those would
 * fight reality. Format: "{PRODUCTION-SHORT-CODE}-{ENTITY}-{sequence}",
 * e.g. "VMPA-CR-000001". See migration 0028's header comment.
 */
async function resolveShortCode(tx: Tx, productionId: string): Promise<string> {
  const [production] = await tx
    .select({ name: schema.productions.name, shortCode: schema.productions.shortCode })
    .from(schema.productions)
    .where(eq(schema.productions.id, productionId))
    .limit(1);
  return production?.shortCode || deriveShortCode(production?.name ?? "");
}

/**
 * Read-only — shows what the next number WOULD be, without consuming it.
 * Used to prefill the Add form the moment it opens. The real, authoritative
 * number is only decided at actual save time by issueNextEntityNumber, so
 * an abandoned form never burns a number (gaps stay reserved for real
 * cancellations/revocations, not for someone who opened a form and closed it).
 */
export async function peekNextEntityNumber(tx: Tx, productionId: string, entityType: EntityType): Promise<string> {
  const shortCode = await resolveShortCode(tx, productionId);
  const [row] = await tx
    .select({ currentValue: schema.idSequences.currentValue })
    .from(schema.idSequences)
    .where(and(eq(schema.idSequences.productionId, productionId), eq(schema.idSequences.entityType, entityType)))
    .limit(1);

  return formatEntityNumber(shortCode, entityType, (row?.currentValue ?? 0) + 1);
}

/**
 * Atomically issues and returns the next number for (production, entityType).
 * A single insert-on-conflict-update statement — Postgres executes this as
 * one atomic operation, so two Producers saving at the same instant can
 * never be handed the same number.
 */
export async function issueNextEntityNumber(tx: Tx, productionId: string, entityType: EntityType): Promise<string> {
  const shortCode = await resolveShortCode(tx, productionId);
  const result = await tx.execute<{ current_value: number }>(sql`
    insert into id_sequences (production_id, entity_type, current_value)
    values (${productionId}, ${entityType}, 1)
    on conflict (production_id, entity_type)
    do update set current_value = id_sequences.current_value + 1, updated_at = now()
    returning current_value
  `);
  const currentValue = Number(result[0]!.current_value);
  return formatEntityNumber(shortCode, entityType, currentValue);
}
