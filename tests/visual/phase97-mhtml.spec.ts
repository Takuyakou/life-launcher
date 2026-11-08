import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MhtmlLimits } from "../../src/mhtml/limits";
import type { InstructionEntry } from "../../src/types";
import { createPublicFixture, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P97-03: MHTML (Chrome/Edge "Webpage, Single File") opens in the instruction viewer,
// read-only, with the same sanitizer and iframe as HTML.

const ROOT = "C:\\PublicDemo\\Instructions";
const FIXTURE_ROOT = resolve("tests/fixtures/mhtml");

type Options = {
  limits?: Partial<MhtmlLimits>;
  tooLarge?: boolean;
  withTreeEntry?: boolean;
  path?: string;
};

function fixtureBytes(name: string): string {
  return readFileSync(resolve(FIXTURE_ROOT, name)).toString("base64");
}

function extraEntry(name: string): InstructionEntry {
  const path = `${ROOT}\\${name}`;
  const bytes = readFileSync(resolve(FIXTURE_ROOT, name));
  return {
    name,
    path,
    kind: "file",
    extension: name.split(".").at(-1)?.toLocaleLowerCase(),
    size: bytes.byteLength,
    modifiedAt: 1,
    readOnly: true,
  };
}

async function openViewer(page: Page, name: string, options: Options = {}): Promise<string> {
  const fixture: VisualQaFixture = createPublicFixture();
  const path = `${ROOT}\\${name}`;
  fixture.instructionBytes = { [path]: fixtureBytes(name) };
  if (options.tooLarge) fixture.instructionTooLargePaths = [path];
  if (options.withTreeEntry) fixture.instructionExtraEntries = [extraEntry(name)];
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (options.limits) {
    await page.addInitScript((limits: Partial<MhtmlLimits>) => {
      (window as unknown as { __LIFE_LAUNCHER_MHTML_LIMITS__?: Partial<MhtmlLimits> })
        .__LIFE_LAUNCHER_MHTML_LIMITS__ = limits;
    }, options.limits);
  }
  await installTauriMock(page, fixture, "life-launcher-instruction");
  const query = options.path ?? `/?view=instruction&path=${encodeURIComponent(path)}`;
  await page.goto(query);
  return path;
}

async function expectFrame(page: Page) {
  const frame = page.frameLocator(".instructionHtmlFrame");
  await expect(page.locator(".instructionHtmlFrame")).toBeVisible();
  return frame;
}

test("Chrome-style MHTML renders its text, cid and Content-Location images, and its CSS", async ({
  page,
}) => {
  await openViewer(page, "chrome-basic.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("MHTMLの見出し");
  await expect(frame.locator(".accent")).toHaveText("本文の段落です。");
  await expect(frame.locator(".accent")).toHaveCSS("color", "rgb(200, 30, 40)");

  const cidImage = frame.locator("#cid-image");
  await expect(cidImage).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect
    .poll(() => cidImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(frame.locator("#location-image")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  await expect(frame.locator("#hero-bg")).toHaveCSS("background-image", /data:image\/png/);
  // The remote url() is removed, not fetched.
  await expect(frame.locator("#remote-bg")).toHaveCSS("background-image", "none");

  // Scripts, event handlers and javascript: links are inert through the same HTML sanitizer.
  expect(
    await frame.locator("body").evaluate(
      () => (window as unknown as { __mhtmlUnsafe?: boolean }).__mhtmlUnsafe,
    ),
  ).toBeUndefined();
  expect(
    await frame
      .locator("#click-target")
      .evaluate((element) => element.hasAttribute("onclick")),
  ).toBe(false);
  expect(
    await frame.locator("#js-link").evaluate((element) => element.hasAttribute("href")),
  ).toBe(false);

  await expect(page.getByRole("button", { name: "手順書を編集" })).toHaveCount(0);
});

test("Shift_JIS MHTML text is decoded without mojibake", async ({ page }) => {
  await openViewer(page, "shift-jis.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("日本語の見出し");
  await expect(frame.locator("p")).toHaveText("シフトJISの本文です。");
});

for (const name of ["chrome-basic.mht", "chrome-basic-upper.MHTML"]) {
  test(`${name} opens like .mhtml`, async ({ page }) => {
    await openViewer(page, name);
    const frame = await expectFrame(page);
    await expect(frame.locator("h1")).toHaveText("MHTMLの見出し");
    await expect(page.getByRole("button", { name: "手順書を編集" })).toHaveCount(0);
  });
}

test("the tree lists MHTML with the HTML action and opens it from the row", async ({ page }) => {
  await openViewer(page, "chrome-basic.mhtml", {
    withTreeEntry: true,
    path: "/?view=instruction",
  });
  const row = page.locator(".instructionTreeRow", { hasText: "chrome-basic.mhtml" });
  await page.locator(".instructionTreeRow").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(row).toBeVisible();
  await row.click();
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("MHTMLの見出し");

  await row.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "手順書操作" });
  await expect(menu.getByRole("menuitem", { name: "ブラウザで開く" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "手順書を編集" })).toHaveCount(0);
});

test("a missing cid removes only that reference", async ({ page }) => {
  await openViewer(page, "missing-cid.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("参照先がない本文");
  await expect(frame.locator("#missing")).not.toHaveAttribute("src", /.*/);
});

test("a broken base64 image is skipped while the rest still renders", async ({ page }) => {
  await openViewer(page, "broken-base64.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("壊れた画像の横の本文");
  await expect(frame.locator("#broken")).not.toHaveAttribute("src", /.*/);
});

test("an embedded frame part is not used as the body", async ({ page }) => {
  await openViewer(page, "nested-frame.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("本文のページ");
  await expect(frame.getByText("入れ子のフレーム")).toHaveCount(0);
  await expect(frame.locator("iframe")).toHaveCount(0);
});

test("nested multipart is read up to depth 3", async ({ page }) => {
  await openViewer(page, "nested-multipart-depth3.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("深い本文");
});

test("arrow keys scroll the MHTML body like HTML", async ({ page }) => {
  await openViewer(page, "long.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("長いMHTML");
  await page.locator(".instructionDocument").focus();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => frame.locator("body").evaluate(() => Math.round(window.scrollY)))
    .toBe(40);
  await page.keyboard.press("End");
  await expect
    .poll(() => frame.locator("body").evaluate(() => Math.round(window.scrollY)))
    .toBeGreaterThan(100);
});

test("nested multipart deeper than 3 is rejected", async ({ page }) => {
  await openViewer(page, "nested-multipart-depth4.mhtml");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("このMHTMLファイルは表示できません");
  await expect(alert).toContainText("入れ子が深すぎます");
});

for (const [name, reason] of [
  ["broken-boundary.mhtml", "境界が途中で切れています"],
  ["not-multipart.mhtml", "multipartではありません"],
  ["no-html.mhtml", "本文のHTMLがありません"],
  ["too-many-parts.mhtml", "部分が多すぎます"],
] as const) {
  test(`${name} reports why it cannot be shown`, async ({ page }) => {
    await openViewer(page, name);
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("このMHTMLファイルは表示できません");
    await expect(alert).toContainText(reason);
  });
}

test("external images and CSS urls are not fetched", async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.invalid")) remoteRequests.push(request.url());
  });
  await openViewer(page, "external-refs.mhtml");
  const frame = await expectFrame(page);
  await expect(frame.locator("h1")).toHaveText("外部参照の本文");
  await expect(frame.locator("#external-image")).not.toHaveAttribute("src", /.*/);
  await expect(frame.locator("#external-bg")).toHaveCSS("background-image", "none");
  await page.waitForTimeout(300);
  expect(remoteRequests).toEqual([]);
});

test("the assembled HTML limit reports a too-large MHTML", async ({ page }) => {
  await openViewer(page, "many-image-refs.mhtml", { limits: { maxAssembledBytes: 5_000 } });
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("このMHTMLファイルは大きすぎるため表示できません");
});

test("assembly stops before outerHTML when the running size exceeds the limit", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { assembleMhtml } = await import("/src/mhtml/assembleMhtml.ts");
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "outerHTML");
    let outerHtmlRead = false;
    Object.defineProperty(Element.prototype, "outerHTML", {
      configurable: true,
      get() {
        outerHtmlRead = true;
        return descriptor?.get?.call(this);
      },
    });
    try {
      const references = Array.from(
        { length: 500 },
        (_, index) => `<img src="cid:big" id="i${index}">`,
      ).join("");
      const parsed = {
        html: `<html><body>${references}</body></html>`,
        baseUrl: null,
        resources: [
          {
            kind: "image" as const,
            mime: "image/png",
            contentId: "big",
            location: null,
            base64: "A".repeat(100_000),
          },
        ],
      };
      let code: string | null = null;
      try {
        assembleMhtml(parsed, {
          maxPartCount: 1_000,
          maxDepth: 3,
          maxDecodedBytes: 64 * 1024 * 1024,
          maxAssembledBytes: 150_000,
          timeoutMs: 10_000,
        });
      } catch (error) {
        code = (error as { code?: string }).code ?? String(error);
      }
      return { code, outerHtmlRead };
    } finally {
      if (descriptor) Object.defineProperty(Element.prototype, "outerHTML", descriptor);
    }
  });
  expect(result.code).toBe("too-large");
  expect(result.outerHtmlRead).toBe(false);
});

