# P96-02 — 窓の上端のタイマーの線 報告

- 日付: 2026-11-06
- ブランチ: `feature/p96-02-timer-line`(P96-01 のマージ後の `main` = `1c5fd34` から)
- 判定: **DONE**(必須ゲートはローカルで通した。CI は待たない)

## 実装内容の要約

メイン画面の窓の上端(左端〜右端、高さ 2px)に、タイマーの進み具合を示す線を出した。予定時間のあるタイマー(`countdown`)が実行中か一時停止中のときだけ出し、実行中は `--accent`、一時停止中は `--warn` で、長さは今の `timerProgressPercent` をそのまま使う。窓のボタン・ダイアログの幕より手前に重ね、クリックとドラッグは受けない。

## 決まりの反映

| 決まり | 反映 |
| --- | --- |
| 出す窓 | メイン画面の窓だけ(`DashboardApp` の根)。手順書ビューアー・ミニタイマー・辞書は別のアプリなので出ない(テストで確認) |
| 位置と大きさ | `position: fixed; top: 0; left: 0; right: 0; height: 2px`、`z-index: 150`(窓のボタン 140・幕 130 より手前)、`pointer-events: none`、`aria-hidden="true"` |
| 進み具合 | 既存の `timerProgressPercent`(経過 ÷ 予定、0〜100%)をそのまま `width` に使う。新しい計算を作っていない |
| 出すとき | `mode === "countdown"` かつ `targetMinutes !== null`。実行中と一時停止中の両方。終わりの確認を待つ間は 100% のまま |
| 出さないとき | 待機中、計測(`mode === "measure"`)、タイマーを終えたあと |
| 色 | 実行中: 線 `--accent`・溝 `--accent` の 12%(`opacity: 0.12` の層)。一時停止中: 線 `--warn`・溝 `--warn` の 12%。新しい色の値は足していない |
| 動き | 実行中だけ `transition: width 1s linear`。一時停止中は `transition: none` でその位置に止まる。`prefers-reduced-motion: reduce` では `transition: none` |
| 計算し直し | 予定時間が変わったとき(開始・「続ける(+15分)」)は、線の要素を作り直して(`key`)動きなしで今の値にする。長さは今の計算どおり(短くなってよい) |
| 時計 | タイマー表示と同じ時刻の元(`now`)を使う。線のためだけの `setInterval` は足していない |
| 表示サイズ | 標準・大・特大で変えない(テストで確認) |
| 操作への影響 | `pointer-events: none`。窓のボタンの中心と、上部メニューの余白で `document.elementFromPoint` が線ではなく下の要素(窓のボタン・`data-tauri-drag-region` を持つ要素)を返すことをテストで確認 |

## 変更ファイル一覧

| ファイル | 変更 |
| --- | --- |
| `src/App.tsx` | `windowTimerLine`(出す条件・状態・計算し直しの目印)を追加し、`appShell` の先頭に線を描く |
| `src/styles.css` | `.windowTimerLine` / `.windowTimerLineGroove` / `.windowTimerLineFill` と一時停止・reduced-motion の決まり |
| `tests/visual/phase96-timer-line.spec.ts` | 新規。10テスト |
| `tests/visual/phase9-visual.spec.ts-snapshots/main-running-win32.png` | 更新(線が出る) |
| `tests/visual/phase9-visual.spec.ts-snapshots/timer-expanded-win32.png` | 更新(線が出る) |
| `docs/spec/current-spec.md` | §6.2「窓の上端のタイマーの線(P96-02)」を追加 |

## 完了条件ごとの結果

- [x] 上の決まりどおりに線が出る・消える・色が変わる → テスト10件で確認
- [x] 線のための別のタイマーを足していない → 長さは既存の `timerProgressPercent`。`setInterval` / `setTimeout` を追加していない
- [x] `docs/spec/current-spec.md` に決まりを書いた → §6.2
- [x] 必須ゲートがローカルで通る → 下記

## テスト(`tests/visual/phase96-timer-line.spec.ts`)

1. 待機中・計測中は線がない
2. 予定時間のあるタイマーで線が出る。高さ 2px・上端・`aria-hidden`・`pointer-events: none`・`z-index > 140`・線が `--accent`・溝が `--accent` の 12%
3. 長さが時計の進み具合と合う(許容 1.5%)
4. 一時停止で `--warn` に変わり、その位置で止まる(時間を進めても長さが変わらない)。再開で `--accent` に戻って続きから伸びる
5. 一時停止・再開を4往復しても長さが減らない
6. 予定時間のあと、終わりの確認を待つ間は 100%。「終わる」で線が消える
7. 「続ける(+15分)」で 25%(20分のうち5分経過)に計算し直される
8. 記録画面でも線が出る(長さも同じ)。手順書ビューアーとミニタイマーにはない
9. 線が窓のボタンとドラッグできる範囲を邪魔しない(`elementFromPoint`)
10. `prefers-reduced-motion: reduce` で `transition` がない
11. 表示サイズを変えても、記録画面に移っても長さが変わらない

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS |
| `npm.cmd run lint` | PASS(警告0) |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **580/580 PASS**(新規10件を含む。約3.3分) |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **133 PASS**(lib 132＋capability契約 1) |
| `git diff --check` | PASS |

## 更新した基準画像(2枚)と理由

- `main-running`: 予定時間のあるタイマーが実行中の画面なので、上端に線が出る
- `timer-expanded`: 拡大タイマーを開いた実行中の画面。線は幕より手前(上端)に出る

どちらも上の 2px が `--accent` の 12% だけ色が変わる(画素の確認: `main-running` の上端 2 行が `rgb(49,42,26)`、その下が `rgb(24,23,20)`)。待機中の `main-standard` は変わっていない(上端まで同じ色)。

## 判断メモ

- 線の色は「今ある CSS 変数だけ」という決まりに沿って、`color-mix` ではなく **溝の層に `opacity: 0.12`** を掛ける形にした。色の値は `--accent` / `--warn` だけで、計算後の色もテストで読める(`toHaveCSS` 相当)
- 「計算し直しは動きなし」は、予定時間が変わったときに線の要素へ `key` を付けて作り直すことで実現した(タイマーを足さずに、`transition` を走らせない)
- 空白や `%` の丸めはブラウザの計算に任せ、テストは `style.width` と実測の両方を見ている(許容 1.5%)。停止中は遷移がないので実測が安定することを利用した
- `main-running` / `timer-expanded` の基準画像は、線の差が許容差(0.001)に収まって自動では更新されなかったため、意図した変化として明示的に作り直した
- 実機確認の前に、オーナー判断(2026-11-06)で線の高さを 2px → **3px** に変えた。色・溝の不透明度・動き・`z-index`・`pointer-events`・`aria-hidden` は変えていない。基準画像(`main-running` `timer-expanded`)はこの変更で撮り直した(待機中の画面は変わっていない)

## 提案

- 実機確認のとき、線が上端の「大きさを変える範囲」(上端の数 px)に重なるが `pointer-events: none` なので操作は通る。実機で違和感がないか見てほしい(確認一覧の4番)
- 記録画面の基準画像は線が無いタイマーなしの状態なので今回は更新していない。記録画面でタイマーを動かした状態の基準画像を足すかは、必要になってからでよい
