import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DepartmentMembership, type DepartmentMemberRow, type EligibleMember, type RoleOption } from "./department-membership";

export default async function DepartmentDetailPage({ params }: { params: Promise<{ departmentId: string }> }) {
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

    const [head] = await tx
      .select({ userId: schema.departmentHeadAssignments.userId, fullName: schema.profiles.fullName, email: schema.profiles.email })
      .from(schema.departmentHeadAssignments)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.departmentHeadAssignments.userId))
      .where(eq(schema.departmentHeadAssignments.departmentId, departmentId))
      .limit(1);

    const memberRows = await tx
      .select({
        userId: schema.departmentMemberships.userId,
        roleId: schema.departmentMemberships.roleId,
        roleName: schema.roles.name,
        fullName: schema.profiles.fullName,
        email: schema.profiles.email,
        createdAt: schema.departmentMemberships.createdAt,
      })
      .from(schema.departmentMemberships)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.departmentMemberships.userId))
      .leftJoin(schema.roles, eq(schema.roles.id, schema.departmentMemberships.roleId))
      .where(eq(schema.departmentMemberships.departmentId, departmentId));

    const roleOptions = await tx
      .select({ id: schema.roles.id, name: schema.roles.name })
      .from(schema.roles)
      .where(eq(schema.roles.isSystemTemplate, true));

    return { department, head: head ?? null, memberRows, roleOptions };
  });

  if (!data) notFound();

  const memberIds = new Set(data.memberRows.map((m) => m.userId));
  const eligibleMembers: EligibleMember[] = snapshot.members
    .filter((m) => !memberIds.has(m.userId))
    .map((m) => ({ userId: m.userId, label: m.fullName || m.email }));

  const members: DepartmentMemberRow[] = data.memberRows.map((m) => ({
    userId: m.userId,
    label: m.fullName || m.email,
    roleId: m.roleId,
    roleName: m.roleName ?? "No role",
    since: m.createdAt.toISOString().slice(0, 10),
  }));

  const departmentRoleOptions: RoleOption[] = data.roleOptions
    .filter((r) => r.id === "role_department_head" || r.id === "role_department_coordinator" || r.id === "role_department_member")
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DepartmentMembership
      production={snapshot.production}
      scenes={snapshot.scenes}
      userEmail={user.email}
      departmentId={data.department.id}
      departmentName={data.department.name}
      head={data.head ? { userId: data.head.userId, label: data.head.fullName || data.head.email } : null}
      members={members}
      eligibleMembers={eligibleMembers}
      roleOptions={departmentRoleOptions}
    />
  );
}
