import {
  type AnyPgColumn,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Relational schema — the persistence-layer counterpart to the shapes in
 * packages/core. Every production-scoped table carries productionId so one
 * database serves many productions; Postgres Row Level Security (see
 * packages/db/drizzle/*.sql) is the real enforcement boundary, keyed off
 * production_members — apps/web/lib/authz.ts adds a fast app-layer check
 * on top for friendlier errors, but RLS is what actually stops a query.
 *
 * Entity ids are `text`, not `uuid`: fixture/seed rows use readable slugs
 * ("cast_farid", "loc_highway-agra") reproduced from the Constitution's
 * worked examples, while rows created through the app get a
 * crypto.randomUUID() string at write time. Only columns that reference a
 * Supabase Auth user (via `profiles`) are real `uuid`.
 */

/** Supabase-managed schema — declared only so FK references type-check; never migrated by us. */
const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", { id: uuid("id").primaryKey() });

/**
 * One row per Supabase Auth user, auto-created by a trigger on
 * `auth.users` insert (see packages/db/drizzle/*.sql — `handle_new_user`).
 * Every user-id column elsewhere in this schema points here instead of at
 * `auth.users` directly, since app code can join/select against `profiles`
 * but not against the `auth` schema.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  /**
   * Which production `requireCurrentProduction` (apps/web/lib/authz.ts)
   * loads for this user — the persisted counterpart to the project
   * switcher. Forward reference to `productions` (declared below): fine at
   * runtime since `.references()` takes a thunk, not the table itself, but
   * needs the explicit AnyPgColumn return type to break TS's circular
   * inference between the two tables.
   */
  activeProductionId: text("active_production_id").references((): AnyPgColumn => productions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The governance layer above productions — P1a foundation only (see
 * docs/audits/VRINDAVAN_MIGRATION_IMPACT.md). One organization can own many
 * productions; membership here is deliberately minimal (no roles/permission
 * vocabulary yet — that's P1b's `authorize()` engine and Department schema,
 * not this). Existing production access continues to be governed entirely
 * by `productionMembers`, unchanged by this table's existence.
 */
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Free-text for now, matching production_members' pattern — no enforced vocabulary until P1b. */
    role: text("role").notNull().default("Owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

export const productions = pgTable("productions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phase: text("phase").notNull().default("Development"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  /**
   * Every production belongs to exactly one organization (P1a). Restrict,
   * not cascade: an organization can't be deleted out from under a
   * production it still owns — that's a decision the app should force
   * explicitly (reassign or delete the production first), never an
   * implicit side effect of deleting the org row.
   */
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),
  /** The script's current revision color (White/Blue/Pink/...) — see packages/core's revision-colors module. Advances only when a revision import actually changes/adds a scene. */
  scriptRevisionColor: text("script_revision_color").notNull().default("White"),
  /** Storage object path in the production-photos bucket (same convention as castMembers.photoPath) — never a public URL. */
  logoPath: text("logo_path"),
  /** Hex color, e.g. "#1A2B3C" — the credential badge's header band. Null falls back to a default in the badge component, not a DB default. */
  brandColor: text("brand_color"),
  /** The ID-numbering prefix, e.g. "VMPA" — see apps/web/lib/id-registry.ts. Null falls back to a derived default (production name initials), not a DB default. */
  shortCode: text("short_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productionMembers = pgTable(
  "production_members",
  {
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Still the authoritative value read by every existing Server Action/assertRole() call — unchanged by P1b. */
    role: text("role").notNull(),
    /**
     * P1b addition: the same membership row's new, richer role reference —
     * nullable, additive. Existing code keeps reading `role` (text);
     * `authorize()` (packages/auth/src/authorize.ts) reads `roleId` instead.
     * Both point at the same real-world role for every row this migration
     * backfills; they can diverge later once custom roles exist, which is
     * exactly the point (a text column can't express a custom role).
     */
    roleId: text("role_id").references(() => roles.id, { onDelete: "set null" }),
    /** ACTIVE | SCHEDULED | SUSPENDED | EXPIRED | REVOKED (AUTHORIZATION_GAP_ANALYSIS.md §7). Existing rows default/backfill to ACTIVE — accurate, not a guess: every row that exists today grants access today. */
    status: text("status").notNull().default("ACTIVE"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.productionId, t.userId] })],
);

/**
 * P1b — authorization foundation (see docs/audits/VRINDAVAN_MIGRATION_IMPACT.md
 * and docs/security/{SECURITY_ARCHITECTURE_V1,PERMISSION_MATRIX_V1}.md,
 * docs/audits/AUTHORIZATION_GAP_ANALYSIS.md). Nothing below is wired into
 * any existing Server Action yet — packages/auth/src/authorize.ts is a new,
 * standalone decision function this schema backs, not yet called from
 * apps/web. Existing `assertRole()`-based checks are completely untouched.
 *
 * `permissions` is a catalog/vocabulary table (PERMISSION_MATRIX_V1.md §1-2)
 * — a fixed `resource.action` string per row, seeded by the migration, not
 * user-editable through any UI in this phase.
 */
export const permissions = pgTable("permissions", {
  /** e.g. "schedule.manage" — the string `authorize()` checks against. */
  key: text("key").primaryKey(),
  /** e.g. "schedule" */
  domain: text("domain").notNull(),
  /** e.g. "manage" */
  action: text("action").notNull(),
  description: text("description").notNull(),
});

/**
 * A named bundle of permissions (PERMISSION_MATRIX_V1.md §4). `organizationId`
 * null means a system template role (seeded by the migration, shared by
 * every organization); non-null means a custom role scoped to that one
 * organization (Part 7's explicit custom-role requirement) — no UI creates
 * custom roles yet in this phase, but the schema doesn't block it later.
 */
export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isSystemTemplate: boolean("is_system_template").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("roles_org_name_unique").on(t.organizationId, t.name)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

/**
 * Department/HOD model (LOGISTICS_DOMAIN_MODEL.md §5) — the concrete fix
 * for AUTHORIZATION_GAP_ANALYSIS.md §5's HOD gap: `crew_members.isHod` and
 * `crew_members.department` (free text) are NOT touched or removed by this
 * migration — they stay the display layer (sort order, Contact Sheet
 * grouping) exactly as the domain model's own migration note specifies.
 * `departments` is the new source of truth `authorize()` actually checks.
 */
export const departments = pgTable(
  "departments",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentDepartmentId: text("parent_department_id").references((): AnyPgColumn => departments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("departments_production_idx").on(t.productionId), unique("departments_production_name_unique").on(t.productionId, t.name)],
);

export const departmentMemberships = pgTable(
  "department_memberships",
  {
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    roleId: text("role_id").references(() => roles.id, { onDelete: "set null" }),
    status: text("status").notNull().default("ACTIVE"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.departmentId, t.userId] })],
);

/** The authoritative "who is HOD of *this* department" record — what authorize() actually checks, replacing crew_members.isHod's display-only flag (AUTHORIZATION_GAP_ANALYSIS.md §5). */
export const departmentHeadAssignments = pgTable(
  "department_head_assignments",
  {
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.departmentId, t.userId] })],
);

/** Department-scoped permission grants layered on top of a role's bundle (LOGISTICS_DOMAIN_MODEL.md §5). */
export const departmentPermissions = pgTable(
  "department_permissions",
  {
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    permission: text("permission")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.departmentId, t.permission] })],
);

/** Ties a department to the budget_lines rows it should see/manage — what makes "Wardrobe HOD sees Wardrobe budget, not Camera budget" enforceable (LOGISTICS_DOMAIN_MODEL.md §5). */
export const departmentBudgetScopes = pgTable(
  "department_budget_scopes",
  {
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    budgetLineId: text("budget_line_id")
      .notNull()
      .references(() => budgetLines.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.departmentId, t.budgetLineId] })],
);

