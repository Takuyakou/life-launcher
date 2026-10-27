# P9-07 枠線の役割を決めて整理する 報告

ブランチ: `feature/p9-07-border-roles`(起点: `feature/p9-06-color-roles`。PR のマージ先も同ブランチ。P9-04〜06 が main にマージされたら `main` へ付け替える)

## 1. 判定

`DONE`(CI の結果は 11. に追記)

## 2. 実装内容の要約

- 指示書の表の対象(上部メニューの外枠、セクションの上線、見出しバー、今日の3件・今やる一手の補助ボタン、「今日やるものを選ぶ」の内側の面)の枠線をなくした。残す枠(勝利条件、カード、開始ボタン、入力欄、ダイアログなど)は変えていない。
- 枠をなくした要素は、枠の太さを残したまま透明にしたので、箱・押せる範囲・配置は変わらない(矩形を変更前後で測り、すべて同一)。
- 枠なしのボタンと見出しバーは、hover を背景(`--control-neutral-hover-bg`)、`:focus-visible` を黄色い輪(`--accent-strong` 2px)で示す。仕様書 §4.1.2 に枠の役割を書いた。

## 3. 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src/styles.css` | 末尾に P9-07 のブロックを追加(既存ルールは変更せず、後から上書き) |
| `docs/spec/current-spec.md` | §4.1.2「枠線の役割」を追加 |
| `tests/visual/phase9-border-roles.spec.ts` | 新規。9件 |
| `tests/visual/phase9-visual.spec.ts-snapshots/` | 基準画像10枚を更新(8. 参照) |
| `docs/phase9/07-screens/*.png` | 変更前後のスクリーンショット20枚 |
| `docs/phase9/07-border-roles.md` | 新規。この報告 |

`src/App.tsx` の変更はない(クラス名・文言・ボタン数・配置はそのまま)。

## 4. 変更内容(指示書の表との対応)

| 対象 | 変更 |
| --- | --- |
| `.topPills` | 外枠(`border-color`)と背景をなくした |
| `.viewToggleButton` | もともと枠は透明。hover / focus-visible の黄色い枠をやめ、hover は背景、focus-visible は黄色の輪にした。選択中(`--active`)の緑の強調は残した |
| `.doNowBand` | 上線をなくした(`.doNowContent` の面と左のアクセント線は残した) |
| `.focusBand` `.projectsBand` `.inboxBand` `.todayActivityBand` | 上線をなくした |
| `.todaySectionBar`、`.disclosureHeader` | 枠と背景をなくし、ただの見出しにした。hover は背景、内側のボタンにキーボードフォーカスがあるときはバー全体に黄色の輪 |
| 今日の3件カード内の「手順書」「今日の3件から外す」「＋ きっかけ」 | 枠なしのテキストボタン(hover は背景、focus-visible は黄色の輪)。「＋ きっかけ」は未設定の表示(`.todayTriggerButton--empty`)に適用 |
| 今やる一手の「他の一手」「手順書」 | 枠なしのテキストボタン |
| `.todayPickerEntryVisual` | 内側の枠をなくした(外側の点線は残した) |

- 色は P9-06 の役割表(§4.1.1)のとおり。hover の色は中立(`--control-neutral-hover-bg`、文字 `--text`)で、黄色は focus の輪にだけ使う。
- 追加した余白: **なし**。セクション間が詰まって見える箇所は、スクリーンショットで確認した範囲(標準・大・特大・860×560)ではなかった。

## 5. 完了条件ごとの結果

- [x] 仕様書 §4 に枠の役割がある(§4.1.2)
- [x] 表の変更がすべて入り、残す枠が残っている(テスト 1・2・3)
- [x] フォーカス表示と押せる範囲が保たれる(テスト 4・5。矩形は変更前後で同一)
- [x] 必須ゲートがすべて通る(ローカル。10. 参照)

## 6. 枠線の付いた要素の数(参考値)

