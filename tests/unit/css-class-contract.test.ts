import { expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

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

/** styles.css only @imports the parts in src/styles/: follow them in order and join the contents. */
function readStyles(path: string): string {
  if (!existsSync(path)) throw new Error("Missing stylesheet: " + path);
  return readFileSync(path, "utf8").replace(/^@import "([^"]+)";\r?\n?/gm, (_, target: string) =>
    readStyles(join(dirname(path), target)),
  );
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

// P10-18e: the bundled fonts register "Inter Variable" / "Noto Sans JP Variable". A plain `Inter` or
// `"Noto Sans JP"` only works on a PC that has the font installed, so CI (and most users) got an OS font.
test("styles.css font-family never names Inter or Noto Sans JP without ' Variable'", () => {
  const css = readStyles("src/styles.css");
  const bad = [...css.matchAll(/font-family:\s*([^;]+);/g)]
    .map((match) => match[1])
    .filter((value) => /(["']?)(Inter|Noto Sans JP)\1(?!\s*Variable)/.test(value));
  expect(bad, "font-family values that do not use the bundled font names").toEqual([]);
});

test("every className string in src/**/*.tsx has a rule in styles.css", () => {
  const css = readStyles("src/styles.css");
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
