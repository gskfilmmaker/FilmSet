import type {
  AIRecommendation,
  Approval,
  BreakdownElement,
  BudgetLine,
  CallSheet,
  CastMember,
  Character,
  CrewMember,
  DocumentRecord,
  Expense,
  Issue,
  Location,
  Production,
  Prop,
  Scene,
  ScriptPage,
  ShootDay,
  Activity,
} from "@filmset/core";

/**
 * Structured fixture data — "THE BAND" — used to make the five canonical
 * FRAME screens feel real without any business logic behind them (build
 * brief §6). A Hindi crime drama: Abraham searches Delhi for Aisha after
 * she witnesses a smuggling shipment tied to businessman Rohan Kapoor;
 * Inspector Vaid investigates in parallel. Enough narrative consistency
 * that the same names/places recur meaningfully across screens.
 */

export const theBandProduction: Production = {
  id: "prod_the-band",
  name: "THE BAND",
  phase: "Production",
  scriptRevisionColor: "White",
};

// --- People ---

export const characters: Character[] = [
  { id: "char_abraham", name: "Abraham" },
  { id: "char_aisha", name: "Aisha" },
  { id: "char_rohan", name: "Rohan Kapoor" },
  { id: "char_meera", name: "Meera" },
  { id: "char_vaid", name: "Inspector Vaid" },
  { id: "char_farid", name: "Farid" },
  { id: "char_nasreen", name: "Nasreen" },
  { id: "char_deepak", name: "Deepak" },
  { id: "char_sunita", name: "Sunita" },
  { id: "char_karim", name: "Karim" },
];

/** No fixture cast/crew member has contact details filled in — the fields exist, the demo data just doesn't exercise them. */
const noContactInfo = {
  email: null,
  phone: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  agentName: null,
  agentPhone: null,
  agentEmail: null,
} as const;

/** No fixture cast member has sizing filled in — the fields exist, the demo data just doesn't exercise them. */
const noSizingInfo = {
  height: null,
  shirtSize: null,
  pantSize: null,
  shoeSize: null,
  sizingNotes: null,
} as const;

