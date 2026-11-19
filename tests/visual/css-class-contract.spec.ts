import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// P10-18d: P10-15 deleted four settings classes that another screen still used, and nothing noticed.
// Every class written as a plain className="..." string in a .tsx must appear as ".name" in styles.css
// (or be a known marker-only class below).

/** Classes with no rule of their own: the look comes from other classes, or they are only markers. */
const MARKER_ONLY = new Set([
  "formError",
  "helpGuideBackdrop",
  "nextStepHeaderAdd",
  "searchPaletteGroupCount",
  "settingsToggle--wide",
  "timerProgress--mini",
  "todayHereBadge",
  "todayRemoveLabel",
  "topPillGroup--autostart",
  "topPillGroup--work",
]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

test("every className string in src/**/*.tsx has a rule in styles.css", () => {
  const css = readFileSync("src/styles.css", "utf8");
  const used = new Map<string, string>();
  for (const file of tsxFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/className="([^"{}$]+)"/g)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) {
        if (!used.has(name)) used.set(name, file);
      }
    }
  }
  expect(used.size, "found some classes to check").toBeGreaterThan(300);

  const missing = [...used]
    .filter(([name]) => !MARKER_ONLY.has(name))
    .filter(([name]) => !new RegExp(`\\.${name.replace(/[-]/g, "\\-")}(?![\\w-])`).test(css))
    .map(([name, file]) => `${name} (${file})`);
  expect(missing, "classes used in TSX but missing from styles.css").toEqual([]);
});
