import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * P96-01 追加修正: 上部メニューの文字を隠す段階。
 * 0 = すべて出す
 * 1 = 自動起動・ミニ・使い方・設定の文字を隠す
 * 2 = 記録・手順書の文字も隠す(すべてアイコンだけ)
 *
 * 幅の決まった境目(@media)ではなく、文字を出したときに必要な幅を実測し、
 * 実際に入りきらないときだけ隠す。
 */
export type TopMenuLabelLevel = 0 | 1 | 2;

/**
 * 隠す・戻すの境目で表示が行ったり来たりしないための余裕(px)。
 * 狭いときに隠し、広げたときに戻すのは、この余裕があるときだけ。
 */
export const TOP_MENU_LABEL_HYSTERESIS_PX = 8;

/** .topBar が縦積みになる幅(styles.css の `@media (max-width: 760px)` と同じ)。 */
const STACKED_LAYOUT_MAX_WIDTH_PX = 760;

export type TopMenuMeasureInput = {
  /** 表示サイズ。変わると測り直す。 */
  measureKey: string;
  /** メイン画面の見出し(「今日 N分」)。記録画面でもこの幅で段階を決める。 */
  summaryTitle: string;
  /** メイン画面の日付。 */
  summaryDate: string;
  /** 表示切替ボタンの、2つの画面で長い方の文字。どちらの画面でも同じ幅で測る。 */
  toggleLabel: string;
};

function hideLabelsIn(root: ParentNode, level: TopMenuLabelLevel): void {
  const hideAll = level >= 2;
  root.querySelectorAll<HTMLElement>(".viewToggleButtonLabel").forEach((label) => {
    const group = label.closest(".topPillGroup");
    const groupHidden =
      level === 1 &&
      (group?.classList.contains("topPillGroup--window") === true ||
        group?.classList.contains("topPillGroup--support") === true);
    label.style.display = hideAll || groupHidden ? "none" : "";
  });
}

/**
 * 要素を複製して、中身が縮まないときの幅(max-content)を測る。
 *
 * 実物は狭いと縮む(見出し・行のどちらも)ため、実物の幅を読むと
 * 「縮んだ幅で測る → 入ると判断する → さらに縮む」の循環になる。
 * 複製は `.topBar` の外(同じ `.mainPanel` の中)へ置き、文字を隠す決まりを
 * 受け継がないようにする。表示サイズの文字の大きさは `.mainPanel` の
 * 中なのでそのまま効く。
 */
function measureMaxContentWidth(
  source: HTMLElement,
  prepare?: (clone: HTMLElement) => void,
): number {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add("layoutMeasure");
  clone.setAttribute("aria-hidden", "true");
  clone.removeAttribute("data-tauri-drag-region");
  clone
    .querySelectorAll("[data-tauri-drag-region]")
    .forEach((element) => element.removeAttribute("data-tauri-drag-region"));
  prepare?.(clone);
  const host = source.closest(".mainPanel") ?? document.body;
  host.appendChild(clone);
  const width = clone.getBoundingClientRect().width;
  clone.remove();
  return width;
}

/** 行の内容に使える幅(窓のボタンのために空けた右余白を除く)。 */
function measureAvailableWidth(bar: HTMLElement): number {
  const style = getComputedStyle(bar);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  return bar.clientWidth - paddingLeft - paddingRight;
}

/**
 * 段階を決めるために使う見出しの幅。**常にメイン画面の見出し**(「今日 N分」＋日付)で測る。
 *
 * 記録画面の見出しは「記録」だけなので、そのまま測ると画面を切り替えたときに
 * 隠れ方が変わってしまう。オーナー決定(2026-11-06)により、段階はメイン画面の
 * 見出しの幅で決め、記録画面も同じ段階にする。
 */
