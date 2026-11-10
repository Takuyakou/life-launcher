import { defineConfig } from "@playwright/test";
import { availableParallelism } from "node:os";

const localWorkers = Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "dist/visual-qa/test-results",
  fullyParallel: false,
  // CI (windows-latest, 4 vCPU) runs two workers. Measured on that runner: see PR #166.
  workers: process.env.CI ? 2 : localWorkers,
  // An explicit project keeps --workers from inheriting a per-project cap.
  projects: [{}],
  use: {
    baseURL: "http://127.0.0.1:1437",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm.cmd run dev -- --port 1437 --strictPort",
    url: "http://127.0.0.1:1437",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
