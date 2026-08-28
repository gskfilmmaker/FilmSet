import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { Shell } from "@/components/shell";
import { CrewSection } from "./crew-section";

export default async function CrewPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Crew</h1>
        <CrewSection productionId={snapshot.production.id} crewMembers={snapshot.crewMembers} />
      </div>
    </Shell>
  );
}
