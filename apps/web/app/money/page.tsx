import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { resolveFileUrls } from "@/lib/file-storage";
import { Shell } from "@/components/shell";
import { ImportPanel } from "@/components/import-panel";
import { DesktopRecommendedBanner } from "@filmset/ui";
import { MoneySection } from "./money-section";

export default async function MoneyPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const fileUrls = await resolveFileUrls(snapshot.expenses.map((e) => e.documentPath));

  return (
    <Shell production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
          <div>
            <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Money</h1>
            <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">Budget by department, and every invoice behind it</p>
          </div>
          <ImportPanel productionId={snapshot.production.id} entityType="expense" />
        </div>
        <DesktopRecommendedBanner>
          Budget review and approval works best on a larger screen — there&rsquo;s a lot of detail to compare at once.
        </DesktopRecommendedBanner>
        <MoneySection productionId={snapshot.production.id} expenses={snapshot.expenses} budgetLines={snapshot.budgetLines} fileUrls={fileUrls} />
      </div>
    </Shell>
  );
}
