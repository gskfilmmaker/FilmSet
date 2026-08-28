/**
 * Heuristic screenplay-text parser — no external deps, works on plain
 * pasted text (Fountain-ish formatting tolerated, not required). Pure
 * function, no DB/Next.js imports, so it's testable and reusable from a
 * Server Action without pulling either along.
 *
 * Known limitations:
 * - Character-cue detection for scripts written in a cased alphabet (an
 *   all-caps line under 40 chars) also matches all-caps action-line
 *   emphasis some writers use ("THE DOOR SLAMS SHUT."), which then gets
 *   misread as a cue.
 * - For a script in a caseless script (Devanagari, Arabic, ...) there's no
 *   upper/lowercase signal to key off at all, so cue detection falls back
 *   to shape instead: short, standalone, few words, no sentence-ending
 *   punctuation. That can still misfire on a short action beat that
 *   happens to fit the same shape (e.g. "फिर वो रुक गया").
 * Acceptable for a first pass — standard screenplay formatting parses cleanly either way.
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

const TERMINAL_PUNCT_RE = /[.!?,;:।…]$/;

function isCharacterCue(line: string): boolean {
  if (!line || line.length > 40) return false;
  if (HEADING_RE.test(line)) return false;
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  const hasAscii = /[A-Za-z]/.test(letters);
  const hasNonAscii = /[^\x00-\x7F]/.test(letters);
  // A line mixing an ASCII word with a non-Latin script is almost always action text with an
  // English emphasis word ("CAMERA धीरे-धीरे आगे बढ़ता है."), not a character name — never a cue.
  if (hasAscii && hasNonAscii) return false;
  if (hasAscii) {
    return letters === letters.toUpperCase();
  }
  // Caseless script (Devanagari, Arabic, ...) — no upper/lowercase distinction to key off, so fall
  // back to the shape of a name cue instead: short, standalone, few words, no sentence-ending punctuation.
  const words = line.split(/\s+/).filter(Boolean);
  return line.length <= 20 && words.length <= 3 && !TERMINAL_PUNCT_RE.test(line);
}

function cleanCharacterName(cue: string): string {
  const base = cue.replace(/\(.*?\)/g, "").trim();
  // Title-case ASCII letter runs only — non-Latin scripts (e.g. Devanagari) have no case and pass through untouched.
  return base.replace(/[A-Za-z]+/g, (word) => (word[0] ?? "").toUpperCase() + word.slice(1).toLowerCase());
}

/** Unique character names cued in this scene, in order of first appearance — stripped of (V.O.)/(CONT'D)-style annotations. */
export function charactersInScene(scene: ParsedScene): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const el of scene.elements) {
    if (el.type !== "character") continue;
    const name = cleanCharacterName(el.text);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
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
