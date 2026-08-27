"use server";

import { requireUser } from "@filmset/auth/server";
import { getDb, schema } from "@filmset/db/server";
import { redirect } from "next/navigation";

export async function createProduction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Production name is required.");

  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(schema.productions).values({ id, name, phase: "Development", createdBy: user.id });
  await db.insert(schema.productionMembers).values({ productionId: id, userId: user.id, role: "Producer" });

  redirect("/overview");
}
