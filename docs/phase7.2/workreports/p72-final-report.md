# Phase 7.2 最終作業報告

日付: 2026-09-10。判定: **PHASE 7.2 MERGED AND VERIFIED**。

## 1. 対象と状態

- repository: `Takuyakou/life-launcher`
- P71最終参照SHA: `c7c28ea4f29c62e738e15e369705a71cb35ae109`
- P72監査開始時main: `873219cc099514fef5be292a01f97aa50d3e3468`
- Phase 7.2 product merge: `4dc39eee8f2b844218646d22eaa5fe6c23586ac0`
- merged main最終検証対象: `4dc39eee8f2b844218646d22eaa5fe6c23586ac0`
- P72-00〜06: PR / CI / merge完了

| Stage | 内容SHA | PR / CI | merge |
| --- | --- | --- | --- |
| P72-00 | `7421292` | #42 / SUCCESS | `96bbf39` |
| P72-01 | `533d015` | #43 / SUCCESS | `c2b5ab9` |
| P72-02 | `b3d2e14` | #44 / SUCCESS | `1134f9f` |
| P72-03 | `39e24d5` | #45 / SUCCESS | `aa34874` |
| P72-04 | `2b6fcf9` | #46 / SUCCESS | `27c803f` |
| P72-05 | `6c5221c` | #47 / SUCCESS | `f607142` |
| P72-06 | `4ce97bf` | #48 / SUCCESS | `4dc39ee` |

PR #32はP72-00で差分を確認し、`CLOSED_UNMERGED`のまま取り込んでいない。Guide/specは現在のmainとP72実装を基準に更新した。

## 2. Phase全体の変更

- Today3 / Builderへ右クリックと「…」の同一menuを設け、Shift+F10、矢印、Escape、focus復帰を維持した。
- Today採用の基本経路をBuilderの「今日へ」に統一した。明示的に除外したsourceだけ「今日の候補に戻す」で候補へ復帰し、Today3へ自動採用しない。
- Builder、Today3、登録元からP71の同じsource editorを開き、成功時だけ元sourceと現在のToday snapshotを1configで同期する。同source Timer中は拒否する。
- 右下Warm Rich Toastを通常4秒、Undo付き8秒、同時3件までに統一した。pointer / focus / document hiddenのOR条件で寿命を停止する。
- Today解除と候補除外へ対象差分Undoを追加した。後続の別項目順序、設定、Session、source、完了履歴を上書きしない。
- NextStep / Wishlistは0〜5件全表示、6〜19件は5件＋展開、20件以上は10件/page。Builderは従来の5件/pageを維持した。
- Today3待機Timerだけ幅90pxへ広げ、高さ36px、label、色、hover分数、title、handler、カード高は維持した。登録元rowの48px密度も維持した。
- Builder候補→Today3、明示除外source→Builderのcross D&Dを追加した。黄色の挿入線、専用preview、500ms一時展開、画面端scrollを持つ。
- 勝利条件、Today3個別、正確な3/3、Do Nowへ保存成功直後だけ約1秒の完了フィードバックを追加した。3件目は3/3を優先する。
- アプリ内Guide、current-spec、日英READMEの古い編集説明を同期し、Web Demo未同期差分を文書化した。

## 3. 保存・identity・履歴

- pointermove、一時展開、一覧展開、page移動では永続保存0回。D&Dは成功dropだけ1回保存する。
- drop直前に日付、stable source identity、source存在、重複、3件上限、active Timerを再確認する。
- 保存失敗ではToday3、候補除外、表示順を変更前へ戻す。UndoはRust保存lock内で最新configとoperation tokenを再検証する。
- 同文Wishlistはstable IDで別項目として扱う。Today snapshot、Session、今日の実行、source completion履歴を別の意味へ流用しない。
- 完了演出は保存成功callbackからだけ発火し、reload、Undo、編集、D&D、既存done読込、保存失敗では発火しない。同Sessionは日付とinstance identityで重複抑止する。

## 4. 検証結果

P72-06のローカル候補 `0ef94f6` に加え、全stage統合後のmerged main `4dc39ee` で再実行した。

