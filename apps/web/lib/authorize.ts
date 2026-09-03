import "server-only";
import {
  evaluateAuthorization,
  type AuthorizationDecision,
  type AuthorizationPrincipal,
  type AuthorizationResource,
  type DepartmentGrant,
  type MembershipStatus,
  type RoleGrant,
} from "@filmset/auth/authorize";
import { schema, type Tx } from "@filmset/db/server";
import { and, eq, inArray } from "drizzle-orm";

/**
 * P1b — the DB-backed half of the authorization engine. `evaluateAuthorization`
 * (@filmset/auth/authorize) stays schema-agnostic and pure; this file is
 * where it meets the real Drizzle schema, mirroring how ./authz.ts already
 * composes @filmset/auth's ProductionMembership against production_members.
 *
 * Not called from any Server Action yet — see
 * docs/audits/VRINDAVAN_MIGRATION_IMPACT.md's P1b section for why this is
 * deliberately unwired in this phase.
 */

async function loadRoleGrant(tx: Tx, roleId: string | null): Promise<RoleGrant | null> {
  if (!roleId) return null;
  const rows = await tx.select({ permission: schema.rolePermissions.permission }).from(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, roleId));
  return { roleId, permissions: rows.map((r) => r.permission) };
}

/** Resolves everything evaluateAuthorization() needs for one user within one production, in one call. */
export async function loadAuthorizationPrincipal(tx: Tx, userId: string, productionId: string): Promise<AuthorizationPrincipal> {
  const [membershipRow] = await tx
    .select({
      roleId: schema.productionMembers.roleId,
      status: schema.productionMembers.status,
      effectiveFrom: schema.productionMembers.effectiveFrom,
      effectiveUntil: schema.productionMembers.effectiveUntil,
    })
    .from(schema.productionMembers)
    .where(and(eq(schema.productionMembers.productionId, productionId), eq(schema.productionMembers.userId, userId)))
    .limit(1);

  const productionRoleGrant = membershipRow ? await loadRoleGrant(tx, membershipRow.roleId) : null;
  const isPlatformSecurityAdmin = productionRoleGrant?.roleId === "role_platform_security_admin";

  const productionMembership = membershipRow
    ? {
        status: membershipRow.status as MembershipStatus,
        effectiveFrom: membershipRow.effectiveFrom,
        effectiveUntil: membershipRow.effectiveUntil,
        role: productionRoleGrant,
      }
    : null;

  const deptMembershipRows = await tx
    .select({ departmentId: schema.departmentMemberships.departmentId, roleId: schema.departmentMemberships.roleId })
    .from(schema.departmentMemberships)
    .innerJoin(schema.departments, eq(schema.departments.id, schema.departmentMemberships.departmentId))
    .where(and(eq(schema.departments.productionId, productionId), eq(schema.departmentMemberships.userId, userId)));

  const headRows = await tx
    .select({ departmentId: schema.departmentHeadAssignments.departmentId })
    .from(schema.departmentHeadAssignments)
    .innerJoin(schema.departments, eq(schema.departments.id, schema.departmentHeadAssignments.departmentId))
    .where(and(eq(schema.departments.productionId, productionId), eq(schema.departmentHeadAssignments.userId, userId)));
  const headDepartmentIds = new Set(headRows.map((r) => r.departmentId));

  const departmentIds = [...new Set([...deptMembershipRows.map((m) => m.departmentId), ...headDepartmentIds])];

  const extraPermRows = departmentIds.length
    ? await tx
        .select({ departmentId: schema.departmentPermissions.departmentId, permission: schema.departmentPermissions.permission })
        .from(schema.departmentPermissions)
        .where(inArray(schema.departmentPermissions.departmentId, departmentIds))
    : [];

  const departmentGrants: DepartmentGrant[] = await Promise.all(
    departmentIds.map(async (departmentId): Promise<DepartmentGrant> => {
      const membershipForDept = deptMembershipRows.find((m) => m.departmentId === departmentId);
      const role = membershipForDept ? await loadRoleGrant(tx, membershipForDept.roleId) : null;
      return {
        departmentId,
        isHead: headDepartmentIds.has(departmentId),
        role,
        extraPermissions: extraPermRows.filter((p) => p.departmentId === departmentId).map((p) => p.permission),
      };
    }),
  );

  return { userId, isPlatformSecurityAdmin, productionMembership, departmentGrants };
}

/** Loads the principal and evaluates the decision in one call — the shape a Server Action would eventually call, once P1b is authorized to wire this in. */
export async function authorize(tx: Tx, userId: string, action: string, resource: AuthorizationResource): Promise<AuthorizationDecision> {
  const principal = await loadAuthorizationPrincipal(tx, userId, resource.productionId);
  return evaluateAuthorization(principal, action, resource);
}
