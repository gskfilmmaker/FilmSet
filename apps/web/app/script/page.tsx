import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { ScriptPageInner } from "./script-page-inner";

export default async function ScriptPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(production.id);
  return <ScriptPageInner snapshot={snapshot} userEmail={user.email} />;
}
