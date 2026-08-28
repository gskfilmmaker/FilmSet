export interface FrameMarkProps extends React.SVGAttributes<SVGSVGElement> {}

/**
 * The FilmSet mark — four viewfinder/crop-mark corners framing a single
 * center node. Reads as "framing the shot" (the app's core metaphor) and
 * as the production's one focal point of truth, without being a
 * clapboard, film reel, play triangle, or camera silhouette (those read
 * as generic "video app" iconography, not this product specifically).
 * Monochrome via currentColor, legible from a 16px favicon up through a
 * hero-sized brand moment (see BrandIntro, apps/web/components/brand-intro.tsx).
 */
export function FrameMark(props: FrameMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M3 9V3H9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 15V21H15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21H3V15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}
