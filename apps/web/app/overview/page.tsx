import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { OverviewPageInner } from "./overview-page-inner";

export default async function OverviewPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(production.id);
  return <OverviewPageInner snapshot={snapshot} userEmail={user.email} />;
}