/**
 * Booking + Approval Engine (LOGISTICS_DOMAIN_MODEL.md §0.1-0.3;
 * docs/audits/LOGISTICS_IMPLEMENTATION_READINESS.md §4-5) — the shared
 * substrate every Logistics subdomain (Travel, Accommodation,
 * Transportation, Catering) will attach to, built first per that
 * document's recommended order since no subdomain can reuse a lifecycle
 * that doesn't exist yet. None of the subdomain tables exist as schema —
 * `bookings.subjectType`/`subjectId` stay null until the first one does.
 *
 * Nothing here is wired into any Server Action or UI. This is schema
 * only, exactly like P1b's authorization foundation was before its own
 * wiring plan — no booking screen, no approval UI, no Server Action reads
 * or writes any of these tables yet.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    /** TRAVEL | HOTEL | VEHICLE | LOCATION | EQUIPMENT | CATERING | SERVICE | OTHER (LOGISTICS_DOMAIN_MODEL.md §0.1). */
    type: text("type").notNull(),
    /** REQUESTED → ... → COMPLETED → RECONCILED, or a cancellation/refund side branch — see §0.1's full BookingStatus lifecycle. */
    status: text("status").notNull().default("REQUESTED"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    /**
     * Polymorphic link to the type-specific detail record (a future
     * TravelBooking, AccommodationBooking, VehicleBooking, CateringOrder,
     * ...) — no FK is possible since no subdomain table exists yet. Both
     * columns are written by whichever subdomain migration lands first,
     * not by this one.
     */
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    vendorRef: text("vendor_ref"),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    currency: text("currency"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bookings_production_idx").on(t.productionId), index("bookings_department_idx").on(t.departmentId)],
);

export const bookingQuotes = pgTable(
  "booking_quotes",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    vendorRef: text("vendor_ref").notNull(),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_quotes_booking_idx").on(t.bookingId)],
);

export const bookingConfirmations = pgTable(
  "booking_confirmations",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    confirmationRef: text("confirmation_ref").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_confirmations_booking_idx").on(t.bookingId)],
);

/** A structured diff when a confirmed booking changes (LOGISTICS_DOMAIN_MODEL.md §0.1's BookingChange). */
export const bookingChanges = pgTable(
  "booking_changes",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    changeType: text("change_type").notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_changes_booking_idx").on(t.bookingId)],
);

/** Terminal record with reason + refund state — one per booking, matching the callSheets/shootDays 1:1 PK pattern. */
export const bookingCancellations = pgTable("booking_cancellations", {
  bookingId: text("booking_id")
    .primaryKey()
    .references(() => bookings.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  refundState: text("refund_state"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A named, reusable approval chain scoped to a production
 * (LOGISTICS_DOMAIN_MODEL.md §0.2) — e.g. "Standard Travel Approval". No
 * module gets a hard-coded approval `if` chain; a new booking type reuses
 * this with a different stage list, not new code.
 */
export const approvalWorkflows = pgTable(
  "approval_workflows",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("approval_workflows_production_idx").on(t.productionId)],
);

/** One step in a workflow: the permission a decider must hold, and its order in the chain. */
export const approvalStages = pgTable(
  "approval_stages",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => approvalWorkflows.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    requiredPermission: text("required_permission")
      .notNull()
      .references(() => permissions.key, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("approval_stages_workflow_idx").on(t.workflowId), unique("approval_stages_workflow_order_unique").on(t.workflowId, t.order)],
);

/** A condition attached to a stage (amount threshold, department, booking type) — a generic type/value pair rather than one column per condition shape, so a new condition type doesn't need a migration. */
export const approvalRules = pgTable(
  "approval_rules",
  {
    id: text("id").primaryKey(),
    stageId: text("stage_id")
      .notNull()
      .references(() => approvalStages.id, { onDelete: "cascade" }),
    conditionType: text("condition_type").notNull(),
    conditionValue: text("condition_value").notNull(),
  },
  (t) => [index("approval_rules_stage_idx").on(t.stageId)],
);

/** One instance of a workflow running against one Booking. */
export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => approvalWorkflows.id, { onDelete: "restrict" }),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("approval_requests_booking_idx").on(t.bookingId), index("approval_requests_workflow_idx").on(t.workflowId)],
);

/**
 * One stage's decision — feeds the Production Audit stream
 * (AUDIT_EVENT_CATALOG.md) once that exists. This table doubles as
 * LOGISTICS_DOMAIN_MODEL.md §0.1's `BookingApproval`: a booking's
 * approval history is its `approvalRequests` joined to their
 * `approvalDecisions`, not a separate, duplicate record.
 */
export const approvalDecisions = pgTable(
  "approval_decisions",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => approvalRequests.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => approvalStages.id, { onDelete: "restrict" }),
    decidedBy: uuid("decided_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    decision: text("decision").notNull(),
    note: text("note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("approval_decisions_request_idx").on(t.requestId)],
);

/**
 * Logistics ↔ Finance (LOGISTICS_DOMAIN_MODEL.md §0.3): a forward-looking
 * financial obligation created when a Booking reaches APPROVED — not yet
 * an Expense. `expenses.bookingId` (added below) is where a Commitment
 * becomes today's real Actual once paid; no vendor/cost data is
 * duplicated between the two, the Booking stays the single source.
 */
export const commitments = pgTable(
  "commitments",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    budgetLineId: text("budget_line_id").references(() => budgetLines.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("commitments_booking_idx").on(t.bookingId), index("commitments_budget_line_idx").on(t.budgetLineId)],
);

/** A Commitment becomes an Invoice when the vendor bills it, before it becomes an Actual (`expenses` row) when paid. */
export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    commitmentId: text("commitment_id")
      .notNull()
      .references(() => commitments.id, { onDelete: "cascade" }),
    vendorRef: text("vendor_ref").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    invoiceNumber: text("invoice_number"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoices_commitment_idx").on(t.commitmentId)],
);

/**
 * Accommodation domain (LOGISTICS_DOMAIN_MODEL.md §2) — the first real
 * Logistics subdomain built on the Booking Engine above. Scoped to
 * AccommodationProperty/RoomType/Stay for a first working v1;
 * AccommodationContract/RoomBlock/RoomAssignment (bulk, negotiated-rate
 * block bookings) are deliberately deferred — see
 * packages/db/migrations/0020_accommodation_domain.sql's header comment.
 *
 * Unlike the Booking Engine tables above (deliberately unwired at 0018),
 * this is wired into real Server Actions
 * (apps/web/app/accommodation/actions.ts) and a real screen from the
 * start, so every table here has full read+write RLS, not read-only.
 */
export const accommodationProperties = pgTable(
  "accommodation_properties",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** HOTEL | APARTMENT | HOUSE | TRAILER | OTHER (LOGISTICS_DOMAIN_MODEL.md §2). */
    type: text("type").notNull().default("HOTEL"),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accommodation_properties_production_idx").on(t.productionId)],
);

export const roomTypes = pgTable(
  "room_types",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => accommodationProperties.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("room_types_property_idx").on(t.propertyId)],
);

/**
 * The traveler-facing record (LOGISTICS_DOMAIN_MODEL.md §2's Stay) — also
 * the AccommodationBooking subtype: this Stay IS the `bookings` row's
 * subject (subjectType: "ACCOMMODATION_STAY", subjectId: stays.id), so
 * there's no separate wrapper table duplicating the link `bookingId`
 * already carries the other way.
 *
 * personType/castMemberId/crewMemberId: cast and crew are two separate
 * tables in this schema (no unified "people" table), so the polymorphic
 * personRef the domain model calls for is two nullable real foreign keys
 * plus a DB check constraint pinning exactly one of them, rather than a
 * stringly-typed id column.
 */
export const stays = pgTable(
  "stays",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => accommodationProperties.id, { onDelete: "restrict" }),
    roomTypeId: text("room_type_id").references(() => roomTypes.id, { onDelete: "set null" }),
    /** "CAST" | "CREW" — enforced together with castMemberId/crewMemberId by a DB check constraint (packages/db/migrations/0020_accommodation_domain.sql). */
    personType: text("person_type").notNull(),
    castMemberId: text("cast_member_id").references((): AnyPgColumn => castMembers.id, { onDelete: "cascade" }),
    crewMemberId: text("crew_member_id").references((): AnyPgColumn => crewMembers.id, { onDelete: "cascade" }),
    checkIn: timestamp("check_in", { withTimezone: true }).notNull(),
    checkOut: timestamp("check_out", { withTimezone: true }).notNull(),
    roomNumber: text("room_number"),
    /** Explicit sharing pairing — §2's RoomAssignment "sharing flag", without the full RoomBlock/RoomAssignment layer this v1 defers. */
    sharedWithStayId: text("shared_with_stay_id").references((): AnyPgColumn => stays.id, { onDelete: "set null" }),
    /** Set once bookStay() creates the matching bookings row in the same transaction. */
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stays_production_idx").on(t.productionId),
    index("stays_property_idx").on(t.propertyId),
    index("stays_cast_member_idx").on(t.castMemberId),
    index("stays_crew_member_idx").on(t.crewMemberId),
    index("stays_booking_idx").on(t.bookingId),
  ],
);

