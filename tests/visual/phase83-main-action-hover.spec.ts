import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type ActionStyle = {
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
  color: string;
  height: number;
  transform: string;
  transitionProperty: string;
  width: number;
};

function actionFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.projects[1].nextStep = undefined;
  fixture.config.today.candidateExcludedSourceKeys = ["wishlist:sample-later"];
  fixture.doNowCandidates = fixture.doNowCandidates.filter(
    (candidate) => candidate.projectId === "sample-learning",
  );
  fixture.staleProjectIds = ["sample-learning"];
  return fixture;
}

async function prepare(
  page: Page,
  fixture = actionFixture(),
  width = 1440,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
) {
  await page.emulateMedia({ reducedMotion });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function readStyle(locator: Locator): Promise<ActionStyle> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const htmlElement = element as HTMLElement;
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      color: style.color,
      height: htmlElement.offsetHeight,
      transform: style.transform,
      transitionProperty: style.transitionProperty,
      width: htmlElement.offsetWidth,
    };
  });
}

async function expectActionHover(locator: Locator) {
  const initial = await readStyle(locator);
  await locator.hover();
  await expect.poll(async () => (await readStyle(locator)).backgroundColor).not.toBe(initial.backgroundColor);
  const hovered = await readStyle(locator);
  expect(hovered.transform).not.toBe("none");
  expect(hovered.backgroundColor).not.toBe(initial.backgroundColor);
  expect(hovered.borderColor).not.toBe(initial.borderColor);
  expect(hovered.boxShadow).not.toBe("none");
  expect(hovered.width).toBe(initial.width);
  expect(hovered.height).toBe(initial.height);
  return { hovered, initial };
}

test("P83-03 gold and neutral actions respond to hover, focus and press without resizing", async ({ page }) => {
  await prepare(page);
  const gold = page.locator(".nextStepHeaderAdd--project");
  const neutral = page.locator(".nextStepRowAction").first();
  expect((await readStyle(gold)).backgroundColor).not.toBe((await readStyle(neutral)).backgroundColor);
  for (const action of [gold, neutral]) {
    await page.mouse.move(1, 1);
    const { initial } = await expectActionHover(action);
    await page.mouse.move(1, 1);
    await action.focus();
    await expect(action).toBeFocused();
    await expect.poll(async () => (await readStyle(action)).boxShadow).not.toBe("none");
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect.poll(() => action.evaluate((node) =>
      new DOMMatrixReadOnly(getComputedStyle(node).transform).a,
    )).toBeLessThan(1);
    const pressed = await readStyle(action);
    expect(pressed.width).toBe(initial.width);
    expect(pressed.height).toBe(initial.height);
    await page.mouse.move(1, 1);
    await page.mouse.up();
    await action.evaluate((node) => (node as HTMLElement).blur());
  }
});

test("P83-03 reduced motion actions never move", async ({ page }) => {
  const fixture = actionFixture();
  fixture.config.today.items.push({
    text: "3件目のサンプル",
    done: false,
    sourceKey: "manual:p83-disabled",
  });
  await prepare(page, fixture, 1440, "reduce");

  const enabled = page.locator(".nextStepRowAction").first();
  await enabled.hover();
  await page.waitForTimeout(140);
  const reduced = await readStyle(enabled);
  expect(reduced.transform).toBe("none");
  expect(reduced.transitionProperty).not.toContain("transform");
});
