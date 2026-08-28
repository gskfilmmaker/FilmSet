import { cn, FilmSetWordmark, FrameMark } from "@filmset/ui";

export interface BrandIntroProps {
  /** Off for secondary auth screens (forgot/reset password) — the hero moment belongs to sign-in/sign-up, not every screen that happens to need the mark. */
  animate?: boolean;
  className?: string;
}

/**
 * The brand hero moment for sign-in/sign-up: mark scales in, its center
 * node pulses once like a shutter landing on focus, then the wordmark
 * rises in underneath. One-time and non-interactive, so it's fine to run
 * longer than the 120-240ms §34 budget for state-communicating motion —
 * see packages/tokens/src/motion.css for the keyframes.
 */
export function BrandIntro({ animate = true, className }: BrandIntroProps) {
  return (
    <div className={cn("flex flex-col items-center gap-[var(--fs-space-8)]", className)}>
      <div className="relative flex size-[40px] items-center justify-center">
        {animate && (
          <span
            aria-hidden="true"
            className="absolute size-[36px] rounded-full bg-[var(--color-action-primary)]/20 [animation:fs-brand-node-pulse_640ms_var(--fs-motion-easing-enter)_260ms_both]"
          />
        )}
        <FrameMark
          aria-hidden="true"
          className={cn(
            "relative size-[32px] text-[var(--color-action-primary)]",
            animate && "[animation:fs-brand-mark-in_420ms_var(--fs-motion-easing-enter)_both]",
          )}
        />
      </div>
      <FilmSetWordmark
        trademark
        className={cn(
          "text-[22px] text-[var(--color-text-primary)]",
          animate && "[animation:fs-brand-rise-in_380ms_var(--fs-motion-easing-enter)_360ms_both]",
        )}
      />
    </div>
  );
}
