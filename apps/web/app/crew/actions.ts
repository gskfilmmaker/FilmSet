"use server";

import { requireProductionMember } from "@/lib/authz";
import { deleteEntityPhoto, uploadEntityPhoto } from "@/lib/photo-storage";
import type { CrewMember } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

export interface CrewMemberInput {
  name: string;
  department: string;
  role: string;
  isHod: boolean;
  contract: CrewMember["contract"];
  walkieChannel: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
}

/** Form fields are always strings; an empty one means "unset" and is stored as null. */
function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validate(input: CrewMemberInput) {
  const name = input.name.trim();
  const department = input.department.trim();
  const role = input.role.trim();
  if (!name) throw new Error("Name is required.");
  if (!department) throw new Error("Department is required.");
  if (!role) throw new Error("Role is required.");
  return {
    name,
    department,
    role,
    isHod: input.isHod,
    contract: input.contract,
    walkieChannel: toNullable(input.walkieChannel),
    email: toNullable(input.email),
    phone: toNullable(input.phone),
    emergencyContactName: toNullable(input.emergencyContactName),
    emergencyContactPhone: toNullable(input.emergencyContactPhone),
    agentName: toNullable(input.agentName),
    agentPhone: toNullable(input.agentPhone),
    agentEmail: toNullable(input.agentEmail),
  };
}

export async function createCrewMember(productionId: string, input: CrewMemberInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) => db.insert(schema.crewMembers).values({ id, productionId, ...values }));
  return id;
}

export async function updateCrewMember(productionId: string, id: string, input: CrewMemberInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  await runAsUser(user.id, (db) =>
    db.update(schema.crewMembers).set(values).where(and(eq(schema.crewMembers.id, id), eq(schema.crewMembers.productionId, productionId))),
  );
}

export async function deleteCrewMember(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.crewMembers).where(and(eq(schema.crewMembers.id, id), eq(schema.crewMembers.productionId, productionId))),
  );
}

export async function uploadCrewPhoto(productionId: string, id: string, formData: FormData) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("No photo selected.");

  const [existing] = await runAsUser(user.id, (db) =>
    db
      .select({ photoPath: schema.crewMembers.photoPath })
      .from(schema.crewMembers)
      .where(and(eq(schema.crewMembers.id, id), eq(schema.crewMembers.productionId, productionId)))
      .limit(1),
  );
  if (!existing) throw new Error("Crew member not found in this production.");

  const path = await uploadEntityPhoto(productionId, "crew", id, file);
  await runAsUser(user.id, (db) =>
    db.update(schema.crewMembers).set({ photoPath: path }).where(and(eq(schema.crewMembers.id, id), eq(schema.crewMembers.productionId, productionId))),
  );
  if (existing.photoPath) await deleteEntityPhoto(existing.photoPath);
}
