/**
 * Heuristic screenplay-text parser — no external deps, works on plain
 * pasted text (Fountain-ish formatting tolerated, not required). Pure
 * function, no DB/Next.js imports, so it's testable and reusable from a
 * Server Action without pulling either along.
 *
 * Known limitations, both found by testing against a real 6900-line Hindi
 * shooting script (heavy with English ALL-CAPS shot/production notes —
 * "CAMERA – WIDE SHOT", "SCENE 10 END", "MUSIC CUE" — alongside Devanagari
 * dialogue):
 * - A caseless script (Devanagari, Arabic, ...) has no upper/lowercase
 *   signal to key off, so guessing a cue from shape (short line, few words)
 *   flagged 391 false "characters" from ordinary short lines — worse than
 *   useless. A caseless-script cue is now only recognized via Fountain's
 *   own "@" force-character syntax (e.g. "@पिता"), which that real script
 *   already used correctly for every one of its actual characters.
 * - Once a script uses "@" ANYWHERE, the plain ALL-CAPS branch (for a cased
 *   alphabet) is disabled for the rest of that script, not just fixed up
 *   with more exclusion rules — that real script's own ALL-CAPS English
 *   shot notes ("CAMERA", "MONTAGE", "SCENE 12 END", ~190 of them) very
 *   nearly outnumbered its real cues 20 to 1, and no denylist of
 *   screenplay jargon is going to be complete. A writer who has shown they
 *   know how to force a cue is trusted to do it consistently; a script
 *   that never uses "@" still gets the plain ALL-CAPS heuristic as before.
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

function isCharacterCue(line: string, usesExplicitCues: boolean): boolean {
  if (!line || line.length > 40) return false;
  if (HEADING_RE.test(line)) return false;

  // Fountain's own "force character" syntax — the writer explicitly marking this line as a
  // cue. Trust it unconditionally; it's the only reliable signal for a caseless script.
  if (line.startsWith("@") && line.length > 1) return true;

  // This script uses "@" elsewhere, so that's the only cue signal it gets — see the module
  // doc comment for why guessing from shape/case alongside it does more harm than good.
  if (usesExplicitCues) return false;

  if (TERMINAL_PUNCT_RE.test(line)) return false; // "CAMERA:", "SUPER:", "> CUT TO:" — directives, not names

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
  // Caseless script, no "@" forcing — no reliable signal to guess a name from. Better to miss a
  // cue than misread ordinary prose as a character.
  return false;
}

function cleanCharacterName(cue: string): string {
  const base = cue.replace(/^@/, "").replace(/\(.*?\)/g, "").trim();
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

const EXPLICIT_CUE_RE = /^@\S/m;

export function parseScreenplay(raw: string): ParsedScene[] {
  const normalized = raw.replace(/\r\n/g, "\n");
  const usesExplicitCues = EXPLICIT_CUE_RE.test(normalized);
  const lines = normalized.split("\n");
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

    if (!inDialogue && isCharacterCue(line, usesExplicitCues)) {
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
