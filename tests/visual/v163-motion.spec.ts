import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { bookPages, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// V163-M1〜M3: the moves run with motion; with reduced motion they finish at once. The page clock
// is paused, so requestAnimationFrame (and motion) only moves when the test runs the clock.

const DOC_PATH = "C:\\PublicDemo\\Instructions\\welcome.md";

async function openViewer(page: Page, reducedMotion: "reduce" | "no-preference") {
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.emulateMedia({ reducedMotion });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createPublicFixture(), "life-launcher-instruction");
  await page.goto(`/?view=instruction&path=${encodeURIComponent(DOC_PATH)}`);
  await waitForBundledFonts(page);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await expect(page.locator(".instructionSidebar")).toBeVisible();
}

const sidebarState = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".instructionSidebarFrame")!;
    const aside = document.querySelector<HTMLElement>(".instructionSidebar")!;
    return {
      frame: frame.getBoundingClientRect().width,
      hidden: aside.hidden,
      ariaHidden: aside.getAttribute("aria-hidden"),
      inert: aside.hasAttribute("inert"),
      bar: Boolean(document.querySelector(".instructionSidebarCollapsedBar")),
    };
  });

test("V163-M1 the list frame springs shut and open, then rests like before", async ({ page }) => {
  await openViewer(page, "no-preference");
  const open = await sidebarState(page);
  expect(open).toMatchObject({ hidden: false, ariaHidden: null, inert: false, bar: false });

  await page.getByRole("button", { name: "手順書一覧を閉じる" }).click();
  await page.clock.runFor(60);
  const middle = await sidebarState(page);
  // Half way: narrower than the list, wider than the bar; the list is still drawn but inert.
  expect(middle.frame).toBeLessThan(open.frame - 1);
  expect(middle.frame).toBeGreaterThan(28 + 1);
  expect(middle).toMatchObject({ hidden: false, ariaHidden: "true", inert: true, bar: true });

  await page.clock.runFor(500);
  const closed = await sidebarState(page);
  expect(Math.round(closed.frame)).toBe(28);
  expect(closed).toMatchObject({ hidden: true, ariaHidden: "true", inert: true, bar: true });
  await expect(page.getByRole("button", { name: "手順書一覧を開く" })).toBeFocused();

  await page.getByRole("button", { name: "手順書一覧を開く" }).click();
  await page.clock.runFor(60);
  const opening = await sidebarState(page);
  expect(opening.frame).toBeGreaterThan(28 + 1);
  expect(opening.frame).toBeLessThan(open.frame - 1);
  await page.clock.runFor(500);
  const reopened = await sidebarState(page);
  expect(Math.round(reopened.frame)).toBe(Math.round(open.frame));
  expect(reopened).toMatchObject({ hidden: false, ariaHidden: null, inert: false, bar: false });
  await expect(page.getByRole("button", { name: "手順書一覧を閉じる" })).toBeFocused();
});

test("V163-M1 with reduced motion the list opens and closes at once", async ({ page }) => {
  await openViewer(page, "reduce");
  const open = await sidebarState(page);
  await page.getByRole("button", { name: "手順書一覧を閉じる" }).click();
  await page.clock.runFor(20);
  const closed = await sidebarState(page);
  expect(Math.round(closed.frame)).toBe(28);
  expect(closed).toMatchObject({ hidden: true, ariaHidden: "true", inert: true, bar: true });
  await expect(page.getByRole("button", { name: "手順書一覧を開く" })).toBeFocused();

  await page.getByRole("button", { name: "手順書一覧を開く" }).click();
  await page.clock.runFor(20);
  const reopened = await sidebarState(page);
  expect(Math.round(reopened.frame)).toBe(Math.round(open.frame));
  expect(reopened).toMatchObject({ hidden: false, ariaHidden: null, inert: false, bar: false });
  await expect(page.getByRole("button", { name: "手順書一覧を閉じる" })).toBeFocused();
});

test("V163-M1 resizing with the keys follows on the next frame (no spring)", async ({ page }) => {
  await openViewer(page, "no-preference");
  const divider = page.locator(".instructionSidebarDivider");
  await divider.focus();
  await divider.press("Home");
  const width = await page
    .locator(".instructionSidebar")
    .evaluate((aside) => aside.getBoundingClientRect().width);
  expect(Math.round(width)).toBe(140);
  // The frame follows on the next animation frame (no spring).
  await page.clock.runFor(20);
  const frame = await page
    .locator(".instructionSidebarFrame")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(Math.round(frame)).toBe(147);
});

// ---- V163-M2: the sliding face is only seen while it moves; at rest the chosen control looks as before.

async function openMain(page: Page, reducedMotion: "reduce" | "no-preference") {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects[0].nextStep = undefined;
  fixture.config.inbox = [{ id: "wish-a", text: "同じプロジェクトの候補A", projectId: "sample-learning" }];
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
}