function measureSummaryWidth(bar: HTMLElement, title: string, date: string): number {
  const probe = document.createElement("div");
  probe.className = "topSummary layoutMeasure";
  probe.setAttribute("aria-hidden", "true");
  const titleElement = document.createElement("h1");
  titleElement.className = "topTitle";
  titleElement.textContent = title;
  const dateElement = document.createElement("span");
  dateElement.className = "topDateLabel";
  dateElement.textContent = date;
  probe.append(titleElement, dateElement);
  bar.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/**
 * メニューの幅。表示切替ボタンだけは画面によって文字が変わる(記録/メイン)ため、
 * 長い方の文字に置き換えて測る。こうすると2つの画面で同じ数値になり、
 * 切り替えても段階が変わらない。
 */
function measurePillsWidth(
  pills: HTMLElement,
  level: TopMenuLabelLevel,
  toggleLabel: string,
): number {
  return measureMaxContentWidth(pills, (clone) => {
    if (toggleLabel) {
      const label = clone.querySelector<HTMLElement>(
        "[data-view-toggle] .viewToggleButtonLabel",
      );
      if (label) label.textContent = toggleLabel;
    }
    hideLabelsIn(clone, level);
  });
}

function measureNeededWidth(
  bar: HTMLElement,
  pills: HTMLElement,
  level: TopMenuLabelLevel,
  input: TopMenuMeasureInput,
): number {
  const gap = Number.parseFloat(getComputedStyle(bar).columnGap) || 0;
  return (
    measureSummaryWidth(bar, input.summaryTitle, input.summaryDate) +
    gap +
    measurePillsWidth(pills, level, input.toggleLabel)
  );
}

/**
 * 入るかどうかで次の段階を決める。入らなければ隠し、戻すときは余裕があるときだけ戻す。
 * 純粋関数(テストから直接呼ぶ)。
 */
export function pickTopMenuLabelLevel(
  neededWidths: readonly number[],
  availableWidth: number,
  currentLevel: TopMenuLabelLevel,
): TopMenuLabelLevel {
  let next: TopMenuLabelLevel = currentLevel;
  while (next < 2 && neededWidths[next] > availableWidth) {
    next = (next + 1) as TopMenuLabelLevel;
  }
  while (next > 0 && neededWidths[next - 1] + TOP_MENU_LABEL_HYSTERESIS_PX <= availableWidth) {
    next = (next - 1) as TopMenuLabelLevel;
  }
  return next;
}

/**
 * 上部メニューの文字の段階を決める。`measureKey` が変わると測り直す
 * (表示サイズの切替など、幅が変わらないが文字の大きさが変わるもの)。
 */
export function useTopMenuLabelLevel(input: TopMenuMeasureInput) {
  const { measureKey, summaryTitle, summaryDate, toggleLabel } = input;
  const barRef = useRef<HTMLElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState<TopMenuLabelLevel>(0);
  const levelRef = useRef<TopMenuLabelLevel>(0);

  const apply = useCallback((next: TopMenuLabelLevel) => {
    if (levelRef.current === next) return;
    levelRef.current = next;
    setLevel(next);
  }, []);

  const measure = useCallback(() => {
    const bar = barRef.current;
    const pills = pillsRef.current;
    if (!bar || !pills) return;
    if (window.innerWidth <= STACKED_LAYOUT_MAX_WIDTH_PX) {
      // 縦積みの幅では今までどおり文字を出さない(styles.css の同じ幅の決まりが受け持つ)
      apply(2);
      return;
    }
    const available = measureAvailableWidth(bar);
    const needed = ([0, 1, 2] as const).map((candidate) =>
      measureNeededWidth(bar, pills, candidate, { measureKey, summaryTitle, summaryDate, toggleLabel }),
    );
    apply(pickTopMenuLabelLevel(needed, available, levelRef.current));
  }, [apply, measureKey, summaryTitle, summaryDate, toggleLabel]);

  // 描画の前に測り、文字が出たままの状態を1フレームも見せない。
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const bar = barRef.current;
    // config の読み込み前は行が無い。行ができた時点(measureKey の変化)で
    // 観測を始め直す。表示サイズの切替でも同じ理由で付け直す。
    if (!bar) return;
    let measuring = false;
    // 幅が変わったその場で測り直す(次のフレームまで文字が出たままにならないように)。
    const run = () => {
      if (measuring) return;
      measuring = true;
      try {
        measure();
      } finally {
        measuring = false;
      }
    };
    const observer = new ResizeObserver(run);
    observer.observe(bar);
    window.addEventListener("resize", run);
    void document.fonts.ready.then(run).catch(() => undefined);
    run();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [measure, measureKey]);

  return { barRef, pillsRef, level };
}