メイン画面で、画面内に見える枠線(いずれかの辺に太さ・線種・透明でない色がある)の付いた要素の数。サイドバーを除く。変更前後は同じ fixture・同じ描画条件で数えた。テストの合否には使っていない。

| 画面 | 変更前 | 変更後 |
| --- | --- | --- |
| メイン 標準(1080×680) | 23 | 12 |
| メイン 大(1080×680) | 22 | 12 |
| メイン 特大(1080×680) | 22 | 12 |
| メイン 860×560 | 18 | 10 |
| 次の一手・やりたいことまでスクロールした位置 | 30 | 20 |
| 実行中(今日の3件から通常タイマーを開始) | 27 | 15 |

指示書の「34個」とは数え方(サイドバーや要素の範囲)が違うため、値は一致しない。

## 7. スクリーンショット(`docs/phase9/07-screens/`)

1080×680(指定のあるものを除く)、公開 fixture、日付は固定。

| 画面 | 変更前 | 変更後 |
| --- | --- | --- |
| メイン(標準) | [main-standard-old.png](07-screens/main-standard-old.png) | [main-standard-new.png](07-screens/main-standard-new.png) |
| メイン(大) | [main-large-old.png](07-screens/main-large-old.png) | [main-large-new.png](07-screens/main-large-new.png) |
| メイン(特大) | [main-xlarge-old.png](07-screens/main-xlarge-old.png) | [main-xlarge-new.png](07-screens/main-xlarge-new.png) |
| メイン 860×560 | [main-860x560-old.png](07-screens/main-860x560-old.png) | [main-860x560-new.png](07-screens/main-860x560-new.png) |
| 次の一手とやりたいことまでスクロール | [main-sources-old.png](07-screens/main-sources-old.png) | [main-sources-new.png](07-screens/main-sources-new.png) |
| 実行中 | [main-running-old.png](07-screens/main-running-old.png) | [main-running-new.png](07-screens/main-running-new.png) |
| 今日やるものを選ぶ画面 | [today-picker-old.png](07-screens/today-picker-old.png) | [today-picker-new.png](07-screens/today-picker-new.png) |
| 今日の3件が2件のときの「今日やるものを選ぶ」入口 | [today-picker-entry-old.png](07-screens/today-picker-entry-old.png) | [today-picker-entry-new.png](07-screens/today-picker-entry-new.png) |
| キーボードで「他の一手」にフォーカス | [keyboard-focus-other-step-old.png](07-screens/keyboard-focus-other-step-old.png) | [keyboard-focus-other-step-new.png](07-screens/keyboard-focus-other-step-new.png) |
| キーボードで今日の3件の「手順書」にフォーカス | [keyboard-focus-today-instruction-old.png](07-screens/keyboard-focus-today-instruction-old.png) | [keyboard-focus-today-instruction-new.png](07-screens/keyboard-focus-today-instruction-new.png) |

## 8. テスト(`phase9-border-roles.spec.ts`、9件)

1. 役割のない枠がなくなっている(上部メニューの外枠、各セクションの上線、見出しバー、枠なしにしたボタン、「＋ きっかけ」。外枠と見出しバーは背景も透明)
2. 残す枠が残っている(勝利条件、今やる一手の本体、今日の3件カード、次の一手カード、開始ボタン、ダイアログの入力欄とダイアログ)。今やる一手の左のアクセント線、今日の3件の上端の色の線、次の一手の左端の3px の色の線も確認
3. 「今日やるものを選ぶ」の外側の点線が残り、内側の面の枠がない
4. 枠なしの各ボタンで、hover が背景(`--control-neutral-hover-bg`)・枠なし、キーボードフォーカスで黄色の輪(`--accent-strong`、solid)。見出しバーは hover の背景と、フォーカス時のバー全体の輪。「＋ きっかけ」も同様
5. 押せる範囲の矩形が変更前(下限は変更前の実測値)より小さくない
6〜9. 表示サイズ 標準・大・特大・860×560 で、横スクロールがなく、枠なしのボタンが画面内に収まる

