import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { resolveFileUrls } from "@/lib/file-storage";
import { Shell } from "@/components/shell";
import { DocumentsSection } from "./documents-section";

export default async function DocumentsPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const fileUrls = await resolveFileUrls(snapshot.documents.map((d) => d.filePath));

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div>
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Documents</h1>
          <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">Contracts, permits, and every other production file, in one place</p>
        </div>
        <DocumentsSection
          productionId={snapshot.production.id}
          documents={snapshot.documents}
          castMembers={snapshot.castMembers}
          characters={snapshot.characters}
          crewMembers={snapshot.crewMembers}
          locations={snapshot.locations}
          fileUrls={fileUrls}
        />
      </div>
    </Shell>
  );
}
