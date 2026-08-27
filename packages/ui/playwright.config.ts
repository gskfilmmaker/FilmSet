import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./a11y-tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:6008",
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium",
    },
  },
});