const movingFaces = (page: Page, selector: string) =>
  page.evaluate(
    (faceSelector) =>
      Array.from(document.querySelectorAll<HTMLElement>(faceSelector)).map((face) => ({
        moving: face.hasAttribute("data-moving"),
        visibility: getComputedStyle(face).visibility,
      })),
    selector,
  );

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`V163-M2 the settings tab face slides only while it moves (${reducedMotion})`, async ({ page }) => {
    await openMain(page, reducedMotion);
    await page.getByRole("button", { name: "設定を開く" }).click();
    await page.clock.runFor(600);
    const settings = page.getByRole("dialog", { name: "設定" });
    expect(await movingFaces(page, ".settingsTabFace")).toEqual([{ moving: false, visibility: "hidden" }]);

    await settings.getByRole("tab", { name: "ショートカット" }).click();
    await page.clock.runFor(60);
    const middle = await movingFaces(page, ".settingsTabFace");
    if (reducedMotion === "reduce") {
      expect(middle).toEqual([{ moving: false, visibility: "hidden" }]);
    } else {
      expect(middle).toEqual([{ moving: true, visibility: "visible" }]);
    }
    await page.clock.runFor(600);
    expect(await movingFaces(page, ".settingsTabFace")).toEqual([{ moving: false, visibility: "hidden" }]);
    const active = settings.getByRole("tab", { name: "ショートカット" });
    await expect(active).toHaveAttribute("aria-selected", "true");
    // At rest the chosen tab draws its own accent frame, as before.
    const colors = await active.evaluate((tab) => ({
      border: getComputedStyle(tab).borderTopColor,
      accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    }));
    expect(colors.accent).not.toBe("");
    expect(colors.border).not.toBe("rgba(0, 0, 0, 0)");
  });
}

test("V163-M2 the next step mode face slides between the two modes", async ({ page }) => {
  await openMain(page, "no-preference");
  const card = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  await card.getByRole("button", { name: "次の一手を設定", exact: true }).click();
  await page.clock.runFor(600);
  const dialog = page.getByRole("dialog", { name: "次の一手を設定" });
  await expect(dialog.getByRole("tab", { name: /やりたいことから選ぶ/ })).toHaveAttribute("aria-selected", "true");
  expect(await movingFaces(page, ".nextStepModeFace")).toEqual([{ moving: false, visibility: "hidden" }]);

  await dialog.getByRole("tab", { name: /新しく入力/ }).click();
  await page.clock.runFor(60);
  expect(await movingFaces(page, ".nextStepModeFace")).toEqual([{ moving: true, visibility: "visible" }]);
  await page.clock.runFor(600);
  expect(await movingFaces(page, ".nextStepModeFace")).toEqual([{ moving: false, visibility: "hidden" }]);
  await expect(dialog.getByRole("tab", { name: /新しく入力/ })).toHaveAttribute("aria-selected", "true");
});

test("V163-M2 the book spread and direction faces slide only while they move", async ({ page }) => {
  const bookPath = "C:\\PublicDemo\\Instructions\\drill.zip";
  const fixture = createPublicFixture();
  fixture.instructionExtraEntries = [
    { name: "drill.zip", path: bookPath, kind: "file", extension: "zip", size: 1024, modifiedAt: 5, readOnly: true },
  ];
  fixture.instructionBookPages = { [bookPath]: { pages: bookPages(10) } };
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto(`/?view=instruction&path=${encodeURIComponent(bookPath)}`);
  await waitForBundledFonts(page);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await expect(page.locator(".bookPane")).toBeVisible();
  expect(await movingFaces(page, ".bookSegFace")).toEqual([
    { moving: false, visibility: "hidden" },
    { moving: false, visibility: "hidden" },
  ]);

  await page.getByRole("button", { name: "1ページ", exact: true }).click();
  await page.clock.runFor(60);
  // The spread face slides to 1ページ. (The direction toggle may move with the toolbar, and its
  // face follows it the same way.)
  const single = page.getByRole("button", { name: "1ページ", exact: true }).locator(".bookSegFace");
  await expect(single).toHaveAttribute("data-moving", "");
  await expect(single).toHaveCSS("visibility", "visible");
  await page.clock.runFor(600);
  expect((await movingFaces(page, ".bookSegFace")).every((face) => !face.moving)).toBe(true);

  await page.getByRole("button", { name: "左から右", exact: true }).click();
  await page.clock.runFor(60);
  await expect(
    page.getByRole("button", { name: "左から右", exact: true }).locator(".bookSegFace"),
  ).toHaveAttribute("data-moving", "");
  await page.clock.runFor(600);
  expect((await movingFaces(page, ".bookSegFace")).every((face) => !face.moving)).toBe(true);
  await expect(page.getByRole("button", { name: "左から右", exact: true })).toHaveAttribute("aria-pressed", "true");
});
