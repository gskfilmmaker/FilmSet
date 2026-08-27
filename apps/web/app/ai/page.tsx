import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { AIPageInner } from "./ai-page-inner";

export default async function AIPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  return <AIPageInner snapshot={snapshot} userEmail={user.email} />;
}
