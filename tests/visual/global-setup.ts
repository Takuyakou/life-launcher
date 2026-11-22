import { chromium, type FullConfig } from "@playwright/test";
import { createPublicFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// ビルドした物を配っているので、温めは念のため。
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
