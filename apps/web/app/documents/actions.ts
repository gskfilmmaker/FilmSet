"use server";

import { requireProductionMember } from "@/lib/authz";
import { deleteEntityFile, uploadEntityFile } from "@/lib/file-storage";
import type { DocumentRecord } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

export interface DocumentInput {
  name: string;
  type: DocumentRecord["type"];
  status: DocumentRecord["status"];
  expiryDate: string;
  /** At most one of these three should be set — enforced by the form, not re-validated here. */
  linkedCastMemberId: string | null;
  linkedCrewMemberId: string | null;
  linkedLocationId: string | null;
}

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validate(input: DocumentInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Document name is required.");
  return {
    name,
    type: input.type,
    status: input.status,
    expiryDate: toNullable(input.expiryDate),
    linkedCastMemberId: input.linkedCastMemberId,
    linkedCrewMemberId: input.linkedCrewMemberId,
    linkedLocationId: input.linkedLocationId,
  };
}

export async function createDocument(productionId: string, input: DocumentInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  const id = crypto.randomUUID();

  await runAsUser(user.id, (db) => db.insert(schema.documents).values({ id, productionId, ...values }));
  return id;
}

export async function updateDocument(productionId: string, id: string, input: DocumentInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);

  await runAsUser(user.id, (db) =>
    db
      .update(schema.documents)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(schema.documents.id, id), eq(schema.documents.productionId, productionId))),
  );
}

export async function deleteDocument(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const [existing] = await runAsUser(user.id, (db) =>
    db
      .select({ filePath: schema.documents.filePath })
      .from(schema.documents)
      .where(and(eq(schema.documents.id, id), eq(schema.documents.productionId, productionId)))
      .limit(1),
  );
  if (!existing) return;

  await runAsUser(user.id, (db) =>
    db.delete(schema.documents).where(and(eq(schema.documents.id, id), eq(schema.documents.productionId, productionId))),
  );
  if (existing.filePath) await deleteEntityFile(existing.filePath);
}

export async function uploadDocumentFile(productionId: string, id: string, formData: FormData) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected.");

  const [existing] = await runAsUser(user.id, (db) =>
    db
      .select({ filePath: schema.documents.filePath })
      .from(schema.documents)
      .where(and(eq(schema.documents.id, id), eq(schema.documents.productionId, productionId)))
      .limit(1),
  );
  if (!existing) throw new Error("Document not found in this production.");

  const path = await uploadEntityFile(productionId, "document", id, file);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.documents)
      .set({ filePath: path, updatedAt: new Date() })
      .where(and(eq(schema.documents.id, id), eq(schema.documents.productionId, productionId))),
  );
  if (existing.filePath) await deleteEntityFile(existing.filePath);
}
