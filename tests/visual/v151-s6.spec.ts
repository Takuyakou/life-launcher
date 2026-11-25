import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { measureRects, waitForStableRects } from "./helpers";
import { installTauriMock } from "./tauriMock";

const PROJECT = "サンプル学習";
const NEXT_STEP = "資料を1ページ読む";

async function open(
  page: Page,
  fixture: VisualQaFixture,
  size = { width: 1280, height: 800 },
  reducedMotion: "no-preference" | "reduce" = "no-preference",
) {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize(size);
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

// T1. 予定時間になりました ------------------------------------------------------------------

function oneMinuteFixture() {
  const fixture = createPickerFixture();
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  return fixture;
}

async function expireDoNowTimer(page: Page) {
  await page.locator(".doNowStartPrimary").click();
  await page.clock.fastForward(60_500);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((node) =>
    Promise.allSettled(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return dialog;
}

test("V151-S6 T1 the completion dialog leads with what happened, then what the timer was for", async ({ page }) => {
  await open(page, oneMinuteFixture());
  const dialog = await expireDoNowTimer(page);

  // 1. The title says what happened; the old English eyebrow is gone.
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("予定時間になりました");
  await expect(dialog.locator(".timerCompleteHeader .eyebrow")).toHaveText("Timer");
  await expect(dialog).not.toContainText("Timer Complete");

  // 2. The subject band holds the project, the planned minutes and the action.
  const subject = dialog.locator(".timerCompleteSubject");
  await expect(subject.locator(".projectIdentity")).toContainText(PROJECT);
  await expect(subject.locator(".timerCompleteMinutes")).toHaveText("予定 1分");
  await expect(subject.locator(".timerCompleteHeading")).toHaveText(NEXT_STEP);

  const s = ".timerCompleteDialog";
  const rects = await waitForStableRects(page, [
    s,
    `${s} .timerCompleteMark`,
    `${s} .timerCompleteHeader > div`,
    `${s} .timerCompleteHeader .eyebrow`,
    `${s} .timerCompleteText`,
    `${s} .timerCompleteSubject`,
    `${s} .timerCompleteSubject .projectIdentity`,
    `${s} .timerCompleteMinutes`,
    `${s} .timerCompleteHeading`,
  ]);
  const dialogBox = rects[s];
  const mark = rects[`${s} .timerCompleteMark`];
  const titleBox = rects[`${s} .timerCompleteHeader > div`];
  const eyebrow = rects[`${s} .timerCompleteHeader .eyebrow`];
  const title = rects[`${s} .timerCompleteText`];
  const band = rects[`${s} .timerCompleteSubject`];
  const identity = rects[`${s} .timerCompleteSubject .projectIdentity`];
  const minutes = rects[`${s} .timerCompleteMinutes`];
  const action = rects[`${s} .timerCompleteHeading`];

  expect(dialogBox.width).toBe(440);

  // Header: the round mark, 14px, then one box with "Timer" above the title.
  expect(Math.abs(titleBox.left - mark.right - 14)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(eyebrow.left - title.left)).toBeLessThanOrEqual(0.5);
  expect(eyebrow.bottom).toBeLessThanOrEqual(title.top + 0.5);
  expect(eyebrow.top).toBeGreaterThanOrEqual(titleBox.top - 0.5);
  expect(title.bottom).toBeLessThanOrEqual(titleBox.bottom + 0.5);

  // 3. "予定 N分" on the project's row at the right end; the action below across the band.
  const contentLeft = band.left + 1 + 14;
  const contentRight = band.right - 1 - 14;
  expect(Math.abs(minutes.right - contentRight)).toBeLessThanOrEqual(0.5);
  expect(minutes.left).toBeGreaterThan(identity.right);
  const identityMid = (identity.top + identity.bottom) / 2;
  const minutesMid = (minutes.top + minutes.bottom) / 2;
  expect(Math.abs(identityMid - minutesMid)).toBeLessThanOrEqual(1);
  expect(action.top).toBeGreaterThanOrEqual(Math.max(identity.bottom, minutes.bottom) - 0.5);
  expect(Math.abs(action.left - contentLeft)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(action.right - contentRight)).toBeLessThanOrEqual(0.5);

  // 4. The mark is a 40px circle in the timer yellow.
  expect(mark.width).toBe(40);
  expect(mark.height).toBe(40);
  await expect(dialog.locator(".timerCompleteMark")).toHaveCSS("color", "rgb(255, 206, 91)");
  await expect(dialog.locator(".timerCompleteMark")).toHaveCSS("border-radius", "50%");

  // Focus and buttons are unchanged.
  await expect(dialog.getByRole("button", { name: "続ける(+15分)" })).toBeFocused();
  // V163-B4: the extend stepper adds − / ＋ buttons, so look at the action row only.
  await expect(dialog.locator(".dialogActions").getByRole("button")).toHaveText([
    "続ける(+15分)",
    "終わる",
  ]);
});

test("V151-S6 T1 after 続ける(+15分) the band shows the extended minutes", async ({ page }) => {
  await open(page, oneMinuteFixture());
  const dialog = await expireDoNowTimer(page);
  await expect(dialog.locator(".timerCompleteMinutes")).toHaveText("予定 1分");
  await dialog.getByRole("button", { name: "続ける(+15分)" }).click();
  await expect(dialog).toHaveCount(0);
  await page.clock.fastForward(15 * 60_000);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".timerCompleteMinutes")).toHaveText("予定 16分");
  await expect(dialog.locator(".timerCompleteHeading")).toHaveText(NEXT_STEP);
});

test("V151-S6 T1 a long action and project name stay inside the dialog at the minimum window", async ({ page }) => {
  const fixture = oneMinuteFixture();
  fixture.config.projects[0].name =
    "とても長いプロジェクト名をここに書いて帯の一行目が予定の分数と重ならない事を確かめる";
  fixture.config.projects[0].nextStep!.text =
    "とても長い行動文をここに書いても、満了ダイアログの帯からはみ出したり操作ボタンに重なったりしないことを確かめるための、さらに長い文章です。三行で切れるはずです。";
  await open(page, fixture, { width: 860, height: 560 });
  const dialog = await expireDoNowTimer(page);
  const s = ".timerCompleteDialog";
  const rects = await waitForStableRects(page, [
    s,
    `${s} .timerCompleteSubject`,
    `${s} .timerCompleteSubject .projectIdentity`,
    `${s} .timerCompleteMinutes`,
    `${s} .timerCompleteHeading`,
    `${s} .secondaryButton--finish`,
  ]);
  const dialogBox = rects[s];
  expect(dialogBox.top).toBeGreaterThanOrEqual(0);
  expect(dialogBox.bottom).toBeLessThanOrEqual(560);
  expect(rects[`${s} .timerCompleteSubject`].right).toBeLessThanOrEqual(dialogBox.right);
  expect(rects[`${s} .timerCompleteSubject .projectIdentity`].right).toBeLessThanOrEqual(
    rects[`${s} .timerCompleteMinutes`].left,
  );
  expect(rects[`${s} .timerCompleteHeading`].bottom).toBeLessThanOrEqual(
    rects[`${s} .secondaryButton--finish`].top,
  );
  // Three lines and an ellipsis.
  const heading = dialog.locator(".timerCompleteHeading");
  const lines = await heading.evaluate((node) => {
    const style = getComputedStyle(node);
    return { height: node.getBoundingClientRect().height, line: parseFloat(style.lineHeight) };
  });
  expect(Math.round(lines.height / lines.line)).toBe(3);
  expect(await heading.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await expect(heading).toHaveCSS("-webkit-line-clamp", "3");
});

// T2. sidebar heading collapse ------------------------------------------------------------

const GROUP = "ショートカット";
const groupSel = `.sidebar .quickGroup:has(> .quickGroupHeader[title="${GROUP}"])`;
const nextHeaderSel = `${groupSel} + .quickGroup > .quickGroupHeader`;
const PRE_V151 =
  ".sidebar .quickGroup{gap:10px!important}.sidebar .quickGroupItems::before{display:none!important}";

async function nextHeaderTop(page: Page) {
  return (await measureRects(page, [nextHeaderSel]))[nextHeaderSel].top;
}

async function toggle(page: Page, expanded: "true" | "false") {
  const header = page.locator(`${groupSel} > .quickGroupHeader`);
  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", expanded);
  if (expanded === "false") {
    await expect(page.locator(`${groupSel} > .quickGroupItems`)).toHaveCount(0);
  }
  await waitForStableRects(page, [nextHeaderSel]);
}

test("V151-S6 T2 at rest the heading-to-button gap is 10px and the layout is unchanged", async ({ page }) => {
  await open(page, createFullTodayFixture());
  await expect(page.locator(groupSel)).toHaveCSS("row-gap", "0px");
  const first = `${groupSel} .quickButton`;
  const rects = await waitForStableRects(page, [`${groupSel} > .quickGroupHeader`, first, nextHeaderSel]);
  expect(Math.abs(rects[first].top - rects[`${groupSel} > .quickGroupHeader`].bottom - 10)).toBeLessThanOrEqual(0.5);

  const openTop = rects[nextHeaderSel].top;
  await toggle(page, "false");
  const closedTop = await nextHeaderTop(page);
  await toggle(page, "true");

  // The same positions with the pre-V151 rule (10px gap outside the collapsing box).
  const before = await page.addStyleTag({ content: PRE_V151 });
  await waitForStableRects(page, [nextHeaderSel]);
  expect(Math.abs((await nextHeaderTop(page)) - openTop)).toBeLessThanOrEqual(0.5);
  await toggle(page, "false");
  expect(Math.abs((await nextHeaderTop(page)) - closedTop)).toBeLessThanOrEqual(0.5);
  await before.evaluate((node) => node.remove());
});

/**
 * Records the box and the next heading right after the click, then after each 16ms step of the
 * paused page clock.
 */
async function recordFrames(page: Page, frames: number) {
  const samples: Array<{ hasItems: boolean; top: number }> = [];
  for (let frame = 0; frame < frames; frame += 1) {
    if (frame > 0) await page.clock.runFor(16);
    samples.push(
      await page.evaluate(
        ({ group, next }) => ({
          hasItems: Boolean(document.querySelector(`${group} > .quickGroupItems`)),
          top: document.querySelector(next)!.getBoundingClientRect().top,
        }),
        { group: groupSel, next: nextHeaderSel },
      ),
    );
  }
  return samples;
}

test("V151-S6 T2 closing and opening a sidebar heading has no 10px jump", async ({ page }) => {
  await open(page, createFullTodayFixture());
  const header = page.locator(`${groupSel} > .quickGroupHeader`);
  await expect(header).toHaveAttribute("aria-expanded", "true");
  await waitForStableRects(page, [nextHeaderSel]);

  const openTop = await nextHeaderTop(page);

  // Close: step the spring frame by frame until it settles. The box only leaves the DOM once the
  // clock runs again, so the first record without it is taken right after it is removed.
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await header.click();
  const closing = await recordFrames(page, 90);
  expect(closing.every((sample) => sample.hasItems)).toBe(true);
  // It really moved through intermediate positions.
  expect(closing.some((sample) => sample.top < openTop - 20 && sample.top > closing[89].top + 1)).toBe(true);
  await page.clock.resume();
  await expect(page.locator(`${groupSel} > .quickGroupItems`)).toHaveCount(0);
  const afterRemoval = await nextHeaderTop(page);
  expect.soft(
    Math.abs(afterRemoval - closing[89].top),
    `last frames ${JSON.stringify(closing.slice(85))} then ${afterRemoval}`,
  ).toBeLessThanOrEqual(2);

  // Open: the position before the click and the first frame with the box.
  const openPausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(openPausedAt);
  const beforeOpen = await nextHeaderTop(page);
  await header.click();
  const opening = await recordFrames(page, 90);
  const shown = opening.findIndex((sample) => sample.hasItems);
  expect(shown, JSON.stringify(opening)).toBeGreaterThanOrEqual(0);
  expect.soft(
    Math.abs(opening[shown].top - beforeOpen),
    `first frames ${JSON.stringify(opening.slice(0, shown + 3))}`,
  ).toBeLessThanOrEqual(4);
  expect(opening[opening.length - 1].top - beforeOpen).toBeGreaterThan(20);
});

// T2b / T2c. Do Now running buttons -------------------------------------------------------

const pause = (page: Page) => page.locator(".doNowActions .runningPauseButton");
const stop = (page: Page) => page.locator(".doNowActions .runningStopButton");

/** P10-14e (1): the play glyph sits left of the label and shares its centre line. */
async function expectStartIconAligned(page: Page) {
  for (const selector of [".doNowStartPrimary", ".doNowStartSecondary"]) {
    const button = page.locator(selector);
    if ((await button.count()) === 0) continue;
    const glyph = await button.locator(".timerStartHoverGlyph").boundingBox();
    const label = await button.locator(".timerStartDuration").boundingBox();
    expect(glyph, selector).not.toBeNull();
    expect(label, selector).not.toBeNull();
    expect(glyph!.x + glyph!.width, selector).toBeLessThanOrEqual(label!.x);
    expect(
      Math.abs(glyph!.y + glyph!.height / 2 - (label!.y + label!.height / 2)),
      selector,
    ).toBeLessThanOrEqual(2);
  }
}

async function startDoNow(page: Page) {
  await expectStartIconAligned(page);
  await page.locator(".doNowStartPrimary").click();
  await expect(pause(page)).toBeVisible();
  await page.mouse.move(0, 0);
}

/** Left gap from the box to the icon and right gap from the label's end to the box. */
function sidePadding(button: Locator) {
  return button.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const icon = node.querySelector(".uiIcon")!.getBoundingClientRect();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    while (walker.nextNode()) {
      if ((walker.currentNode as Text).data.trim()) last = walker.currentNode as Text;
    }
    const range = document.createRange();
    range.selectNodeContents(last!);
    const text = range.getBoundingClientRect();
    return {
      left: icon.left - box.left,
      right: box.right - text.right,
      overflow: node.scrollWidth - node.clientWidth,
      width: box.width,
    };
  });
}

