import { readableTextOn } from "@/lib/badge";
import { ShieldCheck } from "lucide-react";
import type { SecurityClass } from "./constants";
import { PrintButton } from "./print-button";

/**
 * The physical credential badge, as an on-screen preview and a print
 * source. Deliberately styled with its own fixed hex palette, not the
 * app's --color-* tokens: a badge is a simulated physical object (it
 * gets printed or photographed) and must look identical regardless of
 * the viewer's light/dark theme preference, exactly like a printed
 * business card would.
 *
 * Card proportions match a real CR80 ID card (3.375in x 2.125in, the
 * same size as a driver's license) so this prints at true size.
 */

const DEFAULT_BRAND_COLOR = "#111318";

const ACCESS_TIER: Record<SecurityClass, { label: string; color: string }> = {
  HOD: { label: "ALL ACCESS", color: "#A9791C" },
  DIRECTOR: { label: "ALL ACCESS", color: "#A9791C" },
  PRODUCER: { label: "ALL ACCESS", color: "#A9791C" },
  VIP: { label: "VIP", color: "#A9791C" },
  SECURITY: { label: "SECURITY", color: "#8B2323" },
  CAST: { label: "CAST", color: "#2B3A55" },
  CREW: { label: "CREW", color: "#2B3A55" },
  DAY_PLAYER: { label: "DAY PLAYER", color: "#2B3A55" },
  BACKGROUND: { label: "BACKGROUND", color: "#2B3A55" },
  LOCATION_STAFF: { label: "LOCATION STAFF", color: "#2B3A55" },
  VENDOR: { label: "VENDOR", color: "#0E6E6E" },
  CONTRACTOR: { label: "CONTRACTOR", color: "#0E6E6E" },
  DRIVER: { label: "DRIVER", color: "#0E6E6E" },
  MEDIA: { label: "MEDIA", color: "#0E6E6E" },
  VISITOR: { label: "VISITOR — ESCORT REQUIRED", color: "#B5560A" },
  TEMPORARY: { label: "TEMPORARY", color: "#B5560A" },
  CUSTOM: { label: "CUSTOM", color: "#4A4A4A" },
};

function formatDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function CredentialBadge({
  productionName,
  brandColor,
  logoUrl,
  photoUrl,
  name,
  subtitle,
  securityClass,
  credentialNumber,
  validFrom,
  validUntil,
  qrDataUrl,
}: {
  productionName: string;
  brandColor: string | null;
  logoUrl: string | null;
  photoUrl: string | null;
  name: string;
  subtitle: string | null;
  securityClass: SecurityClass;
  credentialNumber: string;
  validFrom: Date | string | null;
  validUntil: Date | string | null;
  qrDataUrl: string;
}) {
  const headerColor = brandColor ?? DEFAULT_BRAND_COLOR;
  const headerTextColor = readableTextOn(headerColor);
  const tier = ACCESS_TIER[securityClass];
  const validFromLabel = formatDate(validFrom);
  const validUntilLabel = formatDate(validUntil);

  return (
    <div className="flex min-h-screen flex-col items-center gap-[24px] bg-[var(--color-background-canvas)] p-[32px] print:bg-white print:p-0">
      <div className="flex w-full max-w-[420px] items-center justify-between print:hidden">
        <p className="text-[13px] text-[var(--color-text-secondary)]">Credential badge</p>
        <PrintButton />
      </div>

      <div
        className="relative flex w-[min(384px,calc(100vw-64px))] shrink-0 flex-col overflow-hidden rounded-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.25)] print:w-[384px] print:shadow-none"
        style={{
          aspectRatio: "1.5882",
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {/* Access-tier color spine — the same at-a-glance cue a physical lanyard/wristband color gives. */}
        <div className="absolute inset-y-0 left-0 w-[7px]" style={{ backgroundColor: tier.color }} aria-hidden="true" />

        {/* Header band */}
        <div
          className="flex shrink-0 items-center gap-[10px] px-[18px] py-[10px] pl-[22px]"
          style={{ backgroundColor: headerColor, color: headerTextColor }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- fixed-size badge asset, resolved server-side, no benefit from next/image here
            <img src={logoUrl} alt="" aria-hidden="true" className="h-[22px] w-auto shrink-0 object-contain" />
          ) : (
            <ShieldCheck className="size-[18px] shrink-0" aria-hidden="true" style={{ color: headerTextColor }} />
          )}
          <p className="truncate text-[11px] font-bold uppercase leading-none tracking-[0.08em]">{productionName}</p>
        </div>

        {/* Body */}
        <div className="flex flex-1 gap-[14px] px-[18px] pl-[22px] pt-[14px]">
          <div
            className="h-[92px] w-[74px] shrink-0 overflow-hidden rounded-[6px] border"
            style={{ borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#E7E9EE" }}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- fixed-size badge asset, resolved server-side, no benefit from next/image here
              <img src={photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-[24px] font-semibold" style={{ color: "#9AA0AC" }}>
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[4px] pt-[2px]">
            <p className="truncate text-[17px] font-bold leading-[20px]" style={{ color: "#111318" }}>
              {name}
            </p>
            {subtitle && (
              <p className="truncate text-[11px] font-medium" style={{ color: "#5B616E" }}>
                {subtitle}
              </p>
            )}
            <span
              className="mt-[4px] inline-flex w-fit items-center rounded-[3px] px-[7px] py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.04em]"
              style={{ backgroundColor: tier.color, color: readableTextOn(tier.color) }}
            >
              {tier.label}
            </span>
          </div>
        </div>

        {/* Footer strip */}
        <div
          className="mt-[10px] flex shrink-0 items-end justify-between border-t px-[18px] py-[10px] pl-[22px]"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div className="flex flex-col gap-[2px]">
            <p className="font-mono text-[11px] font-semibold tracking-[0.03em]" style={{ color: "#111318" }}>
              {credentialNumber}
            </p>
            {(validFromLabel || validUntilLabel) && (
              <p className="text-[9px]" style={{ color: "#8A909C" }}>
                Valid {validFromLabel ?? "—"} – {validUntilLabel ?? "no expiry"}
              </p>
            )}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, generated server-side per request */}
          <img src={qrDataUrl} alt="" width={52} height={52} className="shrink-0" />
        </div>
      </div>

      <p className="max-w-[384px] text-center text-[11px] text-[var(--color-text-tertiary)] print:hidden">
        Scanning this code resolves only an opaque identifier — no name, photo, or other personal data is encoded in it.
      </p>
    </div>
  );
}
