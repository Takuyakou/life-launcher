import { defineConfig } from "@playwright/test";
import { availableParallelism } from "node:os";

export const FAST_SPECS = [
  "config-validation.spec.ts",
  "css-class-contract.spec.ts",
  "dictionary-window-position.spec.ts",
  "phase72-public-safety.spec.ts",
  "phase82-countup-core.spec.ts",
  "phase96-topmenu-labels.spec.ts",
  "readme-contract.spec.ts",
  "test-timing-contract.spec.ts",
];

const localWorkers = Math.max(1, Math.min(8, Math.floor(availableParallelism() / 2)));

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: FAST_SPECS,
  outputDir: "dist/visual-qa/fast-results",
  fullyParallel: true,
  workers: process.env.CI ? 2 : localWorkers,
  projects: [{}],
});
