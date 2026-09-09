import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("current Guide and spec describe dynamic early completion without obsolete exclusivity", () => {
  const guide = readFileSync("src/content/helpGuide.ts", "utf8");
  const spec = readFileSync("docs/spec/current-spec.md", "utf8");
  for (const text of [guide, spec]) {
    expect(text).not.toMatch(/予定時間前に終了しても完了にはなりません|満了後に「終わる」で確定した項目だけ完了|予定時間前の手動終了は記録だけを残し|5分以上なら必ず/);
    expect(text).toContain("未完了のまま終了");
    expect(text).toContain("今日の分は完了");
  }
  for (const contract of ["Math.min(5, validSnapshotOr5) * 60", "TodayItem.shortTimerMinutes", "elapsedSeconds >= thresholdSeconds", "5分fallback", "初期focusは右", "2/3の部分補充", "Sessionを保持"]) {
    expect(spec).toContain(contract);
  }
  expect(guide).toContain("基準は通常5分です");
  expect(guide).toContain("5分未満に設定して採用した項目");
});
