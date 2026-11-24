import { expect, test, type Page } from "@playwright/test";
import { pauseClock } from "./clock";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V164-E: the close motion. `<ExitPresence>` keeps a dialog, a menu or the expanded timer mounted
// while the `ui-*-exit` keyframes of 09-ui-parts-book.css run, marks it `data-exiting` / `inert`
// and removes it when the last of those motions ends. The clock is paused in the first test, so
// only `animationend` can remove the surface there (the JS fallback timer never fires).

type ExitRecord = {
  className: string;
  ariaHidden: string | null;
  inert: boolean;
  animation: string;
  pointerEvents: string;
  childAnimation: string | null;
};

async function openMain(
  page: Page,
  fixture: VisualQaFixture = createFullTodayFixture(),
  reducedMotion: "no-preference" | "reduce" = "no-preference",
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

/**
 * Records every element that receives `data-exiting="true"`, with the styles it had at that moment.
 * Reading after the click would race the 130–150ms motion, so the page records it instead.
 */
async function watchExits(page: Page) {
  await page.evaluate(() => {
    const store = window as unknown as { __v164Exits: ExitRecord[] };
    store.__v164Exits = [];
    const seen = new WeakSet<Element>();
    const capture = (element: Element) => {
      if (element.getAttribute("data-exiting") !== "true" || seen.has(element)) return;
      seen.add(element);
      const style = getComputedStyle(element);
      const child = element.querySelector('[role="dialog"], [role="menu"], .expandedTimer');
      store.__v164Exits.push({
        className: element.getAttribute("class") ?? "",
        ariaHidden: element.getAttribute("aria-hidden"),
        inert: element.hasAttribute("inert"),
        animation: style.animationName,
        pointerEvents: style.pointerEvents,
        childAnimation: child ? getComputedStyle(child).animationName : null,
      });
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element) {
          capture(record.target);
        }
        if (record.type === "childList") {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            capture(node);
            for (const nested of node.querySelectorAll('[data-exiting="true"]')) capture(nested);
          }
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-exiting"],
      childList: true,
    });
  });
}

async function readExits(page: Page): Promise<ExitRecord[]> {
  return page.evaluate(
    () => (window as unknown as { __v164Exits: ExitRecord[] }).__v164Exits ?? [],
  );
}

async function animationNames(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).animationName);
}

test("V164-E1 a closed dialog runs the close motion and leaves the DOM after it, with the clock paused", async ({
  page,
}) => {
  await openMain(page);
  await watchExits(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await pauseClock(page);

  await page.getByRole("button", { name: "設定を閉じる" }).click();
  // The surface stays in the DOM with the close motion, and it can no longer be used.
  await expect(page.locator('.modalBackdrop[data-exiting="true"]')).toHaveCount(1);
  await expect(page.locator('.modalBackdrop[data-exiting="true"]')).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator('.modalBackdrop[data-exiting="true"]')).toHaveAttribute("inert", "");

  const exits = await readExits(page);
  expect(exits).toHaveLength(1);
  expect(exits[0].className).toContain("modalBackdrop");
  expect(exits[0].ariaHidden).toBe("true");
  expect(exits[0].inert).toBe(true);
  expect(exits[0].animation).toBe("ui-backdrop-exit");
  expect(exits[0].childAnimation).toBe("ui-dialog-exit");
  expect(exits[0].pointerEvents).toBe("none");

  // The clock is paused, so the 240ms fallback timer never runs: `animationend` does the removal.
  await expect(page.locator(".modalBackdrop")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "設定" })).toHaveCount(0);
});

test("V164-E1 a menu and the expanded timer also close through the motion", async ({ page }) => {
  await openMain(page);
  await watchExits(page);

  await page.locator(".doNowBand").click({ button: "right" });
  const menu = page.locator(".contextMenu").first();
  await expect(menu).toBeVisible();
  expect(await animationNames(page, ".contextMenu")).toContain("ui-menu-enter");
  await page.keyboard.press("Escape");
  await expect(page.locator(".contextMenu")).toHaveCount(0);

  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay).toBeVisible();
  await page.locator(".expandedTimerClose").click();
  await expect(page.locator(".expandedTimerBackdrop")).toHaveCount(0);

  const exits = await readExits(page);
  const menuExit = exits.find((record) => record.className.includes("contextMenu"));
  expect(menuExit).toBeDefined();
  expect(menuExit!.animation).toBe("ui-menu-exit");
  expect(menuExit!.pointerEvents).toBe("none");

  const timerExit = exits.find((record) => record.className.includes("expandedTimerBackdrop"));
  expect(timerExit).toBeDefined();
  expect(timerExit!.animation).toBe("ui-backdrop-exit");
  expect(timerExit!.childAnimation).toBe("ui-expanded-timer-exit");
  expect(timerExit!.inert).toBe(true);
});

test("V164-E1 the reduced-motion setting drops the surface without the close motion", async ({
  page,
}) => {
  await openMain(page, createFullTodayFixture(), "reduce");
  await watchExits(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await page.getByRole("button", { name: "設定を閉じる" }).click();
  await expect(page.locator(".modalBackdrop")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "設定" })).toHaveCount(0);

  const exits = await readExits(page);
  // Every close motion is switched off for this setting, so nothing waits for an animation.
  for (const record of exits) {
    expect(record.animation).toBe("none");
    expect(record.childAnimation ?? "none").toBe("none");
  }
});

