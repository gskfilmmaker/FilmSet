import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { resolvePhotoUrls } from "@/lib/photo-storage";
import { Shell } from "@/components/shell";
import { LocationsSection } from "./locations-section";

export default async function LocationsPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const photoUrls = await resolvePhotoUrls(snapshot.locations.map((l) => l.photoPath));

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Locations</h1>
        <LocationsSection productionId={snapshot.production.id} locations={snapshot.locations} photoUrls={photoUrls} />
      </div>
    </Shell>
  );
}
