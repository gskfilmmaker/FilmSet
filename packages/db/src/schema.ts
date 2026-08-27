import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
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

export const productions = pgTable("productions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phase: text("phase").notNull().default("Development"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
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
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.productionId, t.userId] })],
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
  (t) => [index("budget_lines_production_idx").on(t.productionId)],
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
