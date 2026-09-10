# Today3 Timer変更前の基準

基準製品SHA: `873219cc099514fef5be292a01f97aa50d3e3468`。
再生成: `npm.cmd run test:visual -- tests/visual/phase72-audit.spec.ts`。
合成fixture、Chromium、DPR1、locale ja-JP、Asia/Tokyo、FIXTURE_NOW固定、reducedMotion=reduce。

## DOM・操作（維持対象）

- App.tsx:8355の `.todayTimerActions` 内に短時間、通常の順で2button。
- 通常時はplay icon（16px）。分数spanはopacity 0。常時分数表示ではない。
- hover:not(:disabled) / focus-visibleでicon opacity 0、分数opacity 1へ置換。レイアウトは変化しない。
- `aria-label`: `短時間タイマー{n}分で開始` / `通常タイマー{n}分で開始`。
- title: `短時間タイマー: {n}分` / `通常タイマー: {n}分`。独自tooltip DOMはない。
- 分数span: 11px / weight850 / line-height1、nowrap。buttonの基礎fontは16px。B2でも両者を変えない。
- 空本文はdisabled。実行中は開始buttonがpause/stopへ置換され、removeがdisabled。完了済みは完了ラベルへ置換。
- 同じsnapshotの分数・sourceId・開始環境をstartTimerへ渡す。サイズ変更でTimerロジックを変えない。
- CSSによる分数切替に独自遅延なし。native titleの表示遅延はbrowser/OS依存で、今回未測定。固定msの独自tooltipを新設しない。

## 実測

各幅のidle/hover/focusと属性は `screenshots/baseline/timer-{width}.json`。座標はCSS px。

| viewport | 列 | 先頭card幅 | 長文card高 | start button |
| --- | --- | --- | --- | --- |
| 1920x900 | 3 | 383.33 | 164.98 | 48x36 |
| 1440x900 | 3 | 372.66 | 164.98 | 48x36 |
| 1366x900 | 3 | 348 | 164.98 | 48x36 |
| 1000x900 | 2 | 344 | 164.98 | 48x36 |
| 860x900 | 1 | 558 | 164.98 | 48x36 |

高164.98はこの長文fixtureの測定結果であり、固定height仕様ではない。idle/hover/focusでbutton rect一致、horizontal overflowなし。135分のhover/focusを含む。

短時間: text rgb(111,207,151)、background rgb(39,52,43)、border rgba(117,196,143,.36)。通常: text #a9d0ff、既存control-short-bg/line。radius8px。hover色とfocus ringは既存CSSのまま保存。

## B2への制約

現状の親gridは48px+48px、gap8px。clusterは160px幅。B2の91px+91px+8px=190pxは現行親幅に収まらない。button widthだけ変えると重なるため、**Today3内の親gridとclusterの寸法も合わせる**案が必要。

footerはflex-wrapを許容している。column境界（container820/520px、viewport900px）付近では外すbuttonを残したまま折返す可能性がある。カード全高を増やさない条件との両立は、P72-03でbefore/afterを実測し、両立しなければ縮幅/配置例外を承認依頼する。固定156px高やボタン非表示で回避しない。

## 画像の検査範囲

20画像を生成。目視確認した代表:
- [1440 hover](screenshots/baseline/timer-1440-hover.png): 3列、135分表示、長文2行省略、removeとの重複なし。
- [1000 focus](screenshots/baseline/timer-1000-focus.png): 2列、黄色focus ring、分数表示とdisabled card。
- [860 running](screenshots/baseline/timer-860-running.png): 1列、pause/stop、remove disabled。

他の画像は生成と自動属性検証まで。全20枚を目視したとはしない。native WebView2/DPI/OS tooltipの表示遅延はUNVERIFIED。既存native EXEには変更・書込していない。
