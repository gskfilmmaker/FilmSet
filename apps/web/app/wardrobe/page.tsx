import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { Shell } from "@/components/shell";
import { WardrobeView } from "./wardrobe-view";

export default async function WardrobePage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <WardrobeView
        productionName={snapshot.production.name}
        castMembers={snapshot.castMembers}
        characters={snapshot.characters}
        scenes={snapshot.scenes}
      />
    </Shell>
  );
}
