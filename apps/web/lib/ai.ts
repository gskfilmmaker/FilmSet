import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ProductionSnapshot } from "./queries";

/**
 * The only place this app calls an LLM. Both functions are pure Suggest
 * (and, for recommendations, Explain) steps — neither writes to the
 * database. Callers in app/ai/actions.ts are responsible for the
 * Preview→Approve→Commit steps the governance model (FilmSet.pdf, AI
 * governance section) requires: nothing here is ever written to
 * production data without an explicit human approval in between.
 */

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — see docs/design-system/README.md#environment.");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function summarizeSnapshot(snapshot: ProductionSnapshot): string {
  const { production, scenes, shootDays, castMembers, characters, locations, issues, budgetLines, expenses } = snapshot;
  const castLines = castMembers.map((c) => {
    const name = characters.find((ch) => ch.id === c.characterId)?.name ?? c.characterId;
    return `- ${c.actorName} as ${name}: status=${c.status}, contract=${c.contract}`;
  });
  const dayLines = shootDays.map((d) => {
    const loc = locations.find((l) => l.id === d.locationId)?.name ?? d.locationId;
    return `- Day ${d.dayNumber} (${d.date}) at ${loc}: status=${d.status}, call=${d.callTime}, scenes=[${d.sceneIds.join(", ")}]`;
  });
  const sceneLines = scenes.map((s) => `- Scene ${s.number} (${s.id}): ${s.intExt}. ${s.setName} — ${s.dayNight}, status=${s.status}, cast=[${s.castIds.join(", ")}]`);
  const locationLines = locations.map((l) => `- ${l.name}: permit=${l.permitStatus}${l.permitExpiry ? `, expires ${l.permitExpiry}` : ""}`);
  const issueLines = issues.map((i) => `- [${i.severity}] ${i.title}: ${i.description}`);
  const budgetLines_ = budgetLines.map((b) => `- ${b.department}: budgeted ${b.budgeted}, actual ${b.actual}`);
  const expenseLines = expenses.map((e) => `- ${e.vendor} (${e.department}): ${e.amount}, status=${e.status}`);

  return [
    `Production: ${production.name} (phase: ${production.phase})`,
    "",
    "Cast:",
    ...castLines,
    "",
    "Shoot days:",
    ...dayLines,
    "",
    "Scenes:",
    ...sceneLines,
    "",
    "Locations:",
    ...locationLines,
    "",
    "Open issues:",
    ...(issueLines.length ? issueLines : ["(none)"]),
    "",
    "Budget lines:",
    ...budgetLines_,
    "",
    "Expenses:",
    ...expenseLines,
  ].join("\n");
}

export interface SuggestedRecommendation {
  severity: "high" | "medium" | "low";
  title: string;
  subject: string;
  conflict: string;
  affected: string[];
  explanation: string;
  options: { label: string; title: string; impact: string }[];
}

const recommendationTool: Anthropic.Tool = {
  name: "propose_recommendation",
  description: "Propose one prioritized production recommendation grounded strictly in the supplied data, with 2-3 concrete options.",
  input_schema: {
    type: "object",
    properties: {
      severity: { type: "string", enum: ["high", "medium", "low"] },
      title: { type: "string", description: "Short category label, e.g. 'Schedule Conflict' or 'Budget Risk'" },
      subject: { type: "string", description: "Who or what this recommendation is about" },
      conflict: { type: "string", description: "One sentence stating the conflict" },
      affected: { type: "array", items: { type: "string" }, description: "Short labels of affected scenes/days/people" },
      explanation: { type: "string", description: "2-4 sentences explaining the reasoning, citing specific data from the input" },
      options: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "A, B, or C" },
            title: { type: "string" },
            impact: { type: "string", description: "One short sentence on the tradeoff" },
          },
          required: ["label", "title", "impact"],
        },
      },
    },
    required: ["severity", "title", "subject", "conflict", "affected", "explanation", "options"],
  },
};

export async function suggestRecommendation(snapshot: ProductionSnapshot): Promise<SuggestedRecommendation> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You are FilmSet AI, a production-management assistant for film productions. You analyze the exact data you're given " +
      "and propose ONE prioritized, concrete recommendation. Never invent facts not present in the data. Ground every claim " +
      "in a specific scene, day, cast member, location, or budget line from the input.",
    messages: [
      {
        role: "user",
        content: `Here is the current state of the production:\n\n${summarizeSnapshot(snapshot)}\n\nPropose the single most pressing recommendation right now.`,
      },
    ],
    tools: [recommendationTool],
    tool_choice: { type: "tool", name: "propose_recommendation" },
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) throw new Error("FilmSet AI did not return a recommendation.");
  return toolUse.input as SuggestedRecommendation;
}

/**
 * Suggest step for the location-photo-match feature (apps/web/app/locations/actions.ts's
 * suggestLocationPhotoMatch): reads an uploaded photo plus the production's scenes and
 * named locations, and proposes which scene(s) the photographed place could serve as the
 * setting for. Returns the same SuggestedRecommendation shape as suggestRecommendation so
 * it flows through the identical Suggest→Explain→Preview→Approve→Commit pipeline — this is
 * still only a Suggest step, nothing is written to production data here.
 */