export const castMembers: CastMember[] = [
  { id: "cast_abraham", characterId: "char_abraham", actorName: "Rahul Verma", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_aisha", characterId: "char_aisha", actorName: "Priya Nair", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_rohan", characterId: "char_rohan", actorName: "Arjun Malhotra", status: "Confirmed", contract: "Pending", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_meera", characterId: "char_meera", actorName: "Kavita Rao", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_vaid", characterId: "char_vaid", actorName: "Sameer Khan", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_farid", characterId: "char_farid", actorName: "Vikram Singh", status: "Unavailable", contract: "Missing", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_nasreen", characterId: "char_nasreen", actorName: "Anjali Gupta", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_deepak", characterId: "char_deepak", actorName: "Tarun Shah", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_sunita", characterId: "char_sunita", actorName: "Divya Menon", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
  { id: "cast_karim", characterId: "char_karim", actorName: "Imran Qureshi", status: "Confirmed", contract: "Signed", ...noContactInfo, ...noSizingInfo, photoPath: null },
];

export const crewMembers: CrewMember[] = [
  { id: "crew_1ad", name: "Rakesh Mehta", department: "Production", role: "1st AD", isHod: false, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_2ad", name: "Ayesha Sheikh", department: "Production", role: "2nd AD", isHod: false, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_dp", name: "Vivek Chandran", department: "Camera", role: "Director of Photography", isHod: true, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_gaffer", name: "Suresh Iyer", department: "Electric", role: "Gaffer", isHod: true, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_sound", name: "Neha Kulkarni", department: "Sound", role: "Sound Mixer", isHod: true, contract: "Pending", walkieChannel: null, ...noContactInfo },
  { id: "crew_script", name: "Pooja Bhatia", department: "Production", role: "Script Supervisor", isHod: false, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_pd", name: "Aditya Rao", department: "Art", role: "Production Designer", isHod: true, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_costume", name: "Simran Kaur", department: "Wardrobe", role: "Costume Designer", isHod: true, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_makeup", name: "Farah Ali", department: "Hair & Makeup", role: "Makeup Head", isHod: true, contract: "Pending", walkieChannel: null, ...noContactInfo },
  { id: "crew_lp", name: "Manoj Tiwari", department: "Production", role: "Line Producer", isHod: true, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_locations", name: "Rajesh Pillai", department: "Locations", role: "Location Manager", isHod: true, contract: "Signed", walkieChannel: null, ...noContactInfo },
  { id: "crew_stunts", name: "Vikas Oberoi", department: "Stunts", role: "Stunt Coordinator", isHod: true, contract: "Missing", walkieChannel: null, ...noContactInfo },
];

// --- Places & things ---

export const locations: Location[] = [
  { id: "loc_paharganj-street", name: "Paharganj Street", address: "Paharganj, New Delhi", permitStatus: "Confirmed", permitExpiry: null, photoPath: null },
  { id: "loc_nasreens-shop", name: "Nasreen's Tea Shop", address: "Chandni Chowk, Old Delhi", permitStatus: "Missing", permitExpiry: null, photoPath: null },
  { id: "loc_police-station", name: "Connaught Place Precinct (set)", address: "Studio A, Film City, Noida", permitStatus: "Confirmed", permitExpiry: null, photoPath: null },
  { id: "loc_abraham-apartment", name: "Karol Bagh Residence", address: "Karol Bagh, New Delhi", permitStatus: "Confirmed", permitExpiry: null, photoPath: null },
  { id: "loc_chandni-chowk-market", name: "Chandni Chowk Market", address: "Old Delhi", permitStatus: "Pending", permitExpiry: null, photoPath: null },
  { id: "loc_highway-agra", name: "NH19 Highway to Agra", address: "NH19, near Agra", permitStatus: "Pending", permitExpiry: "Aug 29", photoPath: null },
  { id: "loc_studio-a", name: "Studio A", address: "Film City, Noida", permitStatus: "Confirmed", permitExpiry: null, photoPath: null },
];

export const props: Prop[] = [
  { id: "prop_ak47", name: "AK-47 (replica)", sceneIds: ["scene_49"] },
  { id: "prop_suitcase", name: "Smuggler's Suitcase", sceneIds: ["scene_47", "scene_48", "scene_49"] },
  { id: "prop_matchbook", name: "Nasreen's Tea Shop Matchbook", sceneIds: ["scene_44"] },
  { id: "prop_case-file", name: "Missing Persons Case File", sceneIds: ["scene_42"] },
  { id: "prop_truck", name: "Cargo Truck", sceneIds: ["scene_52"] },
];

// --- Scenes ---

export const theBandScenes: Scene[] = [
  { id: "scene_40", number: "40", intExt: "INT", setName: "Nasreen's Tea Shop", dayNight: "DAY", synopsis: "Nasreen warns Abraham to stop asking questions.", pageCount: "1 2/8", status: "Shot", shootDayId: "day_16", castIds: ["cast_abraham", "cast_nasreen"], locationId: "loc_nasreens-shop", revisionColor: "White", continuityNotes: "" },
  { id: "scene_41", number: "41", intExt: "INT", setName: "Nasreen's Tea Shop", dayNight: "DAY", synopsis: "Farid confronts Abraham outside the shop.", pageCount: "7/8", status: "Shot", shootDayId: "day_16", castIds: ["cast_abraham", "cast_farid"], locationId: "loc_nasreens-shop", revisionColor: "White", continuityNotes: "" },
  { id: "scene_42", number: "42", intExt: "INT", setName: "Connaught Place Precinct", dayNight: "DAY", synopsis: "Inspector Vaid reviews Aisha's missing person file.", pageCount: "1 1/8", status: "Draft", shootDayId: null, castIds: ["cast_vaid"], locationId: "loc_police-station", revisionColor: "White", continuityNotes: "" },
  { id: "scene_44", number: "44", intExt: "INT", setName: "Abraham's Apartment", dayNight: "NIGHT", synopsis: "Abraham finds a matchbook from Nasreen's shop in Aisha's things.", pageCount: "5/8", status: "Shot", shootDayId: "day_17", castIds: ["cast_abraham"], locationId: "loc_abraham-apartment", revisionColor: "White", continuityNotes: "" },
  { id: "scene_45", number: "45", intExt: "INT", setName: "Abraham's Apartment", dayNight: "NIGHT", synopsis: "Meera arrives with information about Rohan Kapoor's shipments.", pageCount: "2 1/8", status: "Shot", shootDayId: "day_17", castIds: ["cast_abraham", "cast_meera"], locationId: "loc_abraham-apartment", revisionColor: "White", continuityNotes: "" },
  { id: "scene_46", number: "46", intExt: "INT", setName: "Abraham's Apartment", dayNight: "NIGHT", synopsis: "Sunita calls, worried she hasn't heard from Aisha.", pageCount: "6/8", status: "Shot", shootDayId: "day_17", castIds: ["cast_abraham", "cast_sunita"], locationId: "loc_abraham-apartment", revisionColor: "White", continuityNotes: "" },
  { id: "scene_47", number: "47", intExt: "EXT", setName: "Paharganj Street", dayNight: "NIGHT", synopsis: "Abraham arrives looking for Aisha.", pageCount: "2 1/8", status: "Scheduled", shootDayId: "day_18", castIds: ["cast_abraham", "cast_aisha"], locationId: "loc_paharganj-street", revisionColor: "White", continuityNotes: "" },
  { id: "scene_48", number: "48", intExt: "EXT", setName: "Paharganj Street", dayNight: "NIGHT", synopsis: "Aisha explains what she saw the night of the shipment.", pageCount: "1 4/8", status: "Scheduled", shootDayId: "day_18", castIds: ["cast_abraham", "cast_aisha"], locationId: "loc_paharganj-street", revisionColor: "White", continuityNotes: "" },
  { id: "scene_49", number: "49", intExt: "EXT", setName: "Paharganj Street", dayNight: "NIGHT", synopsis: "Karim's men spot them from a passing car.", pageCount: "7/8", status: "Scheduled", shootDayId: "day_18", castIds: ["cast_abraham", "cast_aisha", "cast_karim"], locationId: "loc_paharganj-street", revisionColor: "White", continuityNotes: "" },
  { id: "scene_50", number: "50", intExt: "EXT", setName: "Chandni Chowk Market", dayNight: "DAY", synopsis: "Abraham and Aisha lose the tail in the market crowd.", pageCount: "1 6/8", status: "Scheduled", shootDayId: "day_19", castIds: ["cast_abraham", "cast_aisha"], locationId: "loc_chandni-chowk-market", revisionColor: "White", continuityNotes: "" },
  { id: "scene_51", number: "51", intExt: "EXT", setName: "Chandni Chowk Market", dayNight: "DAY", synopsis: "Inspector Vaid questions market vendors about the chase.", pageCount: "1 1/8", status: "Scheduled", shootDayId: "day_19", castIds: ["cast_vaid"], locationId: "loc_chandni-chowk-market", revisionColor: "White", continuityNotes: "" },
  { id: "scene_52", number: "52", intExt: "EXT", setName: "NH19 Highway to Agra", dayNight: "NIGHT", synopsis: "Deepak's truck convoy makes its run.", pageCount: "2 3/8", status: "Scheduled", shootDayId: "day_20", castIds: ["cast_deepak", "cast_farid"], locationId: "loc_highway-agra", revisionColor: "White", continuityNotes: "" },
  { id: "scene_53", number: "53", intExt: "EXT", setName: "NH19 Highway to Agra", dayNight: "NIGHT", synopsis: "Vaid's unit sets up a checkpoint.", pageCount: "1 3/8", status: "Scheduled", shootDayId: "day_20", castIds: ["cast_vaid"], locationId: "loc_highway-agra", revisionColor: "White", continuityNotes: "" },
  { id: "scene_12", number: "12", intExt: "INT", setName: "Rohan Kapoor's Office", dayNight: "DAY", synopsis: "Rohan pressures a city official over the shipment route.", pageCount: "1 5/8", status: "Draft", shootDayId: null, castIds: ["cast_rohan"], locationId: "loc_studio-a", revisionColor: "White", continuityNotes: "" },
  { id: "scene_13", number: "13", intExt: "INT", setName: "Rohan Kapoor's Office", dayNight: "DAY", synopsis: "Rohan learns Meera is investigating him.", pageCount: "1 2/8", status: "Draft", shootDayId: null, castIds: ["cast_rohan", "cast_meera"], locationId: "loc_studio-a", revisionColor: "White", continuityNotes: "" },
  { id: "scene_30", number: "30", intExt: "INT", setName: "Nasreen's Tea Shop", dayNight: "NIGHT", synopsis: "Cut from the schedule — covered by Scene 40.", pageCount: "4/8", status: "Omitted", shootDayId: null, castIds: ["cast_nasreen"], locationId: "loc_nasreens-shop", revisionColor: "White", continuityNotes: "" },
  { id: "scene_8", number: "8", intExt: "EXT", setName: "Abraham's Apartment Building", dayNight: "DAY", synopsis: "Establishing shot — needs a pickup.", pageCount: "1/8", status: "Pickup", shootDayId: null, castIds: [], locationId: "loc_abraham-apartment", revisionColor: "White", continuityNotes: "" },
];

// --- Schedule ---

export const shootDays: ShootDay[] = [
  { id: "day_16", dayNumber: 16, totalDays: 38, date: "Mon, Aug 24", locationId: "loc_nasreens-shop", status: "Wrapped", callTime: "06:30", wrapTime: "18:45", sceneIds: ["scene_40", "scene_41"], unit: "Main Unit" },
  { id: "day_17", dayNumber: 17, totalDays: 38, date: "Tue, Aug 25", locationId: "loc_abraham-apartment", status: "Wrapped", callTime: "12:00", wrapTime: "23:15", sceneIds: ["scene_44", "scene_45", "scene_46"], unit: "Main Unit" },
  { id: "day_18", dayNumber: 18, totalDays: 38, date: "Wed, Aug 26", locationId: "loc_paharganj-street", status: "In Progress", callTime: "18:00", wrapTime: null, sceneIds: ["scene_47", "scene_48", "scene_49"], unit: "Main Unit" },
  { id: "day_19", dayNumber: 19, totalDays: 38, date: "Thu, Aug 27", locationId: "loc_chandni-chowk-market", status: "Scheduled", callTime: "07:00", wrapTime: null, sceneIds: ["scene_50", "scene_51"], unit: "Main Unit" },
  { id: "day_20", dayNumber: 20, totalDays: 38, date: "Fri, Aug 28", locationId: "loc_highway-agra", status: "Unconfirmed", callTime: "TBD", wrapTime: null, sceneIds: ["scene_52", "scene_53"], unit: "Main Unit" },
];

// --- Breakdown (reproduces Constitution §29's own example for Scene 47) ---

export const breakdownElements: BreakdownElement[] = [
  { id: "bd_rain", sceneId: "scene_47", category: "Special Equipment", label: "Rain", source: "ai-suggested" },
  { id: "bd_taxi", sceneId: "scene_47", category: "Vehicles", label: "Taxi", source: "ai-suggested" },
  { id: "bd_bg75", sceneId: "scene_47", category: "Background", label: "75 Background", source: "ai-suggested" },
  { id: "bd_ak47", sceneId: "scene_47", category: "Props", label: "AK-47", source: "confirmed" },
  { id: "bd_suitcase", sceneId: "scene_47", category: "Props", label: "Suitcase", source: "confirmed" },
];

// --- Script content for Day 18's scenes ---

export const scriptPages: ScriptPage[] = [
  {
    sceneId: "scene_47",
    elements: [
      { type: "slugline", text: "47   EXT. PAHARGANJ STREET - NIGHT" },
      { type: "action", text: "Neon signs flicker over the narrow lane. ABRAHAM, 40s, weathered, moves against the crowd, scanning faces. He stops." },
      { type: "action", text: "Across the street: AISHA, 20s, hood up, alone in a doorway." },
      { type: "character", text: "ABRAHAM" },
      { type: "dialogue", text: "Aisha." },
      { type: "action", text: "She doesn't move. Then — she runs." },
      { type: "action", text: "Abraham chases after her, pushing through the crowd." },
    ],
  },
  {
    sceneId: "scene_48",
    elements: [
      { type: "slugline", text: "48   EXT. PAHARGANJ STREET - NIGHT" },
      { type: "action", text: "Abraham catches her arm in an alley. She spins, ready to fight — then recognizes him." },
      { type: "character", text: "AISHA" },
      { type: "dialogue", text: "You shouldn't have come." },
      { type: "character", text: "ABRAHAM" },
      { type: "dialogue", text: "Where have you been? Sunita hasn't heard from you in six days." },
      { type: "character", text: "AISHA" },
      { type: "dialogue", text: "I saw something I wasn't supposed to see." },
      { type: "action", text: "She glances over his shoulder — headlights turning onto the street." },
    ],
  },
  {
    sceneId: "scene_49",
    elements: [
      { type: "slugline", text: "49   EXT. PAHARGANJ STREET - NIGHT" },
      { type: "action", text: "A black SUV rolls to a stop at the end of the lane. KARIM, broad-shouldered, watches from the passenger window." },
      { type: "character", text: "KARIM" },
      { type: "parenthetical", text: "(into phone)" },
      { type: "dialogue", text: "Found her." },
      { type: "action", text: "The SUV's doors open." },
    ],
  },
];

// --- Production status surfaces ---

export const issues: Issue[] = [
  { id: "issue_1", severity: "high", title: "Actor unavailable — Farid (Vikram Singh)", description: "Marked unavailable for Day 20 (NH19 Highway to Agra). Scene 52 requires him.", affectedSceneIds: ["scene_52"], affectedShootDayId: "day_20" },
  { id: "issue_2", severity: "medium", title: "Location permit pending", description: "Chandni Chowk Market permit is still pending for Day 19 (tomorrow). Scenes 50-51 need confirmation before call time.", affectedSceneIds: ["scene_50", "scene_51"], affectedShootDayId: "day_19" },
  { id: "issue_3", severity: "medium", title: "Location permit expires before shoot", description: "NH19 Highway permit expires Aug 29 — before the Day 20 shoot. Scenes 52-53 are at risk.", affectedSceneIds: ["scene_52", "scene_53"], affectedShootDayId: "day_20" },
  { id: "issue_4", severity: "low", title: "Wardrobe continuity conflict", description: "Aisha's jacket in Scene 48 doesn't match the costume logged for Scene 47 — same night, continuous action.", affectedSceneIds: ["scene_47", "scene_48"], affectedShootDayId: "day_18" },
  { id: "issue_5", severity: "medium", title: "PO exceeds approved budget", description: "Camera package rental PO exceeds the approved Camera department budget by ₹1,80,000.", affectedSceneIds: [], affectedShootDayId: null },
];

export const approvals: Approval[] = [
  { id: "approval_1", title: "Call Sheet — Day 19", requestedBy: "Rakesh Mehta (1st AD)", status: "Pending" },
  { id: "approval_2", title: "Camera Package PO — ₹4,80,000", requestedBy: "Manoj Tiwari (Line Producer)", status: "Pending" },
  { id: "approval_3", title: "Schedule Revision — Day 20 swap", requestedBy: "Rakesh Mehta (1st AD)", status: "Approved" },
];

const noFileDoc = { filePath: null, expiryDate: null, linkedCastMemberId: null, linkedCrewMemberId: null, linkedLocationId: null } as const;

export const documents: DocumentRecord[] = [
  { id: "doc_1", name: "THE BAND — Screenplay", type: "Screenplay", status: "Locked", updatedAt: "2 days ago", ...noFileDoc },
  { id: "doc_2", name: "Call Sheet — Day 18", type: "Call Sheet", status: "Published", updatedAt: "Today, 05:30", ...noFileDoc },
  { id: "doc_3", name: "Call Sheet — Day 19", type: "Call Sheet", status: "Draft", updatedAt: "1 hour ago", ...noFileDoc },
  { id: "doc_4", name: "Highway Permit — NH19", type: "Permit", status: "Review", updatedAt: "3 days ago", ...noFileDoc },
  { id: "doc_5", name: "Camera Package Rental Agreement", type: "Contract", status: "Approved", updatedAt: "5 days ago", ...noFileDoc },
  { id: "doc_6", name: "Budget — Revision 3", type: "Budget", status: "Published", updatedAt: "1 week ago", ...noFileDoc },
];

const noFileExpense = { date: "", invoiceNumber: null, documentPath: null } as const;

export const expenses: Expense[] = [
  { id: "expense_1", vendor: "Delhi Camera Rentals", department: "Camera", amount: 480000, status: "Pending", ...noFileExpense },
  { id: "expense_2", vendor: "Chandni Chowk Catering Co.", department: "Locations/Catering", amount: 62000, status: "Approved", ...noFileExpense },
  { id: "expense_3", vendor: "Metro Transport Services", department: "Transport", amount: 145000, status: "Pending", ...noFileExpense },
  { id: "expense_4", vendor: "Highway Security Services", department: "Locations", amount: 38000, status: "Pending", ...noFileExpense },
  { id: "expense_5", vendor: "Studio A Rental — Film City", department: "Studio", amount: 220000, status: "Paid", ...noFileExpense },
];

export const budgetLines: BudgetLine[] = [
  { department: "Camera", budgeted: 4200000, actual: 4380000 },
  { department: "Locations", budgeted: 2100000, actual: 2050000 },
  { department: "Cast", budgeted: 8500000, actual: 8500000 },
  { department: "Crew", budgeted: 6200000, actual: 6340000 },
  { department: "Art/Wardrobe", budgeted: 1800000, actual: 1760000 },
  { department: "Post", budgeted: 3000000, actual: 0 },
];

export const activities: Activity[] = [
  { id: "activity_1", timestamp: "5 min ago", actor: "Rakesh Mehta (1st AD)", description: "Published Call Sheet — Day 18" },
  { id: "activity_2", timestamp: "42 min ago", actor: "Priya Nair (Aisha)", description: "Confirmed availability for Day 19" },
  { id: "activity_3", timestamp: "1 hour ago", actor: "Script Dept", description: "Locked screenplay — Blue Revision" },
  { id: "activity_4", timestamp: "2 hours ago", actor: "Manoj Tiwari (Line Producer)", description: "Submitted Camera Package PO for approval" },
  { id: "activity_5", timestamp: "Yesterday", actor: "Rajesh Pillai (Location Manager)", description: "Uploaded NH19 Highway permit application" },
];

// --- Call sheet (Day 18 — today) ---

export const callSheetDay18: CallSheet = {
  shootDayId: "day_18",
  weather: "Clear, 24°C, light haze",
  sunrise: "05:58",
  sunset: "18:52",
  hospital: "Lady Hardinge Medical College — 12 min from set",
  parking: "Multi-level lot, Paharganj Main Bazaar Rd",
  basecamp: "DDA Community Ground, 3 min walk from set",
  timeline: [
    { time: "18:00", label: "Crew call" },
    { time: "18:30", label: "Cast call — Rahul Verma, Priya Nair" },
    { time: "19:00", label: "Blocking & rehearsal — Scene 47" },
    { time: "19:45", label: "First shot — Scene 47" },
    { time: "21:15", label: "Scene 47 complete" },
    { time: "21:30", label: "Meal break" },
    { time: "22:15", label: "Scene 48" },
    { time: "23:45", label: "Company move — 50m up lane" },
    { time: "00:00", label: "Scene 49" },
    { time: "01:30", label: "Estimated wrap" },
  ],
  notes: "Street remains open to pedestrian traffic — PAs holding both ends during takes. Rain machine on standby, not confirmed for use.",
  castCallTimes: [],
  crewCallTimes: [],
};

// --- FilmSet AI recommendations (reproduces Constitution §50's structure) ---

export const aiRecommendations: AIRecommendation[] = [
  {
    id: "ai_rec_1",
    severity: "high",
    title: "Schedule Conflict",
    subject: "Farid (Vikram Singh)",
    conflict: "Unavailable Day 20 — NH19 Highway to Agra",
    affected: ["Scene 52", "Shoot Day 20"],
    options: [
      { label: "A", title: "Move Scene 52 to Day 21", impact: "+0.5 estimated location day" },
      { label: "B", title: "Reorder Scene 52 after Scene 53's setup", impact: "No cast conflict, same day" },
      { label: "C", title: "Exchange Day 20 / Day 22", impact: "Estimated budget impact +₹68,000" },
    ],
  },
  {
    id: "ai_rec_2",
    severity: "medium",
    title: "Budget Risk",
    subject: "Camera Department",
    conflict: "Projected ₹1,80,000 over approved budget",
    affected: ["Camera Package PO", "Days 18-24"],
    options: [
      { label: "A", title: "Approve PO as submitted", impact: "Camera department +4.3% over" },
      { label: "B", title: "Negotiate 2-day rental extension credit", impact: "Reduces overage to +1.1%" },
      { label: "C", title: "Swap secondary lens package to rental tier 2", impact: "Reduces overage to +0.2%, image quality tradeoff" },
    ],
  },
];
