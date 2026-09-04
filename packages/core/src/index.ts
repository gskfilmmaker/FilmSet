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
  /** Wardrobe/hair/makeup continuity notes for this scene — what's different here from the rest of the shoot (torn sleeve, bruise, wet hair, ...). */
  continuityNotes: z.string(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const productionSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: productionPhaseSchema,
  /** The script's current revision color — advances only when a re-imported script actually changes/adds a scene. */
  scriptRevisionColor: z.string(),
  /** Storage object path (production-photos bucket) — resolved to a signed URL server-side. Used on the Security & Access credential badge. */
  logoPath: z.string().nullable(),
  /** Hex color (e.g. "#1A2B3C") — the credential badge's header band. Null falls back to a default in the badge component. */
  brandColor: z.string().nullable(),
  /** The ID-numbering prefix (e.g. "VMPA"). Null falls back to a derived default (production name initials) — see apps/web/lib/id-registry.ts. */
  shortCode: z.string().nullable(),
});
export type Production = z.infer<typeof productionSchema>;

// --- People ---

export const characterSchema = z.object({ id: z.string(), name: z.string() });
export type Character = z.infer<typeof characterSchema>;

/**
 * Contact & representation fields shared by Cast and Crew — the "who do I
 * call" data a production office actually needs: a direct line, an
 * emergency contact, and (for an actor's agent/manager or a HOD's rep) who
 * to go through to reach them. All optional/nullable — most crew rows will
 * never fill in the agent fields, and that's fine.
 */
export const contactInfoSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
  agentName: z.string().nullable(),
  agentPhone: z.string().nullable(),
  agentEmail: z.string().nullable(),
});
export type ContactInfo = z.infer<typeof contactInfoSchema>;

/** Wardrobe sizing for one cast member — free-text sizingNotes covers anything a fixed field wouldn't (wigs, prosthetics, allergies, continuity quirks). */
export const sizingInfoSchema = z.object({
  height: z.string().nullable(),
  shirtSize: z.string().nullable(),
  pantSize: z.string().nullable(),
  shoeSize: z.string().nullable(),
  sizingNotes: z.string().nullable(),
});
export type SizingInfo = z.infer<typeof sizingInfoSchema>;

export const castMemberSchema = z
  .object({
    id: z.string(),
    characterId: z.string(),
    actorName: z.string(),
    status: z.enum(["Confirmed", "Offer Out", "Unavailable"]),
    contract: z.enum(["Signed", "Pending", "Missing"]),
    /** Storage object path (production-photos bucket) — resolved to a signed URL server-side, never a public URL. */
    photoPath: z.string().nullable(),
  })
  .extend(contactInfoSchema.shape)
  .extend(sizingInfoSchema.shape);
export type CastMember = z.infer<typeof castMemberSchema>;

export const crewMemberSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    department: z.string(),
    role: z.string(),
    /** Head of department — sorts first within their department and is called out on the Contact Sheet. */
    isHod: z.boolean(),
    /** Deal memo / contract status — same tracking Cast already has, extended to Crew. */
    contract: z.enum(["Signed", "Pending", "Missing"]),
    /** Radio/walkie channel assignment — printed on the call sheet's Radio Plan so departments know which channel to monitor. */
    walkieChannel: z.string().nullable(),
    /** Storage object path (production-photos bucket) — resolved to a signed URL server-side, never a public URL. Same convention as CastMember.photoPath. */
    photoPath: z.string().nullable(),
  })
  .extend(contactInfoSchema.shape);
export type CrewMember = z.infer<typeof crewMemberSchema>;

/**
 * Standard film-production department names, offered as a picklist on the
 * Crew form so "Camera" and "camera" don't silently become two different
 * departments. Not enforced at the schema/DB level — crew_members.department
 * stays free text so a production can still name something unusual — this
 * is a UI convenience plus the reference list the "needs a department head"
 * gap-check (apps/web/app/crew/crew-section.tsx) is written against.
 */
export const STANDARD_DEPARTMENTS = [
  "Production",
  "Camera",
  "Grip & Electric",
  "Sound",
  "Art",
  "Props",
  "Wardrobe",
  "Hair & Makeup",
  "Locations",
  "Stunts",
  "Transportation",
  "Logistics",
  "Catering",
  "Post-Production",
  "Visual Effects",
  "Special Effects",
  "Set Decorating",
  "Casting",
  "Construction",
  "Medic",
  "Accounting",
  "Video/Playback",
  "Animals",
  "Publicity",
  "Additional Labor",
] as const;

// --- Places & things ---

export const locationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  permitStatus: z.enum(["Confirmed", "Pending", "Missing"]),
  permitExpiry: z.string().nullable(),
  /** Storage object path (production-photos bucket) — resolved to a signed URL server-side, never a public URL. */
  photoPath: z.string().nullable(),
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

