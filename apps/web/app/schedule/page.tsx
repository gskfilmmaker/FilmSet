import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { StripboardPageInner } from "./schedule-page-inner";

export default async function SchedulePage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  return <StripboardPageInner snapshot={snapshot} userEmail={user.email} />;
}
