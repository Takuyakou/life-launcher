import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/screenshots");

test.describe.configure({ mode: "serial" });

async function prepare(
  page: Page,
  route: string,
  windowLabel: string,
  viewport: { width: number; height: number },
  setup?: (fixture: ReturnType<typeof createPublicFixture>) => void,
) {
  const fixture = createPublicFixture();
  setup?.(fixture);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, windowLabel);
  await page.goto(route);
  await expect(page.locator("main, [role=main]").first()).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;cursor:none!important}",
  });
  return errors;
}

test("@manual capture public main dashboard", async ({ page }) => {
  const errors = await prepare(page, "/", "main", { width: 1366, height: 768 });
  await expect(page.getByText("最優先の一手を始める", { exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "main-dashboard.png") });
  expect(errors).toEqual([]);
});

test("@manual capture public dictionary", async ({ page }) => {
  const errors = await prepare(page, "/?view=dictionary", "dictionary", {
    width: 1000,
    height: 640,
  });
  await expect(page.locator(".dictionaryWindowShell")).toBeVisible();
  await expect(page.getByText("サンプルエディター", { exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary.png") });
  expect(errors).toEqual([]);
});

test("@manual capture public instruction viewer", async ({ page }) => {
  const errors = await prepare(page, "/?view=instruction", "life-launcher-instruction", {
    width: 1080,
    height: 680,
  });
  const root = page.locator('.instructionTreeRow[aria-level="1"]').first();
  await root.getByRole("button", { name: "Instructionsを展開する" }).click();
  const guide = page.locator('.instructionTreeRow[aria-level="2"]').filter({ hasText: "guide.md" });
  await guide.click();
  await expect(page.getByText("Markdown手順書", { exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "instruction-viewer.png") });
  expect(errors).toEqual([]);
});

test("@manual capture public weekly planning", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await prepare(
    page,
    "/",
    "main",
    { width: 1366, height: 768 },
    (fixture) => {
      fixture.config.sourceCompletions = [
        {
          id: "done-1",
          sourceType: "nextStep",
          sourceIdentity: "project:sample-learning:1",
          textSnapshot: "資料を1ページ読む",
          projectId: "sample-learning",
          completedAt: "2026-08-04T10:00:00+09:00",
        },
        {
          id: "done-2",
          sourceType: "wishlist",
          sourceIdentity: "wishlist:sample-weekend",
          textSnapshot: "週末に試すアイデア",
          projectId: "sample-learning",
          completedAt: "2026-08-06T10:00:00+09:00",
        },
        {
          id: "done-3",
          sourceType: "nextStep",
          sourceIdentity: "project:sample-stretch:1",
          textSnapshot: "5分だけ体を動かす",
          projectId: "sample-stretch",
          completedAt: "2026-08-08T10:00:00+09:00",
        },
      ];
    },
  );
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await page.getByRole("tab", { name: "今週を決める" }).click();
  await expect(page.locator(".weeklyPlanning")).toBeVisible();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "weekly-planning.png") });
  expect(errors).toEqual([]);
});

test("@manual create public screenshot contact sheet", async ({ page }) => {
  const items = [
    ["Main dashboard", "main-dashboard.png"],
    ["Dictionary", "dictionary.png"],
    ["Instruction viewer", "instruction-viewer.png"],
  ].map(([label, file]) => ({
    label,
    source: `data:image/png;base64,${readFileSync(resolve(SCREENSHOT_DIR, file)).toString("base64")}`,
  }));
  await page.setViewportSize({ width: 1280, height: 920 });
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#11110f;color:#f4f1e8;font:16px Arial,sans-serif}
    h1{font-size:24px;margin:0 0 20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    figure{margin:0;padding:12px;background:#1c1b17;border:1px solid #403d32;border-radius:6px}
    figure:first-child{grid-column:1/-1}img{display:block;width:100%;height:auto;border:1px solid #302e27}
    figcaption{margin-top:10px;font-weight:600}
  </style></head><body><h1>Life Launcher public screenshots</h1><div class="grid">
    ${items.map((item) => `<figure><img src="${item.source}" alt=""><figcaption>${item.label}</figcaption></figure>`).join("")}
  </div></body></html>`);
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "contact-sheet.png"), fullPage: true });
});
