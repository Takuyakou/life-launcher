# P9-01 勝利条件の文字サイズ 報告

ブランチ: `fix/p9-01-victory-font-size`(起点: `main` = `69cca4a`、P9-00 マージ後)

## 1. 判定

`FIXED`

## 2. 実装内容の要約

- 大・特大で勝利条件(`.victoryTextButton`、`.victoryInput`)を `--dashboard-font-body` に上書きしていたルールから外し、全サイズで `--dashboard-font-action` を使うようにした。
- 勝利条件は標準 17px / 大 19px / 特大 20px になり、標準より小さくならない。
- `phase9-display-size.spec.ts` を追加し、基準画像は `main-large` と `main-xlarge` だけ更新した。

## 3. 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src/styles.css` | 大・特大の上書きルールから `.victoryTextButton`、`.victoryInput` を外した(1行) |
| `docs/spec/current-spec.md` | §4 に勝利条件の文字サイズ(17 / 19 / 20px)を追記 |
| `tests/visual/phase9-display-size.spec.ts` | 新規。3件 |
| `tests/visual/phase9-visual.spec.ts-snapshots/main-large-win32.png` | 更新 |
| `tests/visual/phase9-visual.spec.ts-snapshots/main-xlarge-win32.png` | 更新 |
| `docs/phase9/01-victory-font-size.md` | 新規。この報告 |

## 4. 完了条件ごとの結果

- [x] 勝利条件が 標準 17px / 大 19px / 特大 20px になる(表示・編集とも。下の表)
- [x] `phase9-display-size.spec.ts` が通る(3件。旧CSSでは2件が失敗することも確認)
- [x] 特大 + 860×560 で勝利条件の表示・編集が崩れない(長文と、空欄 + 候補チップの両方。枠内に収まり、横スクロールなし)
- [x] 基準画像の更新は `main-large`、`main-xlarge` のみ(11枚は無変更で一致)
- [x] 必須ゲートがすべて通る(ローカル。CI は PR で確認)

## 5. 修正前後の計測値

1080×680、`createFullTodayFixture`、ブラウザの計算値。

| 要素 | サイズ | 修正前 | 修正後 |
| --- | --- | --- | --- |
| 勝利条件 表示 `.victoryTextButton` | 標準 | 17px | 17px |
| | 大 | **14px** | **19px** |
| | 特大 | **16px** | **20px** |
| 勝利条件 編集 `.victoryInput` | 標準 | 17px | 17px |
| | 大 | **14px** | **19px** |
| | 特大 | **16px** | **20px** |
| 今やる一手の行動文 | 標準 / 大 / 特大 | 17 / 19 / 20px | 同じ |
| 今日の3件の文 `.todayTextButton` | 標準 / 大 / 特大 | 13 / 14 / 16px | 同じ |
| 今日の3件の開始ボタン `.todayStartButton` | 標準 / 大 / 特大 | 16 / 16 / 16px | 同じ |

## 6. テスト

`tests/visual/phase9-display-size.spec.ts`

1. 大・特大で、勝利条件(表示・編集)、今やる一手の行動文、今日の3件の文、今日の3件の開始ボタンが標準以上
2. 勝利条件が 17 / 19 / 20px(表示・編集)
3. 特大 + 860×560 で、勝利条件の表示・編集・候補チップが枠内に収まり、横スクロールがない(長文の場合と、空欄で候補が出る場合)

旧CSSに戻すと 1 と 2 が失敗する(大で 14px)ことを確認した。

## 7. 実行したゲート

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3456ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 392件通過、1.4分(P9-00 の389件 + 新規3件) |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy -D warnings` | 通過 |
| `cargo test` | 通過(124件 + 1件) |
| `git diff --check` | 通過 |

## 8. 更新した基準画像

| 画像 | 差 | 理由 |
| --- | --- | --- |
| `main-large` | 16,848 px | 勝利条件が 14px → 19px |
| `main-xlarge` | 16,831 px | 勝利条件が 16px → 20px |

他の11枚は、閾値 0.001 のまま一致した。更新後の2枚は目視で確認した。

## 9. 判断メモ

- `.todayTextButton`、`.todayEditInput` は、標準より大きくなっているため計画書どおり同じルールに残した。
- 今日の3件の開始ボタンは全サイズで 16px のままだが、標準以上という条件を満たしているため変更していない。

## 10. 提案(実装していないこと)

- 今やる一手の開始ボタン(「5分で始める」など)が全サイズで 12px のまま(計画書の記載。今回は計測していない)。
- 文字サイズの変数化・整理は v1.5 候補のまま。
