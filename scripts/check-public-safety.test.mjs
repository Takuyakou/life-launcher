import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findSecretFindings, forbiddenAiToolFinding, isForbiddenAiToolPath } from "./public-safety-rules.mjs";

// Build fake values at runtime so this test file itself does not contain a
// complete credential-shaped string that the audit would flag.
const fake = (...parts) => parts.join("");

test("URL embedded credentials are found", () => {
  const body = fake("https://", "fake-user", ":", "fake-pass", "@", "example.test");
  assert.ok(findSecretFindings(body).includes("URL embedded credential"));
  assert.deepEqual(findSecretFindings(fake("https://", "example.test", "/path")), []);
});

for (const prefix of ["gho_", "ghu_", "ghs_", "ghr_"]) {
  test(`${prefix} tokens are found`, () => {
    const body = fake(prefix, "A".repeat(24));
    assert.ok(findSecretFindings(body).includes("GitHub token"));
    assert.deepEqual(findSecretFindings(fake(prefix, "short")), []);
  });
}

test("Anthropic keys are found, including the existing sk- check", () => {
  const body = fake("sk-ant-", "fake".repeat(4));
  assert.ok(findSecretFindings(body).includes("Anthropic API key"));
  assert.deepEqual(findSecretFindings(fake("sk-ant-", "short")), []);
});

test("Authorization token and Basic values are found", () => {
  const tokenBody = fake("Authorization: ", "token ", "fake-token-value");
  const basicBody = fake("Authorization: ", "Basic ", "ZmFrZTpmYWtl");
  assert.ok(findSecretFindings(tokenBody).includes("Authorization credential"));
  assert.ok(findSecretFindings(basicBody).includes("Authorization credential"));
  assert.deepEqual(findSecretFindings(fake("Authorization: ", "Bearer ", "short")), []);
});

test("command-line password, token and api-key values are found", () => {
  for (const flag of ["--password", "--token", "--api-key"]) {
    assert.ok(
      findSecretFindings(fake(flag, " ", "fake-value")).includes("command-line credential"),
      flag,
    );
    assert.deepEqual(findSecretFindings(flag), [], flag);
  }
});

test("plain URLs and short values do not match", () => {
  assert.deepEqual(findSecretFindings(fake("https://", "example.test", "/a:b@c")), []);
  assert.deepEqual(findSecretFindings(fake("sk-", "short")), []);
});

test("AI tool configuration paths are forbidden", () => {
  for (const path of [
    ".claude/settings.local.json",
    ".claude/settings.json",
    ".commandcode/settings.local.json",
    ".cursor/rules.md",
    ".codex/config.json",
    "nested/.claude/settings.extra.json",
  ]) {
    assert.equal(isForbiddenAiToolPath(path), true, path);
  }
  for (const path of [".claude/other.json", "src/App.tsx", "docs/archive/reports/security/secret-guard.md"]) {
    assert.equal(isForbiddenAiToolPath(path), false, path);
  }
});

test("tracked AI tool files fail even when ignored; ignored untracked files are skipped", () => {
  const path = ".claude/settings.local.json";
  assert.equal(forbiddenAiToolFinding(path, new Set([path]), new Set([path])), "tracked");
  assert.equal(forbiddenAiToolFinding(path, new Set(), new Set([path])), null);
  assert.equal(forbiddenAiToolFinding(path, new Set(), new Set()), "prohibited");
  assert.equal(forbiddenAiToolFinding("src/App.tsx", new Set(), new Set()), null);
});

// --- Which files the check scans ---------------------------------------------------------
// The check reads the list of files from Git (tracked files plus new files that are not ignored)
// when it runs at the top of a work tree, so ignored work files are not scanned.

const script = new URL("./check-public-safety.mjs", import.meta.url);
const rules = new URL("./public-safety-rules.mjs", import.meta.url);

function makeRepository() {
  const root = mkdtempSync(join(tmpdir(), "ll-public-check-"));
  mkdirSync(join(root, "scripts"));
  copyFileSync(script, join(root, "scripts/check-public-safety.mjs"));
  copyFileSync(rules, join(root, "scripts/public-safety-rules.mjs"));
  const git = (...args) =>
    spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(git("init", "-q").status, 0);
  writeFileSync(join(root, ".gitignore"), "ignored-work/\n");
  writeFileSync(join(root, "README.md"), "# Synthetic repository\n");
  return {
    root,
    run: () => spawnSync(process.execPath, ["scripts/check-public-safety.mjs"], { cwd: root, encoding: "utf8" }),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

// Build values at runtime so this file does not hold a complete blocker-shaped string.
const blockerPath = fake("D", ":", "\\", "work", "\\", "note.txt");

test("work files that Git ignores are not scanned", () => {
  const repository = makeRepository();
  try {
    mkdirSync(join(repository.root, "ignored-work"));
    writeFileSync(join(repository.root, "ignored-work/run-record.json"), `{"path":"${blockerPath.replaceAll("\\", "\\\\")}"}`);
    const result = repository.run();
    assert.equal(result.status, 0, result.stderr);
    // .gitignore, README.md and the two scripts. The ignored run record is not counted.
    assert.match(result.stdout, /\b4 files scanned/);
  } finally {
    repository.cleanup();
  }
});

test("a new file that Git does not ignore is still scanned", () => {
  const repository = makeRepository();
  try {
    writeFileSync(join(repository.root, "notes.txt"), `see ${blockerPath}\n`);
    const result = repository.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /notes\.txt: absolute D drive path/);
    rmSync(join(repository.root, "notes.txt"));
    assert.equal(repository.run().status, 0);
  } finally {
    repository.cleanup();
  }
});

test("outside a Git work tree every file under the folder is scanned", () => {
  const root = mkdtempSync(join(tmpdir(), "ll-public-check-plain-"));
  try {
    mkdirSync(join(root, "scripts"));
    copyFileSync(script, join(root, "scripts/check-public-safety.mjs"));
    copyFileSync(rules, join(root, "scripts/public-safety-rules.mjs"));
    writeFileSync(join(root, "notes.txt"), `see ${blockerPath}\n`);
    const result = spawnSync(process.execPath, ["scripts/check-public-safety.mjs"], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /notes\.txt: absolute D drive path/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
