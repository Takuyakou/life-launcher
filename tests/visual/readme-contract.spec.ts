import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;
const readmes = ["README.md", "README.en.md"];

for (const file of readmes) {
  test(`${file} describes current downloads and links to existing local documents`, () => {
    const text = readFileSync(file, "utf8");
    expect(text).toContain("https://github.com/Takuyakou/life-launcher/releases/latest");
    expect(text).not.toContain("releases/tag/v1.0.0");
    for (const suffix of ["-setup.exe", ".exe", "-portable.zip"]) {
      expect(text).toContain(`Life-Launcher-v${version}-windows-x64${suffix}`);
    }
    expect(text).toContain("SHA256SUMS.txt");
    expect(text).toContain("%APPDATA%\\life-launcher");
    expect(text).toContain("SmartScreen");
    expect(text).toContain("source key");
    const paths = [
      ...Array.from(text.matchAll(/\]\(([^)]+)\)/g), (match) => match[1]),
      ...Array.from(text.matchAll(/src="([^"]+)"/g), (match) => match[1]),
    ].filter((path) => !/^https?:/.test(path));
    for (const path of paths) {
      expect(existsSync(resolve(path)), `${file}: missing ${path}`).toBe(true);
    }
  });
}

test("Japanese and English READMEs share the same downloads and images", () => {
  const extract = (file: string) => {
    const text = readFileSync(file, "utf8");
    return Array.from(text.matchAll(/https:\/\/github\.com\/Takuyakou\/life-launcher\/releases\/[^)\s]+|docs\/screenshots\/[\w.-]+\.png/g), match => match[0]).sort();
  };
  expect(extract(readmes[0])).toEqual(extract(readmes[1]));
});
