import { expect, test, type Page } from "@playwright/test";
import { IMPORT_PROMPT_FIRST, IMPORT_PROMPT_REPEAT } from "../../src/content/importPrompt";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

async function prepare(page: Page, viewport = { width: 1440, height: 900 }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(viewport);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

function guideOpener(page: Page) {
  return page.getByRole("button", { name: "使い方" });
}

function guideDialog(page: Page) {
  return page.getByRole("dialog", { name: "使い方" });
}

async function openGuide(page: Page) {
  await guideOpener(page).click();
  const dialog = guideDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "使い方", exact: true })).toBeFocused();
  return dialog;
}

test("Guide contents move focus to a section and mark the current location", async ({ page }) => {
  await prepare(page);
  const dialog = await openGuide(page);
  const navigation = dialog.getByRole("navigation", { name: "使い方の目次" });
  const todayButton = navigation.getByRole("button", { name: /今日やるものを選ぶ/ });

  await todayButton.click();
  const todayHeading = dialog
    .locator('[data-help-section-id="today-builder"]')
    .getByRole("heading", { name: "今日やるものを選ぶ" });
  await expect(todayHeading).toBeFocused();
  await expect(todayButton).toHaveAttribute("aria-current", "location");

  await expect(dialog.getByRole("button", { name: "目次へ戻る" })).toHaveCount(0);
});

test("Guide traps focus, ignores backdrop clicks, and returns focus after explicit close", async ({ page }) => {
  await prepare(page);
  const opener = guideOpener(page);
  let dialog = await openGuide(page);

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "閉じる", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "使い方を閉じる" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  dialog = await openGuide(page);
  await page.locator(".helpGuideBackdrop").click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "使い方を閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("Guide close button uses the red cancel style (P96-03)", async ({ page }) => {
  await prepare(page);
  const dialog = await openGuide(page);
  const close = dialog.getByRole("button", { name: "閉じる", exact: true });
  // ほかの赤いボタン(終わる)と同じ見た目であること
  const reference = await page.evaluate(() => {
    const probe = document.createElement("button");
    probe.className = "secondaryButton secondaryButton--finish";
    probe.textContent = "終わる";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const value = {
      background: style.backgroundColor,
      color: style.color,
      border: style.borderTopColor,
    };
    probe.remove();
    return value;
  });
  await expect(close).toHaveCSS("background-color", reference.background);
  await expect(close).toHaveCSS("color", reference.color);
  await expect(close).toHaveCSS("border-top-color", reference.border);
  expect(reference.background).toBe("rgb(59, 40, 35)");
  expect(reference.color).toBe("rgb(255, 180, 173)");
});

test("Guide shows both import prompts and copies exactly what importPrompt.ts has", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as typeof window & { __copiedGuidePrompt?: string }).__copiedGuidePrompt = text;
        },
      },
    });
  });
  await prepare(page);
  const dialog = await openGuide(page);
  const navigation = dialog.getByRole("navigation", { name: "使い方の目次" });
  await navigation.getByRole("button", { name: /まとめて取り込む/ }).click();
  const section = dialog.locator('[data-help-section-id="bulk-import"]');
  await expect(section).toBeVisible();

  const blocks = section.locator(".helpGuideCodeBlock");
  await expect(blocks).toHaveCount(3);
  const first = blocks.filter({ hasText: "はじめて用のプロンプト" });
  const repeat = blocks.filter({ hasText: "2回目以降用のプロンプト" });
  const example = blocks.filter({ hasText: "「私の状況」の例" });
  await expect(first.locator("pre")).toHaveText(IMPORT_PROMPT_FIRST);
  await expect(repeat.locator("pre")).toHaveText(
    IMPORT_PROMPT_REPEAT.replace(
      "{CURRENT_STATE}",
      "(「今の内容を付けてコピー」で、ここに今のアプリの内容が自動で入ります)",
    ),
  );
  await expect(example.locator("pre")).toHaveText(
    "英語を話せるようになりたい。平日の夜に30分くらい使える。ベースで好きな曲を1曲弾けるようになりたい。部屋の片付けもしたいが、何から手を付けるか決まっていない。",
  );
  await expect(example.getByRole("button")).toHaveCount(0);

  await first.getByRole("button", { name: "はじめて用のプロンプトをコピー" }).click();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __copiedGuidePrompt?: string }).__copiedGuidePrompt ?? "",
    ),
  ).toBe(IMPORT_PROMPT_FIRST);

  await repeat.getByRole("button", { name: "2回目以降用のプロンプトをコピー" }).click();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __copiedGuidePrompt?: string }).__copiedGuidePrompt ?? "",
    ),
  ).toBe(
    IMPORT_PROMPT_REPEAT.replace(
      "{CURRENT_STATE}",
      "(「今の内容を付けてコピー」で、ここに今のアプリの内容が自動で入ります)",
    ),
  );
});

test("Guide remains bounded at 860px and exposes the collapsed contents below 760px", async ({
  page,
}) => {
  await prepare(page, { width: 860, height: 700 });
  let dialog = await openGuide(page);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(860);
  expect(box!.y + box!.height).toBeLessThanOrEqual(700);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 700, height: 700 });
  dialog = await openGuide(page);
  const toggle = dialog.getByRole("button", { name: "目次を開く" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(dialog.getByRole("navigation", { name: "使い方の目次" })).toBeVisible();
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).resolves.toBe(true);
});
