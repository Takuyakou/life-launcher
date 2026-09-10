import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("early completion documentation keeps P71 explicit edit synchronization", () => {
  const guide = readFileSync("src/content/helpGuide.ts", "utf8");
  const spec = readFileSync("docs/spec/current-spec.md", "utf8");
  for (const text of [guide, spec]) {
    expect(text).not.toMatch(/予定時間前に終了しても完了にはなりません|採用後にプロジェクトの設定を変えても、今日の基準は変わりません|後からプロジェクト設定を変えても、採用済みカードの分数は変わりません/);
    expect(text).toContain("未完了のまま終了");
    expect(text).toContain("今日の分は完了");
  }
  for (const contract of ["Math.min(5, validSnapshotOr5) * 60", "TodayItem.shortTimerMinutes", "elapsedSeconds >= thresholdSeconds", "5分fallback", "初期focusは右", "2/3の部分補充", "Sessionを保持", "停止中の明示編集保存"]) {
    expect(spec).toContain(contract);
  }
  expect(guide).toContain("短時間が3分の項目は3分、10分の項目は5分");
  expect(guide).toContain("今日の基準も更新されます");
});
