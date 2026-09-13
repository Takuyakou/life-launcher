import { expect, test, type Frame, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createPublicFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const FIXTURE_ROOT = resolve("tests/fixtures/instruction-html");
const HTML_PATH = resolve(FIXTURE_ROOT, "browser-parity/index.html");
const INSTRUCTION_PATH = "C:\\PublicDemo\\Instructions\\browser-parity\\index.html";
const ASSET_URL_PATTERN = "http://asset.localhost/instructions/**";

type LayoutSnapshot = {
  viewportWidth: number;
  bodyMargin: string;
  bodyBackground: string;
  bodyFontSize: string;
  gridColumns: string;
  gridDisplay: string;
  flexDisplay: string;
  flexGap: string;
  inlinePaddingTop: string;
  tableCellPadding: string;
  absolutePosition: string;
  absoluteTop: string;
  absoluteRight: string;
  imageWidth: number;
  backgroundImage: string;
};

async function routeInstructionAssets(page: Page): Promise<void> {
  await page.route(ASSET_URL_PATTERN, async (route) => {
    const url = new URL(route.request().url());
    const relative = decodeURIComponent(url.pathname.replace(/^\/instructions\//, ""));
    const candidate = resolve(FIXTURE_ROOT, relative);
    if (!candidate.startsWith(FIXTURE_ROOT)) {
      await route.abort("blockedbyclient");
      return;
    }
    const contentTypes: Record<string, string> = {
      ".css": "text/css",
      ".html": "text/html",
      ".png": "image/png",
    };
    await route.fulfill({
      body: readFileSync(candidate),
      contentType: contentTypes[extname(candidate)] ?? "application/octet-stream",
    });
  });
}

async function prepareViewer(page: Page, width: number, height: number): Promise<Frame> {
  const fixture = createPublicFixture();
  fixture.instructionDocuments = {
    [INSTRUCTION_PATH]: readFileSync(HTML_PATH, "utf8"),
  };
  await page.setViewportSize({ width, height });
  await routeInstructionAssets(page);
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto("/?view=instruction&path=" + encodeURIComponent(INSTRUCTION_PATH));
  const iframe = page.locator(".instructionHtmlFrame");
  await expect(iframe).toBeVisible();
  await expect
    .poll(() =>
      iframe.evaluate((element: HTMLIFrameElement) => element.contentDocument?.readyState),
    )
    .toBe("complete");
  const handle = await iframe.elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error("instruction HTML frame was not created");
  await expect
    .poll(() =>
      frame
        .locator("#relative-image")
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth),
    )
    .toBe(32);
  return frame;
}

async function snapshot(frame: Frame): Promise<LayoutSnapshot> {
  return frame.evaluate(() => {
    const computed = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error("Missing fixture selector: " + selector);
      return getComputedStyle(element);
    };
    const image = document.querySelector<HTMLImageElement>("#relative-image");
    if (!image) throw new Error("Missing relative image");
    return {
      viewportWidth: window.innerWidth,
      bodyMargin: computed("body").margin,
      bodyBackground: computed("body").backgroundColor,
      bodyFontSize: computed("body").fontSize,
      gridColumns: computed(".grid-probe").gridTemplateColumns,
      gridDisplay: computed(".grid-probe").display,
      flexDisplay: computed(".flex-row").display,
      flexGap: computed(".flex-row").gap,
      inlinePaddingTop: computed(".inline-probe").paddingTop,
      tableCellPadding: computed("td").padding,
      absolutePosition: computed(".absolute-probe").position,
      absoluteTop: computed(".absolute-probe").top,
      absoluteRight: computed(".absolute-probe").right,
      imageWidth: image.naturalWidth,
      backgroundImage: computed("#background-probe").backgroundImage,
    };
  });
}

function expectEquivalent(actual: LayoutSnapshot, baseline: LayoutSnapshot): void {
  expect(actual.viewportWidth).toBe(baseline.viewportWidth);
  expect(actual.bodyMargin).toBe(baseline.bodyMargin);
  expect(actual.bodyBackground).toBe(baseline.bodyBackground);
  expect(actual.bodyFontSize).toBe(baseline.bodyFontSize);
  expect(actual.gridColumns).toBe(baseline.gridColumns);
  expect(actual.gridDisplay).toBe(baseline.gridDisplay);
  expect(actual.flexDisplay).toBe(baseline.flexDisplay);
  expect(actual.flexGap).toBe(baseline.flexGap);
  expect(actual.inlinePaddingTop).toBe(baseline.inlinePaddingTop);
  expect(actual.tableCellPadding).toBe(baseline.tableCellPadding);
  expect(actual.absolutePosition).toBe(baseline.absolutePosition);
  expect(actual.absoluteTop).toBe(baseline.absoluteTop);
  expect(actual.absoluteRight).toBe(baseline.absoluteRight);
  expect(actual.imageWidth).toBe(baseline.imageWidth);
  expect(actual.backgroundImage).not.toBe("none");
}

for (const viewport of [
  { name: "wide", width: 1366, height: 768 },
  { name: "narrow", width: 860, height: 720 },
]) {
  test(
    "HTML preview matches direct Chromium layout at " + viewport.name,
    async ({ page, context }) => {
      const frame = await prepareViewer(page, viewport.width, viewport.height);
      const iframeBox = await page.locator(".instructionHtmlFrame").boundingBox();
      if (!iframeBox) throw new Error("instruction HTML frame has no bounding box");

      const direct = await context.newPage();
      await direct.setViewportSize({
        width: Math.round(iframeBox.width),
        height: Math.round(iframeBox.height),
      });
      const directHtml = readFileSync(HTML_PATH, "utf8").replace(
        "<head>",
        '<head><base href="http://127.0.0.1:1437/tests/fixtures/instruction-html/browser-parity/">',
      );
      await direct.setContent(directHtml, { waitUntil: "domcontentloaded" });
      await expect(direct.locator("#relative-image")).toHaveJSProperty("complete", true);

      expectEquivalent(await snapshot(frame), await snapshot(direct.mainFrame()));
      await expect(page.locator(".instructionDocument--html")).toHaveCSS("padding", "0px");
      expect(Math.round(iframeBox.width)).toBe(
        await page.locator(".instructionDocument--html").evaluate((element) => element.clientWidth),
      );
      await direct.close();
    },
  );
}

test("HTML preview keeps local assets but blocks active and remote content", async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.invalid")) remoteRequests.push(request.url());
  });
  const frame = await prepareViewer(page, 1080, 720);

  const browserButton = page.getByRole("button", { name: "ブラウザで開く" });
  await expect(browserButton).toBeVisible();
  await browserButton.hover();
  await expect(browserButton).toHaveAttribute("title", "ブラウザで開く");
  await browserButton.click();
  await expect(page.getByText("ブラウザで開きました", { exact: true })).toBeVisible();
  expect(await page.title()).toContain("Life Launcher 手順書ビューワー");
  expect(await frame.evaluate(() => document.doctype?.name)).toBe("html");
  expect(await frame.locator('meta[name="viewport"]').count()).toBe(1);
  expect(await frame.locator('meta[http-equiv="refresh"]').count()).toBe(0);
  expect(await frame.locator("script, form, input, button, iframe, object, embed").count()).toBe(0);
  expect(await frame.locator("#remote-image").getAttribute("src")).toBeNull();
  expect(await frame.locator("#event-probe").getAttribute("onclick")).toBeNull();
  expect(await frame.locator("link[href^='https://']").count()).toBe(0);
  expect(await frame.evaluate(() => Reflect.get(window, "__unsafe"))).toBeUndefined();
  expect(await page.evaluate(() => Reflect.get(window, "__instructionEscaped"))).toBeUndefined();
  expect(await frame.locator("#relative-image").getAttribute("src")).toBe("./assets/sample.png");
  expect(
    await frame
      .locator("a")
      .first()
      .evaluate((anchor: HTMLAnchorElement) => anchor.href),
  ).toBe("http://asset.localhost/instructions/browser-parity/linked.html");
  await page.waitForTimeout(100);
  expect(remoteRequests).toEqual([]);
});