| Gate | 結果 |
| --- | --- |
| `npm.cmd ci` | PASS、172 packages、0 vulnerabilities |
| `npm.cmd run public:check` | PASS、merged mainは279 files / 0 blockers |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **238/238 PASS**、merged mainで1.9分 |
| Rust fmt / check / clippy `-D warnings` | PASS |
| Rust tests | 103 unit + 2 capability PASS |
| npm audit 全依存 / production | 両方0 vulnerabilities |
| 指示packet validator | 35 files / 34 hashes / 7 stages / 89 scenarios PASS |
| `git diff --check` | PASS、改行警告のみ |
| Tauri `build --no-bundle` | PASS |
| 隔離Native起動smoke | PASS、window title / handle / 5秒生存を確認 |

Native smokeは専用temporary APPDATA / LOCALAPPDATAで実行した。生成は隔離先の`config.json`と`config.schema.json`だけで、プロセス終了後に専用tempを検証して削除した。既存`Alt+Space`のhotkey競合警告は出たが起動は継続した。使用中の実ユーザーconfig、Session、確認用EXEは変更していない。

## 5. Visual QA

- 1920 / 1440 / 1366 / 1000 / 860px、Today3の3 / 2 / 1列相当、長文、Projectなし、disabled、hover、focusを自動確認した。
- 0/1/5/6/19/20/21/30/100件、19→20、末尾page clamp、stable focusを確認した。
- Toast単体/3件/queue、Undo hover/focus/hidden pause、狭幅、reduced-motionを確認した。
- D&D preview、黄色挿入線、closed Builder 500ms展開、drop-only保存、失敗rollbackを確認した。
- 勝利sweep、個別check、3/3、Do Now、静的done、reduced-motion、演出中の操作可能性を確認した。
- 実Windows DPI 125% / 150%とOS tooltip表示遅延は未実施。Playwright viewport / DPR相当と同一視しない。

## 6. 初回失敗とフレーク

- P72-00追加計測はfixtureのdone継承で5件失敗し、fixtureを明示して解消した。製品不具合ではない。
- P72-01初回は旧仕様selector 5件、その後2件が失敗し、新しい経路へテストを更新した。
- P72-03初回は量fixtureが重点最大3件制約に抵触して9件失敗し、fixtureを修正した。
- P72-05初回は保存失敗checkbox操作と3/3装飾文字の厳密一致で2件失敗し、実契約を検証するselectorへ修正した。
- P72-05途中の全Visualで既存Quickキーボード1件が一度失敗し3件未実行。対象4件は直後4/4 PASS、P72-06の最終全237件は初回PASS。既知の順序依存フレーク候補として残す。
- PR #47のCIでもQuick / Dictionary保存失敗を1テスト内で連続実行するケースが2回失敗した。両方向を独立テストへ分けて状態を隔離し、対象6/6 PASS、更新後CI全gate PASSを確認した。

## 7. Web・安全性・対象外

- Web Demo SHA `9212c0c`にはv1.1同期、Today解除、早期完了まで反映済み。P72の復帰menu、Undo Toast、一覧閾値、cross D&D、完了演出は未同期。詳細は [web-demo-followup.md](../web-demo-followup.md)。Web repoは変更・merge・deployしていない。
- 通信、Tauri capability、permission、dependency、schema versionは追加・変更していない。
- アプリ宣言versionは`1.1.0`のまま。tag、Release、配布asset、確認用EXEを作成・更新していない。
- P71既知制約のうち、旧文面依存Wishlist identity、multi-window stale config、保存fallbackのcrash耐性、開始環境action内容の独立snapshotは今回の対象外。Undoだけは限定command内の最新config再検証で保護した。

## 8. 完了状態

- P72-00〜06はすべてCI成功後にmainへmerge済み。
- merged main `4dc39ee` で全自動gateを再実行し、すべてPASSした。
- Phase 7.2としての実装・文書・回帰確認に残作業はない。正式リリースasset、署名、Defender、fresh-folder smokeは別工程とする。

**PHASE 7.2 MERGED AND VERIFIED**
