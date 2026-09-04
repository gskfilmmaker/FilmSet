import { describe, expect, it } from "vitest";
import {
  type AccessCheckpointContext,
  type AccessCredentialContext,
  type AccessDeviceContext,
  type AccessIdentityContext,
  type AccessResourceContext,
  type AccessRestrictionContext,
  type EffectiveAccessGrant,
  type EvaluateAccessInput,
  evaluateAccess,
} from "./access-control";

const PRODUCTION_ID = "prod_vrindavan";
// Tuesday, local time — fixed so day-of-week/time-of-day grant window tests are deterministic.
const NOW = new Date(2026, 8, 1, 12, 0, 0);

function device(overrides: Partial<AccessDeviceContext> = {}): AccessDeviceContext {
  return { id: "device_1", productionId: PRODUCTION_ID, status: "TRUSTED", ...overrides };
}

function checkpoint(overrides: Partial<AccessCheckpointContext> = {}): AccessCheckpointContext {
  return {
    id: "checkpoint_1",
    productionId: PRODUCTION_ID,
    resourceId: "resource_1",
    active: true,
    directionMode: "BOTH",
    antiPassbackMode: "OFF",
    ...overrides,
  };
}

function credential(overrides: Partial<AccessCredentialContext> = {}): AccessCredentialContext {
  return {
    id: "cred_1",
    productionId: PRODUCTION_ID,
    identityId: "identity_1",
    status: "ACTIVE",
    assuranceLevel: "LEVEL_1_BASIC",
    validFrom: null,
    validUntil: null,
    ...overrides,
  };
}

function identity(overrides: Partial<AccessIdentityContext> = {}): AccessIdentityContext {
  return { id: "identity_1", productionId: PRODUCTION_ID, active: true, ...overrides };
}

function resource(overrides: Partial<AccessResourceContext> = {}): AccessResourceContext {
  return {
    id: "resource_1",
    productionId: PRODUCTION_ID,
    active: true,
    minimumAssuranceLevel: "LEVEL_1_BASIC",
    ...overrides,
  };
}

function grant(overrides: Partial<EffectiveAccessGrant> = {}): EffectiveAccessGrant {
  return {
    resourceId: "resource_1",
    validFrom: null,
    validUntil: null,
    daysOfWeek: null,
    timeStart: null,
    timeEnd: null,
    minimumAssuranceLevel: null,
    escortRequired: false,
    ...overrides,
  };
}

function restriction(overrides: Partial<AccessRestrictionContext> = {}): AccessRestrictionContext {
  return { resourceId: null, validFrom: null, validUntil: null, ...overrides };
}

function input(overrides: Partial<EvaluateAccessInput> = {}): EvaluateAccessInput {
  return {
    productionId: PRODUCTION_ID,
    device: device(),
    checkpoint: checkpoint(),
    credential: credential(),
    identity: identity(),
    resource: resource(),
    requestedDirection: "ENTRY",
    restrictions: [],
    grants: [grant()],
    lastEventDirection: null,
    ...overrides,
  };
}

describe("evaluateAccess — happy path", () => {
  it("ALLOWS when every check passes", () => {
    const decision = evaluateAccess(input(), NOW);
    expect(decision.allowed).toBe(true);
    expect(decision.decision).toBe("ALLOW");
    expect(decision.reasonCode).toBe("ACCESS_ALLOWED");
  });

  it("carries escortRequired from the matched grant", () => {
    const decision = evaluateAccess(input({ grants: [grant({ escortRequired: true })] }), NOW);
    expect(decision.allowed).toBe(true);
    expect(decision.escortRequired).toBe(true);
  });
});

