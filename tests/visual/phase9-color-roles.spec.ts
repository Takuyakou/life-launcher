import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function open(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1080, height: 680 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

/** A computed colour of an existing design token, resolved the way the browser formats it. */
const resolve = (page: Page, value: string, property: "color" | "backgroundColor" = "color") =>
  page.evaluate(
    ([cssValue, prop]) => {
      const probe = document.createElement("div");
      probe.style.setProperty(prop === "color" ? "color" : "background-color", cssValue);
      document.body.appendChild(probe);
      const value = getComputedStyle(probe)[prop];
      probe.remove();
      return value;
    },
    [value, property] as const,
  );

const token = (page: Page, name: string, property: "color" | "backgroundColor" = "color") =>
  resolve(page, `var(${name})`, property);

/** 0-255 channels of an `rgb()`, `rgba()` or `color(srgb ...)` computed colour. */
function channels(value: string): number[] {
  const numbers = value.match(/[\d.]+/g)!.map(Number);
  const scale = value.startsWith("color(") ? 255 : 1;
  return numbers.slice(0, 3).map((channel) => Math.round(channel * scale));
}

const styleOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        background: style.backgroundColor,
        border: style.borderTopColor,
        outline: style.outlineColor,
        outlineStyle: style.outlineStyle,
      };
    });

const ADD_BUTTONS = [".nextStepHeaderAdd--project", ".nextStepHeaderAdd--wishlist", ".nextStepTodayAdd"];

test("P9-06 add buttons on Main use the neutral tokens, with visible hover, focus and pressed states", async ({
  page,
}) => {
  // Two Today3 items, so the card "＋ 今日へ" buttons are enabled.
  const fixture = createFullTodayFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 2);
  await open(page, fixture);
  const neutral = {
    color: await token(page, "--text-muted-readable"),
    background: await token(page, "--control-neutral-bg", "backgroundColor"),
    border: await token(page, "--line"),
  };
  const hoverBackground = await token(page, "--control-neutral-hover-bg", "backgroundColor");
  const hoverBorder = await token(page, "--muted");
  const activeBackground = await token(page, "--control-neutral-active-bg", "backgroundColor");

  for (const selector of ADD_BUTTONS) {
    const button = page.locator(selector).first();
    await button.scrollIntoViewIfNeeded();
    expect(await styleOf(page, selector), selector).toMatchObject(neutral);

    await button.hover();
    await expect
      .poll(async () => (await styleOf(page, selector)).background, { message: `${selector} hover` })
      .toBe(hoverBackground);
    expect((await styleOf(page, selector)).border).toBe(hoverBorder);

    // Hold the press, then leave the button before releasing so it is not a click.
    await page.mouse.down();
    await expect
      .poll(async () => (await styleOf(page, selector)).background, { message: `${selector} pressed` })
      .toBe(activeBackground);
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }

  // Keyboard focus stays the yellow accent ring.
  await page.locator(ADD_BUTTONS[0]).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const focused = await styleOf(page, ADD_BUTTONS[0]);
  expect(focused.outlineStyle).toBe("solid");
  expect(focused.outline).toBe(await token(page, "--accent-strong"));
});

test("P9-06 the three maintenance buttons are neutral and 'restore from backup' is red like 'clear backup folder'", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });

  await settings.getByRole("tab", { name: "メンテナンス" }).click();
  const neutral = {
    color: await token(page, "--muted"),
    background: await token(page, "--surface", "backgroundColor"),
    border: await token(page, "--line"),
  };
  for (const name of ["アイコンキャッシュ再生成", "ミニウィンドウ位置をリセット", "手順書ウィンドウ位置をリセット"]) {
    const selector = `button:has-text("${name}")`;
    expect(await styleOf(page, selector), name).toMatchObject(neutral);
    // Same look as the other neutral maintenance button, and a hover that is still visible.
    const rest = await styleOf(page, selector);
    await page.locator(selector).hover();
    await expect.poll(async () => (await styleOf(page, selector)).border).not.toBe(rest.border);
  }
  expect(await styleOf(page, 'button:has-text("configフォルダを開く")')).toMatchObject(neutral);

  await settings.getByRole("tab", { name: "バックアップ" }).click();
  const clear = await styleOf(page, 'button:has-text("バックアップを未設定にする")');
  const restoreSelector = 'button:has-text("バックアップから復元")';
  const restore = await styleOf(page, restoreSelector);
  expect(restore).toMatchObject({ color: clear.color, background: clear.background, border: clear.border });
  expect(restore.border).toBe(await token(page, "--error"));
  const restoreHover = restore.border;
  await page.locator(restoreSelector).hover();
  await page.mouse.down();
  await expect
    .poll(async () => (await styleOf(page, restoreSelector)).background)
    .not.toBe(restore.background);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  expect(restoreHover).toBe(await token(page, "--error"));
});

test("P9-06 save stays green and cancel stays red in the settings dialog", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const save = await styleOf(page, ".settingsSaveButton");
  const cancel = await styleOf(page, ".settingsCancelButton");
  expect(save.color).toBe(await token(page, "--good"));
  expect(save.background).toBe(await token(page, "--control-positive-bg", "backgroundColor"));
  // The cancel label is the pale red of the danger role (red clearly above green and blue).
  const [red, green, blue] = channels(cancel.color);
  expect(red).toBeGreaterThan(200);
  expect(green).toBeLessThan(200);
  expect(blue).toBeLessThan(200);
  // A translucent layer of the danger background token.
  expect(channels(cancel.background)).toEqual(
    channels(await token(page, "--control-danger-bg", "backgroundColor")),
  );
});

test("P9-06 the Today3 entry, the victory bar, keyboard focus and the running time stay yellow", async ({
  page,
}) => {
  await open(page, createPickerFixture());
  const accent = await token(page, "--accent");
  const accentStrong = await token(page, "--accent-strong");

  // Victory condition: accent tinted border.
  expect((await styleOf(page, ".victoryBar")).border).toMatch(/^rgba\(231, 185, 77/);
  // "今日やるものを選ぶ" stays the gold action.
  const picker = await styleOf(page, ".todayEmptyState .mainActionButton--gold");
  expect(picker.color).toBe(accentStrong);
  expect(picker.border).toMatch(/^rgba\(231, 185, 77/);
  // Keyboard focus ring on a text control.
  await page.locator(".victoryTextButton").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const focus = await styleOf(page, ".victoryTextButton");
  expect(focus.outlineStyle).toBe("solid");
  expect(focus.outline).toBe(accent);

  // The running time.
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  expect((await styleOf(page, ".timerDock .timerClock")).color).toBe(accentStrong);
});
