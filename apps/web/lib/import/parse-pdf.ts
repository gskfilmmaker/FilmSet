import "server-only";
import { PDFParse } from "pdf-parse";

const MAX_PDF_TEXT_CHARS = 60_000;

/**
 * Extracts plain text from an uploaded PDF for AI extraction. Works for
 * any text-bearing PDF (a real screenplay/casting-bible/location-list
 * export) — a scanned, image-only PDF returns near-empty text, which the
 * caller should treat as "not supported yet" rather than silently sending
 * blank content to the model.
 */
export async function parsePdfText(buffer: ArrayBuffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text.slice(0, MAX_PDF_TEXT_CHARS);
  } finally {
    await parser.destroy();
  }
}
