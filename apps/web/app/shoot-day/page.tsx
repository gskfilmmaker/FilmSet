import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { ShootDayPageInner } from "./shoot-day-page-inner";

export default async function ShootDayPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(production.id);
  return <ShootDayPageInner snapshot={snapshot} userEmail={user.email} />;
}
