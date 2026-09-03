import "server-only";
import { assertRole, type ProductionMembership } from "@filmset/auth/server";
import type { ProductionRole } from "@filmset/auth";
import type { Tx } from "@filmset/db/server";
import { authorize } from "./authorize";

/**
 * P1c — the safe-migration adapter (docs/audits/AUTHORIZATION_WIRING_PLAN.md).
 * Not called from any Server Action yet — this is the mechanism a future,
 * separately-authorized PR uses to migrate one call site at a time.
 *
 * The pattern: swap a Server Action's `assertRole(membership, roles)` call
 * for `checkWithShadow({..., allowedRoles: roles, equivalentPermission})`.
 * That swap is a NO-OP for real behavior — `checkWithShadow` still calls
 * the real, unchanged `assertRole()` and returns/throws exactly what it
 * would have. In parallel, it runs the new `authorize()` engine for the
 * equivalent permission and returns a `shadowMismatch` describing any
 * disagreement, for the caller to log (e.g. to `console.warn` or a future
 * structured log) — never to act on. Once shadow logs show no unexpected
 * mismatches for a call site over a real observation period, a SEPARATE,
 * later, explicitly-authorized change swaps that call site's real gate
 * from `assertRole()` to `authorize()` directly.
 *
 * This is deliberately asymmetric: it only ever detects "assertRole()
 * ALLOWS but authorize() would DENY" — the case that matters before a
 * cutover, since it's the one that could newly break a user's access.
 * When assertRole() itself denies (throws), this function throws too,
 * before ever reaching the shadow check — matching today's exact
 * behavior and control flow, and meaning a denial is never softened by
 * mistake.
 */

export interface ShadowCheckParams {
  tx: Tx;
  userId: string;
  membership: ProductionMembership | null;
  allowedRoles?: ProductionRole[];
  productionId: string;
  /** The PERMISSION_MATRIX_V1.md permission string this call site maps to, for the shadow authorize() comparison. */
  equivalentPermission: string;
  /** Present only if this call site's real-world equivalent is department-scoped. */
  departmentId?: string;
}

export interface ShadowMismatch {
  productionId: string;
  userId: string;
  equivalentPermission: string;
  /** Always "ALLOW" — a mismatch is only ever recorded when assertRole() allowed and authorize() would not have. See the module doc comment for why. */
  assertRoleResult: "ALLOW";
  authorizeResult: "DENY";
  authorizeReason: string;
}

export interface ShadowCheckResult {
  /** Identical to what a plain `assertRole(membership, allowedRoles)` call would return — the real gate, unchanged. */
  membership: ProductionMembership;
  /** Non-null only when authorize() would have denied what assertRole() allowed. Null on agreement AND on any shadow-check failure (see catch below) — a failed shadow check is not itself a mismatch. */
  shadowMismatch: ShadowMismatch | null;
}

export async function checkWithShadow(params: ShadowCheckParams): Promise<ShadowCheckResult> {
  // The real gate. Unchanged from today: throws exactly when a plain
  // assertRole() call would, with the same error, before any shadow logic
  // runs at all.
  const membership = assertRole(params.membership, params.allowedRoles);

  let shadowMismatch: ShadowMismatch | null = null;
  try {
    const decision = await authorize(params.tx, params.userId, params.equivalentPermission, {
      productionId: params.productionId,
      departmentId: params.departmentId,
    });
    if (!decision.allowed) {
      shadowMismatch = {
        productionId: params.productionId,
        userId: params.userId,
        equivalentPermission: params.equivalentPermission,
        assertRoleResult: "ALLOW",
        authorizeResult: "DENY",
        authorizeReason: decision.reason,
      };
    }
  } catch {
    // A shadow-check failure (e.g. a transient query error) must never
    // affect the real path — it is swallowed here, deliberately, and
    // reported as "no mismatch" rather than propagated or logged as one.
    // The new engine is not authoritative yet; it must not be able to
    // break or even flag a Server Action that assertRole() just allowed.
  }

  return { membership, shadowMismatch };
}
