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

test("release metadata and notes share the package version", () => {
  const cargoManifest = readFileSync("src-tauri/Cargo.toml", "utf8");
  const cargoLock = readFileSync("src-tauri/Cargo.lock", "utf8");
  const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  const releaseNotesPath = `docs/releases/v${version}.md`;

  expect(cargoManifest).toMatch(new RegExp(`^version = "${version}"$`, "m"));
  expect(cargoLock).toMatch(
    new RegExp(`name = "life-launcher"\\r?\\nversion = "${version}"`),
  );
  expect(tauriConfig.version).toBe(version);
  expect(changelog).toContain(`## ${version} -`);
  expect(existsSync(releaseNotesPath)).toBe(true);

  const releaseNotes = readFileSync(releaseNotesPath, "utf8");
  for (const suffix of ["-setup.exe", ".exe", "-portable.zip"]) {
    expect(releaseNotes).toContain(`Life-Launcher-v${version}-windows-x64${suffix}`);
  }
});