/** A structured diff when a Stay changes (LOGISTICS_DOMAIN_MODEL.md §2's AccommodationChange), mirroring bookingChanges' shape. */
export const accommodationChanges = pgTable(
  "accommodation_changes",
  {
    id: text("id").primaryKey(),
    stayId: text("stay_id")
      .notNull()
      .references(() => stays.id, { onDelete: "cascade" }),
    changeType: text("change_type").notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accommodation_changes_stay_idx").on(t.stayId)],
);

/**
 * Transportation domain (LOGISTICS_DOMAIN_MODEL.md §3) — the second real
 * Logistics subdomain, built on the Booking Engine the same way
 * Accommodation was. Scoped to Vehicle/Driver/DriverQualification/
 * Movement/MovementLeg/passenger-manifest for a first working v1;
 * Route/PickupPoint as first-class entities and a separate
 * MovementAssignment table are deliberately deferred — see
 * packages/db/migrations/0021_transportation_domain.sql's header
 * comment. Today's fixture-era `production_vehicles`/`transport_runs`
 * fields (packages/core, wired into the shoot-day call sheet) are a
 * completely separate, untouched thing — this is a parallel real
 * booking system, not a migration of those free-text fields.
 */
export const vehicles = pgTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    /** A fixed picklist enforced at the UI layer (Production Vehicle | Cast Car | VIP Vehicle | Shuttle | Bus | Van | Equipment Vehicle | Picture Vehicle | External Taxi/Chauffeur — LOGISTICS_DOMAIN_MODEL.md §3), not a separate VehicleType table. */
    type: text("type").notNull().default("PRODUCTION_VEHICLE"),
    identifier: text("identifier").notNull(),
    capacity: integer("capacity").notNull().default(1),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vehicles_production_idx").on(t.productionId)],
);

