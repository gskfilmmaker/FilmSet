import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DepartmentPermissionPreview, type RoleBundle } from "./department-permission-preview";

const ROLE_ORDER = ["role_department_head", "role_department_coordinator", "role_department_member"];

export default async function DepartmentPermissionsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  const data = await runAsUser(user.id, async (tx) => {
    const [department] = await tx
      .select({ id: schema.departments.id, name: schema.departments.name })
      .from(schema.departments)
      .where(and(eq(schema.departments.id, departmentId), eq(schema.departments.productionId, production.id)))
      .limit(1);
    if (!department) return null;

    const [roles, grantRows, extraGrants, headCount] = await Promise.all([
      tx.select({ id: schema.roles.id, name: schema.roles.name }).from(schema.roles).where(inArray(schema.roles.id, ROLE_ORDER)),
      tx
        .select({ roleId: schema.rolePermissions.roleId, key: schema.permissions.key, description: schema.permissions.description })
        .from(schema.rolePermissions)
        .innerJoin(schema.permissions, eq(schema.permissions.key, schema.rolePermissions.permission))
        .where(inArray(schema.rolePermissions.roleId, ROLE_ORDER)),
      tx
        .select({ key: schema.departmentPermissions.permission, description: schema.permissions.description })
        .from(schema.departmentPermissions)
        .innerJoin(schema.permissions, eq(schema.permissions.key, schema.departmentPermissions.permission))
        .where(eq(schema.departmentPermissions.departmentId, departmentId)),
      tx
        .select({ userId: schema.departmentHeadAssignments.userId })
        .from(schema.departmentHeadAssignments)
        .where(eq(schema.departmentHeadAssignments.departmentId, departmentId)),
    ]);

    return { department, roles, grantRows, extraGrants, hasHead: headCount.length > 0 };
  });

  if (!data) notFound();

  const bundles: RoleBundle[] = ROLE_ORDER.map((roleId) => {
    const role = data.roles.find((r) => r.id === roleId);
    const grants = data.grantRows.filter((g) => g.roleId === roleId).sort((a, b) => a.key.localeCompare(b.key));
    return { roleId, roleName: role?.name ?? roleId, grants };
  });

  return (
    <DepartmentPermissionPreview
      production={snapshot.production}
      scenes={snapshot.scenes}
      userEmail={user.email}
      departmentId={departmentId}
      departmentName={data.department.name}
      roleBundles={bundles}
      extraGrants={data.extraGrants}
      hasHead={data.hasHead}
    />
  );
}
