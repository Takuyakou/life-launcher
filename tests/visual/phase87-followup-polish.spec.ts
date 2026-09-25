import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(
  page: Page,
  viewport = { width: 1180, height: 760 },
  fixture = createPublicFixture(),
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
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
  await expect(dialog.getByRole("button", { name: "ボタン編集を閉じる" })).toBeVisible();
  const footerButtons = dialog.locator(".buttonEditDialogFooter").getByRole("button");
  await expect(footerButtons).toHaveText(["保存", "キャンセル"]);
  await expect(footerButtons.first()).toHaveCSS("color", "rgb(111, 207, 151)");
  await expect(footerButtons.last()).toHaveCSS("color", "rgb(255, 180, 173)");
  await dialog.getByRole("button", { name: "ボタン編集を閉じる" }).click();
  await expect(dialog).toHaveCount(0);
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

  const horizontalColumns = await page
    .locator(".todaySectionBar, .projectsBand, .inboxBand, .todayActivityBand")
    .evaluateAll((bands) =>
      bands.map((band) => {
        const title = band.querySelector(".todaySectionDisclosure h2, .disclosureLabel strong")!;
        const count = band.querySelector(".todaySectionCount, .disclosureCount")!;
        return [title.getBoundingClientRect().x, count.getBoundingClientRect().x];
      }),
    );
  horizontalColumns.forEach(([titleX, countX]) => {
    expect(Math.abs(titleX - horizontalColumns[0][0])).toBeLessThanOrEqual(2);
    expect(Math.abs(countX - horizontalColumns[0][1])).toBeLessThanOrEqual(2);
  });

  const todayTitle = page.locator(".todaySectionDisclosure h2");
  const titleColor = await todayTitle.evaluate((element) => getComputedStyle(element).color);
  const todayHeader = page.locator(".todaySectionBar");
  const nextStepHeader = page.locator(".projectsBand .disclosureHeader");
  await page.mouse.move(0, 0);
  const normalNextStepSurface = await nextStepHeader.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor];
  });
  await expect(todayHeader).toHaveCSS("background-color", normalNextStepSurface[0]);
  await expect(todayHeader).toHaveCSS("border-color", normalNextStepSurface[1]);
  await nextStepHeader.hover();
  const hoveredNextStepSurface = await nextStepHeader.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor];
  });
  await todayHeader.hover();
  await expect(todayTitle).toHaveCSS("color", titleColor);
  await expect(todayHeader).toHaveCSS("background-color", hoveredNextStepSurface[0]);
  await expect(todayHeader).toHaveCSS("border-color", hoveredNextStepSurface[1]);
});

test("Dictionary entry aligns with item rows and Guide footer stays inside its dialog", async ({
  page,
}) => {
  await prepare(page, { width: 1064, height: 703 });
  const launcherLabel = page.locator(".launcherOpenButtonLabel > span:last-child");
  const itemLabel = page.locator(".quickButton span:last-child").first();
  const launcherIconSlot = page.locator(".launcherOpenButtonIcon");
  const launcherIcon = launcherIconSlot.locator(".uiIcon");
  const [launcherBox, itemBox, launcherIconSlotBox, launcherIconBox] = await Promise.all([
    launcherLabel.boundingBox(),
    itemLabel.boundingBox(),
    launcherIconSlot.boundingBox(),
    launcherIcon.boundingBox(),
  ]);
  expect(launcherBox).not.toBeNull();
  expect(itemBox).not.toBeNull();
  expect(launcherIconSlotBox).not.toBeNull();
  expect(launcherIconBox).not.toBeNull();
  expect(Math.abs(launcherBox!.x - itemBox!.x)).toBeLessThanOrEqual(2);
  expect(launcherIconSlotBox!.width).toBe(28);
  expect(launcherIconBox!.height).toBe(22);
  expect(launcherIconBox!.width).toBeGreaterThan(launcherIconBox!.height);
  await expect(launcherIcon.locator("circle")).toHaveCount(1);

  await page.getByRole("button", { name: "使い方" }).click();
  const footer = page.locator(".helpGuideFooter");
  const dialog = page.getByRole("dialog", { name: "使い方" });
  const close = footer.getByRole("button", { name: "閉じる", exact: true });
  const [dialogBox, footerBox, closeBox] = await Promise.all([
    dialog.boundingBox(),
    footer.boundingBox(),
    close.boundingBox(),
  ]);
  expect(dialogBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.y - footerBox!.y).toBeGreaterThanOrEqual(8);
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(footerBox!.y + footerBox!.height + 1);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(
    dialogBox!.y + dialogBox!.height + 1,
  );
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);
});

