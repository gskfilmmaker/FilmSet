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
  /** Which script revision (White/Blue/Pink/...) last changed this scene's content — see packages/core's revision-colors module. */
  revisionColor: z.string(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const productionSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: productionPhaseSchema,
  /** The script's current revision color — advances only when a re-imported script actually changes/adds a scene. */
  scriptRevisionColor: z.string(),
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

// --- Script revisions ---

/**
 * Industry-standard revision-page color cycle (WGA convention): the
 * original draft is White; each round of changes to the script is
 * reprinted on the next color in this order. Only pages that actually
 * changed move to the new color — the rest of the script stays on
 * whatever color it last changed on. Swatches approximate the real
 * colored paper each name refers to.
 */
export const REVISION_COLORS = ["White", "Blue", "Pink", "Yellow", "Green", "Goldenrod", "Buff", "Salmon", "Cherry"] as const;

export const REVISION_COLOR_SWATCHES: Record<(typeof REVISION_COLORS)[number], string> = {
  White: "#FFFFFF",
  Blue: "#AFD9F5",
  Pink: "#F5B8D0",
  Yellow: "#F7EC9E",
  Green: "#A9DDB0",
  Goldenrod: "#E8C15A",
  Buff: "#E8D3A8",
  Salmon: "#F2A896",
  Cherry: "#D9707A",
};

function parseRevisionColor(color: string): { cycle: number; name: string } {
  const match = /^(\d+)(?:st|nd|rd|th)\s+(.+)$/.exec(color);
  if (!match) return { cycle: 1, name: color };
  return { cycle: Number(match[1]), name: match[2]! };
}

function ordinal(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * The next color after `current` in the revision cycle. Wraps back to
 * Blue (never White — White means "never revised") with an incremented
 * cycle prefix once every color has been used, matching how long-running
 * productions actually label a second pass through the colors ("2nd Blue").
 */
export function nextRevisionColor(current: string): string {
  const { cycle, name } = parseRevisionColor(current);
  const index = REVISION_COLORS.indexOf(name as (typeof REVISION_COLORS)[number]);
  const safeIndex = index === -1 ? 0 : index;
  if (safeIndex + 1 < REVISION_COLORS.length) {
    const next: string = REVISION_COLORS[safeIndex + 1] ?? REVISION_COLORS[1];
    return cycle > 1 ? `${ordinal(cycle)} ${next}` : next;
  }
  return `${ordinal(cycle + 1)} Blue`;
}

/** Swatch hex for a revision color name, tolerant of a "2nd Blue"-style cycle prefix. */
export function revisionColorSwatch(color: string): string {
  const { name } = parseRevisionColor(color);
  return REVISION_COLOR_SWATCHES[name as (typeof REVISION_COLORS)[number]] ?? "#CCCCCC";
}
