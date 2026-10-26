# P9-04 今やる一手と今日の3件の実行中表示の同期 報告

ブランチ: `feature/p9-04-running-state-sync`(起点: `main` = `c3bfd7a`、P9-01〜03 マージ後)

## 1. 判定

`DONE`(CI の結果は 11. に追記)

## 2. 実装内容の要約

- 「同じ行動」の判定を `src/timerSource.ts` の共通関数に切り出し、完了処理・動的な早期完了の確認・実行中表示が同じ関数を使うようにした。
- 今やる一手と今日の3件が、単一の `activeTimer` から同じ実行状態(バッジ、一時停止 / 再開、終了)を表示する。実行中の今やる一手は「通常 N分」の代わりに残り時間(計測は経過時間)を出す。
- 完了時の振る舞いと今やる一手の候補選びのルールは変えていない。

## 3. 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src/timerSource.ts` | 新規。共通の判定関数(4. 参照) |
| `src/App.tsx` | 完了処理を `findTodayEntryForTimer` に置き換え。`isDoNowRunning` と今日の3件の実行中判定を共通関数から導く。今やる一手に残り時間 / 経過時間を表示 |
| `src/earlyCompletion.ts` | 同じ `timerTodaySourceKey` と `sameSourceGeneration` を使うようにした(振る舞いは同じ) |
| `docs/spec/current-spec.md` | §8、§10、§14 に同期のルールと「同じ行動」の定義を追記 |
| `tests/visual/phase9-flow.spec.ts` | 流れ2通り + 計測 + ケース表7件(11件)を追加 |
| `tests/visual/phase9-visual.spec.ts-snapshots/main-running-win32.png` | 更新 |
| `docs/phase9/04-running-state-sync.md` | 新規。この報告 |

## 4. 共通関数(`src/timerSource.ts`)

| 関数 | 役割 | 使っている場所 |
| --- | --- | --- |
| `sameSourceGeneration(a, b)` | 世代 ID の厳密一致(両方なしは一致、片方だけは不一致) | 下の3つの関数 |
| `timerTodaySourceKey(timer)` | Timer がどの今日の項目のキーに属するか(`today:` の項目自身、または `project:<projectId>`) | `findTodayEntryForTimer`、`timerMatchesProjectNextStep`、`earlyCompletionItem` |
| `findTodayEntryForTimer(entries, timer)` | Timer が対象とする未完了の今日の項目(キー一致 + 世代 ID 厳密一致) | **完了処理**(`finishCompletedTimer`)と、今日の3件の**実行中表示**(`isTimerOnTodayItem`) |
| `timerMatchesProjectNextStep(timer, projectId, generationId)` | Timer が今やる一手のプロジェクトの次の一手を実行中か | 今やる一手の**実行中表示**(`isDoNowRunning`) |

- 完了処理は、もとの判定(`!item.done`、`sourceKey` 一致、`item.sourceGenerationId === timer.sourceGenerationId`)をそのまま `findTodayEntryForTimer` に移した。条件の順序・厳密さは同じ。
- `earlyCompletionItem` は、キー導出と世代 ID の比較だけを共通関数に置き換えた。一意に1件だけ一致する条件、旧形式の `sourceKey` なしの項目の扱いは変えていない。
- 実行中表示のために別の判定は書いていない。

## 5. 完了条件ごとの結果

- [x] 2通りの開始で、両方のカードの表示が開始から完了まで一致する(今やる一手から / 今日の3件から。開始 → 一時停止 → 再開 → 満了 → 続行 → 終了 → 完了。各時点で比較)
- [x] 完了処理と実行中表示が同じ判定関数を使っている(4.)
- [x] ケース表7件がすべてテストで確かめられている(6.)
- [x] 完了時の既存の振る舞いと回帰テストが保たれる(既存テストをそのまま実行し、すべて通過)
- [x] 必須ゲートがすべて通る(ローカル。CI は PR で確認)

## 6. テスト(`tests/visual/phase9-flow.spec.ts`)

