import "server-only";
import mammoth from "mammoth";

const MAX_DOCX_TEXT_CHARS = 60_000;

/** Extracts plain text from an uploaded .docx file — same role as parsePdfText, for a Word-exported document instead of a PDF. */
export async function parseDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value.slice(0, MAX_DOCX_TEXT_CHARS);
}
