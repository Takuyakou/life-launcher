import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Candidate = VisualQaFixture["doNowCandidates"][number];
type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => unknown;
    updateConfig: (config: unknown) => void;
    setDoNowCandidates: (candidates: Candidate[]) => void;
    invokeCalls: Array<{ command: string }>;
  };
};

const LEARNING = "sample-learning";
const STRETCH = "sample-stretch";
const WRITING = "sample-writing";

const candidate = (projectId: string, reason: string, restartEligible = false) =>
  ({ projectId, reason, restartEligible }) as Candidate;

async function prepare(page: Page, candidates: Candidate[], fixture = createFullTodayFixture()) {
  fixture.doNowCandidates = candidates;
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowContent")).toBeVisible();
}

const loadCount = (page: Page) =>
  page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "load_do_now_candidates",
      ).length,
  );

const reason = (page: Page) => page.locator(".doNowReason");

/** Replace the mocked Rust answer and make the app reload (an external config change event). */
async function changeCandidates(page: Page, candidates: Candidate[]) {
  await page.evaluate((next) => {
    const qa = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    qa.setDoNowCandidates(next);
    qa.updateConfig(structuredClone(qa.currentConfig()));
  }, candidates);
}

test("P9-05 a today3 candidate says it is in Today3, and the older reasons keep their priority", async ({
  page,
}) => {
  await prepare(page, [candidate(LEARNING, "today3"), candidate(STRETCH, "noToday")]);
  await expect(reason(page)).toHaveText("今日の3件に入っている一手です");

  // "Other step" keeps its own sentence.
  await page.locator(".doNowAlternateButton").click();
  await expect(reason(page)).toHaveText("今の状況から選んだ別の候補です");
});

test("P9-05 the restart guidance after 14 idle days outranks the Today3 reason", async ({
  page,
}) => {
  await prepare(page, [candidate(LEARNING, "today3", true), candidate(STRETCH, "noToday")]);
  await expect(reason(page)).toHaveText("14日以上空いているため、短時間から再開できます");
});

test("P9-05 every Today3 change asks for the candidates again", async ({ page }) => {
  await prepare(page, [candidate(LEARNING, "today3"), candidate(STRETCH, "noToday")]);
  const refreshed = async (action: () => Promise<void>) => {
    const before = await loadCount(page);
    await action();
    await expect.poll(() => loadCount(page)).toBeGreaterThan(before);
  };

  // reorder
  await refreshed(async () => {
    await page.locator(".todayRow").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "右へ移動" }).click();
  });
  // remove
  await refreshed(async () => {
    await page.locator(".todayRemoveButton").nth(1).click();
  });
  // add (the Today3 now has an empty slot, so the picker entry is shown)
  await refreshed(async () => {
    await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
    const picker = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
    // The third item closes the picker by itself.
    await picker.getByRole("button", { name: "＋ 今日へ" }).first().click();
    await expect(picker).toHaveCount(0);
  });
  // complete
  await refreshed(async () => {
    const row = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
    await row.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
    await page.clock.runFor(60_500);
    await page
      .getByRole("dialog", { name: "タイマー満了" })
      .getByRole("button", { name: /続ける/ })
      .click();
    await page.locator(".timerDock").getByRole("button", { name: "終了" }).click();
    await page
      .getByRole("dialog", { name: "今日の分は完了にしますか？" })
      .getByRole("button", { name: "今日の分は完了" })
      .click();
    await expect(row).toHaveClass(/todayRow--complete/);
  });
});

test("P9-05 refreshing the candidates keeps the completed Do Now hold until it is acknowledged", async ({
  page,
}) => {
  await prepare(page, [candidate(LEARNING, "today3"), candidate(STRETCH, "noToday")]);
  await page.locator(".doNowStartPrimary").click();
  await page.clock.runFor(60_500);
  await page
    .getByRole("dialog", { name: "タイマー満了" })
    .getByRole("button", { name: /続ける/ })
    .click();
  await page.locator(".todayRow").first().locator(".runningStopButton").click();
  const hold = page.locator(".doNowContent--hold");
  await expect(hold).toContainText("✓ 一手進みました");

  const before = await loadCount(page);
  await changeCandidates(page, [candidate(STRETCH, "noToday"), candidate(LEARNING, "today3")]);
  await expect.poll(() => loadCount(page)).toBeGreaterThan(before);
  await expect(hold).toContainText("✓ 一手進みました");

  await hold.getByRole("button", { name: "次の一手を見る" }).click();
  await expect(hold).toHaveCount(0);
});

