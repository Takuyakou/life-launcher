import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P97-02 E/F: 設定画面の ↑ で選んでいるタブへ戻ること、窓の大きさが変わった直後に
// 乗せた色を出さないこと。

async function open(page: Page) {
  const fixture = createPublicFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1200, height: 680 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("ArrowUp at the top of a settings section returns to the selected tab", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();

  const selectedTab = settings.locator('.settingsTabs [role="tab"][aria-selected="true"]');
  await expect(selectedTab).toHaveCount(1);
  const tabName = await selectedTab.getAttribute("aria-label");

  // タブで ↓ → 節の一番上へ
  await selectedTab.focus();
  await page.keyboard.press("ArrowDown");
  const inSection = await page.evaluate(() =>
    Boolean(
      (document.activeElement as HTMLElement | null)?.closest(
        ".settingsSection:not(.settingsSection--hidden)",
      ),
    ),
  );
  expect(inSection, "focus moved into the section").toBe(true);

  // 節の一番上で ↑ → 選んでいるタブへ戻る（タブは切り替わらない）
  await page.keyboard.press("ArrowUp");
  const after = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return {
      isTab: Boolean(active?.matches('.settingsTabs [role="tab"]')),
      selected: active?.getAttribute("aria-selected"),
      label: active?.getAttribute("aria-label"),
    };
  });
  expect(after.isTab, "focus is on a tab").toBe(true);
  expect(after.selected, "the tab stays the selected one").toBe("true");
  expect(after.label).toBe(tabName);
});

test("hover colours stay off after the window is resized until the mouse moves", async ({
  page,
}) => {
  await open(page);
  const button = page.locator(".windowControlButton").first();
  const style = () =>
    button.evaluate((element) => {
      const computed = getComputedStyle(element);
      return `${computed.backgroundColor}|${computed.color}`;
    });
  await page.mouse.move(2, 2);
  const resting = await style();
  await button.hover();
  const hovered = await style();
  expect(hovered, "a hovered window button shows a colour").not.toBe(resting);

  // 大きさが変わった直後: 乗せた色を出さない
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(page.locator("body")).toHaveClass(/hover-suppressed/);
  const suppressed = await style();
  expect(suppressed, "no hover colour right after a resize").toBe(resting);

  // マウスを動かすと今までどおり
  await page.mouse.move(600, 300);
  await expect(page.locator("body")).not.toHaveClass(/hover-suppressed/);
  await button.hover();
  const released = await style();
  expect(released, "the hover colour comes back").toBe(hovered);
});
