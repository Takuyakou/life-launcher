import { expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// V151-S1: timing-dependent sleeps in Playwright tests caused intermittent CI failures across runs.
// Fixed sleeps (waitForTimeout) are forbidden under tests/visual/, and setTimeout is only allowed
// inside simulated-latency stubs with an explicit "// simulated-latency" comment on the same line.

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

test("tests/visual contains no waitForTimeout and only explicitly marked simulated-latency setTimeout calls", () => {
  const files = tsFiles("tests/visual");
  expect(files.length).toBeGreaterThan(20);

  const waitForTimeoutHits: string[] = [];
  const unmarkedSetTimeoutHits: string[] = [];

  for (const file of files) {
    if (file.endsWith("test-timing-contract.spec.ts")) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes("waitForTimeout(")) {
        waitForTimeoutHits.push(`${file}:${index + 1}`);
      }
      if (line.includes("setTimeout(") && !/\/\/\s*simulated-latency\b/.test(line)) {
        unmarkedSetTimeoutHits.push(`${file}:${index + 1}`);
      }
    });
  }

  expect(waitForTimeoutHits, "waitForTimeout( is forbidden in tests/visual").toEqual([]);
  expect(
    unmarkedSetTimeoutHits,
    "setTimeout( without // simulated-latency is forbidden in tests/visual",
  ).toEqual([]);
});

// V151-S8: the bundled fonts load by Unicode range, so `document.fonts.ready` alone can let a test
// measure text in a fallback face. Every spec that measures geometry or compares screenshots must
// call waitForBundledFonts at least once.
const FONT_WAIT_EXCLUSIONS: Record<string, string> = {
  "test-timing-contract.spec.ts": "reads source files only; it names these APIs as text",
};

test("specs that measure layout or compare screenshots wait for the bundled fonts", () => {
  const specs = readdirSync("tests/visual").filter((name) => name.endsWith(".spec.ts"));
  expect(specs.length).toBeGreaterThan(20);
  const missing = specs.filter((name) => {
    if (name in FONT_WAIT_EXCLUSIONS) return false;
    const source = readFileSync(join("tests/visual", name), "utf8");
    const measures = /boundingBox\(|getBoundingClientRect|toHaveScreenshot/.test(source);
    return measures && !source.includes("waitForBundledFonts(");
  });
  expect(missing, "specs that measure text must call waitForBundledFonts(page)").toEqual([]);
});