/** crewMemberId/externalName: most drivers are crew, but an external taxi/chauffeur service has no crew record at all — a nullable pair with a DB check constraint pinning exactly one, not a required either/or. */
export const drivers = pgTable(
  "drivers",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    crewMemberId: text("crew_member_id").references((): AnyPgColumn => crewMembers.id, { onDelete: "cascade" }),
    externalName: text("external_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("drivers_production_idx").on(t.productionId), index("drivers_crew_member_idx").on(t.crewMemberId)],
);

/** Tracked for reference/display in this v1 — not yet cross-checked against a leg's requirements when assigning a driver (no per-leg "required qualification" field exists yet to check against). */
export const driverQualifications = pgTable(
  "driver_qualifications",
  {
    id: text("id").primaryKey(),
    driverId: text("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    qualificationType: text("qualification_type").notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("driver_qualifications_driver_idx").on(t.driverId)],
);

/** Also the VehicleBooking subtype's anchor: a Movement IS the bookings row's subject (subjectType "TRANSPORT_MOVEMENT", subjectId: movements.id), mirroring exactly how a Stay anchors an accommodation booking. */
export const movements = pgTable(
  "movements",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    purpose: text("purpose").notNull(),
    /** PLANNED | CONFIRMED | DRIVER_ASSIGNED | READY | BOARDING | EN_ROUTE | ARRIVED | COMPLETED | CANCELLED (LOGISTICS_DOMAIN_MODEL.md §3). */
    status: text("status").notNull().default("PLANNED"),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("movements_production_idx").on(t.productionId), index("movements_booking_idx").on(t.bookingId)],
);

/** vehicleId/driverId live directly on the leg for v1 (MovementAssignment deferred). pickup/dropoff reuse the existing `locations` table with a free-text fallback. */
export const movementLegs = pgTable(
  "movement_legs",
  {
    id: text("id").primaryKey(),
    movementId: text("movement_id")
      .notNull()
      .references(() => movements.id, { onDelete: "cascade" }),
    pickupLocationId: text("pickup_location_id").references(() => locations.id, { onDelete: "set null" }),
    pickupNotes: text("pickup_notes"),
    dropoffLocationId: text("dropoff_location_id").references(() => locations.id, { onDelete: "set null" }),
    dropoffNotes: text("dropoff_notes"),
    scheduledTime: timestamp("scheduled_time", { withTimezone: true }).notNull(),
    vehicleId: text("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    driverId: text("driver_id").references(() => drivers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("movement_legs_movement_idx").on(t.movementId),
    index("movement_legs_vehicle_idx").on(t.vehicleId),
    index("movement_legs_driver_idx").on(t.driverId),
  ],
);

/** LOGISTICS_DOMAIN_MODEL.md §3's PassengerManifest — same polymorphic person pattern as stays.castMemberId/crewMemberId. */
export const movementLegPassengers = pgTable(
  "movement_leg_passengers",
  {
    id: text("id").primaryKey(),
    legId: text("leg_id")
      .notNull()
      .references(() => movementLegs.id, { onDelete: "cascade" }),
    personType: text("person_type").notNull(),
    castMemberId: text("cast_member_id").references((): AnyPgColumn => castMembers.id, { onDelete: "cascade" }),
    crewMemberId: text("crew_member_id").references((): AnyPgColumn => crewMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("movement_leg_passengers_leg_idx").on(t.legId),
    index("movement_leg_passengers_cast_member_idx").on(t.castMemberId),
    index("movement_leg_passengers_crew_member_idx").on(t.crewMemberId),
  ],
);

/**
 * Catering domain (LOGISTICS_DOMAIN_MODEL.md §6) — the third real
 * Logistics subdomain. DietaryProfile/DietaryRequirement are explicitly
 * sensitive per §6's mandate; the "who sees a named person's allergy
 * info vs. only an anonymized headcount" split is enforced by
 * apps/web/app/catering/actions.ts at the app layer (the same interim
 * Producer-only gate every write action in this train uses), not by a
 * tighter RLS policy — see 0022_catering_domain.sql's header comment.
 * CraftService folds into mealServices.mealType = "CRAFT" rather than a
 * separate table; MealCount is computed live by Server Actions, never
 * stored, per §6's own "generated view, never a separately-maintained
 * document" principle — see that same migration's header comment.
 */
export const dietaryProfiles = pgTable(
  "dietary_profiles",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    personType: text("person_type").notNull(),
    castMemberId: text("cast_member_id").references((): AnyPgColumn => castMembers.id, { onDelete: "cascade" }),
    crewMemberId: text("crew_member_id").references((): AnyPgColumn => crewMembers.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** VEGETARIAN | NON_VEGETARIAN | VEGAN | EGGETARIAN | JAIN | HALAL | KOSHER — a standing preference, distinct from dietaryRequirements' graded allergy severities (0024). */
    dietType: text("diet_type"),
    beveragePreference: text("beverage_preference"),
    /** MILD | MEDIUM | HOT. */
    spicePreference: text("spice_preference"),
  },
  (t) => [
    index("dietary_profiles_production_idx").on(t.productionId),
    index("dietary_profiles_cast_member_idx").on(t.castMemberId),
    index("dietary_profiles_crew_member_idx").on(t.crewMemberId),
  ],
);

/** The structured half of a profile (e.g. "Nut allergy — Severe") — free-text notes live on dietaryProfiles itself. */
export const dietaryRequirements = pgTable(
  "dietary_requirements",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => dietaryProfiles.id, { onDelete: "cascade" }),
    requirementType: text("requirement_type").notNull(),
    /** PREFERENCE | MILD | SEVERE. */
    severity: text("severity").notNull().default("PREFERENCE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dietary_requirements_profile_idx").on(t.profileId)],
);

export const cateringVendors = pgTable(
  "catering_vendors",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contact: text("contact"),
    contractTerms: text("contract_terms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("catering_vendors_production_idx").on(t.productionId)],
);

/** mealType "CRAFT" covers LOGISTICS_DOMAIN_MODEL.md §6's CraftService case — see 0022's header comment. */
export const mealServices = pgTable(
  "meal_services",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    /** BREAKFAST | LUNCH | DINNER | CRAFT. */
    mealType: text("meal_type").notNull(),
    locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** BUFFET | PLATED | PACKED_BOXES | FAMILY_STYLE (0024). */
    serviceStyle: text("service_style"),
    /** DISPOSABLE_ECO | DISPOSABLE_STANDARD | REUSABLE | PLATED. */
    packagingType: text("packaging_type"),
    /** Free-text clock time (e.g. "12:30 PM") — `date` already carries the day. */
    serviceTime: text("service_time"),
    headcountConfirmed: integer("headcount_confirmed"),
    hospitalityNotes: text("hospitality_notes"),
  },
  (t) => [index("meal_services_production_idx").on(t.productionId)],
);

/** Who's expected at a service — same polymorphic person pattern as stays/movementLegPassengers. */
export const mealServiceAssignments = pgTable(
  "meal_service_assignments",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id")
      .notNull()
      .references(() => mealServices.id, { onDelete: "cascade" }),
    personType: text("person_type").notNull(),
    castMemberId: text("cast_member_id").references((): AnyPgColumn => castMembers.id, { onDelete: "cascade" }),
    crewMemberId: text("crew_member_id").references((): AnyPgColumn => crewMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("meal_service_assignments_service_idx").on(t.serviceId),
    index("meal_service_assignments_cast_member_idx").on(t.castMemberId),
    index("meal_service_assignments_crew_member_idx").on(t.crewMemberId),
  ],
);

/** The Booking (0018) subtype: a CateringOrder IS the bookings row's subject (subjectType "CATERING_ORDER", subjectId: cateringOrders.id) — status lives on the linked bookings row, not duplicated here. */
export const cateringOrders = pgTable(
  "catering_orders",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id")
      .notNull()
      .references(() => mealServices.id, { onDelete: "cascade" }),
    vendorId: text("vendor_id").references(() => cateringVendors.id, { onDelete: "set null" }),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("catering_orders_service_idx").on(t.serviceId),
    index("catering_orders_vendor_idx").on(t.vendorId),
    index("catering_orders_booking_idx").on(t.bookingId),
  ],
);

/** A production's approved menu catalog (0024) — same shape/role as equipmentCatalogItems, optionally linked to a cateringVendors row. */
export const menuItems = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    vendorId: text("vendor_id").references(() => cateringVendors.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** STARTER | MAIN | DESSERT | BEVERAGE | SNACK | BREAD | SIDE. */
    category: text("category"),
    cuisine: text("cuisine"),
    /** VEGETARIAN | NON_VEGETARIAN | VEGAN | EGGETARIAN | JAIN. */
    dietType: text("diet_type"),
    /** MILD | MEDIUM | HOT. */
    spiceLevel: text("spice_level"),
    /** DISPOSABLE_ECO | DISPOSABLE_STANDARD | REUSABLE | PLATED. */
    packagingType: text("packaging_type"),
    price: numeric("price", { precision: 12, scale: 2 }),
    /** USD | INR | CAD | EUR | AED — same explicit list as equipmentCatalogItems (0023). */
    currency: text("currency"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("menu_items_production_idx").on(t.productionId), index("menu_items_vendor_idx").on(t.vendorId)],
);

/** Itemizes a cateringOrders row against the menu catalog (0024) — an order can still exist with zero items (vendor-only, details TBD). */
export const cateringOrderItems = pgTable(
  "catering_order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => cateringOrders.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("catering_order_items_order_idx").on(t.orderId), index("catering_order_items_menu_item_idx").on(t.menuItemId)],
);

/** Equipment domain (0023) — Camera / Grip & Electric / Sound. Same shape as cateringVendors. */
export const equipmentVendors = pgTable(
  "equipment_vendors",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contact: text("contact"),
    contractTerms: text("contract_terms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("equipment_vendors_production_idx").on(t.productionId)],
);

/** A vendor's approved-for-this-production equipment list — dopApproved is set by the Camera department's HOD (see 0023's header comment for why there's no dedicated "DOP" role). */
export const equipmentCatalogItems = pgTable(
  "equipment_catalog_items",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => equipmentVendors.id, { onDelete: "cascade" }),
    /** "Camera" | "Grip & Electric" | "Sound" — packages/core's STANDARD_DEPARTMENTS values. */
    department: text("department").notNull(),
    category: text("category"),
    name: text("name").notNull(),
    dailyRate: numeric("daily_rate", { precision: 12, scale: 2 }),
    currency: text("currency"),
    dopApproved: boolean("dop_approved").notNull().default(false),
    dopApprovedBy: uuid("dop_approved_by").references(() => profiles.id, { onDelete: "set null" }),
    dopApprovedAt: timestamp("dop_approved_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("equipment_catalog_items_production_idx").on(t.productionId), index("equipment_catalog_items_vendor_idx").on(t.vendorId)],
);

/** One equipment line item on one shoot day — the Booking (0018) subtype plus the owner's three-role sign-off (DOP / Director / Producer), each an independent boolean + who + when. */
export const equipmentBookings = pgTable(
  "equipment_bookings",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => shootDays.id, { onDelete: "cascade" }),
    catalogItemId: text("catalog_item_id")
      .notNull()
      .references(() => equipmentCatalogItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    /** Snapshot of the negotiated per-unit daily rate at booking time — may differ from the catalog item's reference dailyRate. */
    rate: numeric("rate", { precision: 12, scale: 2 }),
    currency: text("currency"),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    dopApproved: boolean("dop_approved").notNull().default(false),
    dopApprovedBy: uuid("dop_approved_by").references(() => profiles.id, { onDelete: "set null" }),
    dopApprovedAt: timestamp("dop_approved_at", { withTimezone: true }),
    directorApproved: boolean("director_approved").notNull().default(false),
    directorApprovedBy: uuid("director_approved_by").references(() => profiles.id, { onDelete: "set null" }),
    directorApprovedAt: timestamp("director_approved_at", { withTimezone: true }),
    producerApproved: boolean("producer_approved").notNull().default(false),
    producerApprovedBy: uuid("producer_approved_by").references(() => profiles.id, { onDelete: "set null" }),
    producerApprovedAt: timestamp("producer_approved_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("equipment_bookings_production_idx").on(t.productionId),
    index("equipment_bookings_shoot_day_idx").on(t.shootDayId),
    index("equipment_bookings_catalog_item_idx").on(t.catalogItemId),
    index("equipment_bookings_booking_idx").on(t.bookingId),
  ],
);

export const characters = pgTable(
  "characters",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [index("characters_production_idx").on(t.productionId)],
);

/** Contact & representation columns shared by cast_members and crew_members — see ContactInfo in packages/core. */
const contactColumns = {
  email: text("email"),
  phone: text("phone"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  agentName: text("agent_name"),
  agentPhone: text("agent_phone"),
  agentEmail: text("agent_email"),
};

/** Wardrobe sizing columns for cast_members — see SizingInfo in packages/core. */
const sizingColumns = {
  height: text("height"),
  shirtSize: text("shirt_size"),
  pantSize: text("pant_size"),
  shoeSize: text("shoe_size"),
  sizingNotes: text("sizing_notes"),
};

export const castMembers = pgTable(
  "cast_members",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    actorName: text("actor_name").notNull(),
    status: text("status").notNull(),
    contract: text("contract").notNull(),
    photoPath: text("photo_path"),
    ...contactColumns,
    ...sizingColumns,
  },
  (t) => [index("cast_members_production_idx").on(t.productionId)],
);

export const crewMembers = pgTable(
  "crew_members",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    department: text("department").notNull(),
    role: text("role").notNull(),
    isHod: boolean("is_hod").notNull().default(false),
    contract: text("contract").notNull().default("Pending"),
    walkieChannel: text("walkie_channel"),
    /** Storage object path in the production-photos bucket — same convention as castMembers.photoPath (0011). */
    photoPath: text("photo_path"),
    ...contactColumns,
  },
  (t) => [index("crew_members_production_idx").on(t.productionId)],
);

export const locations = pgTable(
  "locations",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address").notNull(),
    permitStatus: text("permit_status").notNull(),
    permitExpiry: text("permit_expiry"),
    photoPath: text("photo_path"),
  },
  (t) => [index("locations_production_idx").on(t.productionId)],
);

