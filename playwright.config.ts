import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "dist/visual-qa/test-results",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:1437",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    reducedMotion: "reduce",
    screenshot: "off",
  },
  webServer: {
    command: "npm.cmd run dev -- --port 1437 --strictPort",
    url: "http://127.0.0.1:1437",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
