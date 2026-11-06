import { expect, test } from "@playwright/test";
import { pickTopMenuLabelLevel, TOP_MENU_LABEL_HYSTERESIS_PX } from "../../src/topMenuLabels";

// P96-01 追加修正: 上部メニューの文字を隠す段階の決め方(純粋関数)。
test.describe("P96-01 top menu label level", () => {
  // すべて出す / 自動起動・ミニ・使い方・設定を隠す / すべて隠す、に必要な幅。
  const needed = [650, 517, 452] as const;
  const hysteresis = TOP_MENU_LABEL_HYSTERESIS_PX;

  test("shows every label while the full row fits", () => {
    expect(pickTopMenuLabelLevel(needed, 650, 0)).toBe(0);
    expect(pickTopMenuLabelLevel(needed, 1920, 0)).toBe(0);
  });

  test("hides the first group as soon as the full row does not fit", () => {
    expect(pickTopMenuLabelLevel(needed, 649, 0)).toBe(1);
    expect(pickTopMenuLabelLevel(needed, 517, 0)).toBe(1);
  });

  test("hides the second group when the short row still does not fit", () => {
    expect(pickTopMenuLabelLevel(needed, 516, 0)).toBe(2);
    expect(pickTopMenuLabelLevel(needed, 100, 0)).toBe(2);
  });

  test("waits for a margin before showing the labels again", () => {
    expect(hysteresis).toBeGreaterThan(0);
    // 隠したあと、必要な幅ちょうどまでは戻さない。
    expect(pickTopMenuLabelLevel(needed, 650, 1)).toBe(1);
    expect(pickTopMenuLabelLevel(needed, 650 + hysteresis - 1, 1)).toBe(1);
    expect(pickTopMenuLabelLevel(needed, 650 + hysteresis, 1)).toBe(0);
    expect(pickTopMenuLabelLevel(needed, 517 + hysteresis - 1, 2)).toBe(2);
    expect(pickTopMenuLabelLevel(needed, 517 + hysteresis, 2)).toBe(1);
  });

  test("does not move back and forth for a one pixel change", () => {
    const first = pickTopMenuLabelLevel(needed, 649, 0);
    const second = pickTopMenuLabelLevel(needed, 650, first);
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(pickTopMenuLabelLevel(needed, 651, second)).toBe(1);
  });
});
