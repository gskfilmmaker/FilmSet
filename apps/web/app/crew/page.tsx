import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { resolvePhotoUrls } from "@/lib/photo-storage";
import { Shell } from "@/components/shell";
import { ImportPanel } from "@/components/import-panel";
import { CrewSection } from "./crew-section";

export default async function CrewPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const photoUrls = await resolvePhotoUrls(snapshot.crewMembers.map((c) => c.photoPath));

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Crew</h1>
          <ImportPanel productionId={snapshot.production.id} entityType="crew" />
        </div>
        <CrewSection productionId={snapshot.production.id} crewMembers={snapshot.crewMembers} photoUrls={photoUrls} />
      </div>
    </Shell>
  );
}
