import assert from "node:assert/strict";
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
  for (const path of [".claude/other.json", "src/App.tsx", "docs/security/secret-guard.md"]) {
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
