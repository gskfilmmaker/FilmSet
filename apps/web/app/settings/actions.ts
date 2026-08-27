"use server";

import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";

export async function updateFullName(fullName: string) {
  const user = await requireUser();
  const trimmed = fullName.trim();
  await runAsUser(user.id, (db) => db.update(schema.profiles).set({ fullName: trimmed || null }).where(eq(schema.profiles.id, user.id)));
}
