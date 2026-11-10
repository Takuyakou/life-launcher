import { chromium, type FullConfig } from "@playwright/test";
import { createPublicFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// Open each window once before the tests start, so the Vite dev server has transformed the entry
// and the lazily loaded dictionary and instruction viewer modules. Without this, the first test that
// opens one of those windows pays for the transform and, with parallel workers on a 4 vCPU runner,
// can miss its 5 s expect timeout. `server.warmup` in vite.config.ts starts the same work, but
// asynchronously; this waits for it to finish.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  if (!baseURL) throw new Error("baseURL is required for the Visual QA warm-up");
  const browser = await chromium.launch();
  try {
    for (const [label, path] of [
      ["main", "/"],
      ["dictionary", "/?view=dictionary"],
      ["life-launcher-instruction", "/?view=instruction&path=C%3A%5CPublicDemo%5CInstructions%5Cwarmup.md"],
    ] as const) {
      const page = await browser.newPage();
      await installTauriMock(page, createPublicFixture(), label);
      await page.goto(new URL(path, baseURL).toString(), { waitUntil: "networkidle", timeout: 120_000 });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
