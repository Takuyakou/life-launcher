import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { findSecretFindings, forbiddenAiToolFinding } from "./public-safety-rules.mjs";

const ROOT = process.cwd();
const SELF = "scripts/check-public-safety.mjs";
const skippedDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "target",
  "release",
  "release-candidate",
  ".local-evaluation",
  "test-results",
  "playwright-report",
  "blob-report",
]);
const textExtensions = new Set([
  ".cjs", ".css", ".html", ".js", ".json", ".lock", ".md", ".mjs",
  ".ps1", ".rs", ".svg", ".toml", ".ts", ".tsx", ".txt", ".yml", ".yaml",
]);
const blockedArtifactExtensions = new Set([
  ".7z", ".exe", ".key", ".msi", ".p12", ".pdb", ".pem", ".pfx", ".rar", ".zip",
]);
const allowedUserPathFragments = new Map([
  ["src-tauri/src/commands/drop.rs", ["C:\\Users\\Me\\Desktop\\Sample App.lnk"]],
  ["src-tauri/src/commands/icons.rs", ["C:/Users/Me/Desktop/App.lnk", "secret@example.com", "test@example.com"]],
  ["package-lock.json", ["i@izs.me"]],
]);
const allowedInternalArtifactPaths = new Set([
  "docs/phase6/00-visual-baseline.md",
  "tests/visual/phase6-baseline.spec.ts",
  "docs/phase7.2/00-baseline.md",
  "docs/phase7.2/00-timer-size-baseline.md",
  "docs/phase8.2/00-baseline-audit.md",
  "docs/phase9/00-baseline.md",
  // User-approved exact synthetic outputs; content checks still run below.
  ...[
    "main-standard", "main-large", "main-xlarge", "main-min", "main-running", "timer-expanded",
    "today-picker", "settings-basic", "mini-idle", "mini-running", "records-review",
    "records-week", "records-all",
  ].map((name) => `docs/phase9/baseline-v1.3.4/${name}.png`),
  ...[1920, 1440, 1366, 1000, 860].flatMap((width) => [
    `docs/phase7.2/screenshots/baseline/timer-${width}.json`,
    ...["idle", "hover", "focus", "running"].map(
      (state) => `docs/phase7.2/screenshots/baseline/timer-${width}-${state}.png`,
    ),
  ]),
]);

function slash(path) {
  return path.replaceAll("\\", "/");
}

function extension(path) {
  const name = path.split("/").at(-1) ?? path;
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (directory === ROOT && entry.name === ".git") continue;
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    const rel = slash(relative(ROOT, absolute));
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push({ absolute, rel });
  }
  return files;
}

function gitPaths(args) {
  try {
    return new Set(
      execFileSync("git", args, {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      })
        .split("\0")
        .filter(Boolean)
        .map((path) => slash(path).toLowerCase()),
    );
  } catch {
    return new Set();
  }
}

const trackedPaths = gitPaths(["ls-files", "-z"]);
const ignoredPaths = gitPaths(["ls-files", "--others", "--ignored", "--exclude-standard", "-z"]);

const findings = [];
const files = walk(ROOT);

for (const { absolute, rel } of files) {
  const lower = rel.toLowerCase();
  const ext = extension(rel);
  const segments = lower.split("/");
  const basename = segments.at(-1) ?? lower;

  const forbiddenAiTool = forbiddenAiToolFinding(rel, trackedPaths, ignoredPaths);
  if (forbiddenAiTool) {
    findings.push(
      forbiddenAiTool === "tracked"
        ? `${rel}: AI tool configuration file is tracked`
        : `${rel}: AI tool configuration file is prohibited`,
    );
    continue;
  }

  if (segments.includes(".git")) findings.push(`${rel}: Git metadata is prohibited`);
  if (blockedArtifactExtensions.has(ext)) findings.push(`${rel}: packaged artifact is prohibited`);
  if (["config.json", "sessions.jsonl", "notes.json"].includes(basename)) {
    findings.push(`${rel}: runtime data filename is prohibited`);
  }
  if (segments.some((part) => ["backup", "backups", "logs"].includes(part))) {
    findings.push(`${rel}: runtime data directory is prohibited`);
  }
  if (
    /work-report|ui-audit|security-audit|private-screenshot|baseline|before-after/.test(lower) &&
    !allowedInternalArtifactPaths.has(lower)
  ) {
    findings.push(`${rel}: internal report or historical artifact is prohibited`);
  }
  if (basename === ".env" || (basename.startsWith(".env.") && basename !== ".env.example")) {
    findings.push(`${rel}: environment file is prohibited`);
  }
  if (rel === SELF || !textExtensions.has(ext)) continue;

  let body = readFileSync(absolute, "utf8");
  for (const fragment of allowedUserPathFragments.get(rel) ?? []) {
    body = body.replaceAll(fragment, "[GENERIC_PATH_TEST]");
  }
  const checks = [
    [/C:\\Users\\/i, "Windows user profile path"],
    [/[\/]Users[\/]/, "macOS user profile path"],
    [/[\/]home[\/]/, "Linux user profile path"],
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "email address"],
    [/(?:^|[^A-Za-z0-9])D:\\/im, "absolute D drive path"],
    [/(?:^|[^A-Za-z0-9])fdfff(?:[^A-Za-z0-9]|$)/i, "known local username"],
    [/https?:\/\/pianowithjonny\.com/i, "prior-use external URL"],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(body)) findings.push(`${rel}: ${label}`);
  }
  for (const label of findSecretFindings(body)) {
    findings.push(`${rel}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error(`Public safety check failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Public safety check passed: ${files.length} files scanned, 0 blockers.`);
console.log(
  `Exact generic path-test exceptions: 2 files; exact internal-artifact exceptions: ${allowedInternalArtifactPaths.size} paths; no global scanner exclusions.`,
);