export const props = pgTable(
  "props",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [index("props_production_idx").on(t.productionId)],
);

export const propScenes = pgTable(
  "prop_scenes",
  {
    propId: text("prop_id")
      .notNull()
      .references(() => props.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.propId, t.sceneId] })],
);

export const shootDays = pgTable(
  "shoot_days",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    totalDays: integer("total_days").notNull(),
    date: text("date").notNull(),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id),
    status: text("status").notNull(),
    callTime: text("call_time").notNull(),
    wrapTime: text("wrap_time"),
    unit: text("unit").notNull().default("Main Unit"),
  },
  (t) => [index("shoot_days_production_idx").on(t.productionId)],
);

export const scenes = pgTable(
  "scenes",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    intExt: text("int_ext").notNull(),
    setName: text("set_name").notNull(),
    dayNight: text("day_night").notNull(),
    synopsis: text("synopsis").notNull().default(""),
    pageCount: text("page_count").notNull().default(""),
    status: text("status").notNull().default("Draft"),
    shootDayId: text("shoot_day_id").references(() => shootDays.id, { onDelete: "set null" }),
    scheduleOrder: integer("schedule_order").notNull().default(0),
    /** The revision color of the script import that last changed this scene's content. */
    revisionColor: text("revision_color").notNull().default("White"),
    /** Wardrobe/hair/makeup continuity notes — what's different in this scene from the rest of the shoot. */
    continuityNotes: text("continuity_notes").notNull().default(""),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id),
  },
  (t) => [
    index("scenes_production_idx").on(t.productionId),
    index("scenes_shoot_day_idx").on(t.shootDayId),
  ],
);

export const sceneCast = pgTable(
  "scene_cast",
  {
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    castMemberId: text("cast_member_id")
      .notNull()
      .references(() => castMembers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sceneId, t.castMemberId] })],
);

export const breakdownElements = pgTable(
  "breakdown_elements",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    label: text("label").notNull(),
    source: text("source").notNull().default("confirmed"),
  },
  (t) => [index("breakdown_elements_scene_idx").on(t.sceneId)],
);

export const scriptPages = pgTable(
  "script_pages",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    elements: jsonb("elements").notNull().$type<{ type: string; text: string }[]>(),
  },
  (t) => [index("script_pages_scene_idx").on(t.sceneId)],
);

export const issues = pgTable(
  "issues",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    affectedShootDayId: text("affected_shoot_day_id").references(() => shootDays.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("issues_production_idx").on(t.productionId)],
);

export const issueScenes = pgTable(
  "issue_scenes",
  {
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.sceneId] })],
);

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    requestedBy: text("requested_by").notNull(),
    status: text("status").notNull().default("Pending"),
  },
  (t) => [index("approvals_production_idx").on(t.productionId)],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("Draft"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    filePath: text("file_path"),
    expiryDate: text("expiry_date"),
    linkedCastMemberId: text("linked_cast_member_id").references(() => castMembers.id, { onDelete: "set null" }),
    linkedCrewMemberId: text("linked_crew_member_id").references(() => crewMembers.id, { onDelete: "set null" }),
    linkedLocationId: text("linked_location_id").references(() => locations.id, { onDelete: "set null" }),
  },
  (t) => [index("documents_production_idx").on(t.productionId)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    vendor: text("vendor").notNull(),
    department: text("department").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: text("status").notNull().default("Pending"),
    date: text("date").notNull().default(""),
    invoiceNumber: text("invoice_number"),
    documentPath: text("document_path"),
    /** Links this Actual back to the Booking that produced it (LOGISTICS_DOMAIN_MODEL.md §0.3) — null for every expense today, since no booking exists yet to link to. set null, not cascade: an expense record is a financial fact that outlives the booking bookkeeping trail. */
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  },
  (t) => [index("expenses_production_idx").on(t.productionId)],
);

export const budgetLines = pgTable(
  "budget_lines",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    department: text("department").notNull(),
    budgeted: numeric("budgeted", { precision: 12, scale: 2 }).notNull(),
    actual: numeric("actual", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("budget_lines_production_idx").on(t.productionId), unique("budget_lines_production_department_unique").on(t.productionId, t.department)],
);

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(),
    description: text("description").notNull(),
  },
  (t) => [index("activities_production_idx").on(t.productionId)],
);

export const callSheets = pgTable("call_sheets", {
  shootDayId: text("shoot_day_id")
    .primaryKey()
    .references(() => shootDays.id, { onDelete: "cascade" }),
  productionId: text("production_id")
    .notNull()
    .references(() => productions.id, { onDelete: "cascade" }),
  weather: text("weather").notNull().default(""),
  sunrise: text("sunrise").notNull().default(""),
  sunset: text("sunset").notNull().default(""),
  hospital: text("hospital").notNull().default(""),
  parking: text("parking").notNull().default(""),
  basecamp: text("basecamp").notNull().default(""),
  notes: text("notes").notNull().default(""),
});

/**
 * Per-person call time overrides for a shoot day — absent for a given
 * person means "use the day's general crew call" (shootDays.callTime).
 * Two tables rather than one polymorphic one, matching the sceneCast /
 * propScenes join-table pattern elsewhere in this schema, so each keeps a
 * real FK to the table it actually references.
 */
