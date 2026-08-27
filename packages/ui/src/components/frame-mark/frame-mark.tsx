import * as React from "react";

export interface FrameMarkProps extends React.SVGAttributes<SVGSVGElement> {}

/**
 * Placeholder abstract mark — an "F" built from frame strokes plus a
 * disconnected node (system/connection), per Constitution §54. Deliberately
 * NOT a clapboard, film reel, play triangle, or camera silhouette.
 *
 * This is a functional placeholder that passes the monochrome and 16px
 * legibility bars, not a finished brand decision — real logo exploration
 * (§54–57) is out of scope for this pass and needs dedicated design work.
 */
export function FrameMark(props: FrameMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <rect x="4" y="4" width="2.4" height="16" rx="1.2" fill="currentColor" />
      <rect x="4" y="4" width="14" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="4" y="10.8" width="10" height="2.4" rx="1.2" fill="currentColor" />
      <circle cx="18.5" cy="18.5" r="2.3" fill="currentColor" />
    </svg>
  );
}
