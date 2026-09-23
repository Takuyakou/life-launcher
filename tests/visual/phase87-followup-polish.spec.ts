import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, viewport = { width: 1180, height: 760 }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await page.evaluate(async () => document.fonts.ready);
}

test("Main button edit shares the group control and positive/cancel footer grammar", async ({
  page,
}) => {
  await prepare(page, { width: 760, height: 520 });
  await page.locator(".quickButton").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集" }).click();
  const dialog = page.getByRole("dialog", { name: "ボタン編集" });
  await expect(dialog.getByRole("button", { name: "既存から選ぶ" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "新規グループを作成" })).toBeVisible();
  await expect(dialog.getByText("アイコン", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "アクションを上へ" })).toHaveCount(0);
  const footerButtons = dialog.locator(".buttonEditDialogFooter").getByRole("button");
  await expect(footerButtons).toHaveText(["保存", "キャンセル"]);
  await expect(footerButtons.first()).toHaveCSS("color", "rgb(111, 207, 151)");
  await expect(footerButtons.last()).toHaveCSS("color", "rgb(255, 180, 173)");
});

test("Timer cannot select text and changing its minutes stays quiet", async ({ page }) => {
  await prepare(page);
  const timer = page.locator(".timerDock");
  await expect(timer).toHaveCSS("user-select", "none");
  await expect(timer.getByRole("spinbutton", { name: "通常タイマーの分数" })).toHaveCSS(
    "user-select",
    "none",
  );
  await timer.locator(".timerPresetButton").last().click();
  await expect(page.getByText(/通常タイマーを\d+分にしました/)).toHaveCount(0);
});

test("Today header collapses and dashboard metadata keeps one vertical rhythm", async ({
  page,
}) => {
  await prepare(page);
  const todayToggle = page.locator(".todaySectionDisclosure");
  await expect(todayToggle).toHaveAttribute("aria-expanded", "true");
  await todayToggle.click();
  await expect(todayToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".todayGridRegion")).toHaveCount(0);
  await todayToggle.click();
  await expect(page.locator(".todayGridRegion")).toBeVisible();

  const offsets = await page
    .locator(".projectsBand, .inboxBand, .todayActivityBand")
    .evaluateAll((bands) =>
      bands.map((band) => {
        const header = band.querySelector(".disclosureHeader")!.getBoundingClientRect();
        const center = (selector: string) => {
          const box = band.querySelector(selector)!.getBoundingClientRect();
          return box.top + box.height / 2 - header.top;
        };
        return [
          center(".disclosureLabel strong"),
          center(".disclosureCount"),
          center(".disclosureDescription"),
        ];
      }),
    );
  offsets
    .flat()
    .forEach((offset) => expect(Math.abs(offset - offsets[0][0])).toBeLessThanOrEqual(2));
});

test("Dictionary label aligns with group labels and Guide footer clears its divider", async ({
  page,
}) => {
  await prepare(page, { width: 1024, height: 420 });
  const launcherLabel = page.locator(".launcherOpenButtonLabel > span:last-child");
  const groupLabel = page.locator(".quickGroupHeader strong").first();
  const [launcherBox, groupBox] = await Promise.all([
    launcherLabel.boundingBox(),
    groupLabel.boundingBox(),
  ]);
  expect(launcherBox).not.toBeNull();
  expect(groupBox).not.toBeNull();
  expect(Math.abs(launcherBox!.x - groupBox!.x)).toBeLessThanOrEqual(2);

  await page.getByRole("button", { name: "使い方" }).click();
  const footer = page.locator(".helpGuideFooter");
  const close = footer.getByRole("button", { name: "閉じる", exact: true });
  const [footerBox, closeBox] = await Promise.all([footer.boundingBox(), close.boundingBox()]);
  expect(footerBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.y - footerBox!.y).toBeGreaterThanOrEqual(12);
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(footerBox!.y + footerBox!.height + 1);
});
