import { expect, test } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("exact artifact permissions retain content and unknown-path checks", () => {
  // V165 PR 2: this ran under Playwright's test.info().outputPath(); the unit layer only needs a
  // throwaway directory of its own.
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "life-launcher-p72-safety-"));
  try {
    mkdirSync(join(root, "scripts"));
    copyFileSync("scripts/check-public-safety.mjs", join(root, "scripts/check-public-safety.mjs"));
    copyFileSync("scripts/public-safety-rules.mjs", join(root, "scripts/public-safety-rules.mjs"));
    const directory = join(root, "docs/archive/phases/phase7.2/screenshots/baseline");
    mkdirSync(directory, { recursive: true });
    const allowed = join(directory, "timer-1440.json");
    const run = () => spawnSync(process.execPath, ["scripts/check-public-safety.mjs"], {
      cwd: root, encoding: "utf8",
    });
    writeFileSync(allowed, '{"synthetic":true}\n');
    expect(run().status).toBe(0);
    const auditDirectory = join(root, "docs/archive/phases/phase8.2");
    mkdirSync(auditDirectory, { recursive: true });
    const audit = join(auditDirectory, "00-baseline-audit.md");
    writeFileSync(audit, "# Synthetic public audit\n");
    expect(run().status).toBe(0);
    const unknown = join(directory, "unreviewed.json");
    writeFileSync(unknown, "{}");
    const rejectedPath = run();
    expect(rejectedPath.status).toBe(1);
    expect(rejectedPath.stderr).toContain("internal report or historical artifact is prohibited");
    rmSync(unknown);
    const syntheticCases = [
      { value: "gh" + "p_" + "a".repeat(24), reason: "token-like value" },
      { value: "C:" + "\\" + ["Users", "Synthetic", "file.txt"].join("\\"), reason: "Windows user profile path" },
    ];
    const targets = [
      { path: allowed, relative: "docs/archive/phases/phase7.2/screenshots/baseline/timer-1440.json" },
      { path: audit, relative: "docs/archive/phases/phase8.2/00-baseline-audit.md" },
    ];
    // Swap the payloads to cover both detectors on both paths in two CLI runs.
    for (const cases of [syntheticCases, [...syntheticCases].reverse()]) {
      for (const [index, target] of targets.entries()) {
        writeFileSync(target.path, cases[index].value);
      }
      const rejectedBody = run();
      expect(rejectedBody.status).toBe(1);
      for (const [index, target] of targets.entries()) {
        expect(rejectedBody.stderr).toContain(`${target.relative}: ${cases[index].reason}`);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