| テスト | 確かめたこと |
| --- | --- |
| 流れ: 今やる一手から開始 | 開始・一時停止(今やる一手の操作)・再開(今日の3件の操作)・満了 → 続行・終了。各時点で両カードが同じバッジと操作。完了後に今日の3件が完了表示、今やる一手は「次の一手を見る」まで保持。記録は1件 |
| 流れ: 今日の3件から開始 | 同じ流れ(今日の3件で一時停止、今やる一手で再開・終了)。確認ダイアログで「今日の分は完了」 |
| 計測 | 今やる一手に経過時間(「経過 01:05」)、今日の3件も実行中 |
| ケース1 同じプロジェクト・同じ世代 | 両方向で同期する |
| ケース2 同じプロジェクト・違う世代 | 同期しない(両方向) |
| ケース3 次の一手の入れ替え | UI では Source Lock のため「変更」が出ない(ロックバッジのみ)。設定を直接差し替えても、新しい世代は実行中にならず、元の今日の3件の項目は実行中のまま |
| ケース4 「他の一手」で候補切替 | 切り替えた先の候補は実行中にならず、Timer と今日の3件の項目は実行中のまま |
| ケース5 手動追加の項目 | 同期しない |
| ケース6 旧データ(世代 ID が両方ない) | 一致して同期する |
| ケース7 片方だけ世代 ID がある(2通り) | 同期しない |

- 同期が必要なテスト(流れ2件、計測、ケース1、3、4、6)は、旧実装(`App.tsx` を戻した状態)で失敗することを確認した。同期しないことを確かめるケース(2、5、7)は旧実装でも新実装でも通る。
- 満了 → 続行 → 終了で完了状態が保たれる既存の回帰テスト(`post-v133c-followup.spec.ts` の `Do Now Continue then normal Timer End retains A completion snapshot` 2件)と、早期完了(`phase7-early-completion.spec.ts`)ほか既存テストは、変更なしですべて通った。

## 7. 実行したゲート

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3462ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 411件通過、1.5分(P9-03 の400件 + 新規11件) |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy -D warnings` | 通過 |
| `cargo test` | 通過(124件 + 1件) |
| `git diff --check` | 通過 |

## 8. 更新した基準画像

| 画像 | 差 | 理由 |
| --- | --- | --- |
| `main-running` | 13,416 px | 今日の3件から開始した Timer を、今やる一手も「実行中」「残り 24:55」「一時停止 / 終了」で表示する |

他の12枚は、閾値 0.001 のまま一致した。更新後の画像は目視で確認した。

## 9. 判断メモ

- **実行中判定を共通化した範囲**: 今日の3件の `isRunningTodayItem` に加え、同じ判定を使う「今日の3件から外す」の無効化(カードのボタン、右クリックメニュー)と、今日やるものを選ぶ画面の `selectedTimerRunning` も `isTimerOnTodayItem` に統一した。今やる一手から開始した Timer の対象項目は、実行中は今日の3件から外せなくなる(従来は外せたが、外すと完了が反映されなくなる状態だった)。
- **Source Lock の編集可否**: `isTimerActiveForSource`(元の次の一手・やりたいことの編集ロック)は変更していない。
- **今日の3件の行**: 今日の3件の開始ボタンは、これまでどおり実行中は「一時停止 / 再開」と「終了」に切り替わる。今回、今やる一手から開始した場合にも同じ表示になる。
- **ケース3**: Source Lock によって、実行中は UI から次の一手を入れ替えられない(ロックのバッジが出て「変更」ボタンがない)。そのため、入れ替え後の表示は、設定を外部から差し替える形(`updateConfig`)で確かめた。
- **残り時間の表示**: 通常「通常 N分」の位置に、カウントダウンは「残り mm:ss」、計測は「経過 mm:ss」を出す。計測では、操作ボタンの左の経過時間(既存)と二重に出る。レイアウトは変えていない。

## 10. 提案(実装していないこと)

- 計測中の今やる一手は、経過時間が説明行と操作ボタンの左の2か所に出る。どちらかに寄せるかは別途判断。
- 今やる一手の候補選びは、今日の3件にある同じ行動を優先していない。P9-05 で実装する。

## 11. CI の結果

(PR 作成後に追記)