export const shootDayCastCallTimes = pgTable(
  "shoot_day_cast_call_times",
  {
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => shootDays.id, { onDelete: "cascade" }),
    castMemberId: text("cast_member_id")
      .notNull()
      .references(() => castMembers.id, { onDelete: "cascade" }),
    callTime: text("call_time").notNull(),
    status: text("status"),
    onCall: boolean("on_call").notNull().default(false),
    pickupTime: text("pickup_time"),
    makeupCallTime: text("makeup_call_time"),
    hairCallTime: text("hair_call_time"),
    wardrobeCallTime: text("wardrobe_call_time"),
    rehearsalCallTime: text("rehearsal_call_time"),
  },
  (t) => [primaryKey({ columns: [t.shootDayId, t.castMemberId] })],
);

export const shootDayCrewCallTimes = pgTable(
  "shoot_day_crew_call_times",
  {
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => shootDays.id, { onDelete: "cascade" }),
    crewMemberId: text("crew_member_id")
      .notNull()
      .references(() => crewMembers.id, { onDelete: "cascade" }),
    callTime: text("call_time").notNull(),
  },
  (t) => [primaryKey({ columns: [t.shootDayId, t.crewMemberId] })],
);

export const callSheetTimelineEvents = pgTable(
  "call_sheet_timeline_events",
  {
    id: text("id").primaryKey(),
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => callSheets.shootDayId, { onDelete: "cascade" }),
    time: text("time").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("call_sheet_timeline_shoot_day_idx").on(t.shootDayId)],
);

/** Background/extras headcount call for a shoot day — see BackgroundExtra in packages/core. */
export const backgroundExtras = pgTable(
  "background_extras",
  {
    id: text("id").primaryKey(),
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => shootDays.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    headcount: integer("headcount").notNull().default(0),
    callTime: text("call_time"),
    instructions: text("instructions"),
  },
  (t) => [index("background_extras_shoot_day_idx").on(t.shootDayId)],
);

/** A named stand-in for a shoot day — see StandIn in packages/core. */
export const standIns = pgTable(
  "stand_ins",
  {
    id: text("id").primaryKey(),
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => shootDays.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    standsInForCastMemberId: text("stands_in_for_cast_member_id").references(() => castMembers.id, { onDelete: "set null" }),
    phone: text("phone"),
    callTime: text("call_time"),
  },
  (t) => [index("stand_ins_shoot_day_idx").on(t.shootDayId)],
);

/** A vehicle needed on a shoot day — trucks/trailers/picture cars — see ProductionVehicle in packages/core. */
export const productionVehicles = pgTable(
  "production_vehicles",
  {
    id: text("id").primaryKey(),
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => shootDays.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    description: text("description").notNull(),
    driverName: text("driver_name"),
    driverPhone: text("driver_phone"),
    notes: text("notes"),
  },
  (t) => [index("production_vehicles_shoot_day_idx").on(t.shootDayId)],
);

/** A shuttle/van run for a shoot day — see TransportRun in packages/core. */
export const transportRuns = pgTable(
  "transport_runs",
  {
    id: text("id").primaryKey(),
    shootDayId: text("shoot_day_id")
      .notNull()
      .references(() => shootDays.id, { onDelete: "cascade" }),
    driverName: text("driver_name"),
    pickupTime: text("pickup_time"),
    pickupLocation: text("pickup_location"),
    dropoffLocation: text("dropoff_location"),
    passengers: text("passengers"),
    notes: text("notes"),
  },
  (t) => [index("transport_runs_shoot_day_idx").on(t.shootDayId)],
);

/**
 * AI recommendations are read-only surfaces of committed Suggest→Explain
 * pipeline output (see apps/web app/api/ai/*); a row here never gets
 * written directly by the model, only by the /approve commit step.
 */
export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    conflict: text("conflict").notNull(),
    explanation: text("explanation"),
    affected: jsonb("affected").notNull().$type<string[]>(),
    options: jsonb("options").notNull().$type<{ label: string; title: string; impact: string }[]>(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_recommendations_production_idx").on(t.productionId)],
);

/**
 * Every AI suggestion that reaches a user is logged here at Suggest time,
 * and updated at Approve/Reject time — the audit trail the governance
 * model (Suggest→Explain→Preview→Approve→Commit) requires. The model
 * itself never writes to any other table.
 */
export const aiSuggestionLog = pgTable(
  "ai_suggestion_log",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    input: jsonb("input").notNull(),
    suggestion: jsonb("suggestion").notNull(),
    explanation: text("explanation").notNull(),
    status: text("status").notNull().default("suggested"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("ai_suggestion_log_production_idx").on(t.productionId)],
);

/**
 * P19 — one atomic counter per (production, entity_type), backing the
 * human-readable ID-numbering system (apps/web/lib/id-registry.ts). Issuing
 * a number is a single insert-on-conflict-update statement against this
 * table's primary key, which Postgres executes atomically — no explicit
 * row locking needed. See migration 0028's header comment.
 */
export const idSequences = pgTable(
  "id_sequences",
  {
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    currentValue: integer("current_value").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.productionId, t.entityType] })],
);

/**
 * Security & Access (P16), Phase A — a generic physical
 * identity/credential/access-control domain (0025_access_control_foundation.sql).
 * Schema only in this phase: no Server Action reads or writes any table
 * below yet, and RLS grants SELECT only (no write policy anywhere) —
 * matching 0017/0018's exact "schema-only, unwired" precedent. See that
 * migration's header comment for the full design rationale: generic,
 * non-film-specific vocabulary; production_id-only tenancy (no redundant
 * organization_id); composite (id, production_id) foreign keys enforcing
 * cross-tenant integrity at the database level, not just RLS/app checks;
 * one generic accessIdentities table (no separate Crew/Cast/Visitor
 * identity tables) reusing this codebase's existing polymorphic-pair
 * pattern (dietaryProfiles, mealServiceAssignments) for CAST/CREW plus a
 * third EXTERNAL case for people with no existing FilmSet record.
 */
