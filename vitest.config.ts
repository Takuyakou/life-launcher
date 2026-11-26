import { defineConfig } from "vitest/config";

// V165 PR 2: the unit layer. Only tests/unit runs here; the Playwright layers keep tests/visual
// (the full screenshot suite) and the public-safety script keeps its own node:test runner.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    exclude: [
      "tests/visual/**",
      "tests/e2e/**",
      "src-tauri/**",
      "dist/**",
      "dist-qa/**",
      "node_modules/**",
    ],
    environment: "node",
  },
});
