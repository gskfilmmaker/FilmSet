import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { Shell } from "@/components/shell";
import { CastSection } from "./cast-section";

export default async function CastPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Cast</h1>
        <CastSection productionId={snapshot.production.id} castMembers={snapshot.castMembers} characters={snapshot.characters} />
      </div>
    </Shell>
  );
}
