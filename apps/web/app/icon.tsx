import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Dynamic favicon — renders the FilmSet mark (see packages/ui FrameMark)
 * server-side so the browser tab carries FilmSet's own brand instead of a
 * static asset. Colors are inlined rather than imported from
 * packages/tokens because Satori (the renderer behind ImageResponse) needs
 * literal values, not CSS custom properties.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0D0F",
          borderRadius: 6,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9V3H9" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 3H21V9" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 15V21H15" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 21H3V15" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" fill="#E5484D" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
