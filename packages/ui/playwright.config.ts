import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./a11y-tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:6015",
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium",
    },
  },
});
