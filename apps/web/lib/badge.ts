import "server-only";
import QRCode from "qrcode";

/**
 * Encodes exactly the opaque, high-entropy credential.publicReference value
 * — never a name, photo, or any other identity data — matching
 * docs/security/QR_SECURITY_ACCESS_CONTROL.md. Rendered server-side so the
 * badge page never needs a client-side QR library.
 */
export async function generateQrDataUrl(publicReference: string): Promise<string> {
  return QRCode.toDataURL(publicReference, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 240,
    color: { dark: "#0A0A0A", light: "#FFFFFF" },
  });
}

/** WCAG relative luminance, used only to pick readable text over an arbitrary brand color. */
function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(c.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Picks near-black or near-white text so the header band stays readable over any brand color a producer picks. */
export function readableTextOn(hexBackground: string): string {
  return relativeLuminance(hexBackground) > 0.42 ? "#111318" : "#F5F6F8";
}