test("CSS url rewriting stops before building the whole string", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { assembleMhtml } = await import("/src/mhtml/assembleMhtml.ts");
    const originalReplace = String.prototype.replace;
    let urlReplacements = 0;
    Object.defineProperty(String.prototype, "replace", {
      configurable: true,
      writable: true,
      value: function (
        this: string,
        search: string | RegExp,
        replacement: string | ((...args: string[]) => string),
      ) {
        if (
          typeof replacement === "function" &&
          search instanceof RegExp &&
          search.source.includes("url")
        ) {
          const wrapped = (...args: string[]) => {
            urlReplacements += 1;
            return replacement(...args);
          };
          return originalReplace.call(this, search, wrapped);
        }
        return originalReplace.call(this, search, replacement);
      },
    });
    try {
      const references = Array.from(
        { length: 500 },
        () => "background-image:url(cid:big);",
      ).join("");
      const parsed = {
        html: `<html><head><style>${references}</style></head><body></body></html>`,
        baseUrl: null,
        resources: [
          {
            kind: "image" as const,
            mime: "image/png",
            contentId: "big",
            location: null,
            base64: "A".repeat(100_000),
          },
        ],
      };
      let code: string | null = null;
      try {
        assembleMhtml(parsed, {
          maxPartCount: 1_000,
          maxDepth: 3,
          maxDecodedBytes: 64 * 1024 * 1024,
          maxAssembledBytes: 150_000,
          timeoutMs: 10_000,
        });
      } catch (error) {
        code = (error as { code?: string }).code ?? String(error);
      }
      return { code, urlReplacements };
    } finally {
      Object.defineProperty(String.prototype, "replace", {
        configurable: true,
        writable: true,
        value: originalReplace,
      });
    }
  });
  expect(result.code).toBe("too-large");
  expect(result.urlReplacements).toBeLessThan(500);
});

test("the 20 MiB file limit reports the limit", async ({ page }) => {
  await openViewer(page, "chrome-basic.mhtml", { tooLarge: true });
  await expect(
    page.getByText("このMHTMLファイルは大きすぎるため表示できません（上限は20 MiBです）"),
  ).toBeVisible();
});

test("decoding stops with a message when the worker exceeds the time limit", async ({ page }) => {
  await openViewer(page, "chrome-basic.mhtml", { limits: { timeoutMs: 0 } });
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("このMHTMLファイルは表示できません");
  await expect(alert).toContainText("時間内に終わりませんでした");
});