export const accessIdentities = pgTable(
  "access_identities",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    /** CAST | CREW | EXTERNAL. */
    personCategory: text("person_category").notNull(),
    castMemberId: text("cast_member_id").references((): AnyPgColumn => castMembers.id, { onDelete: "cascade" }),
    crewMemberId: text("crew_member_id").references((): AnyPgColumn => crewMembers.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    company: text("company"),
    photoPath: text("photo_path"),
    /** Independent from personCategory — see this table's header comment. */
    securityClass: text("security_class").notNull().default("CREW"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete — a row is never really removed, so a credential/resource/checkpoint's number is never freed for reuse. See docs/security/AUDIT_TRAIL_ACCESS_CONTROL.md. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_identities_production_idx").on(t.productionId),
    index("access_identities_cast_member_idx").on(t.castMemberId),
    index("access_identities_crew_member_idx").on(t.crewMemberId),
    unique("access_identities_id_production_unique").on(t.id, t.productionId),
  ],
);

/** The credential domain — status is a real lifecycle, never a boolean. publicReference is the only value ever meant to be encoded in a QR (opaque, high-entropy, zero PII). */
export const accessCredentials = pgTable(
  "access_credentials",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    identityId: text("identity_id").notNull(),
    credentialType: text("credential_type").notNull().default("QR"),
    credentialClass: text("credential_class").notNull(),
    /** Human-readable badge number (e.g. "VMPA-CR-000482") — searchable by admins, never the QR secret. */
    credentialNumber: text("credential_number").notNull(),
    /** The opaque, high-entropy value a QR actually encodes. Globally unique. */
    publicReference: text("public_reference").notNull(),
    status: text("status").notNull().default("DRAFT"),
    assuranceLevel: text("assurance_level").notNull().default("LEVEL_1_BASIC"),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedBy: uuid("issued_by").references(() => profiles.id, { onDelete: "set null" }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => profiles.id, { onDelete: "set null" }),
    revocationReason: text("revocation_reason"),
    replacedByCredentialId: text("replaced_by_credential_id").references((): AnyPgColumn => accessCredentials.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_credentials_production_idx").on(t.productionId),
    index("access_credentials_identity_idx").on(t.identityId),
    index("access_credentials_status_idx").on(t.status),
    unique("access_credentials_number_unique").on(t.productionId, t.credentialNumber),
    unique("access_credentials_public_reference_unique").on(t.publicReference),
    unique("access_credentials_id_production_unique").on(t.id, t.productionId),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_credentials_identity_fk" }).onDelete("cascade"),
  ],
);

/** Generic hierarchical resource/zone tree — arbitrary parent/child depth, not hard-coded. locationId optionally roots a tree at an existing FilmSet Location without duplicating it. */
export const accessResources = pgTable(
  "access_resources",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    parentResourceId: text("parent_resource_id"),
    locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),
    resourceType: text("resource_type").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    securityLevel: text("security_level").notNull().default("STANDARD"),
    minimumAssuranceLevel: text("minimum_assurance_level").notNull().default("LEVEL_1_BASIC"),
    capacity: integer("capacity"),
    occupancyPolicy: text("occupancy_policy").notNull().default("IGNORE"),
    offlinePolicy: text("offline_policy").notNull().default("DENY"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_resources_production_idx").on(t.productionId),
    index("access_resources_parent_idx").on(t.parentResourceId),
    index("access_resources_location_idx").on(t.locationId),
    unique("access_resources_id_production_unique").on(t.id, t.productionId),
    foreignKey({ columns: [t.parentResourceId, t.productionId], foreignColumns: [t.id, t.productionId], name: "access_resources_parent_fk" }).onDelete("cascade"),
  ],
);

/** A named, reusable access template (§9) — assignable to many identities instead of repeating the same rule set per person. */
export const accessProfiles = pgTable(
  "access_profiles",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_profiles_production_idx").on(t.productionId),
    unique("access_profiles_id_production_unique").on(t.id, t.productionId),
    unique("access_profiles_production_name_unique").on(t.productionId, t.name),
  ],
);

/** One allowed-resource rule within a profile. Null days/time window = no restriction on that axis. */
export const accessProfileRules = pgTable(
  "access_profile_rules",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    profileId: text("profile_id").notNull(),
    resourceId: text("resource_id").notNull(),
    daysOfWeek: text("days_of_week").array(),
    timeStart: time("time_start"),
    timeEnd: time("time_end"),
    /** Overrides the resource's own minimum only when stricter — enforced by the policy engine, not this column. */
    minimumAssuranceLevel: text("minimum_assurance_level"),
    escortRequired: boolean("escort_required").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_profile_rules_profile_idx").on(t.profileId),
    index("access_profile_rules_resource_idx").on(t.resourceId),
    foreignKey({ columns: [t.profileId, t.productionId], foreignColumns: [accessProfiles.id, accessProfiles.productionId], name: "access_profile_rules_profile_fk" }).onDelete("cascade"),
    foreignKey({ columns: [t.resourceId, t.productionId], foreignColumns: [accessResources.id, accessResources.productionId], name: "access_profile_rules_resource_fk" }).onDelete("cascade"),
  ],
);

export const accessIdentityProfiles = pgTable(
  "access_identity_profiles",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    identityId: text("identity_id").notNull(),
    profileId: text("profile_id").notNull(),
    assignedBy: uuid("assigned_by").references(() => profiles.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_identity_profiles_identity_idx").on(t.identityId),
    index("access_identity_profiles_profile_idx").on(t.profileId),
    unique("access_identity_profiles_unique").on(t.identityId, t.profileId),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_identity_profiles_identity_fk" }).onDelete("cascade"),
    foreignKey({ columns: [t.profileId, t.productionId], foreignColumns: [accessProfiles.id, accessProfiles.productionId], name: "access_identity_profiles_profile_fk" }).onDelete("cascade"),
  ],
);

/** Direct, individual resource overrides (§9: "Individual overrides must be possible"). */
export const accessGrants = pgTable(
  "access_grants",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    identityId: text("identity_id").notNull(),
    resourceId: text("resource_id").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    daysOfWeek: text("days_of_week").array(),
    timeStart: time("time_start"),
    timeEnd: time("time_end"),
    grantedBy: uuid("granted_by").references(() => profiles.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_grants_identity_idx").on(t.identityId),
    index("access_grants_resource_idx").on(t.resourceId),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_grants_identity_fk" }).onDelete("cascade"),
    foreignKey({ columns: [t.resourceId, t.productionId], foreignColumns: [accessResources.id, accessResources.productionId], name: "access_grants_resource_fk" }).onDelete("cascade"),
  ],
);

/** Explicit blocks (§31: "Restrictions should override grants"). Null resourceId = restricted from every resource in the production. */
export const accessRestrictions = pgTable(
  "access_restrictions",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    identityId: text("identity_id").notNull(),
    resourceId: text("resource_id"),
    reason: text("reason").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_restrictions_identity_idx").on(t.identityId),
    index("access_restrictions_resource_idx").on(t.resourceId),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_restrictions_identity_fk" }).onDelete("cascade"),
    foreignKey({ columns: [t.resourceId, t.productionId], foreignColumns: [accessResources.id, accessResources.productionId], name: "access_restrictions_resource_fk" }).onDelete("cascade"),
  ],
);

/** A physical gate/door/entrance where verification actually happens. */
export const accessCheckpoints = pgTable(
  "access_checkpoints",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    directionMode: text("direction_mode").notNull().default("BOTH"),
    active: boolean("active").notNull().default(true),
    antiPassbackMode: text("anti_passback_mode").notNull().default("OFF"),
    requiresOperatorConfirmation: boolean("requires_operator_confirmation").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_checkpoints_production_idx").on(t.productionId),
    index("access_checkpoints_resource_idx").on(t.resourceId),
    unique("access_checkpoints_id_production_unique").on(t.id, t.productionId),
    foreignKey({ columns: [t.resourceId, t.productionId], foreignColumns: [accessResources.id, accessResources.productionId], name: "access_checkpoints_resource_fk" }).onDelete("cascade"),
  ],
);

/** Every scanner is a first-class, individually trusted security identity — device trust and operator authentication are two separate axes, never conflated. */
export const accessDevices = pgTable(
  "access_devices",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    checkpointId: text("checkpoint_id"),
    name: text("name").notNull(),
    deviceType: text("device_type").notNull().default("MOBILE_SCANNER"),
    deviceIdentifier: text("device_identifier").notNull(),
    status: text("status").notNull().default("PENDING"),
    trustedAt: timestamp("trusted_at", { withTimezone: true }),
    trustedBy: uuid("trusted_by").references(() => profiles.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => profiles.id, { onDelete: "set null" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    appVersion: text("app_version"),
    capabilities: jsonb("capabilities").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_devices_production_idx").on(t.productionId),
    index("access_devices_checkpoint_idx").on(t.checkpointId),
    unique("access_devices_identifier_unique").on(t.productionId, t.deviceIdentifier),
    unique("access_devices_id_production_unique").on(t.id, t.productionId),
    foreignKey({ columns: [t.checkpointId, t.productionId], foreignColumns: [accessCheckpoints.id, accessCheckpoints.productionId], name: "access_devices_checkpoint_fk" }).onDelete("set null"),
  ],
);

/** Short-lived, one-time, HASHED enrollment tokens backing secure scanner enrollment (§14). The raw token is never stored — only its hash. */
export const accessDeviceEnrollments = pgTable(
  "access_device_enrollments",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    consumedByDeviceId: text("consumed_by_device_id"),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("access_device_enrollments_production_idx").on(t.productionId),
    unique("access_device_enrollments_token_hash_unique").on(t.tokenHash),
    foreignKey({ columns: [t.consumedByDeviceId, t.productionId], foreignColumns: [accessDevices.id, accessDevices.productionId], name: "access_device_enrollments_device_fk" }).onDelete("set null"),
  ],
);

