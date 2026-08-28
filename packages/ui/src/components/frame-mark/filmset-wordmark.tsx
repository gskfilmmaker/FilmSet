import { cn } from "../../lib/cn";

export interface FilmSetWordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Show the ™ superscript — reserve for the primary brand lockup (sign-in/sign-up hero, not every inline mention). */
  trademark?: boolean;
}

/** The "FilmSet" wordmark, paired with FrameMark wherever the brand needs to be legible as text, not just the abstract mark — the global bar, the auth screens' brand intro. */
export function FilmSetWordmark({ trademark = false, className, ...props }: FilmSetWordmarkProps) {
  return (
    <span className={cn("inline-flex items-baseline font-semibold tracking-[-0.01em]", className)} {...props}>
      FilmSet
      {trademark && <sup className="ml-[1px] text-[0.55em] font-medium not-italic opacity-70">™</sup>}
    </span>
  );
}