test("V151-S6 T2b the running buttons fit their labels and 再開 keeps the row still", async ({ page }) => {
  await open(page, createPickerFixture(), { width: 1280, height: 760 });
  await startDoNow(page);
  await expect(pause(page)).toContainText("一時停止");

  for (const button of [pause(page), stop(page)]) {
    const padding = await sidePadding(button);
    expect(padding.overflow, JSON.stringify(padding)).toBeLessThanOrEqual(0);
    expect(padding.left, JSON.stringify(padding)).toBeGreaterThanOrEqual(16);
    expect(padding.right, JSON.stringify(padding)).toBeGreaterThanOrEqual(16);
  }
  const s = ".doNowActions";
  const running = await waitForStableRects(page, [`${s} .runningPauseButton`, `${s} .runningStopButton`]);
  expect(running[`${s} .runningPauseButton`].width).toBe(128);
  expect(running[`${s} .runningPauseButton`].height).toBe(48);

  await pause(page).click();
  await expect(pause(page)).toContainText("再開");
  await page.mouse.move(0, 0);
  const paused = await waitForStableRects(page, [`${s} .runningPauseButton`, `${s} .runningStopButton`]);
  expect(paused[`${s} .runningPauseButton`].width).toBe(128);
  expect(
    Math.abs(paused[`${s} .runningStopButton`].left - running[`${s} .runningStopButton`].left),
  ).toBeLessThanOrEqual(0.5);
});

