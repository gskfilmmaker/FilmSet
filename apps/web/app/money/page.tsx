import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { resolveFileUrls } from "@/lib/file-storage";
import { Shell } from "@/components/shell";
import { MoneySection } from "./money-section";

export default async function MoneyPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const fileUrls = await resolveFileUrls(snapshot.expenses.map((e) => e.documentPath));

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div>
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Money</h1>
          <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">Budget by department, and every invoice behind it</p>
        </div>
        <MoneySection productionId={snapshot.production.id} expenses={snapshot.expenses} budgetLines={snapshot.budgetLines} fileUrls={fileUrls} />
      </div>
    </Shell>
  );
}
