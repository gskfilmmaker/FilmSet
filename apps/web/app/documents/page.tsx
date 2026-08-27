import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { Shell } from "@/components/shell";
import { EmptyState } from "@filmset/ui";
import { FolderOpen } from "lucide-react";

export default async function DocumentsPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex h-full items-center justify-center p-[var(--fs-space-24)]">
        <EmptyState
          icon={<FolderOpen className="size-full" />}
          title="Documents is coming soon"
          description="Uploading, versioning, and approving documents isn't wired up yet — the counts on Overview are read-only for now."
        />
      </div>
    </Shell>
  );
}
