# P61-04 総合QA / 引渡しレポート

> この文書はPhase 6.1 stacked PR全体の最終検証記録である。現在仕様は`docs/spec/current-spec.md`、追加仕様は`docs/phase6.1/SPECIFICATION.md`を参照する。
> 検証には公開可能な合成fixtureだけを使用し、実ユーザーデータは変更していない。

## 状態

- Stage: P61-04
- 判定: `PHASE 6.1 READY FOR HUMAN REVIEW — STOPPED`
- Approved base SHA: `6ce15dd9dea7f8a7f6514475562b3d48907481d9`（P61-03承認head）
- Integration / verification SHA: `b6715966111c59a8b9c4b04d026216885e1bb060`
- Branch: `chore/p61-04-followup-readiness`
- PR: [#14](https://github.com/Takuyakou/life-launcher/pull/14)
- PR base: `docs/p61-03-in-app-guide`（PR #13）
- Product version: `1.0.0`（変更なし）

## 適用元と依存順

| Stage | Approved commit | Report | PR / base | 状態 |
|---|---|---|---|---|
| P61-00 | `c2c3d9a142dfefe5b841f06dc0fe8880fcb068a8` | `P61-00-report.md` | #10 / `main` | OPEN、CI PASS、MERGEABLE |
| P61-01 | `3022e77b6ef90dbc2e6217545cc3fb06533ec510` | `P61-01-report.md` | #11 / PR #10 branch | OPEN、CI PASS、MERGEABLE |
| P61-02 | `bf0e742eaec1ea5c265021a2e7323a7c6b423280` | `P61-02-report.md` | #12 / PR #11 branch | OPEN、CI PASS、MERGEABLE |
| P61-03 | `6ce15dd9dea7f8a7f6514475562b3d48907481d9` | `P61-03-report.md` | #13 / PR #12 branch | OPEN、CI PASS、MERGEABLE |
| P61-04 | human review待ち | このreport | #14 / PR #13 branch | review待ち |

旧Phase 6 readinessのPR #9は`main`へMERGED、CI PASS。main側のmerge commitは`66ff0923203deb6be63dce6600d435843182dfd0`で、P61-00のbaseと一致する。未承認commitや別branchの変更は混入していない。

## Phase 6.1の追加差分

- BuilderをProjectの設定済みNextStepとWishlistだけから派生する候補ビューへ整理した。独立候補DB、Session候補、勝利条件候補、追加form、送付先select、dismiss UIを持たない。
- NextStep/Wishlist/Builderの`今日へ`を同じ非破壊採用契約へ接続した。3件上限、stable source identity、保存失敗rollbackを維持する。
- Wishlistへ後方互換stable IDを追加し、旧データの欠落IDをload時に一度だけ補完する。同文項目を別identityとして扱う。
- Today3採用時に本文、Project、起動action、手順書、通常/短時間分数をsnapshotする。採用後のProject編集で実行条件を変えない。
- Wishlistの追加を本文専用の小さいmodalへ変更した。既存Wishlist編集とNextStepの詳細Project作成能力は維持する。
- アプリ内Guideを現在の登録、選択、開始、満了後終了確定、次batchの流れへ同期した。
- P61-04では製品コード・権限・依存packageを変更していない。統合QA、状態記録、引渡しreportだけを追加した。

## 維持したPhase 6機能

- Today3は0〜3件、3→2→1列responsive、D&D順序、完了表示、3件完了後の手動次batchを維持。
- TimerはDo Now/Today3から開始し、満了dialog表示だけでは完了しない。満了後に`終わる`を確定した項目だけを完了にする。
- 1分未満/以上の手動停止、pause/再開、別Timer切替、Session重複防止の既存条件を維持。
- Quick/辞書のkeyboard・context menu・D&D、100件超filter、Explorer表示のID境界を維持。
- Tauri capability/permissionに差分なし。既存の最小権限contract 2件がPASSした。
- 今日の勝利条件、Project編集、手順書、記録、設定など今回対象外の入力・閲覧能力を維持。

## Today3 / Builder操作マトリクス

| 領域 / 状態 | 表示・操作 | 保存契約 | 自動確認 |
|---|---|---|---|
| Today3 0件、候補あり | `今日の候補を見る`からBuilderへ移動 | 開閉だけで候補データを保存しない | active count 0、source registration |
| Today3 0件、候補0 | Wishlist / NextStep登録元を案内 | Today3自由入力なし | source-only / registration test |
| Today3 1〜3件 | 短時間/通常開始、既存D&D | 3件上限、drop時保存、stable identity | active count 1〜3、responsive、completion |
| Today3満枠 | `今日へ`は4件目を作らず短いfeedback | source不変、成功扱いなし | full-limit adoption |
| Today3 3件完了 | `次の3件を選ぶ`でBuilderへ案内 | 履歴保持、勝手な補充なし | next-batch 1/2/3件、4件目拒否 |
| Builder 0/1/5/6/10/11/50件 | 5件/page、正しい件数とclamp | sourceから毎回派生、候補DBなし | pagination / clamp / 50件 |
| Builder行 | `今日へ`のみ。追加/select/dismissなし | source保持、共通adoption、失敗rollback | source-only / non-destructive / rollback |
| Builder D&D | 掴み・移動先を表示 | pointermove中は保存せずdrop時だけ順序保存 | drop-only persistence |

## 互換性確認

| 対象 | 結果 | 根拠 |
|---|---|---|
| 旧dismiss値 | PASS | 値を保持するが新Builderのfilterへ適用せず、新規dismiss値を生成しない |
| 旧Wishlist IDなし | PASS | Rust migrationが一意IDを一度だけ補完し、再loadでも安定 |
| 同文Wishlist | PASS | stable IDで別候補を維持。旧文字列selectionは先頭1件だけへ対応 |
| 旧Today3 sourceKeyなし | PASS | load時のstable key補完とlegacy完了normalizationをRust testで確認 |
| 旧Today3 timer snapshotなし | PASS | Project値を一度補完し、その後のProject変更には追従しない |
| Session-source/manual Today3 | PASS | Today3表示・Timer連携を残し、Builder候補から外すだけで履歴を削除しない |
| Timer満了 / 手動停止 | PASS | 満了後終了確定だけ完了。手動停止はToday3未完了、既存記録条件を維持 |
| pause後の別Timer | PASS | 古いpause Timerを終了してactive Timerを1本に保つ |

## Guide照合

| Guide記述 | 実装 | 結果 |
|---|---|---|
| WishlistまたはNextStepへ登録 | source sectionの追加UI | 一致 |
| Builderは登録済み候補から選ぶ | Project.nextStep + Wishlist派生 | 一致 |
| `今日へ`でToday3へ採用しsourceを残す | 共通`addCandidateToToday` | 一致 |
| Today3は一度に3件 | `TODAY_ITEM_LIMIT`と次batch | 一致 |
| 開始はDo Now / Today3 | Builder/NextStepに開始buttonなし | 一致 |
| 満了後`終わる`で完了 | completion prompt確定処理 | 一致 |
| Wishlist追加は小さいmodal | 本文専用dialog | 一致 |
| 手順書はMarkdown / Text / HTML | viewerの既存対応 | 一致 |

Guide専用4件は文言、旧説明不在、目次focus、focus trap、Escape/backdrop、860px/760px境界を確認した。Guideは内部データ階層の暗記を要求せず、ユーザー操作の順で説明している。

## 旧55件からのcoverage更新

Phase 6基準の55件を69件へ更新した。廃止仕様を期待していた次の5件を新契約へ置換した。

| 旧test | 新test / coverage |
|---|---|
| Builder save/delete/restore | source-only、pagination、legacy dismiss無視 |
| Today3にescape pathなし | 候補あり/なしのselection path |
| 最終page itemのBuilder delete | source消失時のpage clamp |
| Builder delete to zero/dismiss persistence | 旧dismiss保持・無視、新dismiss書込なし |
| section add flows | 登録元だけで追加しreload後も維持 |

追加coverageはstable Wishlist identity、legacy同文selection、採用時snapshot、Builder drop-only保存、Guide 4件、Wishlist modal 6件。既存Quick/辞書/Explorer/Timer/Today3/公開画像の無関係coverageは残り、全69件が実行された。

## Before / After目視

- Before: `docs/phase6/screenshots/today-builder-5-items.png`
- After Builder: `docs/phase6.1/screenshots/p61-01-builder-source-only.png`
- After Wishlist modal: `docs/phase6.1/screenshots/p61-02-wishlist-modal-1440.png`
- After Wishlist modal narrow: `docs/phase6.1/screenshots/p61-02-wishlist-modal-860.png`
- After Guide: `docs/phase6.1/screenshots/p61-03-guide-860.png`

同じ合成fixtureで比較した。After Builderには追加、送付先select、Session候補がなく、候補行の`今日へ`、5件page、件数が明瞭。modalは1440/860で同じ最大幅を保ち、本文・validation・buttonに重なりや横見切れなし。Guideは860pxで目次、本文、footerがviewport内に収まり、長い日本語は本文幅で折り返される。

## 最終検証

| コマンド / 検査 | 結果 | 件数 / 備考 |
|---|---|---|
| `npm.cmd ci` | PASS | 172 packages追加、173 packages監査、脆弱性0 |
| `npm.cmd run public:check` | PASS | 173 files、blocker 0 |
| `npm.cmd run lint` | PASS | warning 0 |
| `npm.cmd run build` | PASS | TypeScript + Vite production build |
| `npm.cmd run test:visual` | PASS | 69/69、browser-level Tauri mock |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | 差分なし |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | dev profile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS | warning 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 95 unit + 2 capability contract |
| `npm.cmd audit --audit-level=low` | PASS | 脆弱性0 |
| 代表画像目視 | PASS | Before 1枚 / After 4枚 |
| `git diff --check` | PASS | whitespace errorなし |

## 現物未確認・既知課題・人間判断

- 実Tauri GUI smokeは未実行。repositoryに実ユーザーデータから分離する既存smoke harnessがなく、使用中アプリと実configを触らない制約を優先した。Rust native test 95件、capability contract 2件、browser-level mock 69件はPASSしている。
- P61-04で新しいTauri API、permission、network access、dependencyは追加していない。
- 人間確認対象は代表画像の情報設計、Wishlist modalの簡潔さ、Guide文言、4本のstacked PRをmainへ入れる判断である。
- version 1.1.0、配布EXE/Installer/ZIP、tag、Release、README、Web Demoは別作業。Phase 6.1の実装readyと公開readyを混同しない。

## merge順序案（実行しない）

1. PR #10（P61-00）
2. PR #11（P61-01）
3. PR #12（P61-02）
4. PR #13（P61-03）
5. PR #14（P61-04）

各PRは直前branchをbaseにしたstackである。main統合時は依存順を守り、各merge後に後続PRのbase差分とCIを再確認する。

`PHASE 6.1 READY FOR HUMAN REVIEW — STOPPED`
