import { expect, test } from "@playwright/test";
import { checkA11y, configureAxe, injectAxe } from "axe-playwright";

/**
 * One-off validation run for this pass — confirms the shipped FRAME
 * components clear WCAG 2.1/2.2 AA with axe-core, across all three themes.
 * The standing CI tool is @storybook/test-runner (`pnpm test:a11y`, wired
 * via .storybook/test-runner.ts); this file exists because the sandboxed
 * environment used to build this pass only ships full Chromium, not the
 * headless-shell binary jest-playwright-preset expects.
 */
async function storyIds(baseURL: string): Promise<string[]> {
  const res = await fetch(`${baseURL}/index.json`);
  const index = (await res.json()) as { entries: Record<string, { type?: string }> };
  return Object.entries(index.entries)
    .filter(([, entry]) => entry.type !== "docs")
    .map(([id]) => id);
}

const THEMES = ["dark", "light", "high-contrast"] as const;

for (const theme of THEMES) {
  test(`every FRAME story clears WCAG 2.1/2.2 AA — ${theme}`, async ({ page, baseURL }) => {
    const ids = await storyIds(baseURL!);
    expect(ids.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const id of ids) {
      await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};density:comfortable`);
      await page.waitForSelector("#storybook-root", { state: "attached" });
      await page.waitForTimeout(150);
      await injectAxe(page);
      await configureAxe(page, { rules: [{ id: "region", enabled: false }] });
      try {
        await checkA11y(page, "#storybook-root", {
          axeOptions: { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } },
        });
      } catch (error) {
        failures.push(`${id}: ${(error as Error).message}`);
      }
    }

    expect(failures, failures.join("\n\n")).toHaveLength(0);
  });
}
