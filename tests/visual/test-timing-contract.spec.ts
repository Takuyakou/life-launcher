import { expect, test } from "@playwright/test";
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
