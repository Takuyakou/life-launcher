import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const SELF = "scripts/check-public-safety.mjs";
const skippedDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "target",
  "release",
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
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    const rel = slash(relative(ROOT, absolute));
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push({ absolute, rel });
  }
  return files;
}

const findings = [];
const files = walk(ROOT);

for (const { absolute, rel } of files) {
  const lower = rel.toLowerCase();
  const ext = extension(rel);
  const segments = lower.split("/");
  const basename = segments.at(-1) ?? lower;

  if (segments.includes(".git")) findings.push(`${rel}: Git metadata is prohibited`);
  if (blockedArtifactExtensions.has(ext)) findings.push(`${rel}: packaged artifact is prohibited`);
  if (["config.json", "sessions.jsonl", "notes.json"].includes(basename)) {
    findings.push(`${rel}: runtime data filename is prohibited`);
  }
  if (segments.some((part) => ["backup", "backups", "logs"].includes(part))) {
    findings.push(`${rel}: runtime data directory is prohibited`);
  }
  if (/work-report|ui-audit|security-audit|private-screenshot|baseline|before-after/.test(lower)) {
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
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
    [/(?:ghp_[A-Za-z0-9_-]{16,}|github_pat_[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9_-]{16,})/i, "token-like value"],
    [/AIza[A-Za-z0-9_-]{30,}/, "Google API key"],
    [/Bearer\s+[A-Za-z0-9._~-]{16,}/i, "Bearer credential"],
    [/AKIA[0-9A-Z]{16}/, "AWS access key"],
    [/(?:api[_-]?key|password|client[_-]?secret)\s*[:=]\s*["'][^"']{8,}["']/i, "credential assignment"],
    [/https?:\/\/pianowithjonny\.com/i, "prior-use external URL"],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(body)) findings.push(`${rel}: ${label}`);
  }
}

function selfTest() {
  const samples = [
    ["C:\\Users\\Owner\\secret.txt", /C:\\Users\\/i],
    ["D:\\private\\notes.txt", /(?:^|[^A-Za-z0-9])D:\\/im],
    ["ghp_1234567890abcdefghijkl", /(?:ghp|github_pat|sk|xox[baprs])_[A-Za-z0-9_-]{16,}/i],
    ["-----BEGIN PRIVATE KEY-----", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ];
  for (const [sample, pattern] of samples) {
    if (!pattern.test(sample)) throw new Error(`Safety detector self-test failed: ${sample}`);
  }
}

selfTest();
if (findings.length > 0) {
  console.error(`Public safety check failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Public safety check passed: ${files.length} files scanned, 0 blockers.`);
console.log("Exact generic path-test exceptions: 2 files; no global scanner exclusions.");