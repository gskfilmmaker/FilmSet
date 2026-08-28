/**
 * Heuristic screenplay-text parser — no external deps, works on plain
 * pasted text (Fountain-ish formatting tolerated, not required). Pure
 * function, no DB/Next.js imports, so it's testable and reusable from a
 * Server Action without pulling either along.
 *
 * Known limitations and design notes, all found by testing against a real
 * 6900-line Hindi shooting script that mixes THREE different conventions
 * for the same thing:
 * - A caseless script (Devanagari, Arabic, ...) has no upper/lowercase
 *   signal to key off, so guessing a cue from shape alone (short line, few
 *   words, no trailing punctuation) flagged 391 false "characters" from
 *   ordinary short lines — worse than useless. Fountain's own "@"
 *   force-character syntax (e.g. "@पिता") is trusted unconditionally — the
 *   real script used it correctly for its core named characters.
 * - Once a script uses "@" ANYWHERE, the plain ALL-CAPS branch (for a cased
 *   alphabet) is disabled for the rest of that script, not patched with
 *   more exclusion rules — that real script's own ALL-CAPS English shot
 *   notes ("CAMERA", "MONTAGE", "SCENE 12 END", ~190 of them) very nearly
 *   outnumbered its real cues 20 to 1, and no denylist of screenplay jargon
 *   is going to be complete. A script that never uses "@" still gets the
 *   plain ALL-CAPS heuristic, unchanged.
 * - That same real script also used a THIRD convention for its secondary
 *   and crowd speakers (संत, सेवक, श्रद्धालु, आदमी, दंपत्ति, बच्चे, and
 *   "बाबा (V.O.)" for voiceover) — none of them "@"-forced, just the bare
 *   name alone on its own line. Once a script is already using "@" (so the
 *   writer isn't relying on shape guessing across the whole document),
 *   that bare-name form is trusted for exactly one extra, much stronger
 *   reason a pure shape guess doesn't have: the very next line is the
 *   dialogue itself, opening with a quotation mark. Real production/shot
 *   labels in this script were never followed by quoted text — only actual
 *   dialogue was — so this catches the bare-name convention without
 *   reopening the false-positive flood a shape-only guess caused.
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

const TERMINAL_PUNCT_RE = /[.!?,;:।…\-–—]$/;

function isCharacterCue(line: string, nextNonBlank: string, usesExplicitCues: boolean): boolean {
  if (!line || line.length > 40) return false;
  if (HEADING_RE.test(line)) return false;

  // Fountain's own "force character" syntax — the writer explicitly marking this line as a
  // cue. Trust it unconditionally; it's the only reliable signal for a caseless script.
  if (line.startsWith("@") && line.length > 1) return true;

  // A trailing cue extension like "(V.O.)"/"(CONT'D)" is ASCII shorthand tacked onto an
  // otherwise-Devanagari name — strip it before judging script composition below, so it
  // doesn't get misread as a mixed-script line.
  const withoutExtension = line.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!withoutExtension) return false;

  // "CAMERA:", "SUPER:", "> CUT TO:", or a mood fragment trailing into the next line
  // ("उत्साह से—") — directives and connective prose, never a name, in either branch below.
  if (TERMINAL_PUNCT_RE.test(line)) return false;

  if (usesExplicitCues) {
    // This script forces its core cast with "@", but also writes some secondary/crowd
    // speakers as a bare name with no "@" and no case to key off — the one reliable signal
    // for that: the next line is the dialogue itself, opening with a quote mark (see the
    // module doc comment). Still capped to a name's actual shape (short, 1–3 words) — the
    // quote-lookahead alone wasn't enough; a mood-setting phrase can precede a quote too.
    if (/[-–—]/.test(withoutExtension)) return false; // "बाबा – भजन" — a topic/context label, not a name
    const letters = withoutExtension.replace(/[^\p{L}]/gu, "");
    if (!letters || /[A-Za-z]/.test(letters)) return false;
    const words = withoutExtension.split(/\s+/).filter(Boolean);
    if (withoutExtension.length > 20 || words.length > 3) return false;
    return nextNonBlank.startsWith('"') || nextNonBlank.startsWith('>"');
  }

  const letters = withoutExtension.replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  const hasAscii = /[A-Za-z]/.test(letters);
  const hasNonAscii = /[^\x00-\x7F]/.test(letters);
  // A line mixing an ASCII word with a non-Latin script is almost always action text with an
  // English emphasis word ("CAMERA धीरे-धीरे आगे बढ़ता है."), not a character name — never a cue.
  if (hasAscii && hasNonAscii) return false;
  if (hasAscii) {
    return letters === letters.toUpperCase();
  }
  // Caseless script, no "@" forcing anywhere in the document — no reliable signal to guess a
  // name from. Better to miss a cue than misread ordinary prose as a character.
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

function nextNonBlankLine(lines: string[], fromIndex: number): string {
  for (let j = fromIndex + 1; j < lines.length; j++) {
    const t = lines[j]!.trim();
    if (t) return t;
  }
  return "";
}

export function parseScreenplay(raw: string): ParsedScene[] {
  const normalized = raw.replace(/\r\n/g, "\n");
  const usesExplicitCues = EXPLICIT_CUE_RE.test(normalized);
  const lines = normalized.split("\n");
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  let inDialogue = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!.trim();
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

    if (!inDialogue && isCharacterCue(line, nextNonBlankLine(lines, idx), usesExplicitCues)) {
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
