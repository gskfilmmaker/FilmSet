import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { Shell } from "@/components/shell";
import { EmptyState } from "@filmset/ui";
import { Wallet } from "lucide-react";

export default async function MoneyPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex h-full items-center justify-center p-[var(--fs-space-24)]">
        <EmptyState
          icon={<Wallet className="size-full" />}
          title="Money is coming soon"
          description="Budget lines, expenses, and purchase orders aren't editable here yet — the numbers on Overview are read-only for now."
        />
      </div>
    </Shell>
  );
}
