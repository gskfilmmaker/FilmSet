import { requireUser } from "@filmset/auth/server";
import { getDb, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const db = getDb();
  const [existing] = await db
    .select({ productionId: schema.productionMembers.productionId })
    .from(schema.productionMembers)
    .where(eq(schema.productionMembers.userId, user.id))
    .limit(1);
  if (existing) redirect("/overview");

  return <OnboardingForm />;
}
