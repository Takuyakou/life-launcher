import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("exact artifact permissions retain content and unknown-path checks", () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "life-launcher-p72-safety-"));
  try {
    mkdirSync(join(root, "scripts"));
    copyFileSync("scripts/check-public-safety.mjs", join(root, "scripts/check-public-safety.mjs"));
    const directory = join(root, "docs/phase7.2/screenshots/baseline");
    mkdirSync(directory, { recursive: true });
    const allowed = join(directory, "timer-1440.json");
    const run = () => spawnSync(process.execPath, ["scripts/check-public-safety.mjs"], {
      cwd: root, encoding: "utf8",
    });
    writeFileSync(allowed, '{"synthetic":true}\n');
    expect(run().status).toBe(0);
    const auditDirectory = join(root, "docs/phase8.2");
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
    for (const entry of syntheticCases) {
      for (const path of [allowed, audit]) {
        writeFileSync(path, entry.value);
        const rejectedBody = run();
        expect(rejectedBody.status).toBe(1);
        expect(rejectedBody.stderr).toContain(entry.reason);
        writeFileSync(path, "Synthetic public content\n");
      }
    }
  } finally {
    if (dirname(resolve(root)) === parent) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});