const transformOf = (button: Locator, pseudo?: "::after") =>
  button.evaluate((node, which) => getComputedStyle(node, which ?? null).transform, pseudo);
const shadowOf = (button: Locator) => button.evaluate((node) => getComputedStyle(node).boxShadow);

async function expectLifted(button: Locator) {
  await expect.poll(() => transformOf(button)).toBe("matrix(1, 0, 0, 1, 0, -1)");
  await expect.poll(() => transformOf(button, "::after")).toBe("matrix(1, 0, 0, 1, 0, 0)");
  expect(await shadowOf(button)).not.toBe("none");
}

async function expectResting(button: Locator) {
  await expect.poll(() => transformOf(button)).toBe("none");
  await expect.poll(() => transformOf(button, "::after")).toBe("matrix(0, 0, 0, 1, 0, 0)");
}

test("V151-S6 T2c hovering or focusing the running buttons lifts them like the start buttons", async ({ page }) => {
  await open(page, createPickerFixture(), { width: 1280, height: 760 });
  await startDoNow(page);
  for (const button of [pause(page), stop(page)]) {
    await expectResting(button);
    await button.hover();
    await expectLifted(button);
    await page.mouse.move(0, 0);
    await expectResting(button);
  }
  // Keyboard focus (:focus-visible) shows the same lift.
  await pause(page).focus();
  await page.keyboard.press("Tab");
  await expect(stop(page)).toBeFocused();
  await expectLifted(stop(page));
  await page.keyboard.press("Shift+Tab");
  await expect(pause(page)).toBeFocused();
  await expectLifted(pause(page));
  await expectResting(stop(page));
});

test("V151-S6 T2c with reduced motion the running buttons do not move but still show the line", async ({ page }) => {
  await open(page, createPickerFixture(), { width: 1280, height: 760 }, "reduce");
  await startDoNow(page);
  for (const button of [pause(page), stop(page)]) {
    const restingBg = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
    await button.hover();
    await expect.poll(() => transformOf(button, "::after")).toBe("matrix(1, 0, 0, 1, 0, 0)");
    await expect
      .poll(() => button.evaluate((node) => getComputedStyle(node).backgroundColor))
      .not.toBe(restingBg);
    expect(await transformOf(button)).toBe("none");
    await page.mouse.move(0, 0);
  }
});