test("Timer right click does not offer group actions, while sidebar still does", async ({ page }) => {
  await prepare(page);
  await page.locator(".timerDock").click({ button: "right", position: { x: 6, y: 6 } });
  await expect(page.getByRole("menuitem", { name: "グループ追加" })).toHaveCount(0);
  await page.locator(".brandBlock").click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "グループ追加" })).toBeVisible();
});

test("Main and Dictionary shortcut badges use the app accent", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.settings.focusHotkey = "Ctrl+Alt+Space";
  await prepare(page, { width: 1180, height: 760 }, fixture);
  for (const badge of [
    page.locator(".brandCopy .shortcutBadge"),
    page.locator(".launcherOpenButton .shortcutBadge"),
  ]) {
    await expect(badge).toHaveCSS("color", "rgb(231, 185, 77)");
    await expect(badge).toHaveCSS("border-top-color", "rgba(231, 185, 77, 0.48)");
  }
});

test("Group add uses positive Add on the left and danger Cancel on the right", async ({ page }) => {
  await prepare(page);
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "グループ追加" }).click();
  const dialog = page.getByRole("dialog", { name: "グループ追加" });
  const actions = dialog.locator(".formDialogActions").getByRole("button");
  await expect(actions).toHaveText(["追加", "キャンセル"]);
  await expect(actions.first()).toBeDisabled();
  await dialog.getByRole("textbox", { name: "グループ名" }).fill("確認用グループ");
  await expect(actions.first()).toHaveCSS("color", "rgb(111, 207, 151)");
  await expect(actions.last()).toHaveCSS("color", "rgb(255, 180, 173)");
  await actions.last().click();
  await expect(dialog).toHaveCount(0);
});

test("Dictionary shortcut badge follows config and actual registration", async ({ page }) => {
  await prepare(page);
  const badge = page.locator(".launcherOpenButton .shortcutBadge");
  await expect(badge).toHaveText("Ctrl+K");

  await page.evaluate(() => {
    const control = (window as Window & {
      __LIFE_LAUNCHER_VISUAL_QA__: {
        currentConfig: () => ReturnType<typeof createPublicFixture>["config"];
        updateConfig: (config: ReturnType<typeof createPublicFixture>["config"]) => void;
        setReapplyDashboardSettingsFailure: (failed: boolean) => void;
        emit: (event: string) => void;
      };
    }).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    control.updateConfig({
      ...config,
      settings: { ...config.settings, launcherHotkey: null },
    });
  });
  await expect(badge).toHaveCount(0);

  await page.evaluate(() => {
    const control = (window as Window & {
      __LIFE_LAUNCHER_VISUAL_QA__: {
        currentConfig: () => ReturnType<typeof createPublicFixture>["config"];
        updateConfig: (config: ReturnType<typeof createPublicFixture>["config"]) => void;
        setReapplyDashboardSettingsFailure: (failed: boolean) => void;
        emit: (event: string) => void;
      };
    }).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    control.updateConfig({
      ...config,
      settings: { ...config.settings, launcherHotkey: "Ctrl+Alt+Shift+K" },
    });
  });
  await expect(badge).toHaveText("Ctrl+Alt+Shift+K");
  await expect(badge).toHaveAttribute("title", "辞書: Ctrl+Alt+Shift+K");

  await page.evaluate(() => {
    const control = (window as Window & {
      __LIFE_LAUNCHER_VISUAL_QA__: {
        setReapplyDashboardSettingsFailure: (failed: boolean) => void;
        emit: (event: string) => void;
      };
    }).__LIFE_LAUNCHER_VISUAL_QA__;
    control.setReapplyDashboardSettingsFailure(true);
    control.emit("config-changed");
  });
  await expect(badge).toHaveClass(/shortcutBadge--unavailable/);
  await expect(badge).toHaveAttribute("title", /登録できていません/);
  await expect(badge).toHaveCSS("color", "rgb(231, 185, 77)");
  await expect(badge).toHaveCSS("border-top-style", "dashed");
});
