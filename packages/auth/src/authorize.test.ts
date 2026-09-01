import { describe, expect, it } from "vitest";
import {
  type AuthorizationPrincipal,
  type DepartmentGrant,
  type ProductionMembershipContext,
  evaluateAuthorization,
} from "./authorize";

const RESOURCE = { productionId: "prod_vrindavan" };
const NOW = new Date("2026-09-01T00:00:00Z");

function membership(overrides: Partial<ProductionMembershipContext> = {}): ProductionMembershipContext {
  return {
    status: "ACTIVE",
    effectiveFrom: null,
    effectiveUntil: null,
    role: { roleId: "role_producer", permissions: ["schedule.view", "schedule.manage", "budget.view_detail"] },
    ...overrides,
  };
}

function principal(overrides: Partial<AuthorizationPrincipal> = {}): AuthorizationPrincipal {
  return {
    userId: "user_1",
    isPlatformSecurityAdmin: false,
    productionMembership: membership(),
    departmentGrants: [],
    ...overrides,
  };
}

function departmentGrant(overrides: Partial<DepartmentGrant> = {}): DepartmentGrant {
  return {
    departmentId: "dept_costume",
    isHead: false,
    role: { roleId: "role_department_head", permissions: ["schedule.view", "budget.view_detail"] },
    extraPermissions: [],
    ...overrides,
  };
}

