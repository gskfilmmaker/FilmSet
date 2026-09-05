"use client";

import { BrandIntro } from "./brand-intro";
import * as React from "react";

const SESSION_KEY = "filmset-splash-shown";
const HOLD_MS = 1100;
const FADE_MS = 300;

/**
 * The one-time brand moment on entering the app — not the auth screens'
 * own BrandIntro (that already plays once per sign-in/sign-up view), but
 * a full-screen version shown exactly once per browser tab session, the
 * first time the authenticated Shell mounts. Every navigation after that
 * finds sessionStorage already set and renders nothing — this is a "you've
 * arrived" moment, not a loading screen, so it never reappears on route
 * changes within the same session.
 *
 * Skippable (click/tap anywhere, or any key) and skipped entirely under
 * prefers-reduced-motion — a forced hold with no motion to justify it
 * would just be a delay, not a graceful degradation.
 */
export function AppSplash() {
  const [visible, setVisible] = React.useState(false);
  const [fadingOut, setFadingOut] = React.useState(false);

  React.useEffect(() => {
    let alreadyShown = true;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // sessionStorage unavailable (private mode, etc.) — treat as already shown, never block on it.
    }
    if (alreadyShown) return;

    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Best-effort only — worst case the splash plays again next navigation, not a functional problem.
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    setVisible(true);
    const holdTimer = setTimeout(() => setFadingOut(true), HOLD_MS);
    const dismissTimer = setTimeout(() => setVisible(false), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  function dismiss() {
    setFadingOut(true);
    setTimeout(() => setVisible(false), FADE_MS);
  }

  if (!visible) return null;

  return (
    <div
      role="presentation"
      onClick={dismiss}
      onKeyDown={dismiss}
      className={
        "fixed inset-0 z-[var(--fs-z-modal)] flex items-center justify-center bg-[var(--color-background-canvas)] " +
        "transition-opacity ease-[var(--fs-motion-easing-standard)]"
      }
      style={{ transitionDuration: `${FADE_MS}ms`, opacity: fadingOut ? 0 : 1 }}
    >
      <BrandIntro />
    </div>
  );
}
