import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { user, production } = await requireCurrentProduction();
  const [snapshot, profileRows] = await Promise.all([
    getProductionSnapshot(user.id, production.id),
    runAsUser(user.id, (db) =>
      db.select({ fullName: schema.profiles.fullName }).from(schema.profiles).where(eq(schema.profiles.id, user.id)).limit(1),
    ),
  ]);

  return (
    <SettingsForm
      production={snapshot.production}
      scenes={snapshot.scenes}
      userEmail={user.email}
      fullName={profileRows[0]?.fullName ?? ""}
    />
  );
}