test("P9-05 a candidate picked with the other-step button returns to the first one when it disappears", async ({
  page,
}) => {
  const all = [candidate(LEARNING, "today3"), candidate(STRETCH, "noToday"), candidate(WRITING, "noToday")];
  await prepare(page, all);
  await page.locator(".doNowAlternateButton").click();
  await expect(page.locator(".doNowContent")).toContainText("5分だけ体を動かす");

  await changeCandidates(page, [candidate(LEARNING, "today3"), candidate(WRITING, "noToday")]);
  await expect(page.locator(".doNowContent")).toContainText("資料を1ページ読む");
  await expect(reason(page)).toHaveText("今日の3件に入っている一手です");
});

test("P9-05 a picked candidate stays the same Project when the order changes its position", async ({
  page,
}) => {
  const all = [candidate(LEARNING, "today3"), candidate(STRETCH, "noToday"), candidate(WRITING, "noToday")];
  await prepare(page, all);
  await page.locator(".doNowAlternateButton").click();
  await expect(page.locator(".doNowContent")).toContainText("5分だけ体を動かす");

  // The picked Project (stretch) moves from index 1 to the last place.
  await changeCandidates(page, [candidate(WRITING, "today3"), candidate(LEARNING, "noToday"), candidate(STRETCH, "noToday")]);
  await expect(page.locator(".doNowContent")).toContainText("5分だけ体を動かす");
  await expect(page.locator(".doNowContent")).not.toContainText("見出しを3つ書き出す");

  // ... to the first place: still shown, now as the first candidate.
  await changeCandidates(page, [candidate(STRETCH, "today3"), candidate(WRITING, "noToday"), candidate(LEARNING, "noToday")]);
  await expect(page.locator(".doNowContent")).toContainText("5分だけ体を動かす");
  await expect(reason(page)).toHaveText("今日の3件に入っている一手です");

  // ... and a shorter list that still offers it.
  await changeCandidates(page, [candidate(LEARNING, "noToday"), candidate(STRETCH, "noToday")]);
  await expect(page.locator(".doNowContent")).toContainText("5分だけ体を動かす");
});

test("P9-05 once a picked candidate has disappeared it stays on the first candidate even if it returns", async ({
  page,
}) => {
  const all = [candidate(LEARNING, "today3"), candidate(STRETCH, "noToday"), candidate(WRITING, "noToday")];
  await prepare(page, all);
  await page.locator(".doNowAlternateButton").click();
  await expect(page.locator(".doNowContent")).toContainText("5分だけ体を動かす");

  await changeCandidates(page, [candidate(LEARNING, "today3"), candidate(WRITING, "noToday")]);
  await expect(page.locator(".doNowContent")).toContainText("資料を1ページ読む");
  await changeCandidates(page, all);
  await expect(page.locator(".doNowContent")).toContainText("資料を1ページ読む");
});

test("P9-05 other-step cycling continues from the picked Project and wraps to the first candidate", async ({
  page,
}) => {
  const all = [candidate(LEARNING, "today3"), candidate(STRETCH, "noToday"), candidate(WRITING, "noToday")];
  await prepare(page, all);
  const next = page.locator(".doNowAlternateButton");
  await next.click();
  await expect(page.locator(".doNowContent")).toContainText("5分だけ体を動かす");
  await next.click();
  await expect(page.locator(".doNowContent")).toContainText("見出しを3つ書き出す");
  await next.click();
  await expect(page.locator(".doNowContent")).toContainText("資料を1ページ読む");
  await expect(reason(page)).toHaveText("今日の3件に入っている一手です");
});
