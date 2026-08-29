import "server-only";

const MAX_PDF_TEXT_CHARS = 60_000;

/**
 * pdf-parse's pdfjs-dist dependency needs a DOMMatrix constructor for text
 * position math even during plain text extraction — normally supplied by
 * its optional @napi-rs/canvas dependency. That's a native binary Vercel's
 * build tracer doesn't reliably bundle into the serverless function
 * ("Cannot find module '@napi-rs/canvas'" at runtime), which otherwise
 * crashes every request with "ReferenceError: DOMMatrix is not defined".
 * Polyfilling it ourselves with a pure-JS implementation sidesteps the
 * native dependency entirely. Reproduced and verified against this exact
 * failure mode (native module hidden) before relying on it.
 */
async function ensureDomMatrixPolyfill(): Promise<void> {
  if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix !== "undefined") return;
  const { default: DOMMatrixPolyfill } = await import("dommatrix");
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
}

/**
 * Extracts plain text from an uploaded PDF for AI extraction. Works for
 * any text-bearing PDF (a real screenplay/casting-bible/location-list
 * export) — a scanned, image-only PDF returns near-empty text, which the
 * caller should treat as "not supported yet" rather than silently sending
 * blank content to the model.
 */
export async function parsePdfText(buffer: ArrayBuffer): Promise<string> {
  await ensureDomMatrixPolyfill();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text.slice(0, MAX_PDF_TEXT_CHARS);
  } finally {
    await parser.destroy();
  }
}
