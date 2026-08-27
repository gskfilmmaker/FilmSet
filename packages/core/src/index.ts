import { z } from "zod";

/**
 * Production-graph shapes — enough to type realistic fixture data for the
 * five canonical FRAME screens (Constitution §72-77). These are shapes
 * only: no persistence, no validation logic, no derived computation.
 * Real domain modeling (scheduling constraints, budget rules, rights,
 * versioned documents) belongs to the feature-implementation phase.
 */

export const productionPhaseSchema = z.enum(["Development", "Prep", "Production", "Post", "Wrap"]);
export type ProductionPhase = z.infer<typeof productionPhaseSchema>;

export const sceneStatusSchema = z.enum(["Draft", "Scheduled", "Shot", "Omitted", "Pickup", "Reshoot"]);
export type SceneStatus = z.infer<typeof sceneStatusSchema>;

export const sceneSchema = z.object({
  id: z.string(),
  number: z.string(),
  intExt: z.enum(["INT", "EXT"]),
  setName: z.string(),
  dayNight: z.enum(["DAY", "NIGHT"]),
  synopsis: z.string(),
  pageCount: z.string(),
  status: sceneStatusSchema,
  shootDayId: z.string().nullable(),
  castIds: z.array(z.string()),
  locationId: z.string(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const productionSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: productionPhaseSchema,
});
export type Production = z.infer<typeof productionSchema>;

// --- People ---

export const characterSchema = z.object({ id: z.string(), name: z.string() });
export type Character = z.infer<typeof characterSchema>;

export const castMemberSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  actorName: z.string(),
  status: z.enum(["Confirmed", "Offer Out", "Unavailable"]),
  contract: z.enum(["Signed", "Pending", "Missing"]),
});
export type CastMember = z.infer<typeof castMemberSchema>;

export const crewMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  department: z.string(),
  role: z.string(),
});
export type CrewMember = z.infer<typeof crewMemberSchema>;

// --- Places & things ---

export const locationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  permitStatus: z.enum(["Confirmed", "Pending", "Missing"]),
  permitExpiry: z.string().nullable(),
});
export type Location = z.infer<typeof locationSchema>;

export const propSchema = z.object({ id: z.string(), name: z.string(), sceneIds: z.array(z.string()) });
export type Prop = z.infer<typeof propSchema>;

// --- Schedule ---

export const shootDayStatusSchema = z.enum(["Wrapped", "In Progress", "Scheduled", "Unconfirmed"]);
export type ShootDayStatus = z.infer<typeof shootDayStatusSchema>;

export const shootDaySchema = z.object({
  id: z.string(),
  dayNumber: z.number(),
  totalDays: z.number(),
  date: z.string(),
  locationId: z.string(),
  status: shootDayStatusSchema,
  callTime: z.string(),
  wrapTime: z.string().nullable(),
  sceneIds: z.array(z.string()),
  unit: z.enum(["Main Unit", "Second Unit"]),
});
export type ShootDay = z.infer<typeof shootDaySchema>;

// --- Breakdown ---

export const breakdownCategorySchema = z.enum([
  "Props",
  "Wardrobe",
  "Vehicles",
  "Background",
  "Stunts",
  "Special Equipment",
  "Makeup/Hair",
]);
export type BreakdownCategory = z.infer<typeof breakdownCategorySchema>;

export const breakdownElementSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  category: breakdownCategorySchema,
  label: z.string(),
  source: z.enum(["ai-suggested", "confirmed"]),
});
export type BreakdownElement = z.infer<typeof breakdownElementSchema>;

// --- Script content ---

export const scriptElementSchema = z.object({
  type: z.enum(["slugline", "action", "character", "dialogue", "parenthetical", "transition"]),
  text: z.string(),
});
export type ScriptElement = z.infer<typeof scriptElementSchema>;

export const scriptPageSchema = z.object({ sceneId: z.string(), elements: z.array(scriptElementSchema) });
export type ScriptPage = z.infer<typeof scriptPageSchema>;

// --- Production status surfaces ---

export const issueSeveritySchema = z.enum(["high", "medium", "low"]);
export type IssueSeverity = z.infer<typeof issueSeveritySchema>;

export const issueSchema = z.object({
  id: z.string(),
  severity: issueSeveritySchema,
  title: z.string(),
  description: z.string(),
  affectedSceneIds: z.array(z.string()),
  affectedShootDayId: z.string().nullable(),
});
export type Issue = z.infer<typeof issueSchema>;

export const approvalSchema = z.object({
  id: z.string(),
  title: z.string(),
  requestedBy: z.string(),
  status: z.enum(["Pending", "Approved", "Rejected"]),
});
export type Approval = z.infer<typeof approvalSchema>;

export const documentRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Screenplay", "Call Sheet", "Contract", "Permit", "Budget", "Schedule"]),
  status: z.enum(["Draft", "Review", "Approved", "Published", "Locked", "Superseded"]),
  updatedAt: z.string(),
});
export type DocumentRecord = z.infer<typeof documentRecordSchema>;

export const expenseSchema = z.object({
  id: z.string(),
  vendor: z.string(),
  department: z.string(),
  amount: z.number(),
  status: z.enum(["Pending", "Approved", "Paid"]),
});
export type Expense = z.infer<typeof expenseSchema>;

export const budgetLineSchema = z.object({
  department: z.string(),
  budgeted: z.number(),
  actual: z.number(),
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

export const activitySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  description: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

// --- Call sheet ---

export const callSheetTimelineEventSchema = z.object({ time: z.string(), label: z.string() });
export type CallSheetTimelineEvent = z.infer<typeof callSheetTimelineEventSchema>;

export const callSheetSchema = z.object({
  shootDayId: z.string(),
  weather: z.string(),
  sunrise: z.string(),
  sunset: z.string(),
  hospital: z.string(),
  parking: z.string(),
  basecamp: z.string(),
  timeline: z.array(callSheetTimelineEventSchema),
  notes: z.string(),
});
export type CallSheet = z.infer<typeof callSheetSchema>;

// --- AI ---

export const aiRecommendationOptionSchema = z.object({
  label: z.string(),
  title: z.string(),
  impact: z.string(),
});
export type AIRecommendationOption = z.infer<typeof aiRecommendationOptionSchema>;

export const aiRecommendationSchema = z.object({
  id: z.string(),
  severity: issueSeveritySchema,
  title: z.string(),
  subject: z.string(),
  conflict: z.string(),
  /** Why the model proposed this — populated for recommendations generated through the Suggest→Explain pipeline. */
  explanation: z.string().optional(),
  affected: z.array(z.string()),
  options: z.array(aiRecommendationOptionSchema),
  status: z.enum(["pending", "resolved", "dismissed"]).optional(),
});
export type AIRecommendation = z.infer<typeof aiRecommendationSchema>;
