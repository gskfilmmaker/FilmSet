import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { SecurityCenter } from "./security-center";

export default async function SecurityCenterPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  return (
    <SecurityCenter production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email} />
  );
}