export const documentTypeSchema = z.enum([
  "Screenplay",
  "Call Sheet",
  "Contract",
  "Permit",
  "Budget",
  "Schedule",
  "Deal Memo",
  "Insurance",
  "Release Form",
  "Location Agreement",
  "Other",
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const documentRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: documentTypeSchema,
  status: z.enum(["Draft", "Review", "Approved", "Published", "Locked", "Superseded"]),
  updatedAt: z.string(),
  /** Storage object path (production-files bucket) — resolved to a signed URL server-side, never a public URL. */
  filePath: z.string().nullable(),
  /** Optional expiry — permits/insurance/deal memos that lapse; surfaced as "expiring soon" on /documents. */
  expiryDate: z.string().nullable(),
  /** At most one of these three is set — which person/place this document belongs to, if any. */
  linkedCastMemberId: z.string().nullable(),
  linkedCrewMemberId: z.string().nullable(),
  linkedLocationId: z.string().nullable(),
});
export type DocumentRecord = z.infer<typeof documentRecordSchema>;

export const expenseSchema = z.object({
  id: z.string(),
  vendor: z.string(),
  department: z.string(),
  amount: z.number(),
  status: z.enum(["Pending", "Approved", "Paid"]),
  date: z.string(),
  invoiceNumber: z.string().nullable(),
  /** Storage object path (production-files bucket) for the attached invoice/receipt — resolved to a signed URL server-side. */
  documentPath: z.string().nullable(),
});
export type Expense = z.infer<typeof expenseSchema>;

/**
 * `actual` is not hand-entered — it's the sum of every Approved/Paid
 * expense in this department, recomputed server-side whenever an expense
 * is created, edited, or deleted (see apps/web/app/money/actions.ts). This
 * keeps "budget vs actual" always true to what's actually been invoiced,
 * rather than a number someone forgot to update.
 */
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

/** A per-person call time override for one shoot day — absence means "use the day's general crew call" (ShootDay.callTime). */
export const personCallTimeSchema = z.object({ personId: z.string(), callTime: z.string() });
export type PersonCallTime = z.infer<typeof personCallTimeSchema>;

/** Standard AD status codes for a cast member on a given shoot day. */
export const castCallStatusSchema = z.enum(["Work", "Hold", "Travel", "Start", "Work/Finish", "Finish"]);
export type CastCallStatus = z.infer<typeof castCallStatusSchema>;

/**
 * A per-cast-member call entry for one shoot day — richer than the plain
 * crew PersonCallTime override, matching what real call sheets show per
 * actor: a status code, department sub-calls (an actor's Makeup call is
 * earlier than their On-Set call), and "On Call" in place of a fixed time.
 * A cast member with no entry here uses the day's general crew call.
 */
export const castCallEntrySchema = z.object({
  personId: z.string(),
  /** On-set call time. Ignored for display when onCall is true. */
  callTime: z.string(),
  status: castCallStatusSchema.nullable(),
  /** "On Call" (O/C) — the actor is on standby with no fixed time, rather than a literal clock time. */
  onCall: z.boolean(),
  pickupTime: z.string().nullable(),
  makeupCallTime: z.string().nullable(),
  hairCallTime: z.string().nullable(),
  wardrobeCallTime: z.string().nullable(),
  rehearsalCallTime: z.string().nullable(),
});
export type CastCallEntry = z.infer<typeof castCallEntrySchema>;

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
  /** Keyed by CastMember.id — a cast member with no entry here uses the day's general crew call. */
  castCallTimes: z.array(castCallEntrySchema),
  /** Keyed by CrewMember.id — a crew member with no entry here uses the day's general crew call. */
  crewCallTimes: z.array(personCallTimeSchema),
});
export type CallSheet = z.infer<typeof callSheetSchema>;

/** Background/extras call for one shoot day — a headcount, not individually tracked cast members. */
export const backgroundExtraSchema = z.object({
  id: z.string(),
  shootDayId: z.string(),
  description: z.string(),
  headcount: z.number(),
  callTime: z.string().nullable(),
  instructions: z.string().nullable(),
});
export type BackgroundExtra = z.infer<typeof backgroundExtraSchema>;

/** A stand-in for one shoot day — a named person, distinct from both cast and crew. */
export const standInSchema = z.object({
  id: z.string(),
  shootDayId: z.string(),
  name: z.string(),
  standsInForCastMemberId: z.string().nullable(),
  phone: z.string().nullable(),
  callTime: z.string().nullable(),
});
export type StandIn = z.infer<typeof standInSchema>;

export const vehicleTypeSchema = z.enum(["Truck", "Trailer", "Picture Car", "Action Vehicle", "Camera Vehicle", "Other"]);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

/** A vehicle needed on one shoot day — production trucks/trailers as well as picture/action cars. */
export const productionVehicleSchema = z.object({
  id: z.string(),
  shootDayId: z.string(),
  type: vehicleTypeSchema,
  description: z.string(),
  driverName: z.string().nullable(),
  driverPhone: z.string().nullable(),
  notes: z.string().nullable(),
});
export type ProductionVehicle = z.infer<typeof productionVehicleSchema>;

/** A shuttle/van run for one shoot day — driver, pickup, and where it's headed. */
export const transportRunSchema = z.object({
  id: z.string(),
  shootDayId: z.string(),
  driverName: z.string().nullable(),
  pickupTime: z.string().nullable(),
  pickupLocation: z.string().nullable(),
  dropoffLocation: z.string().nullable(),
  passengers: z.string().nullable(),
  notes: z.string().nullable(),
});
export type TransportRun = z.infer<typeof transportRunSchema>;

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
