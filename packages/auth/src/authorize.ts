/**
 * The centralized authorization decision function — P1b foundation (see
 * docs/security/SECURITY_ARCHITECTURE_V1.md §1,
 * docs/security/PERMISSION_MATRIX_V1.md,
 * docs/audits/AUTHORIZATION_GAP_ANALYSIS.md §3-5). This is deliberately a
 * pure function: no database access, no Supabase client, nothing async —
 * every input it needs is passed in already resolved, so it's fully
 * unit-testable without a database (see authorize.test.ts) and its
 * decision logic can never silently depend on how the data was loaded.
 *
 * Not yet called from any Server Action in apps/web. Loading an
 * AuthorizationPrincipal from the real schema (production_members, roles,
 * role_permissions, department_memberships, department_head_assignments,
 * department_permissions) is separate, schema-specific work — this
 * package stays DB-agnostic, matching how ./server.ts's
 * ProductionMembership/assertRole() already work today.
 */

export type MembershipStatus = "ACTIVE" | "SCHEDULED" | "SUSPENDED" | "EXPIRED" | "REVOKED";

export interface RoleGrant {
  roleId: string;
  permissions: readonly string[];
}

/** One department this principal belongs to, and what that specific department grants them. */
export interface DepartmentGrant {
  departmentId: string;
  /** True only if a department_head_assignments row exists for this user on this department — the authoritative HOD record (LOGISTICS_DOMAIN_MODEL.md §5), not a role name. */
  isHead: boolean;
  role: RoleGrant | null;
  /** department_permissions rows for this department. */
  extraPermissions: readonly string[];
}

export interface ProductionMembershipContext {
  status: MembershipStatus;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  role: RoleGrant | null;
}

export interface AuthorizationPrincipal {
  userId: string;
  /** Platform Security Admin holds cross-org/production reach for security.* and permissions.* actions only (PERMISSION_MATRIX_V1.md §4) — computed by the loader, not derived here. */
  isPlatformSecurityAdmin: boolean;
  /** Null if the principal isn't a member of resource.productionId at all. */
  productionMembership: ProductionMembershipContext | null;
  /** Every department this principal belongs to, across the whole production — evaluateAuthorization only ever consults the entry matching resource.departmentId, never any other. This is what makes cross-department leakage structurally impossible rather than merely policy. */
  departmentGrants: readonly DepartmentGrant[];
}

export interface AuthorizationResource {
  productionId: string;
  /** Present only for a department-scoped resource/action. Omitted (or absent) means "evaluate at the production level only." */
  departmentId?: string;
}

export type AuthorizationDecision = { allowed: true; reason: string } | { allowed: false; reason: string };

/**
 * PERMISSION_MATRIX_V1.md §4: departments.manage/departments.assign_hod are
 * "scoped to their own DepartmentHeadAssignment" for a Department Head.
 * Deliberately NOT sourced from any role's permission bundle (see
 * packages/db/migrations/0017_authorization_foundation.sql's comment on
 * role_department_head/role_department_coordinator for why) — granted
 * here, directly, only when department_head_assignments records this
 * principal as the head of resource.departmentId. Being recorded as HOD is
 * what grants HOD authority, not holding a role string; this is what makes
 * `authorize()` actually check the AUTHORIZATION_GAP_ANALYSIS.md §5 gap
 * instead of reproducing it in a different table.
 */
const DEPARTMENT_HEAD_IMPLICIT_PERMISSIONS = ["departments.manage", "departments.assign_hod"] as const;
const DEPARTMENT_HEAD_IMPLICIT_PERMISSION_SET: ReadonlySet<string> = new Set(DEPARTMENT_HEAD_IMPLICIT_PERMISSIONS);

/**
 * Adds a role's permissions to the granted set — except
 * DEPARTMENT_HEAD_IMPLICIT_PERMISSIONS, which this function refuses to
 * grant from ANY role bundle, structurally, regardless of what a role's
 * permission data happens to contain. Those two permissions are granted
 * exactly once, in evaluateAuthorization() below, only when `isHead` is
 * true for the matching department — never as a side effect of a role
 * assignment. This is deliberate defense in depth: even a future data bug
 * (e.g. someone adds "departments.manage" to some role's row in the
 * database) cannot reopen the cross-department leak this model exists to
 * close, because this function won't honor it from role data either way.
 */
function addRoleGrant(target: Set<string>, role: RoleGrant | null): void {
  if (!role) return;
  for (const permission of role.permissions) {
    if (DEPARTMENT_HEAD_IMPLICIT_PERMISSION_SET.has(permission)) continue;
    target.add(permission);
  }
}

/**
 * Single decision function — ALLOW or DENY(reason), never a partial/
 * ambiguous result. Evaluation order matches
 * SECURITY_ARCHITECTURE_V1.md §1: cheapest/most-decisive checks first so a
 * DENY short-circuits early. Default is DENY — a resource/action with no
 * matching grant anywhere is inaccessible, full stop (§1's explicit
 * inversion of today's RLS-only "ungoverned table is accessible to any
 * member" default).
 */
export function evaluateAuthorization(
  principal: AuthorizationPrincipal,
  action: string,
  resource: AuthorizationResource,
  now: Date = new Date(),
): AuthorizationDecision {
  if (principal.isPlatformSecurityAdmin) {
    return { allowed: true, reason: "Platform Security Admin — cross-scope security/permissions access" };
  }

  const membership = principal.productionMembership;
  if (!membership) {
    return { allowed: false, reason: `Not a member of production "${resource.productionId}"` };
  }
  if (membership.status !== "ACTIVE") {
    return { allowed: false, reason: `Production membership status is ${membership.status}, not ACTIVE` };
  }
  if (membership.effectiveFrom && now < membership.effectiveFrom) {
    return { allowed: false, reason: "Production membership is not yet effective" };
  }
  if (membership.effectiveUntil && now > membership.effectiveUntil) {
    return { allowed: false, reason: "Production membership has expired" };
  }

  const granted = new Set<string>();
  addRoleGrant(granted, membership.role);

  if (resource.departmentId) {
    const deptGrant = principal.departmentGrants.find((g) => g.departmentId === resource.departmentId);
    if (deptGrant) {
      addRoleGrant(granted, deptGrant.role);
      for (const permission of deptGrant.extraPermissions) granted.add(permission);
      if (deptGrant.isHead) for (const permission of DEPARTMENT_HEAD_IMPLICIT_PERMISSIONS) granted.add(permission);
    }
    // A DepartmentGrant for any OTHER department (including one where this
    // principal genuinely is the head) never reaches this branch — the
    // `.find` above only ever matches resource.departmentId. This is the
    // entire mechanism that keeps a Costume HOD's authority from applying
    // to Camera's resources.
  }

  if (!granted.has(action)) {
    return { allowed: false, reason: `No grant includes permission "${action}"` };
  }
  return { allowed: true, reason: `Granted "${action}"` };
}