/** The append-only verification ledger — "ordinary operators cannot alter historical events." No write RLS policy exists yet (see migration header); this table only grows once a later phase adds the real scan-writing Server Action. */
export const accessEvents = pgTable(
  "access_events",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    identityId: text("identity_id"),
    credentialId: text("credential_id"),
    deviceId: text("device_id").notNull(),
    checkpointId: text("checkpoint_id").notNull(),
    resourceId: text("resource_id").notNull(),
    operatorUserId: uuid("operator_user_id").references(() => profiles.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    direction: text("direction"),
    decision: text("decision").notNull(),
    reasonCode: text("reason_code").notNull(),
    /** Compact snapshot of the policy/profile ids that produced this decision (§49). */
    policySnapshot: jsonb("policy_snapshot").notNull().default({}),
    verificationMode: text("verification_mode").notNull().default("ONLINE"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    serverReceivedAt: timestamp("server_received_at", { withTimezone: true }).notNull().defaultNow(),
    clientOccurredAt: timestamp("client_occurred_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    correlationId: text("correlation_id"),
  },
  (t) => [
    index("access_events_production_idx").on(t.productionId),
    index("access_events_identity_idx").on(t.identityId),
    index("access_events_credential_idx").on(t.credentialId),
    index("access_events_device_idx").on(t.deviceId),
    index("access_events_checkpoint_idx").on(t.checkpointId),
    index("access_events_resource_idx").on(t.resourceId),
    index("access_events_occurred_at_idx").on(t.occurredAt),
    index("access_events_decision_idx").on(t.decision),
    index("access_events_reason_code_idx").on(t.reasonCode),
    unique("access_events_id_production_unique").on(t.id, t.productionId),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_events_identity_fk" }).onDelete("set null"),
    foreignKey({ columns: [t.credentialId, t.productionId], foreignColumns: [accessCredentials.id, accessCredentials.productionId], name: "access_events_credential_fk" }).onDelete("set null"),
    foreignKey({ columns: [t.deviceId, t.productionId], foreignColumns: [accessDevices.id, accessDevices.productionId], name: "access_events_device_fk" }).onDelete("restrict"),
    foreignKey({ columns: [t.checkpointId, t.productionId], foreignColumns: [accessCheckpoints.id, accessCheckpoints.productionId], name: "access_events_checkpoint_fk" }).onDelete("restrict"),
    foreignKey({ columns: [t.resourceId, t.productionId], foreignColumns: [accessResources.id, accessResources.productionId], name: "access_events_resource_fk" }).onDelete("restrict"),
  ],
);

/** Time-boxed grants that stop applying on their own after validUntil (§30) — enforced by the policy engine reading validUntil directly against server time, not a cleanup job. */
export const accessTemporaryGrants = pgTable(
  "access_temporary_grants",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    identityId: text("identity_id").notNull(),
    resourceId: text("resource_id").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    reason: text("reason"),
    requestedBy: uuid("requested_by").references(() => profiles.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => profiles.id, { onDelete: "set null" }),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    index("access_temporary_grants_identity_idx").on(t.identityId),
    index("access_temporary_grants_resource_idx").on(t.resourceId),
    index("access_temporary_grants_status_idx").on(t.status),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_temporary_grants_identity_fk" }).onDelete("cascade"),
    foreignKey({ columns: [t.resourceId, t.productionId], foreignColumns: [accessResources.id, accessResources.productionId], name: "access_temporary_grants_resource_fk" }).onDelete("cascade"),
  ],
);

/** Generic, append-only trail of every create/update/(soft)delete across this domain. No FK to the row it describes — that row may itself be soft-deleted, and RLS grants only select+insert, never update/delete, so the log can't be edited or purged through the app. See docs/security/AUDIT_TRAIL_ACCESS_CONTROL.md. */
export const accessAuditLog = pgTable(
  "access_audit_log",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    action: text("action").notNull(),
    actor: uuid("actor").references(() => profiles.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    before: jsonb("before"),
    after: jsonb("after"),
  },
  (t) => [
    index("access_audit_log_production_idx").on(t.productionId),
    index("access_audit_log_record_idx").on(t.tableName, t.recordId),
    index("access_audit_log_occurred_at_idx").on(t.occurredAt),
  ],
);

/** 1:1 extension of an EXTERNAL-category identity with visitor-specific fields (§28). */
export const accessVisitorDetails = pgTable(
  "access_visitor_details",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    identityId: text("identity_id").notNull(),
    hostIdentityId: text("host_identity_id"),
    purpose: text("purpose"),
    escortRequired: boolean("escort_required").notNull().default(false),
    vehicleInfo: text("vehicle_info"),
    status: text("status").notNull().default("PRE_REGISTERED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("access_visitor_details_identity_idx").on(t.identityId),
    index("access_visitor_details_host_idx").on(t.hostIdentityId),
    index("access_visitor_details_status_idx").on(t.status),
    unique("access_visitor_details_identity_unique").on(t.identityId),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_visitor_details_identity_fk" }).onDelete("cascade"),
    foreignKey({ columns: [t.hostIdentityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_visitor_details_host_fk" }).onDelete("set null"),
  ],
);

/** Security incident management (§32). */
export const accessIncidents = pgTable(
  "access_incidents",
  {
    id: text("id").primaryKey(),
    productionId: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    incidentNumber: text("incident_number").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull().default("LOW"),
    status: text("status").notNull().default("OPEN"),
    title: text("title").notNull(),
    description: text("description"),
    resourceId: text("resource_id"),
    checkpointId: text("checkpoint_id"),
    identityId: text("identity_id"),
    credentialId: text("credential_id"),
    accessEventId: text("access_event_id"),
    reportedBy: uuid("reported_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("access_incidents_production_idx").on(t.productionId),
    index("access_incidents_status_idx").on(t.status),
    index("access_incidents_severity_idx").on(t.severity),
    unique("access_incidents_number_unique").on(t.productionId, t.incidentNumber),
    foreignKey({ columns: [t.resourceId, t.productionId], foreignColumns: [accessResources.id, accessResources.productionId], name: "access_incidents_resource_fk" }).onDelete("set null"),
    foreignKey({ columns: [t.checkpointId, t.productionId], foreignColumns: [accessCheckpoints.id, accessCheckpoints.productionId], name: "access_incidents_checkpoint_fk" }).onDelete("set null"),
    foreignKey({ columns: [t.identityId, t.productionId], foreignColumns: [accessIdentities.id, accessIdentities.productionId], name: "access_incidents_identity_fk" }).onDelete("set null"),
    foreignKey({ columns: [t.credentialId, t.productionId], foreignColumns: [accessCredentials.id, accessCredentials.productionId], name: "access_incidents_credential_fk" }).onDelete("set null"),
    foreignKey({ columns: [t.accessEventId, t.productionId], foreignColumns: [accessEvents.id, accessEvents.productionId], name: "access_incidents_access_event_fk" }).onDelete("set null"),
  ],
);
