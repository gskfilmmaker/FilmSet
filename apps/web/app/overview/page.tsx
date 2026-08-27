import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { OverviewPageInner } from "./overview-page-inner";

export default async function OverviewPage() {
  const { user, production, role } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  return <OverviewPageInner snapshot={snapshot} userEmail={user.email} userId={user.id} myRole={role} />;
}
