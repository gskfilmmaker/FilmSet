import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // a11y-tests/ is a separate Playwright suite (run via the dedicated
    // `test:a11y` script, which needs a running Storybook build) — vitest's
    // default glob otherwise picks up its *.spec.ts file too and crashes
    // trying to execute Playwright's test() runner inside vitest.
    exclude: ["a11y-tests/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
