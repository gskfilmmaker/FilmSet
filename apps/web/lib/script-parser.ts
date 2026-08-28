/**
 * Heuristic screenplay-text parser — no external deps, works on plain
 * pasted text (Fountain-ish formatting tolerated, not required). Pure
 * function, no DB/Next.js imports, so it's testable and reusable from a
 * Server Action without pulling either along.
 *
 * Known limitation: character-cue detection (an all-caps line under 40
 * chars) also matches all-caps action-line emphasis some writers use
 * ("THE DOOR SLAMS SHUT."), which then gets misread as a cue. Acceptable
 * for a first pass — standard screenplay formatting parses cleanly.
 */

export type ScriptElementType = "slugline" | "action" | "character" | "parenthetical" | "dialogue";

export interface ParsedElement {
  type: ScriptElementType;
  text: string;
}

export interface ParsedScene {
  intExt: "INT" | "EXT";
  setName: string;
  dayNight: "DAY" | "NIGHT";
  elements: ParsedElement[];
}

const HEADING_RE = /^(INT|EXT|INT\.?\s*\/\s*EXT\.?|I\/E)[.\s]+(.+)$/i;
const DAY_NIGHT_SPLIT_RE = /^(.*?)\s*[-–—]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MOMENTS LATER)\b.*$/i;

function isParenthetical(line: string): boolean {
  return line.startsWith("(") && line.endsWith(")");
}

function isCharacterCue(line: string): boolean {
  if (!line || line.length > 40) return false;
  if (HEADING_RE.test(line)) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

export function parseScreenplay(raw: string): ParsedScene[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  let inDialogue = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = HEADING_RE.exec(line);

    if (heading) {
      const intExt: ParsedScene["intExt"] = /^EXT/i.test(heading[1] ?? "") ? "EXT" : "INT";
      const rest = (heading[2] ?? "").trim();
      const split = DAY_NIGHT_SPLIT_RE.exec(rest);
      const setName = (split ? (split[1] ?? "") : rest).trim().replace(/[.\s]+$/, "") || "Unknown";
      const dayNight: ParsedScene["dayNight"] = split && (split[2] ?? "").toUpperCase() === "NIGHT" ? "NIGHT" : "DAY";

      current = { intExt, setName, dayNight, elements: [{ type: "slugline", text: line.toUpperCase() }] };
      scenes.push(current);
      inDialogue = false;
      continue;
    }

    if (!current) continue; // ignore anything before the first heading (title page, etc.)

    if (!line) {
      inDialogue = false;
      continue;
    }

    if (isParenthetical(line)) {
      current.elements.push({ type: "parenthetical", text: line });
      continue;
    }

    if (!inDialogue && isCharacterCue(line)) {
      current.elements.push({ type: "character", text: line.toUpperCase() });
      inDialogue = true;
      continue;
    }

    if (inDialogue) {
      current.elements.push({ type: "dialogue", text: line });
      continue;
    }

    current.elements.push({ type: "action", text: line });
  }

  return scenes;
}