export async function suggestLocationMatch(
  snapshot: ProductionSnapshot,
  locationName: string,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
): Promise<SuggestedRecommendation> {
  const sceneLines = snapshot.scenes.map(
    (s) => `- Scene ${s.number} (id: ${s.id}): ${s.intExt}. ${s.setName} — ${s.dayNight}. ${s.synopsis || "(no synopsis)"}`,
  );
  const locationLines = snapshot.locations.map((l) => `- ${l.name}${l.name === locationName ? " ← this is the location being photographed" : ""}`);

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You are FilmSet AI, a production-management assistant for film productions. You are shown a photo of a real-world " +
      "location or set, plus the production's existing scene list and named locations. Suggest which scene(s) this photo's " +
      "location could plausibly serve as the setting for, based only on what's visibly in the photo (setting, era, indoor/" +
      "outdoor, day/night lighting, urban/rural) compared with each scene's slugline and synopsis. If nothing matches " +
      "well, say so plainly instead of forcing a match. Never invent details not visible in the photo or not present in " +
      "the scene data.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text:
              `This photo is being uploaded for the location "${locationName}".\n\n` +
              `Existing scenes:\n${sceneLines.join("\n")}\n\n` +
              `Existing named locations:\n${locationLines.join("\n")}\n\n` +
              "Suggest which scene(s) this photographed location best matches, or flag if it doesn't clearly match any current scene.",
          },
        ],
      },
    ],
    tools: [recommendationTool],
    tool_choice: { type: "tool", name: "propose_recommendation" },
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) throw new Error("FilmSet AI did not return a location match suggestion.");
  return toolUse.input as SuggestedRecommendation;
}

export interface ExtractedCastCandidate {
  characterName: string;
  actorName: string;
  notes: string;
}

const castExtractionTool: Anthropic.Tool = {
  name: "extract_cast_candidates",
  description: "Extract every character/cast record found in this document, one entry per role.",
  input_schema: {
    type: "object",
    properties: {
      records: {
        type: "array",
        items: {
          type: "object",
          properties: {
            characterName: { type: "string", description: "The character or role name" },
            actorName: {
              type: "string",
              description: "The cast actor's real name if the document names one, otherwise an empty string (e.g. for a role marked open/uncast/TBD)",
            },
            notes: { type: "string", description: "A short one-line summary of role size or function, if stated (empty string if none)" },
          },
          required: ["characterName", "actorName", "notes"],
        },
      },
    },
    required: ["records"],
  },
};

/**
 * Suggest step for document-based cast import (apps/web/lib/import): reads
 * raw text extracted from an uploaded casting bible / character breakdown
 * / cast list and proposes structured character+actor candidates. Purely
 * extractive — never invents a role or actor not present in the text.
 * Still only a Suggest step: nothing is written to production data here,
 * the caller logs it to ai_suggestion_log and a human reviews every row
 * before commitImport writes anything.
 */
export async function extractCastCandidates(rawText: string): Promise<ExtractedCastCandidate[]> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You extract structured character/cast data from film production documents (casting bibles, character breakdowns, cast lists). " +
      "Only extract what is actually stated in the text — never invent a character or actor name. A role explicitly marked as open, " +
      "uncast, or TBD should have an empty actorName. Skip generic ensemble/background entries that don't name a specific character.",
    messages: [{ role: "user", content: `Extract every character/cast record from this document:\n\n${rawText}` }],
    tools: [castExtractionTool],
    tool_choice: { type: "tool", name: "extract_cast_candidates" },
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) throw new Error("FilmSet AI did not return any cast candidates.");
  return (toolUse.input as { records: ExtractedCastCandidate[] }).records;
}

export interface ExtractedLocationCandidate {
  name: string;
  address: string;
  notes: string;
}

const locationExtractionTool: Anthropic.Tool = {
  name: "extract_location_candidates",
  description: "Extract every named filming location found in this document.",
  input_schema: {
    type: "object",
    properties: {
      records: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The location's name" },
            address: { type: "string", description: "A street address or descriptive location if stated, otherwise an empty string" },
            notes: { type: "string", description: "A short one-line summary of what happens there or its category, if stated (empty string if none)" },
          },
          required: ["name", "address", "notes"],
        },
      },
    },
    required: ["records"],
  },
};

/** Same Suggest-step pattern as extractCastCandidates, for a location list / scouting document / location map page. */
export async function extractLocationCandidates(rawText: string): Promise<ExtractedLocationCandidate[]> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You extract structured filming-location data from film production documents (location lists, scouting reports, location maps). " +
      "Only extract locations actually named in the text — never invent one.",
    messages: [{ role: "user", content: `Extract every named filming location from this document:\n\n${rawText}` }],
    tools: [locationExtractionTool],
    tool_choice: { type: "tool", name: "extract_location_candidates" },
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) throw new Error("FilmSet AI did not return any location candidates.");
  return (toolUse.input as { records: ExtractedLocationCandidate[] }).records;
}

export async function answerQuestion(snapshot: ProductionSnapshot, question: string): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      "You are FilmSet AI, a production-management assistant. Answer the user's question using ONLY the production data " +
      "provided below. If the data doesn't contain what's needed to answer confidently, say exactly what's missing instead " +
      "of guessing. Keep answers to 2-4 sentences.",
    messages: [
      {
        role: "user",
        content: `Production data:\n\n${summarizeSnapshot(snapshot)}\n\nQuestion: ${question}`,
      },
    ],
  });

  const text = message.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  return text?.text ?? "FilmSet AI couldn't produce an answer.";
}
