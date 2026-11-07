import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P97-02 B: 窓を動かせるのは上端の余白・上部メニューの行・ブランド表示だけ。
// .mainPanel / .sidebar そのものに付けると、内側の下端・右端の余白まで動いてしまう。

async function open(page: Page) {
  const fixture = createPublicFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1200, height: 680 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("only the top margins, the top bar and the brand block are drag regions", async ({ page }) => {
  await open(page);
  const hits = await page.evaluate(() => {
    const drag = (element: Element | null) =>
      Boolean(
        element &&
          (element.getAttribute("data-tauri-drag-region") === "" ||
            element.closest("[data-tauri-drag-region]") !== null),
      );
    const at = (x: number, y: number) => document.elementFromPoint(x, y);
    const panel = document.querySelector<HTMLElement>(".mainPanel")!.getBoundingClientRect();
    const sidebar = document.querySelector<HTMLElement>(".sidebar")!.getBoundingClientRect();
    const bar = document.querySelector<HTMLElement>(".mainPanel > .topBar")!.getBoundingClientRect();
    const groups = Array.from(document.querySelectorAll<HTMLElement>(".quickGroup"));
    const groupGapY =
      groups.length > 1
        ? (groups[0].getBoundingClientRect().bottom +
            groups[1].getBoundingClientRect().top) /
          2
        : sidebar.top + sidebar.height / 2;
    const timer = document.querySelector<HTMLElement>(".timerDock")!.getBoundingClientRect();
    return {
      panelTopMargin: drag(at(panel.left + panel.width / 2, panel.top + 4)),
      topBar: drag(at(panel.left + 120, bar.top + bar.height / 2)),
      panelBottom: drag(at(panel.left + panel.width / 2, panel.bottom - 3)),
      panelRight: drag(at(panel.right - 3, panel.top + panel.height / 2)),
      sidebarTop: drag(at(sidebar.left + sidebar.width / 2, sidebar.top + 6)),
      brand: drag(at(sidebar.left + 24, sidebar.top + 32)),
      sidebarGroupGap: drag(at(sidebar.left + sidebar.width / 2, groupGapY)),
      timerSurround: drag(at(sidebar.left + sidebar.width / 2, timer.top - 4)),
    };
  });
  expect(hits.panelTopMargin, "main panel top margin").toBe(true);
  expect(hits.topBar, "top bar").toBe(true);
  expect(hits.sidebarTop, "sidebar top margin").toBe(true);
  expect(hits.brand, "brand block").toBe(true);
  expect(hits.panelBottom, "main panel bottom margin").toBe(false);
  expect(hits.panelRight, "main panel right margin").toBe(false);
  expect(hits.sidebarGroupGap, "sidebar gap between the lists").toBe(false);
  expect(hits.timerSurround, "around the sidebar Timer").toBe(false);
});

test("the panel and the sidebar themselves do not carry the drag attribute", async ({ page }) => {
  await open(page);
  await expect(page.locator(".mainPanel")).not.toHaveAttribute("data-tauri-drag-region", "");
  await expect(page.locator(".sidebar")).not.toHaveAttribute("data-tauri-drag-region", "");
  await expect(page.locator(".panelDragStrip--main")).toHaveAttribute("data-tauri-drag-region", "");
  await expect(page.locator(".panelDragStrip--sidebar")).toHaveAttribute(
    "data-tauri-drag-region",
    "",
  );
});
