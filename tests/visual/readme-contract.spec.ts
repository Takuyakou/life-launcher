import { expect, test } from "@playwright/test";
import { marked } from "marked";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;
const changelog = readFileSync("CHANGELOG.md", "utf8");
const publishedVersion = changelog.match(/^## (\d+\.\d+\.\d+) - /m)?.[1];
const readmes = ["README.md", "README.en.md"];
const releasesUrl = "https://github.com/Takuyakou/life-launcher/releases";
const publishedAssets = [
  ...["-setup.exe", ".exe", "-portable.zip"].map(
    (suffix) => `Life-Launcher-v${publishedVersion}-windows-x64${suffix}`,
  ),
  "SHA256SUMS.txt",
];
const downloadTargets = [
  `${releasesUrl}/latest`,
  `${releasesUrl}/tag/v${publishedVersion}`,
  ...publishedAssets.flatMap((asset) => [
    `${releasesUrl}/download/v${publishedVersion}/${asset}`,
    `${releasesUrl}/latest/download/${asset}`,
  ]),
];

test("published documentation does not describe a newer version than the app", () => {
  expect(publishedVersion).toBeDefined();
  expect(version.localeCompare(publishedVersion!, undefined, { numeric: true })).toBeGreaterThanOrEqual(0);
});

for (const file of readmes) {
  test(`${file} describes current downloads and links to existing local documents`, () => {
    const text = readFileSync(file, "utf8");
    const links: { href: string; text: string }[] = [];
    const paths: string[] = [];
    marked.walkTokens(marked.lexer(text), (token) => {
      if (token.type === "link") links.push({ href: token.href, text: token.text });
      if (token.type === "link" || token.type === "image") paths.push(token.href);
      if (token.type === "html") {
        for (const match of token.text.matchAll(/\b(src|href)=["']([^"']+)["']/g)) {
          paths.push(match[2]);
          if (match[1] === "href") links.push({ href: match[2], text: token.text });
        }
      }
    });
    expect(links.map((link) => link.href)).toContain(`${releasesUrl}/latest`);
    for (const link of links) {
      const isReleaseUrl = /^https?:\/\//i.test(link.href) &&
        /^\/[^/]+\/[^/]+\/releases(?:\/|$)/.test(new URL(link.href).pathname);
      if (
        isReleaseUrl ||
        /download|GitHub Releases|\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9|Life-Launcher-v|SHA256SUMS/i.test(link.text)
      ) {
        expect(downloadTargets, `${file}: incorrect download target ${link.href}`).toContain(link.href);
      }
    }
    for (const asset of publishedAssets) {
      expect(text).toContain(asset);
    }
    for (const path of paths.filter((path) => !/^https?:/.test(path))) {
      expect(existsSync(resolve(path)), `${file}: missing ${path}`).toBe(true);
    }
  });
}

test("app metadata agrees and published notes match the changelog", () => {
  const cargoManifest = readFileSync("src-tauri/Cargo.toml", "utf8");
  const cargoLock = readFileSync("src-tauri/Cargo.lock", "utf8");
  const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const releaseNotesPath = `docs/releases/v${publishedVersion}.md`;

  expect(cargoManifest).toMatch(new RegExp(`^version = "${version}"$`, "m"));
  expect(cargoLock).toMatch(
    new RegExp(`name = "life-launcher"\\r?\\nversion = "${version}"`),
  );
  expect(tauriConfig.version).toBe(version);
  expect(existsSync(releaseNotesPath)).toBe(true);

  const releaseNotes = readFileSync(releaseNotesPath, "utf8");
  for (const suffix of ["-setup.exe", ".exe", "-portable.zip"]) {
    expect(releaseNotes).toContain(`Life-Launcher-v${publishedVersion}-windows-x64${suffix}`);
  }
});
