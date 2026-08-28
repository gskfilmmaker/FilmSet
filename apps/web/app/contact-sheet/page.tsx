import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { Shell } from "@/components/shell";
import { ContactSheetView } from "./contact-sheet-view";

export default async function ContactSheetPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <ContactSheetView
        productionName={snapshot.production.name}
        castMembers={snapshot.castMembers}
        characters={snapshot.characters}
        crewMembers={snapshot.crewMembers}
      />
    </Shell>
  );
}
