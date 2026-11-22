import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// V163-C6: WebView2 keeps its own list of values typed into a field and shows it under the field.
// The app already offers its own suggestions (the victory chips), so that list is noise: it grows
// forever and cannot be cleared from the app. Every text field must opt out with autoComplete="off".

/** Inputs that are not text fields: these have no saved-value list. */
const NON_TEXT_TYPES = new Set(["checkbox", "radio", "range", "file", "color"]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** Index of the `>` that closes the JSX tag starting at `start`, skipping strings and `{...}`. */
function tagEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = null;
    } else if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    } else if (character === ">" && depth === 0) {
      return index;
    }
  }
  throw new Error("Unterminated JSX tag at " + start);
}

test("every text input and textarea opts out of the browser's saved-value list", () => {
  const files = tsxFiles("src");
  expect(files.length).toBeGreaterThan(20);
  const missing: string[] = [];
  let checked = 0;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<(input|textarea)\b/g)) {
      const start = match.index;
      const tag = source.slice(start, tagEnd(source, start) + 1);
      if (match[1] === "input") {
        const type = /type="([^"]*)"/.exec(tag)?.[1] ?? "text";
        if (NON_TEXT_TYPES.has(type)) continue;
      }
      checked += 1;
      if (!/autoComplete="off"/.test(tag)) {
        const line = source.slice(0, start).split(/\r?\n/).length;
        missing.push(`${file}:${line}`);
      }
    }
  }

  expect(checked, "found some text fields to check").toBeGreaterThan(40);
  expect(missing, "text fields without autoComplete=\"off\"").toEqual([]);
});