describe("evaluateAuthorization — required scenarios", () => {
  it("ALLOWS a production member whose role grants the action", () => {
    const decision = evaluateAuthorization(principal(), "schedule.manage", RESOURCE, NOW);
    expect(decision.allowed).toBe(true);
  });

  it("DENIES a non-member of the production", () => {
    const decision = evaluateAuthorization(principal({ productionMembership: null }), "schedule.view", RESOURCE, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/not a member/i);
  });

  it("DENIES when membership role doesn't include the action", () => {
    const decision = evaluateAuthorization(principal(), "security.users.manage", RESOURCE, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/no grant includes/i);
  });

  it("DENIES a SUSPENDED membership even though the role would otherwise allow it", () => {
    const decision = evaluateAuthorization(principal({ productionMembership: membership({ status: "SUSPENDED" }) }), "schedule.view", RESOURCE, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/suspended/i);
  });

  it("DENIES a REVOKED membership", () => {
    const decision = evaluateAuthorization(principal({ productionMembership: membership({ status: "REVOKED" }) }), "schedule.view", RESOURCE, NOW);
    expect(decision.allowed).toBe(false);
  });

  it("DENIES a membership that isn't effective yet (effectiveFrom in the future)", () => {
    const decision = evaluateAuthorization(
      principal({ productionMembership: membership({ effectiveFrom: new Date("2026-12-01T00:00:00Z") }) }),
      "schedule.view",
      RESOURCE,
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/not yet effective/i);
  });

  it("DENIES a membership that has expired (effectiveUntil in the past)", () => {
    const decision = evaluateAuthorization(
      principal({ productionMembership: membership({ effectiveUntil: new Date("2026-01-01T00:00:00Z") }) }),
      "schedule.view",
      RESOURCE,
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/expired/i);
  });

  it("ALLOWS a membership that is within its effective window", () => {
    const decision = evaluateAuthorization(
      principal({
        productionMembership: membership({
          effectiveFrom: new Date("2026-08-01T00:00:00Z"),
          effectiveUntil: new Date("2026-10-01T00:00:00Z"),
        }),
      }),
      "schedule.view",
      RESOURCE,
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });

  it("ALLOWS a Platform Security Admin regardless of production membership", () => {
    const decision = evaluateAuthorization(
      principal({ isPlatformSecurityAdmin: true, productionMembership: null }),
      "security.users.manage",
      RESOURCE,
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("evaluateAuthorization — department scoping", () => {
  it("ALLOWS a department-scoped permission granted only via the matching department's role", () => {
    const p = principal({
      productionMembership: membership({ role: { roleId: "role_department_head", permissions: ["schedule.view"] } }),
      departmentGrants: [departmentGrant({ departmentId: "dept_costume" })],
    });
    const decision = evaluateAuthorization(p, "budget.view_detail", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(decision.allowed).toBe(true);
  });

  it("DENIES that same department-scoped permission with no departmentId on the resource", () => {
    const p = principal({
      productionMembership: membership({ role: { roleId: "role_department_head", permissions: ["schedule.view"] } }),
      departmentGrants: [departmentGrant({ departmentId: "dept_costume" })],
    });
    const decision = evaluateAuthorization(p, "budget.view_detail", RESOURCE, NOW);
    expect(decision.allowed).toBe(false);
  });

  it("grants departments.manage/assign_hod ONLY via department_head_assignments (isHead), never from a role bundle alone", () => {
    const p = principal({
      productionMembership: membership({ role: { roleId: "role_department_head", permissions: ["departments.manage", "departments.assign_hod"] } }),
      departmentGrants: [departmentGrant({ departmentId: "dept_costume", isHead: false })],
    });
    // Even though the (unrealistic, deliberately adversarial) production-level
    // role bundle above claims departments.manage/assign_hod, and the
    // department grant exists, isHead is false — must still DENY. This
    // pins down that these two permissions are never granted via role
    // bundles at all in this function; only the isHead flag matters.
    const decision = evaluateAuthorization(p, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(decision.allowed).toBe(false);
  });

  it("ALLOWS departments.manage for the actual recorded head of that department", () => {
    const p = principal({
      productionMembership: membership({ role: { roleId: "role_department_head", permissions: ["schedule.view"] } }),
      departmentGrants: [departmentGrant({ departmentId: "dept_costume", isHead: true })],
    });
    const decision = evaluateAuthorization(p, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(decision.allowed).toBe(true);
    const decision2 = evaluateAuthorization(p, "departments.assign_hod", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(decision2.allowed).toBe(true);
  });
});

describe("evaluateAuthorization — cross-department leak prevention (the core P1b requirement)", () => {
  /** A Costume HOD: production-level role has only generic view perms; department-scoped HOD authority comes solely from being recorded as head of dept_costume. */
  function costumeHod(): AuthorizationPrincipal {
    return principal({
      productionMembership: membership({ role: { roleId: "role_department_head", permissions: ["schedule.view", "crew.view"] } }),
      departmentGrants: [
        departmentGrant({
          departmentId: "dept_costume",
          isHead: true,
          role: { roleId: "role_department_head", permissions: ["schedule.view", "crew.view", "budget.view_detail"] },
        }),
      ],
    });
  }

  it("ALLOWS the Costume HOD to manage Costume's own department", () => {
    const decision = evaluateAuthorization(costumeHod(), "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(decision.allowed).toBe(true);
  });

  it("ALLOWS the Costume HOD to view Costume's budget detail", () => {
    const decision = evaluateAuthorization(costumeHod(), "budget.view_detail", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(decision.allowed).toBe(true);
  });

  it("DENIES the Costume HOD from managing Camera's department — the exact leak this model exists to close", () => {
    const decision = evaluateAuthorization(costumeHod(), "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_camera" }, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/no grant includes/i);
  });

  it("DENIES the Costume HOD from assigning Camera's HOD", () => {
    const decision = evaluateAuthorization(costumeHod(), "departments.assign_hod", { productionId: "prod_vrindavan", departmentId: "dept_camera" }, NOW);
    expect(decision.allowed).toBe(false);
  });

  it("DENIES the Costume HOD from viewing Camera's budget detail", () => {
    const decision = evaluateAuthorization(costumeHod(), "budget.view_detail", { productionId: "prod_vrindavan", departmentId: "dept_camera" }, NOW);
    expect(decision.allowed).toBe(false);
  });

  it("DENIES a Costume Department Coordinator (member, not head) from managing even their own department", () => {
    const coordinator = principal({
      productionMembership: membership({ role: { roleId: "role_department_coordinator", permissions: ["schedule.view"] } }),
      departmentGrants: [
        departmentGrant({
          departmentId: "dept_costume",
          isHead: false,
          role: { roleId: "role_department_coordinator", permissions: ["schedule.view", "budget.view_detail"] },
        }),
      ],
    });
    const decision = evaluateAuthorization(coordinator, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(decision.allowed).toBe(false);
  });

  it("a principal who heads TWO departments is only granted HOD authority on the one matching the resource, for each independently", () => {
    const dualHead = principal({
      productionMembership: membership({ role: { roleId: "role_department_head", permissions: [] } }),
      departmentGrants: [
        departmentGrant({ departmentId: "dept_costume", isHead: true, role: null }),
        departmentGrant({ departmentId: "dept_camera", isHead: true, role: null }),
      ],
    });
    expect(evaluateAuthorization(dualHead, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW).allowed).toBe(true);
    expect(evaluateAuthorization(dualHead, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_camera" }, NOW).allowed).toBe(true);
    expect(evaluateAuthorization(dualHead, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_sound" }, NOW).allowed).toBe(false);
  });
});

describe("evaluateAuthorization — invariants", () => {
  it("mutation safety: never mutates the principal, its departmentGrants array, or the resource object", () => {
    const p = principal({ departmentGrants: [departmentGrant()] });
    const pSnapshot = JSON.parse(JSON.stringify(p));
    const resource = { productionId: "prod_vrindavan", departmentId: "dept_costume" };
    const resourceSnapshot = JSON.parse(JSON.stringify(resource));

    evaluateAuthorization(p, "budget.view_detail", resource, NOW);

    expect(p).toEqual(pSnapshot);
    expect(resource).toEqual(resourceSnapshot);
  });

  it("determinism: identical inputs always produce an identical decision", () => {
    const p = costumeHodLike();
    const first = evaluateAuthorization(p, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    const second = evaluateAuthorization(p, "departments.manage", { productionId: "prod_vrindavan", departmentId: "dept_costume" }, NOW);
    expect(first).toEqual(second);
  });

  it("default-deny: an action with no matching permission anywhere is denied, not merely unspecified", () => {
    const decision = evaluateAuthorization(principal(), "some.made.up.permission.that.does.not.exist", RESOURCE, NOW);
    expect(decision.allowed).toBe(false);
  });

  function costumeHodLike(): AuthorizationPrincipal {
    return principal({
      productionMembership: membership({ role: { roleId: "role_department_head", permissions: [] } }),
      departmentGrants: [departmentGrant({ departmentId: "dept_costume", isHead: true, role: null })],
    });
  }
});
