import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const assertRoleMock = vi.fn();
vi.mock("@filmset/auth/server", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
}));

const authorizeMock = vi.fn();
vi.mock("./authorize", () => ({
  authorize: (...args: unknown[]) => authorizeMock(...args),
}));

const { checkWithShadow } = await import("./authorize-adapter");

const MEMBERSHIP = { productionId: "prod_1", role: "Producer" } as const;
const TX = {} as never;

beforeEach(() => {
  assertRoleMock.mockReset();
  authorizeMock.mockReset();
});

describe("checkWithShadow — real-gate fidelity", () => {
  it("returns exactly what assertRole() returns when it allows", async () => {
    assertRoleMock.mockReturnValue(MEMBERSHIP);
    authorizeMock.mockResolvedValue({ allowed: true, reason: "ok" });

    const result = await checkWithShadow({
      tx: TX,
      userId: "user_1",
      membership: MEMBERSHIP,
      productionId: "prod_1",
      equivalentPermission: "schedule.manage",
    });

    expect(result.membership).toBe(MEMBERSHIP);
  });

  it("propagates assertRole()'s exact thrown error and never calls authorize() at all", async () => {
    const error = new Error("FORBIDDEN: requires one of [Producer], has \"Crew\"");
    assertRoleMock.mockImplementation(() => {
      throw error;
    });

    await expect(
      checkWithShadow({
        tx: TX,
        userId: "user_1",
        membership: { productionId: "prod_1", role: "Crew" },
        allowedRoles: ["Producer"],
        productionId: "prod_1",
        equivalentPermission: "schedule.manage",
      }),
    ).rejects.toBe(error);

    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it("calls assertRole() with the exact same membership/allowedRoles a direct call would", async () => {
    assertRoleMock.mockReturnValue(MEMBERSHIP);
    authorizeMock.mockResolvedValue({ allowed: true, reason: "ok" });

    await checkWithShadow({
      tx: TX,
      userId: "user_1",
      membership: MEMBERSHIP,
      allowedRoles: ["Producer", "UPM"],
      productionId: "prod_1",
      equivalentPermission: "budget.approve",
    });

    expect(assertRoleMock).toHaveBeenCalledWith(MEMBERSHIP, ["Producer", "UPM"]);
  });
});

describe("checkWithShadow — shadow comparison", () => {
  it("reports no mismatch when authorize() agrees (ALLOW)", async () => {
    assertRoleMock.mockReturnValue(MEMBERSHIP);
    authorizeMock.mockResolvedValue({ allowed: true, reason: "Granted" });

    const result = await checkWithShadow({
      tx: TX,
      userId: "user_1",
      membership: MEMBERSHIP,
      productionId: "prod_1",
      equivalentPermission: "schedule.view",
    });

    expect(result.shadowMismatch).toBeNull();
  });

  it("reports a mismatch when assertRole() allows but authorize() would deny", async () => {
    assertRoleMock.mockReturnValue(MEMBERSHIP);
    authorizeMock.mockResolvedValue({ allowed: false, reason: "No grant includes permission \"budget.view_detail\"" });

    const result = await checkWithShadow({
      tx: TX,
      userId: "user_1",
      membership: MEMBERSHIP,
      productionId: "prod_1",
      departmentId: "dept_camera",
      equivalentPermission: "budget.view_detail",
    });

    expect(result.shadowMismatch).toEqual({
      productionId: "prod_1",
      userId: "user_1",
      equivalentPermission: "budget.view_detail",
      assertRoleResult: "ALLOW",
      authorizeResult: "DENY",
      authorizeReason: 'No grant includes permission "budget.view_detail"',
    });
    // The real result is still the real assertRole() outcome — the mismatch
    // is informational only, never enforced.
    expect(result.membership).toBe(MEMBERSHIP);
  });

  it("passes productionId/departmentId through to authorize() unchanged", async () => {
    assertRoleMock.mockReturnValue(MEMBERSHIP);
    authorizeMock.mockResolvedValue({ allowed: true, reason: "ok" });

    await checkWithShadow({
      tx: TX,
      userId: "user_42",
      membership: MEMBERSHIP,
      productionId: "prod_vrindavan",
      departmentId: "dept_costume",
      equivalentPermission: "departments.manage",
    });

    expect(authorizeMock).toHaveBeenCalledWith(TX, "user_42", "departments.manage", {
      productionId: "prod_vrindavan",
      departmentId: "dept_costume",
    });
  });
});

describe("checkWithShadow — failure containment (the core safety property)", () => {
  it("never lets a shadow authorize() failure propagate or affect the real result", async () => {
    assertRoleMock.mockReturnValue(MEMBERSHIP);
    authorizeMock.mockRejectedValue(new Error("simulated DB error during shadow check"));

    const result = await checkWithShadow({
      tx: TX,
      userId: "user_1",
      membership: MEMBERSHIP,
      productionId: "prod_1",
      equivalentPermission: "schedule.view",
    });

    // No throw reached the caller, membership is still the real result,
    // and a failed shadow check is reported as "no mismatch" — not as a
    // mismatch, and not as an error.
    expect(result.membership).toBe(MEMBERSHIP);
    expect(result.shadowMismatch).toBeNull();
  });
});