旧 CSS では 1・3・4 が失敗し、2・5〜9 は旧 CSS でも通る(残す枠・矩形・レイアウトは変えていない)。

### 画像比較の限界

Playwright の画像比較は、画素ごとの許容差(既定 0.2)のため、暗い色の1pxの線の有無を検出できない。実際、枠線を消しただけでは `phase9-visual.spec.ts` は失敗しなかった。そのため、枠の有無は上の DOM のテスト(計算後の枠線)で判定し、基準画像は `--update-snapshots=all` で作り直して差分のある画像を更新した。

## 9. 更新した基準画像

| 画像 | 理由 |
| --- | --- |
| `main-standard`、`main-large`、`main-xlarge`、`main-min` | 上部メニューの外枠、セクションの上線、見出しバー、補助ボタンの枠がなくなった |
| `main-running` | 同上 |
| `today-picker` | 背後のメイン画面の枠がなくなった(ピッカー自体は変更なし) |
| `settings-basic` | 背後のメイン画面の枠がなくなった(設定の中身は変更なし) |
| `records-review`、`records-week`、`records-all` | 記録画面の上部メニューの外枠がなくなった(上部メニューはメインと共通。記録画面の中身は変更なし) |

変更なし: `timer-expanded`、`mini-idle`、`mini-running`。

## 10. 実行したゲート

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3500ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 436件通過、1.5分(P9-06 の427件 + 新規9件) |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

## 11. CI の結果

[PR #123](https://github.com/Takuyakou/life-launcher/pull/123)(マージ先は P9-06 のブランチ)、ワークフロー `CI`(`windows-latest`)。

| コミット | 結果 |
| --- | --- |
| `ec8c488`(実装) | この報告を書いた時点で実行中。結果は確定後に追記する |

P9-04・P9-05・P9-06 のブランチの CI は、最後のコミットまですべて成功している。

## 12. 判断メモ

- **枠は透明にして消した**: `border: 0` にすると箱が 1〜2px 小さくなり、配置や押せる範囲が変わる。「押せる範囲の大きさを変えない」ため、枠の太さは残して色だけを透明にした(`border-top-color: transparent` など)。
- **記録画面の上部メニュー**: 上部メニューは記録画面と共通で、記録画面の中身は対象外だが、上部メニューの外枠はなくなる。基準画像 `records-*` が更新されるのはこのため。
- **「＋ きっかけ」**: 指示書は「＋ きっかけ」だけを対象としているため、未設定の表示(`.todayTriggerButton--empty`)だけを枠なしにした。きっかけを設定済みの表示(内容を表すボタン)は枠を残した。
- **hover の色**: 枠なしのボタンの hover は、P9-06 の役割表に合わせて中立(背景 `--control-neutral-hover-bg`、文字 `--text`)にした。従来は hover で黄色の枠と文字だった。
- **P9-04〜06 が main に未マージ**: 指示書は main から切る前提だが、この時点で #120〜#122 が未マージのため、P9-06 のブランチから切った。
- **不安定なテスト**: `phase6-readiness` の `registration` は、既知の不安定なテスト(P9-04 の報告に記載)。このブランチのローカル実行でも1度失敗し、再実行(全体、436件)で通過した。別に、PC のスリープをまたいだ実行(所要10.2時間と表示)で4件がタイムアウトしたが、測り直しで通過した。

## 13. 提案(実装していないこと)

- 画像比較の許容差が、暗い色の1pxの線を検出できない(8.)。枠線の整理のような変更は DOM のテストで見るしかないため、今後 `maxDiffPixelRatio` ではなく `threshold` も下げるかどうかは別途判断。
- 未使用になった `.settingsButton--warning` のルール(P9-06 の提案)は、まだ残っている。
