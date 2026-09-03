"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

/**
 * Real, data-backed Server Actions for DEPARTMENT_UX_SPEC.md's Membership
 * screen (§3) — the first implementation slice of P2's spec, per the
 * owner's explicit request to build real screens rather than stop at the
 * design document.
 *
 * Gated with `requireProductionMember(productionId, ["Producer"])`,
 * matching `overview/team-actions.ts`'s existing precedent for
 * membership-management actions — the closest analogous convention
 * already in the codebase. This is a deliberate interim choice: nothing
 * here calls `authorize()`/`checkWithShadow()` (P1c), since flipping any
 * real gate is explicitly out of that plan's scope until separately
 * authorized. Migrating these actions to a department-scoped permission
 * check is exactly what AUTHORIZATION_WIRING_PLAN.md's Phase 8
 * ("Future logistics" / future department-scoped work) would cover.
 */

/**
 * Sets (or clears) a department's Head of Department. Per
 * DEPARTMENT_UX_SPEC.md §3: `department_head_assignments` is the sole
 * source `authorize()` checks for HOD-only permissions — never a role
 * bundle — so this table, not `department_memberships.role_id`, is what
 * this action writes. One HOD per department in this UI (the schema
 * technically allows more; the "Change HOD" dialog always replaces the
 * existing one rather than adding a second).
 */
export async function setDepartmentHead(productionId: string, departmentId: string, userId: string | null) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [department] = await tx
        .select({ id: schema.departments.id })
        .from(schema.departments)
        .where(and(eq(schema.departments.id, departmentId), eq(schema.departments.productionId, productionId)))
        .limit(1);
      if (!department) throw new Error("Department not found in this production.");

      await tx.delete(schema.departmentHeadAssignments).where(eq(schema.departmentHeadAssignments.departmentId, departmentId));
      if (userId) {
        await tx.insert(schema.departmentHeadAssignments).values({ departmentId, userId });
      }
    }),
  );
}

/**
 * Adds a production member to a department. Per DEPARTMENT_UX_SPEC.md §3,
 * a new HOD should ordinarily already be a member — this action is also
 * what the "Change HOD" dialog calls first for someone not yet listed,
 * before setDepartmentHead.
 */
export async function addDepartmentMember(productionId: string, departmentId: string, userId: string, roleId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [department] = await tx
        .select({ id: schema.departments.id })
        .from(schema.departments)
        .where(and(eq(schema.departments.id, departmentId), eq(schema.departments.productionId, productionId)))
        .limit(1);
      if (!department) throw new Error("Department not found in this production.");

      const [member] = await tx
        .select({ userId: schema.productionMembers.userId })
        .from(schema.productionMembers)
        .where(and(eq(schema.productionMembers.productionId, productionId), eq(schema.productionMembers.userId, userId)))
        .limit(1);
      if (!member) throw new Error("That person isn't a member of this production.");

      await tx
        .insert(schema.departmentMemberships)
        .values({ departmentId, userId, roleId })
        .onConflictDoUpdate({ target: [schema.departmentMemberships.departmentId, schema.departmentMemberships.userId], set: { roleId } });
    }),
  );
}

/**
 * Removes a department member. Also clears any HOD assignment for that
 * same department+user — a person who is no longer a member of a
 * department can't remain its HOD (department_head_assignments has no FK
 * back to department_memberships, so this has to be done explicitly).
 */
export async function removeDepartmentMember(productionId: string, departmentId: string, userId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [department] = await tx
        .select({ id: schema.departments.id })
        .from(schema.departments)
        .where(and(eq(schema.departments.id, departmentId), eq(schema.departments.productionId, productionId)))
        .limit(1);
      if (!department) throw new Error("Department not found in this production.");

      await tx
        .delete(schema.departmentHeadAssignments)
        .where(and(eq(schema.departmentHeadAssignments.departmentId, departmentId), eq(schema.departmentHeadAssignments.userId, userId)));
      await tx
        .delete(schema.departmentMemberships)
        .where(and(eq(schema.departmentMemberships.departmentId, departmentId), eq(schema.departmentMemberships.userId, userId)));
    }),
  );
}

/** Row-menu "role change" on the Membership screen's members table. */
export async function changeDepartmentMemberRole(productionId: string, departmentId: string, userId: string, roleId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);

  await runAsUser(user.id, (db) =>
    db
      .update(schema.departmentMemberships)
      .set({ roleId })
      .where(and(eq(schema.departmentMemberships.departmentId, departmentId), eq(schema.departmentMemberships.userId, userId))),
  );
}
