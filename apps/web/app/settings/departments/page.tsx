import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";
import { DepartmentsDirectory, type DepartmentRow } from "./departments-directory";

export default async function DepartmentsDirectoryPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  const rows = await runAsUser(user.id, async (tx) => {
    const departments = await tx
      .select({ id: schema.departments.id, name: schema.departments.name })
      .from(schema.departments)
      .where(eq(schema.departments.productionId, production.id))
      .orderBy(schema.departments.name);

    const [heads, memberCounts] = await Promise.all([
      tx
        .select({
          departmentId: schema.departmentHeadAssignments.departmentId,
          fullName: schema.profiles.fullName,
          email: schema.profiles.email,
        })
        .from(schema.departmentHeadAssignments)
        .innerJoin(schema.profiles, eq(schema.profiles.id, schema.departmentHeadAssignments.userId))
        .innerJoin(schema.departments, eq(schema.departments.id, schema.departmentHeadAssignments.departmentId))
        .where(eq(schema.departments.productionId, production.id)),
      tx
        .select({ departmentId: schema.departmentMemberships.departmentId, userId: schema.departmentMemberships.userId })
        .from(schema.departmentMemberships)
        .innerJoin(schema.departments, eq(schema.departments.id, schema.departmentMemberships.departmentId))
        .where(eq(schema.departments.productionId, production.id)),
    ]);

    const headByDept = new Map(heads.map((h) => [h.departmentId, h.fullName || h.email]));
    const countByDept = new Map<string, number>();
    for (const m of memberCounts) countByDept.set(m.departmentId, (countByDept.get(m.departmentId) ?? 0) + 1);

    return departments.map(
      (d): DepartmentRow => ({
        id: d.id,
        name: d.name,
        headName: headByDept.get(d.id) ?? null,
        memberCount: countByDept.get(d.id) ?? 0,
      }),
    );
  });

  return (
    <DepartmentsDirectory production={snapshot.production} scenes={snapshot.scenes} userEmail={user.email} departments={rows} />
  );
}
