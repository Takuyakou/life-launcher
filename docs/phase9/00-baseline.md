# P9-00 Baseline 報告

ブランチ: `test/p9-00-baseline`(起点: `main` = `901255c`、v1.3.4)

## 1. 判定

`BASELINE READY`(ローカル)。ただし CI(`windows-latest`)での一致は未確認。ブランチを push していないため。

## 2. 実装内容の要約

- fixture を `fullTodayFixture` / `pickerFixture` / `runningFixture` の3つに分けた(`tests/visual/fixtures.ts`)。
- 流れのテスト `phase9-flow.spec.ts`(1件)と画像比較 `phase9-visual.spec.ts`(13画面)を追加し、v1.3.4 の製品コードのまま通る。
- v1.3.4 の基準画像13枚を `docs/phase9/baseline-v1.3.4/` に保存した。

## 3. 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `tests/visual/fixtures.ts` | `VisualQaFixture.name` の型を拡張。Phase 9 の fixture 3つを追加(`createPublicFixture` は変更なし) |
| `tests/visual/phase9-flow.spec.ts` | 新規。流れのテスト |
| `tests/visual/phase9-visual.spec.ts` | 新規。画像比較13枚 |
| `tests/visual/phase9-visual.spec.ts-snapshots/*-win32.png` | 新規。比較の基準画像13枚 |
| `docs/phase9/baseline-v1.3.4/*.png` | 新規。上記の保存用コピー(テストからは参照しない) |
| `docs/phase9/00-baseline.md` | 新規。この報告 |
| `scripts/check-public-safety.mjs` | 上記14パスを `allowedInternalArtifactPaths` へ完全一致で追加(オーナー承認済み、判断メモ参照) |

`src/` と `src-tauri/` の差分はない。

## 4. 完了条件ごとの結果

- [x] fixture が3つに分かれ、`pickerFixture` の候補が6件以上: 次の一手5件 + やりたいこと5件 = 10件
- [x] `phase9-flow.spec.ts` が v1.3.4 の製品コードのまま通る
- [ ] 基準画像13枚がコミットされ、ローカルと CI で通る: 13枚すべて作成し、ローカルで2回連続一致。コミットと CI 確認は未実施
- [x] `docs/phase9/baseline-v1.3.4/` に v1.3.4 の画像が保存されている(13枚)
- [x] 実行時間の前後比較がある(6.参照)
- [x] 必須ゲート(7.参照。`public:check` のローカル既存の指摘1件を除く)
- [x] 製品コードの差分がない

## 5. fixture

| 名前 | 今日の3件 | 内容 |
| --- | --- | --- |
| `createFullTodayFixture` | 3/3、1件完了 | プロジェクト5件(青・緑・紫・ピンク・オレンジ)、やりたいこと5件、実行記録4件。1件目は `project:sample-learning`(`sourceGenerationId` あり、短時間タイマー1分) |
| `createPickerFixture` | 0/3 | 同じプロジェクト・やりたいこと。候補は10件 |
| `createRunningFixture` | 3/3、1件完了 | full と同じデータ。テスト内でタイマーを開始して実行中にする |

## 6. 流れのテストと実行時間

`phase9-flow.spec.ts`: 今やる一手に候補表示 → 今日の3件から短時間タイマー(1分)で開始 → 時計を進めて満了 → 「続ける」 → 一時停止 → 再開 → 終了 → 確認ダイアログで「今日の分は完了」 → 今日の3件が完了表示・`record_session` が1回。

「満了 → 続ける → 終了で完了状態が失われる」問題の既存の回帰テストは、`post-v133c-followup.spec.ts` の次の2件。

- `Do Now Continue then normal Timer End retains A completion snapshot: Today3 source`
- `Do Now Continue then normal Timer End retains A completion snapshot: NextStep source with pause`

| 計測 | 追加前(v1.3.4) | 追加後 |
| --- | --- | --- |
| `npm.cmd run test:visual` | 375件、1.4分 | 389件、1.4分(壁時計 1分22秒) |
| `phase9-flow.spec.ts` 単体 | — | 1件、約3.2秒(テスト本体 1.3秒) |
| `phase9-visual.spec.ts` 単体 | — | 13件、約9.6秒(基準画像の生成を含む) |
| 上記2つを合わせて再実行 | — | 14件、約7.6秒 |

追加分は全体の所要時間にほぼ影響しなかった。ワーカー数は既存設定のまま。

## 7. 画像比較

- 比較対象は13画面(main-standard / main-large / main-xlarge / main-min / main-running / timer-expanded / today-picker / settings-basic / mini-idle / mini-running / records-review / records-week / records-all)。13枚すべて作成できた。
- 閾値: `maxDiffPixelRatio: 0.01`(上限どおり)。同じ PC では2回とも画素まで一致した。0.01 は CI ランナーとのフォント描画の差を吸収するための余裕。
- 日時は `page.clock` で固定し、`pauseAt` で一時停止して実行中のタイマー表示を 24:55 に固定した。アニメーション・トランジション・キャレットは止めている。
- `mini-running` は `mini-timer-snapshot` を `emit` で送って作った(作れたので除外なし)。
- 基準画像の内容は目視で確認した。ミニの待機中の重なり(P9-03)や、今日やるものを選ぶ画面で候補が約1行しか見えない状態(P9-08)も v1.3.4 のまま写っている。
- 基準画像は Windows 用(`-win32.png`)。ローカルは Windows 11。CI での一致は push 後に確認が必要で、0.01 でも一致しない場合は閾値を緩めず停止する。

## 8. 実行したゲート

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 作業ツリー内の `.tmp/playwright-transform-cache/…`(`.gitignore` 対象のローカルキャッシュ、2026-10-26 11:22 作成)に D ドライブの絶対パスがあるという指摘が1件残る。P9-00 の変更ではない既存のもの。CI は新しい checkout なので出ない。それ以外はなし |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過(チャンクサイズの警告のみ、既存) |
| `npm.cmd run test:visual` | 389件通過、1.4分 |
| `cargo fmt -- --check` | 通過 |
| `cargo check` | 通過 |
| `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(124件 + 1件) |
| `git diff --check` | 通過(LF→CRLF の警告のみ) |

## 9. 更新した基準画像

既存の基準画像はない(画像比較は今回が初導入)。新規作成した13枚は上記のとおり。

## 10. 判断メモ

- `public:check` は、パスに `baseline` を含むファイルを禁止している。P9-00 の指定パス(`docs/phase9/baseline-v1.3.4/`、`docs/phase9/00-baseline.md`)が該当したため、オーナー確認のうえ `scripts/check-public-safety.mjs` の許可リストへ14パスを完全一致で追加した(docs/phase7.2 の画像と同じ前例)。内容チェックは残っている。
- 今日の3件から終了すると「今日の分は完了にしますか？」の確認が出る(v1.3.4 の振る舞い)。計画書の手順7と8の間にあたるので、確認ダイアログで「今日の分は完了」を選ぶ操作をテストに含めた。
- 画像のファイル名は Playwright の既定(`<名前>-win32.png`)のまま。
- 計画書にある「今やる一手から開始した場合の今日の3件の表示同期」は、P9-04 で追加する。

## 11. 提案(実装していないこと)

- 画像比較の基準画像は Windows でしか作っていない。CI の `windows-latest` で一致しない場合に備え、最初の PR で CI の結果を確認してから次の Stage へ進むとよい。
- ローカルの `.tmp/` に古い Playwright キャッシュが残っていて `public:check` が失敗する。掃除はオーナー判断。