describe("evaluateAccess — device trust", () => {
  it("DENIES a device that is not registered", () => {
    const decision = evaluateAccess(input({ device: null }), NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DEVICE_NOT_FOUND");
  });

  it("DENIES a device from a different production", () => {
    const decision = evaluateAccess(input({ device: device({ productionId: "prod_other" }) }), NOW);
    expect(decision.reasonCode).toBe("PRODUCTION_MISMATCH");
  });

  it("DENIES a device still PENDING trust enrollment", () => {
    const decision = evaluateAccess(input({ device: device({ status: "PENDING" }) }), NOW);
    expect(decision.reasonCode).toBe("DEVICE_NOT_TRUSTED");
  });

  it("DENIES a SUSPENDED device", () => {
    const decision = evaluateAccess(input({ device: device({ status: "SUSPENDED" }) }), NOW);
    expect(decision.reasonCode).toBe("DEVICE_SUSPENDED");
  });

  it("DENIES a REVOKED device", () => {
    const decision = evaluateAccess(input({ device: device({ status: "REVOKED" }) }), NOW);
    expect(decision.reasonCode).toBe("DEVICE_REVOKED");
  });
});

describe("evaluateAccess — checkpoint", () => {
  it("DENIES a checkpoint that is not registered", () => {
    const decision = evaluateAccess(input({ checkpoint: null }), NOW);
    expect(decision.reasonCode).toBe("CHECKPOINT_NOT_FOUND");
  });

  it("DENIES a checkpoint from a different production", () => {
    const decision = evaluateAccess(input({ checkpoint: checkpoint({ productionId: "prod_other" }) }), NOW);
    expect(decision.reasonCode).toBe("PRODUCTION_MISMATCH");
  });

  it("DENIES an inactive checkpoint", () => {
    const decision = evaluateAccess(input({ checkpoint: checkpoint({ active: false }) }), NOW);
    expect(decision.reasonCode).toBe("CHECKPOINT_INACTIVE");
  });

  it("DENIES an EXIT attempt at an ENTRY-only checkpoint", () => {
    const decision = evaluateAccess(
      input({ checkpoint: checkpoint({ directionMode: "ENTRY" }), requestedDirection: "EXIT" }),
      NOW,
    );
    expect(decision.reasonCode).toBe("DIRECTION_NOT_ALLOWED");
  });

  it("ALLOWS an ENTRY attempt at an ENTRY-only checkpoint", () => {
    const decision = evaluateAccess(
      input({ checkpoint: checkpoint({ directionMode: "ENTRY" }), requestedDirection: "ENTRY" }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("evaluateAccess — credential lifecycle", () => {
  it("DENIES when no credential was resolved", () => {
    const decision = evaluateAccess(input({ credential: null }), NOW);
    expect(decision.reasonCode).toBe("CREDENTIAL_NOT_FOUND");
  });

  it("DENIES a credential from a different production", () => {
    const decision = evaluateAccess(input({ credential: credential({ productionId: "prod_other" }) }), NOW);
    expect(decision.reasonCode).toBe("PRODUCTION_MISMATCH");
  });

  it.each([
    ["DRAFT", "CREDENTIAL_NOT_ACTIVE"],
    ["PENDING_APPROVAL", "CREDENTIAL_NOT_ACTIVE"],
    ["SUSPENDED", "CREDENTIAL_SUSPENDED"],
    ["LOST", "CREDENTIAL_LOST"],
    ["REVOKED", "CREDENTIAL_REVOKED"],
    ["REPLACED", "CREDENTIAL_REPLACED"],
    ["EXPIRED", "CREDENTIAL_EXPIRED"],
  ] as const)("DENIES status %s with reason %s", (status, reasonCode) => {
    const decision = evaluateAccess(input({ credential: credential({ status }) }), NOW);
    expect(decision.reasonCode).toBe(reasonCode);
  });

  it("DENIES an ACTIVE credential before its validFrom", () => {
    const decision = evaluateAccess(
      input({ credential: credential({ validFrom: new Date(2026, 11, 1) }) }),
      NOW,
    );
    expect(decision.reasonCode).toBe("CREDENTIAL_NOT_YET_VALID");
  });

  it("DENIES an ACTIVE credential past its validUntil, even though status is still ACTIVE", () => {
    const decision = evaluateAccess(
      input({ credential: credential({ validUntil: new Date(2026, 7, 1) }) }),
      NOW,
    );
    expect(decision.reasonCode).toBe("CREDENTIAL_EXPIRED");
  });
});

describe("evaluateAccess — identity", () => {
  it("DENIES when no identity was resolved", () => {
    const decision = evaluateAccess(input({ identity: null }), NOW);
    expect(decision.reasonCode).toBe("IDENTITY_NOT_FOUND");
  });

  it("DENIES an identity from a different production", () => {
    const decision = evaluateAccess(input({ identity: identity({ productionId: "prod_other" }) }), NOW);
    expect(decision.reasonCode).toBe("PRODUCTION_MISMATCH");
  });

  it("DENIES when the credential's identityId doesn't match the resolved identity", () => {
    const decision = evaluateAccess(
      input({ credential: credential({ identityId: "identity_other" }) }),
      NOW,
    );
    expect(decision.reasonCode).toBe("IDENTITY_CREDENTIAL_MISMATCH");
  });

  it("DENIES an inactive identity", () => {
    const decision = evaluateAccess(input({ identity: identity({ active: false }) }), NOW);
    expect(decision.reasonCode).toBe("IDENTITY_INACTIVE");
  });
});

describe("evaluateAccess — resource + baseline assurance", () => {
  it("DENIES when no resource was resolved", () => {
    const decision = evaluateAccess(input({ resource: null }), NOW);
    expect(decision.reasonCode).toBe("RESOURCE_NOT_FOUND");
  });

  it("DENIES a resource from a different production", () => {
    const decision = evaluateAccess(input({ resource: resource({ productionId: "prod_other" }) }), NOW);
    expect(decision.reasonCode).toBe("PRODUCTION_MISMATCH");
  });

  it("treats a resource that doesn't match the checkpoint's resourceId as an internal inconsistency", () => {
    const decision = evaluateAccess(input({ resource: resource({ id: "resource_other" }) }), NOW);
    expect(decision.reasonCode).toBe("INTERNAL_ERROR");
  });

  it("DENIES insufficient assurance against the resource's own minimum", () => {
    const decision = evaluateAccess(
      input({ resource: resource({ minimumAssuranceLevel: "LEVEL_3_DYNAMIC" }) }),
      NOW,
    );
    expect(decision.reasonCode).toBe("INSUFFICIENT_ASSURANCE");
  });

  it("ALLOWS when credential assurance meets a stricter resource minimum", () => {
    const decision = evaluateAccess(
      input({
        resource: resource({ minimumAssuranceLevel: "LEVEL_3_DYNAMIC" }),
        credential: credential({ assuranceLevel: "LEVEL_4_SMART" }),
      }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });

  it("DENIES an inactive resource (checked after restrictions, before grant matching)", () => {
    const decision = evaluateAccess(input({ resource: resource({ active: false }) }), NOW);
    expect(decision.reasonCode).toBe("RESOURCE_INACTIVE");
  });
});

describe("evaluateAccess — restrictions override grants", () => {
  it("DENIES via a blanket restriction (resourceId null) even with a valid grant present", () => {
    const decision = evaluateAccess(input({ restrictions: [restriction()] }), NOW);
    expect(decision.reasonCode).toBe("RESTRICTED");
  });

  it("DENIES via a restriction scoped to this exact resource", () => {
    const decision = evaluateAccess(input({ restrictions: [restriction({ resourceId: "resource_1" })] }), NOW);
    expect(decision.reasonCode).toBe("RESTRICTED");
  });

  it("does NOT apply a restriction scoped to a different resource", () => {
    const decision = evaluateAccess(input({ restrictions: [restriction({ resourceId: "resource_other" })] }), NOW);
    expect(decision.allowed).toBe(true);
  });

  it("does NOT apply a restriction outside its own validity window", () => {
    const decision = evaluateAccess(
      input({ restrictions: [restriction({ validUntil: new Date(2026, 7, 1) })] }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });

  it("a restriction is checked, and DENIES, even when the resource is also inactive", () => {
    const decision = evaluateAccess(
      input({ resource: resource({ active: false }), restrictions: [restriction()] }),
      NOW,
    );
    expect(decision.reasonCode).toBe("RESTRICTED");
  });
});

describe("evaluateAccess — grant matching", () => {
  it("DENIES with NO_GRANT when no grant covers this resource at all", () => {
    const decision = evaluateAccess(input({ grants: [] }), NOW);
    expect(decision.reasonCode).toBe("NO_GRANT");
  });

  it("DENIES with NO_GRANT when grants exist but none reference this resource", () => {
    const decision = evaluateAccess(input({ grants: [grant({ resourceId: "resource_other" })] }), NOW);
    expect(decision.reasonCode).toBe("NO_GRANT");
  });

  it("DENIES with GRANT_NOT_YET_VALID before the grant's validFrom", () => {
    const decision = evaluateAccess(
      input({ grants: [grant({ validFrom: new Date(2026, 11, 1) })] }),
      NOW,
    );
    expect(decision.reasonCode).toBe("GRANT_NOT_YET_VALID");
  });

  it("DENIES with GRANT_EXPIRED past the grant's validUntil", () => {
    const decision = evaluateAccess(
      input({ grants: [grant({ validUntil: new Date(2026, 7, 1) })] }),
      NOW,
    );
    expect(decision.reasonCode).toBe("GRANT_EXPIRED");
  });

  it("DENIES with OUTSIDE_ALLOWED_DAY when today isn't in the grant's daysOfWeek", () => {
    const decision = evaluateAccess(input({ grants: [grant({ daysOfWeek: ["SAT", "SUN"] })] }), NOW);
    expect(decision.reasonCode).toBe("OUTSIDE_ALLOWED_DAY");
  });

  it("ALLOWS when today is in the grant's daysOfWeek (NOW is a Tuesday)", () => {
    const decision = evaluateAccess(input({ grants: [grant({ daysOfWeek: ["TUE"] })] }), NOW);
    expect(decision.allowed).toBe(true);
  });

  it("DENIES with OUTSIDE_ALLOWED_TIME outside the grant's time window", () => {
    const decision = evaluateAccess(
      input({ grants: [grant({ timeStart: "18:00:00", timeEnd: "23:00:00" })] }),
      NOW,
    );
    expect(decision.reasonCode).toBe("OUTSIDE_ALLOWED_TIME");
  });

  it("ALLOWS inside the grant's time window", () => {
    const decision = evaluateAccess(
      input({ grants: [grant({ timeStart: "06:00:00", timeEnd: "20:00:00" })] }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });

  it("DENIES with INSUFFICIENT_ASSURANCE when the only covering grant demands higher assurance than the credential holds", () => {
    const decision = evaluateAccess(
      input({ grants: [grant({ minimumAssuranceLevel: "LEVEL_4_SMART" })] }),
      NOW,
    );
    expect(decision.reasonCode).toBe("INSUFFICIENT_ASSURANCE");
  });

  it("ALLOWS via a later grant when an earlier one for the same resource fails its own window", () => {
    const decision = evaluateAccess(
      input({
        grants: [
          grant({ daysOfWeek: ["SAT"] }), // fails: not Saturday
          grant({ timeStart: "06:00:00", timeEnd: "20:00:00" }), // succeeds
        ],
      }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("evaluateAccess — anti-passback", () => {
  it("ignores a repeated direction when the checkpoint's mode is OFF", () => {
    const decision = evaluateAccess(
      input({ checkpoint: checkpoint({ antiPassbackMode: "OFF" }), lastEventDirection: "ENTRY", requestedDirection: "ENTRY" }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.decision).toBe("ALLOW");
  });

  it("DENIES a repeated direction when the checkpoint's mode is DENY", () => {
    const decision = evaluateAccess(
      input({ checkpoint: checkpoint({ antiPassbackMode: "DENY" }), lastEventDirection: "ENTRY", requestedDirection: "ENTRY" }),
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe("DENY");
    expect(decision.reasonCode).toBe("ANTI_PASSBACK_VIOLATION");
  });

  it("WARNS (but still allows) a repeated direction when the checkpoint's mode is WARN", () => {
    const decision = evaluateAccess(
      input({ checkpoint: checkpoint({ antiPassbackMode: "WARN" }), lastEventDirection: "ENTRY", requestedDirection: "ENTRY" }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.decision).toBe("WARN");
    expect(decision.reasonCode).toBe("ANTI_PASSBACK_WARNING");
  });

  it("does not trigger anti-passback when the direction differs from the last event", () => {
    const decision = evaluateAccess(
      input({ checkpoint: checkpoint({ antiPassbackMode: "DENY" }), lastEventDirection: "EXIT", requestedDirection: "ENTRY" }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });

  it("does not trigger anti-passback when there is no prior event on record", () => {
    const decision = evaluateAccess(
      input({ checkpoint: checkpoint({ antiPassbackMode: "DENY" }), lastEventDirection: null, requestedDirection: "ENTRY" }),
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("evaluateAccess — invariants", () => {
  it("mutation safety: never mutates its input", () => {
    const i = input({ restrictions: [restriction()], grants: [grant(), grant({ resourceId: "resource_2" })] });
    const snapshot = JSON.parse(JSON.stringify(i));
    evaluateAccess(i, NOW);
    expect(i).toEqual(snapshot);
  });

  it("determinism: identical inputs always produce an identical decision", () => {
    const i = input();
    expect(evaluateAccess(i, NOW)).toEqual(evaluateAccess(i, NOW));
  });

  it("default-deny: an identity with absolutely nothing resolved is denied, not merely unspecified", () => {
    const decision = evaluateAccess(
      { productionId: PRODUCTION_ID, device: null, checkpoint: null, credential: null, identity: null, resource: null, requestedDirection: null, restrictions: [], grants: [], lastEventDirection: null },
      NOW,
    );
    expect(decision.allowed).toBe(false);
  });
});