test("V164-E1 a second open right after a close is not stopped by the closing surface", async ({
  page,
}) => {
  await openMain(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await page.getByRole("button", { name: "設定を閉じる" }).click();

  // The closing backdrop covers the window but takes no pointer events, so this click lands.
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await expect(page.locator('.modalBackdrop:not([data-exiting="true"])')).toHaveCount(1);
});

test("V164-E1 Ctrl+Z still undoes right after a dialog closes", async ({ page }) => {
  await openMain(page);
  await page.locator(".todayRemoveButton").first().click();
  await expect(page.locator(".toast", { hasText: "今日の3件から外しました" }).last()).toBeVisible();

  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await page.getByRole("button", { name: "設定を閉じる" }).click();
  // Sent while the closing backdrop is still in the DOM (it must not count as an open dialog).
  await page.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }),
    );
  });
  await expect(page.locator(".toast", { hasText: "元に戻しました" }).last()).toBeVisible();
});

test("V164-E1 Escape pressed again while closing leaves nothing stuck", async ({ page }) => {
  await openMain(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await expect(page.locator(".modalBackdrop")).toHaveCount(0);
  await expect(page.locator('[data-exiting="true"]')).toHaveCount(0);
  // The screen still takes input afterwards.
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
});

test("V164-E1 closing the confirm on top of Settings gives the focus back to Settings", async ({
  page,
}) => {
  await openMain(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  await settings.getByRole("tab", { name: "メンテナンス" }).click();

  await settings.getByRole("button", { name: "ミニウィンドウ位置をリセット" }).click();
  const confirm = page.getByRole("dialog", { name: "ミニウィンドウ位置をリセットしますか？" });
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);

  // 1-4 6/7: the closing confirm is not "the top surface" any more, so the focus goes back inside.
  await expect(
    settings.getByRole("button", { name: "ミニウィンドウ位置をリセット" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const focusInside = await page.evaluate(() => {
    const active = document.activeElement;
    const dialog = document.querySelector(".settingsDialog");
    return Boolean(dialog && active && dialog.contains(active));
  });
  expect(focusInside).toBe(true);
});

test("V164-E1 the four surfaces that had no open motion animate when they open", async ({
  page,
}) => {
  await openMain(page);

  // The Next Step editor's 「足す物」 menu.
  const row = page.locator(".nextStepCard").filter({ hasText: "ストレッチ" }).first();
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  await expect(page.locator(".nextStepEditDialog")).toBeVisible();
  await page.locator(".nextStepOpenChipAdd").click();
  await expect(page.locator(".nextStepOpenMenu")).toBeVisible();
  expect(await animationNames(page, ".nextStepOpenMenu")).toBe("ui-menu-enter");
  await page.locator(".nextStepOpenChipAdd").click();
  await page.keyboard.press("Escape");

  // The expanded timer.
  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
  expect(await animationNames(page, ".expandedTimerBackdrop")).toBe("ui-backdrop-enter");
  expect(await animationNames(page, ".expandedTimer")).toBe("ui-expanded-timer-enter");
});

test("V164-E1 the dictionary menu and settings animate when they open", async ({ page }) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1000, height: 640 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installTauriMock(page, createFullTodayFixture(), "dictionary");
  await page.goto("/?view=dictionary");
  await waitForBundledFonts(page);

  await page.getByRole("button", { name: "辞書の設定" }).click();
  await expect(page.getByRole("dialog", { name: "辞書の設定" })).toBeVisible();
  expect(await animationNames(page, ".dictionarySettingsBackdrop")).toBe("ui-backdrop-enter");
  expect(await animationNames(page, ".dictionarySettingsBackdrop > [role='dialog']")).toBe(
    "ui-dialog-enter",
  );
  await page.getByRole("button", { name: "辞書の設定を閉じる" }).click();
  await expect(page.locator(".dictionarySettingsBackdrop")).toHaveCount(0);

  await page
    .locator(".dictionaryWindowTitlebar")
    .click({ button: "right", position: { x: 190, y: 20 } });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  expect(await animationNames(page, ".dictionaryTitlebarMenu")).toBe("ui-menu-enter");
  await page.keyboard.press("Escape");
  await expect(page.locator(".dictionaryTitlebarMenu")).toHaveCount(0);
});

test("V164-E1 the reduced-motion setting turns off the four new open motions", async ({ page }) => {
  await openMain(page, createFullTodayFixture(), "reduce");
  await watchExits(page);

  const row = page.locator(".nextStepCard").filter({ hasText: "ストレッチ" }).first();
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  await expect(page.locator(".nextStepEditDialog")).toBeVisible();
  await page.locator(".nextStepOpenChipAdd").click();
  await expect(page.locator(".nextStepOpenMenu")).toBeVisible();
  expect(await animationNames(page, ".nextStepOpenMenu")).toBe("none");
  await page.locator(".nextStepOpenChipAdd").click();
  await page.keyboard.press("Escape");

  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
  expect(await animationNames(page, ".expandedTimerBackdrop")).toBe("none");
  expect(await animationNames(page, ".expandedTimer")).toBe("none");

  await page.locator(".expandedTimerClose").click();
  await expect(page.locator(".expandedTimerBackdrop")).toHaveCount(0);
  const exits = await readExits(page);
  expect(exits.length).toBeGreaterThan(0);
  expect(exits.every((record) => record.animation === "none")).toBe(true);
});
