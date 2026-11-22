import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// V163-B4: the minutes 「続ける」 adds can be changed on the prompt and in Settings > 基本.

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => { settings: { extendTimerMinutes?: number } };
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  };
};

const TEN_MINUTES = 10 * 60_000;

async function open(page: Page, fixture: VisualQaFixture = createPickerFixture()) {
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  const now = new Date(FIXTURE_NOW).getTime();
  await page.clock.install({ time: now });
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  // Only the time the test moves with the page clock passes.
  await page.clock.pauseAt(now + 600_000);
}

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "タイマー満了" });
const dockClock = (page: Page) => page.locator(".timerDock .timerClock");
const extendInput = (page: Page) =>
  dialogOf(page).getByRole("spinbutton", { name: "延長タイマー分数" });

async function startAndExpire(page: Page) {
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await page.clock.fastForward(60_500);
  await expect(dialogOf(page)).toBeVisible();
  // The first focus is placed in an animation frame, which follows the paused page clock.
  await page.clock.runFor(100);
}

async function recordedMinutes(page: Page) {
  return page.evaluate(() =>
    (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls
      .filter((call) => call.command === "record_session")
      .map((call) => (call.args.session as { minutes: number }).minutes),
  );
}

test("V163-B4 1 the prompt starts at 15 minutes with 続ける(+15分) focused", async ({ page }) => {
  await open(page);
  await startAndExpire(page);
  await expect(extendInput(page)).toHaveValue("15");
  await expect(dialogOf(page).getByRole("button", { name: "続ける(+15分)" })).toBeFocused();
  await expect(dialogOf(page).locator(".dialogActions").getByRole("button")).toHaveText([
    "続ける(+15分)",
    "終わる",
  ]);
});

test("V163-B4 2 − / ＋ move by 5 and a typed value extends by that many minutes", async ({
  page,
}) => {
  await open(page);
  await startAndExpire(page);
  const dialog = dialogOf(page);
  await dialog.getByRole("button", { name: "延長タイマーを5分増やす" }).click();
  await expect(extendInput(page)).toHaveValue("20");
  await expect(dialog.getByRole("button", { name: "続ける(+20分)" })).toBeVisible();
  await dialog.getByRole("button", { name: "延長タイマーを5分減らす" }).click();
  await dialog.getByRole("button", { name: "延長タイマーを5分減らす" }).click();
  await expect(extendInput(page)).toHaveValue("10");

  await extendInput(page).fill("13");
  await dialog.getByRole("button", { name: "延長タイマーを5分増やす" }).click();
  // No rounding to the step: 13 + 5 = 18.
  await expect(extendInput(page)).toHaveValue("18");
  await extendInput(page).fill("10");
  await expect(dialog.getByRole("button", { name: "続ける(+10分)" })).toBeVisible();

  // V151-S7: the time spent on the prompt is not counted.
  await page.clock.fastForward(TEN_MINUTES);
  await dialog.getByRole("button", { name: "続ける(+10分)" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(dockClock(page)).toHaveText(/^(10:00|09:59)$/);

  await page.clock.fastForward(10 * 60_000 + 500);
  await expect(dialogOf(page)).toBeVisible();
  await expect(dialogOf(page).locator(".timerCompleteMinutes")).toHaveText("予定 11分");
  await dialogOf(page).getByRole("button", { name: "終わる" }).click();
  await expect.poll(() => recordedMinutes(page)).toEqual([11]);
});

test("V163-B4 3 the default from Settings > 基本 is used the next time the prompt opens", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  const field = settings.getByRole("spinbutton", { name: "延長タイマー分数" });
  await expect(field).toHaveValue("15");
  await field.fill("25");
  await settings.getByRole("button", { name: "保存" }).click();
  await expect(settings).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().settings
            .extendTimerMinutes,
      ),
    )
    .toBe(25);

  await page.reload();
  await expect(page.locator(".doNowBand")).toBeVisible();
  await startAndExpire(page);
  await expect(extendInput(page)).toHaveValue("25");
  await expect(dialogOf(page).getByRole("button", { name: "続ける(+25分)" })).toBeFocused();
});

test("V163-B4 4 an empty, 0 or 999 entry falls back safely", async ({ page }) => {
  await open(page);
  await startAndExpire(page);
  const dialog = dialogOf(page);
  await extendInput(page).fill("");
  await expect(dialog.getByRole("button", { name: "続ける(+15分)" })).toBeVisible();
  await extendInput(page).fill("0");
  await expect(dialog.getByRole("button", { name: "続ける(+15分)" })).toBeVisible();
  await extendInput(page).fill("999");
  await expect(dialog.getByRole("button", { name: "続ける(+240分)" })).toBeVisible();
  // On blur the field shows the value that will be used.
  await extendInput(page).blur();
  await expect(extendInput(page)).toHaveValue("240");
  await extendInput(page).fill("0");
  await extendInput(page).blur();
  await expect(extendInput(page)).toHaveValue("15");
  await dialog.getByRole("button", { name: "延長タイマーを5分減らす" }).click();
  await expect(extendInput(page)).toHaveValue("10");
  await extendInput(page).fill("3");
  await dialog.getByRole("button", { name: "延長タイマーを5分減らす" }).click();
  await expect(extendInput(page)).toHaveValue("1");
});

test("V163-B4 5 the Next step edit steppers still move by 1 minute", async ({ page }) => {
  await open(page);
  await page.locator("[data-project-id]").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  await page.clock.runFor(100);
  const dialog = page.getByRole("dialog", { name: "次の一手を編集" });
  const short = dialog.getByRole("spinbutton", { name: "短時間タイマー分数" });
  const before = Number(await short.inputValue()) || 1;
  await dialog.getByRole("button", { name: "短時間タイマーを1分増やす" }).click();
  await expect(short).toHaveValue(String(before + 1));
  await dialog.getByRole("button", { name: "短時間タイマーを1分減らす" }).click();
  await expect(short).toHaveValue(String(before));
});

test("V163-C3 6 an empty minutes field dims 分 together with the placeholder number", async ({
  page,
}) => {
  await open(page);
  await page.locator("[data-project-id]").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  await page.clock.runFor(100);
  const dialog = page.getByRole("dialog", { name: "次の一手を編集" });
  const field = dialog.locator(".nextStepTimerStepperValue").first();
  const input = field.locator(".nextStepTimerValueInput");
  const read = () =>
    field.evaluate((element) => {
      const value = element.querySelector(".nextStepTimerValueInput")!;
      const unit = element.querySelector(".nextStepTimerStepperUnit")!;
      return {
        placeholder: getComputedStyle(value, "::placeholder").color,
        unit: getComputedStyle(unit).color,
        number: getComputedStyle(value).color,
        shown: value.matches(":placeholder-shown"),
      };
    });

  await input.fill("");
  const empty = await read();
  expect(empty.shown).toBe(true);
  expect(empty.unit).toBe(empty.placeholder);
  expect(empty.unit).not.toBe(empty.number);

  await input.fill("20");
  const typed = await read();
  expect(typed.shown).toBe(false);
  expect(typed.unit).toBe(typed.number);
  expect(typed.unit).not.toBe(empty.placeholder);
});
