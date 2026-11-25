# Life Launcher 全テスト整理監査

> 本書の「結論」から「確認の限界」までは、実装前に行った静的監査の記録である。候補表・行番号・件数は当時の履歴として残している。承認後の変更と確定した検証結果は、末尾の「実施結果（完了版）」を参照。最終Playwrightは373件全PASS（失敗・skip・flaky各0件）。これはテスト整理の検証結果であり、ネイティブEXEの手動起動や実Windows shellの動作確認は今回実施していない。提出ブランチへの整理であり、マージは未実施。

## 結論

削減の中心は、古い仕様の無効テスト、同じ操作を複数フェーズで繰り返すブラウザテスト、モックが作った結果の自己検証、比較に使われていない自動撮影である。短い境界テストを件数のために削るより、これらの重複実行と保守負担を取り除く方が合理的。

当初の静的監査では削除・統合の提案だけを作成し、テスト・アプリのコードは変更しなかった。残す理由は「念のため」ではなく、誤削除、二重保存、別世代の項目の完了、保存失敗後のデータ消失など、検出できる具体的な故障で判断した。承認後の実装は末尾の実施結果に記録している。

## 対象と方法

- 開発フォルダの作業ブランチ: `fix/p810-shortcut-badge-visual-match`、`aff3fe4202ab7ce99b7c2b35cb012e64c1a04594`。
- 追加照合: ローカルにある `origin/main` の `1b1299411e341407708ebe8abb967ccd461a0e14`。ネットワーク上の最新状態を保証するものではない。
- 作業ツリーは Playwright 62ファイル・434テスト宣言。上記 main は66ファイル・471テスト宣言。ループ展開前の構文解析数であり、実行ケース数ではない。撮影用・skipも含む。
- main にだけある `post-v133a-additional-fixes`、`post-v133b-captures`、`post-v133b-followup`、`post-v133c-followup` も読み取り対象に含めた。変更された既存テストも差分確認した。
- Rustは12ファイル、作業HEADの134個とmainの135個の `#[test]` を対象。共通モック・fixture、公開安全性スクリプト、Playwright設定、CI経路も確認した。
- 過去の整理コミット `ff14111` とそのマージ `9bc3685` は、今回の作業HEADにも上記 origin/mainにも未反映。過去の削除判断をそのまま再採用せず、内容を再評価した。
- 当初の静的監査では既存の未コミット変更に触れず、Cドライブへの生成、ビルド、テスト実行、マージ、pushも行わなかった。実装後の検証とは区別する。

ソースを読んだ静的監査であり、実測の実行時間・不安定率・削除後の成功を測ったものではない。以下のコスト評価は、ブラウザ起動回数、操作数、固定待機、画像出力、期待値の実装依存からの定性的な評価。削減秒数やカバレッジ維持率は算出しない。

## 判断区分

- **削除**: その検査が独立して守る実用上の保証がない、または他の現存テストが同じ経路を守っている。
- **統合**: 固有の確認事項を指定した残存テストへ移してから、重複するテストを削除する。移す前の丸ごと削除は不可。
- **置換**: 実装依存の期待値を除き、利用者に見える結果や公開された呼び出し境界の検証にする。
- **維持**: 削除すると現実的な故障を見逃す。安価なテストの単なる表形式化は、削減効果として数えない。

各表の行は整理の単位であり、削除できるテスト件数ではない。同じテストが複数の論点に登場するため、行数を合計して削減件数として扱わない。

## 共通の候補

| 対象 | 判断と理由 | 削ると失うもの・残すもの |
| --- | --- | --- |
| `scripts/check-public-safety.mjs:121` の `selfTest()` | 削除。テスト内で別に書いた正規表現にサンプルを当てており、本番の `checks` を通していない。トークン用の式も本番と異なる。`Set.has` と許可リストの要素数30の固定は定義の言い換え。 | 本番検出器の故障は現在も拾えない。`phase72-public-safety.spec.ts` の実CLIに安全・危険ファイルを渡す検査とCIの `public:check` は残す。 |
| `tests/visual/tauriMock.ts:79`、`:94`、`:418`、`:491`、`:604` 付近の独自日付・初期設定・記録・検索・リセット/復元ロジックを期待値として再検証するassert | 部分削除。モックをバックエンドの第二実装にしてもRustの故障を検出できない。 | UIが送る引数、成功/失敗応答への反応、表示更新は残す。実ファイルの保護、日付境界、復元整合性はRust側の本物の関数を使うテストへ責務を置く。モック自体を一括削除する提案ではない。 |
| 成功時の `page.screenshot()` / `locator.screenshot()` | 通常CIから外し、必要な撮影だけ手動実行へ。全specを検索した範囲で `toHaveScreenshot` / `toMatchSnapshot` の画像比較はない。CIにもこれら撮影結果を掲載する工程がない。 | 画像保存だけでは画像差分の回帰を自動検出しない。現在ある位置・幅・操作のassertは維持し、設定済みの失敗時スクリーンショットは残す。公開用 `public-screenshots.spec.ts` は既に `@manual` であり通常CI削減効果なし。 |
| `phase89-main-display.spec.ts:145` などの画面幅×表示サイズの直積 | 統合。全幅で同じ操作を繰り返す代わりに、表示サイズ切替を1経路、横幅検証をレイアウト分岐と最大サイズの代表に整理。 | 削った特定幅でしか出ないはみ出しは見逃し得る。`styles.css` の700px、1050/1051pxなど関係する分岐を確認して組み替え、単純に中間幅を全削除しない。長文・低い画面・DPIは幅と別の故障条件。 |
| ホバーの固定待機140/180msを繰り返すテスト | 重複するスタイル検査を統合し、残す検査は状態を待つassertへ。固定待機だけの削除では動作保証にならない。 | プロジェクト別ホバー色、クリック後の色残り、focus-visible、操作不能は実際の回帰なので各固有経路を残す。ミリ秒値やtransformの係数そのものの固定は外す。 |

### 通常CIで不要な撮影処理の所在

`phase62-today-layer`、`phase72-selection-edit-menus`、`phase81-layout-qa`、`phase82-countup-ui`、`phase82-nextstep-wishlist`、`phase83-settings-maintenance`、`phase84-do-now-ranking`、`phase84-nextstep-create-pick`、`phase84-section-empty-state-polish`、`phase84-today-picker`、`phase84-wishlist-nextstep-hover`、`phase89-main-display`、`phase810-activity-axis`、`phase810-expanded-timer`、mainのみの `post-v133a-additional-fixes`、`post-v133b-captures`、`post-v133c-followup`。無効テスト内の撮影は既に実行されないため、削減効果を二重計上しない。

## 無効化されたテストの整理

以下はすべて `tests/visual/` 内。合計41個の `test.skip` 宣言のうち、39宣言は削除候補、toast寿命/queueの2宣言は現行操作へ置換する候補。現在のCIでは実行されないため、削除によって新しく見逃す不具合も実行時間の短縮もない。削減効果は古い仕様の混在と保守負担の除去。ファイル全体ではなく、記載行から始まる無効テストだけが対象。

| ファイル | 対象の開始行 | 内容・現行の確認先 |
| --- | --- | --- |
| `dashboard-disclosure-context.spec.ts` | 39, 80 | 旧バー/Builder移動。現行開閉は `phase87-followup-polish`、現行選択は `phase84-today-picker`。 |
| `phase6-main.spec.ts` | 114, 265 | 旧3列階層・Builderページング。現行配置・Pickerに置き換わっている。 |
| `phase6-readiness.spec.ts` | 75, 96, 236, 249, 289, 315 | 旧開始場所制限、件数ループ、Builderドラッグ、旧除外データ。現行 `phase84` の選択・D&Dが担当。 |
| `phase62-today-layer.spec.ts` | 44, 128, 175, 200, 218 | 常設Builder、除外、グループ展開、旧タイマーロック。現行PickerとSource Lockの有効テストへ責務を置く。 |
| `phase72-cross-dnd.spec.ts` | 68, 89, 115, 145, 174, 194, 219, 238, 292, 307, 346, 395 | 旧Builderを前提とした12宣言。現行 `phase84-nextstep-today3-dnd`、`phase84-today-remove-dropzone` の有効検査は残す。 |
| `phase72-followup-five.spec.ts` | 135, 175 | 旧Builderへのドラッグ案内。 |
| `phase72-selection-edit-menus.spec.ts` | 61, 75 | 旧Builderの空状態とメニュー。 |
| `phase72-toast-undo.spec.ts` | 69, 137, 175 | 69の旧候補除外は削除。137のUndo寿命と175の待ち行列は今も実装されているため、旧Builder操作を現行操作へ置換して救済する。無効テストのまま残すことも、要件ごと削ることも推奨しない。 |
| `phase8-today3-builder.spec.ts` | 20, 71, 89 | 旧空状態・Builder採用取消・追加場所。 |
| `phase82-nextstep-wishlist.spec.ts` | 574 | 旧Builderからの除外。 |
| `phase83-main-action-hover.spec.ts` | 239, 350, 553 | 旧採用ボタン・除外操作・旧アクション幅ループ。 |

## Rust の削除と統合候補

行番号は作業HEAD基準。mainだけの変更は別記。

| 対象 | 判断・整理方法 | 削除で失う保証と残す検証 |
| --- | --- | --- |
| `models.rs:1151 sample_config_uses_v3_nested_next_step` | 削除。テスト専用sampleの固定文言・versionを検査しているだけ。 | 本番初期化の保証は失わない。`initial_config_is_a_generic_empty_shell` と `v2_*` 移行テストを残す。 |
| `commands/icons.rs:1087 icon_source_path_uses_explicit_file_source` | 削除。明示ソースとactionのパスが同じなので、優先順位が逆でも通る。 | 同値入力の確認のみを失う。異なるパスを使う `icon_source_path_prefers_explicit_source:1038` とOpenFile fallbackを残す。 |
| `tests/capability_contract.rs:108 webviews_do_not_receive_unused_opener_or_global_shortcut_permissions` | 削除。1本目の完全な許可リスト一致に包含される。 | 独立した検出力なし。`window_capabilities_match_the_reviewed_least_privilege_contract:27` はセキュリティ境界として維持。両方を消さない。 |
| `commands/config.rs:4738 config_v3_rejects_active_and_pending_next_step_settings_together` | 削除。`production_load_blocks_unsafe_roots_and_preserves_original_bytes:4476` の active and pending v3 ケースが同じデコーダを通り、保存禁止・元データ保全まで確認。 | 独立した単体診断とエラー文言の部分一致のみを失う。競合入力の拒否自体は本番ロードテストで維持。 |
| `commands/sessions.rs:905 next_step_suggestions_are_unique_and_project_scoped` | 現行の抽出ロジックコピーを削除・置換。本番 `load_next_step_suggestions` を呼ばず、テスト内でfilter・重複排除を自作している。 | 本番の絞り込み・重複排除・5件制限は現在も守れていない。実際の共通処理を呼ぶ検査に変更し、複数行の追記・読戻しを残す。丸ごと削除だけではこのI/O確認も失う。 |
| `commands/reset.rs:1232 isolated_native_backend_clean_start_smoke_supports_first_workflow_after_reset` | 縮小・統合。Committedフェーズと初期状態確認を `reset_creates_canonical_fresh_state_and_preserves_external_data:1220` へ。後半はマーカーを自ら消し、構造体を直接保存する疑似操作。 | リセット後のJSON往復は失うが、本物の再起動・作成コマンド・セッション記録の保証は現状もない。実リセットの外部データ保全・復旧テストは残す。 |
| `commands/icons.rs:1063 icon_source_path_uses_open_file_for_shell_icon` と `:1012 icon_source_path_uses_first_local_action` | ケースを1つの表へ統合して同じ巨大なButton準備を削る。明示ソース優先も共通fixture化可能。 | OpenFile固有分岐を削れば取りこぼす。入力行は維持する。実行時間の大幅短縮ではなく保守負担の低減。 |
| `commands/sessions.rs:1203 do_now_candidates_prioritize_focus_without_using_it_as_eligibility`、`:1238 do_now_candidates_use_manual_order_for_equal_state_and_empty_without_steps` | `:1108 do_now_candidates_include_non_focus_exclude_empty_and_use_manual_order_for_ties` と重複fixtureを統合。 | 空の重点対象からのfallback、履歴なし同順位、全候補空の各条件は残す。同日時刻順:1057、非重点の日付順:1154は別の故障を守るため削らない。 |
| `commands/config.rs:3856 hidden_button_is_removed_and_reappears_at_dictionary_order_end_after_saves` | 状態遷移を `:3471 normalizes_dictionary_order_independently_and_idempotently` に移し、重複する環境変数・実ファイル準備を削減。 | 再表示後の末尾追加は維持。ディスク往復は `:3783` の移行ロードで担当するが、再表示シナリオ固有の往復保証は薄くなる。現在もsave_config自体は呼んでいない。 |
| `commands/config.rs:2924 start_environment_fields_are_optional_and_instruction_references_follow_changes` | Today/Inbox改名・削除を `:2964 instruction_reference_update_preserves_unrelated_config_and_rewrites_descendants` へ統合。旧Inboxデコードは互換性の表へ移す。 | Projectと別ループで更新するToday/Inboxを消すのは不可。固有ケースを維持し、準備だけ削る。 |
| `commands/config.rs:2898 project_optional_fields_default_for_v3_config`、`:4175 source_completion_history_is_optional_for_legacy_config` | `:3248 v120_optional_fields_keep_v113_and_partial_configs_compatible` に最小入力のケースを統合。低優先。 | 任意フィールドが必須化される故障を拾うケースは残す。大きな正常fixtureだけで代替しない。 |
| `commands/config.rs:4748 config_v3_decoder_accepts_v2_then_accepts_written_v3_without_remigration` | `:4690 config_v2_to_v3_value_migration_is_idempotent_and_preserves_snapshots` に型デコード・再保存の往復を統合。 | JSON値の移行と、実際の型復元は異なる。デコード経路を削らず重複準備を減らす。 |
| `commands/config.rs:4320 undo_today_selection_accepts_frontend_defaulted_source_snapshot` | 置換して `:4364 undo_candidate_exclusion_does_not_adopt_when_it_removed_no_today_item` に統合可能。Project直下へbuttonIdsを足しており、現行のnextStep.buttonIdsのdefault差を作れていない。 | 現状は未知フィールド無視の確認に近い。正しい入れ子で、省略と空配列によるUndo拒否の故障を検証する。 |
| `commands/reset.rs:1383 preflight_rejects_uncleared_or_unapproved_local_storage` | 不要な実ファイルfixtureだけ削る。preflight条件の検査は維持。 | 条件分岐の検出力は失わない。ファイル準備に依存した副次確認は目的外。 |
| `commands/explorer.rs:228 dispatch_returns_a_generic_error_without_exposing_the_path` | 不要な実ファイル準備だけ削る。エラーにパスを漏らさない検査は維持。 | エラー内容の保証は失わない。実際のExplorer起動成功を検証するテストではない。 |

### Rust で残す検証

`config_v3_decoder_rejects_non_object_root_without_panicking` は本番ロードの配列拒否と同じではない。ロードはデコーダより手前で拒否するため残す。`same_version_overlay_migration_requires_backup` も辞書順変更のバックアップとは別条件。

実ファイルの置換失敗時保全、各リセット変更境界のrollback、破損journal・snapshot、外部参照の保護、Undoの世代/操作token競合、長パス、ハードリンク/シンボリックリンク拒否、危険なfavicon取得先・リダイレクト・容量制限は維持する。これはライブラリ一般論の再確認ではなく、このアプリが外部入力を安全に扱えるかの確認。

`display_awake.rs` の2テストも、最後の利用者で解除すること、期限切れ、解除失敗からの再試行を守るため維持。

main追加の `sessions.rs:1332 crossing_midnight_session_uses_its_recorded_end_day_without_changing_old_rows` は保存済み日付によるフィルタの確認として維持。ただし記録時の日付算定・旧ファイル不変まで検証したとは扱わない。

## フロントエンドの入力と表示

以下のファイルは特記がない限り `tests/visual/` 内。`名前…` は同ファイル内のテストタイトルの先頭部分で特定する。

| 対象 | 判断・統合先 | 削ると見逃すもの・費用対効果 |
| --- | --- | --- |
| `phase8-guide-sync.spec.ts:106 Overview and current spec stay concise and synchronized` | 削除。文書のversion 1.3.0、100行上限、説明文の固定を廃止。 | 文言の変化のみを失う。リリース資産のリンク整合性とは別であり、文章を読みやすく直すたびの修正負担が大きい。 |
| 同ファイル `:30 Guide has the beginner ten-section structure…`、`:54 Guide uses current labels…` | 文章を羅列する2件を1件の操作確認へ置換。目次選択→対応見出し→閉じる→フォーカス復帰。 | 文章・節数の完全一致は失う。目次の結線不良は現在の文章列挙より直接守れる。Guideの低高さフッター検証は別途残す。 |
| `phase8-entry-forms.spec.ts:47 Phase 8.1 separates Project metadata…` | metadata作成を `phase81-entry-contracts:111`、新規NextStepとtrigger保存を `phase84-nextstep-create-pick:28` へ移して削除。 | 固有保存assertを移せば成功導線の独立した損失は小さい。見出し全列挙を捨て、重複起動を減らす。保存待機・二重送信・失敗時draftは残す。 |
| `phase8-entry-forms.spec.ts:179 P8 form actions fit at 860…`、同 `:89` の固定RGB検査と色確認だけの環境Picker開閉 | `phase81-layout-qa:357` の狭い画面での到達性とTab操作へ統合。 | 各モーダル固有のはみ出しは、対象の低高さ/狭幅確認を残した場合にのみ代替できる。検索・キャンセル時の旧選択保持・適用は削らない。 |
| `phase8-records.spec.ts:136 older notes stay collapsed until requested` | `:105 all records supports filters…` の操作確認に短い開閉を統合。 | 折りたたみの確認を移せば損失なし。起動1回を削減。`:153` の幅違いは狭幅を主とし、860側は同じ分岐か確認して削減。 |
| `phase8-records.spec.ts:105` の検索後件数 | モックの絞り込み結果だけを本番検索の保証にしない。送信する検索条件・返った行の表示へ検証を絞る。 | Rustの検索計算は現在も未検証。記録の編集・キーボードメニューと履歴snapshot・ページングの `:80` は独立した本番UI処理なので維持。 |
| `phase8-dictionary-state.spec.ts:162 dictionary focus states stay bounded at …` | 1440幅の繰り返しを縮約候補。860側と、検索・再表示・削除後fallbackの各状態遷移を残す。 | 広幅限定のはみ出しは失う。低い価値の幅違い1起動を減らすが、ページと項目のfocus分離は削らない。 |
| `phase81-layout-qa.spec.ts:128 source layout stays bounded…`、`:357 metadata and NextStep dialogs remain usable…` | 5幅の共通旅程と860/620のモーダル旅程を、実際の列切替・低高さ・最小幅の代表へ縮約。画面数を一律3件などに固定しない。 | 削った幅だけの崩れは見逃す。1000付近の2列、空/長文、入力へのfocus復帰を残す。手動撮影以外の出力は除去。 |
| `phase81-source-followup.spec.ts:201 old Today snapshot never clears its replacement NextStep` | `phase81-generation-boundary:103 same-text A completion leaves B and history unchanged` へ旧Today全体保持assertを移して統合。 | 同文面の別世代を守る方が文字列同一視に強い。安価な純粋関数テストなので優先度は低い。逆方向のDo Now B完了テストは残す。 |
| `phase83-clean-start.spec.ts:116 clean start remains usable…`、`:216 reset backup remains selectable…` | canonical設定の複製一致、モックのbackup内容、externalSentinel、restoreCountの自己検証を削除。sessions内部参照を `record_session` 引数とUI表示へ置換。 | 本物のファイルや外部参照を守れていたわけではない。リセットされた画面から作成→採用→計測→表示、および復元要求と成功画面は維持。モックの第二実装を保守する負担を減らす。 |
| `phase83-settings-maintenance.spec.ts:180 Maintenance visual QA at …` の2ケース | `:79 Maintenance groups keep immediate and confirmed handlers` を狭幅でも操作可能と検証してから削除、撮影は手動へ。 | 既存は可視性と画像保存だけ。フッターが本当に押せることまで移せば通常CIの独立価値はほぼない。 |
| `phase83-software-reset.spec.ts:118 backup choice uses gold…` | 危険側の識別を `:88 backup choice cancel and final Escape…` に統合し、単独起動を削除。 | 固定RGB値だけは維持しないが、危険な操作とキャンセルが区別できる検証を残す。 |
| 同 `:267 no-backup reset success…`、`:409 reset freeze ignores watcher reloads…` | `:284 duplicate final dispatch invokes prepare and reset only once` にbackup未呼出し、restart画面、watcher無視を移して統合。 | 固有のwatcher競合assertを移す前には削らない。backup失敗、部分clear失敗、storage復旧、実行中/一時停止中拒否は別分岐として維持。ブラウザstorageは本番UIが操作しているためモックsentinelと混同しない。 |

## 今日の選択と実行の統合

| 対象 | 判断・統合先 | 削ると見逃すもの・費用対効果 |
| --- | --- | --- |
| `phase8-today3-builder.spec.ts:54 P8 completed Today3 cards stay visible…` | `phase72-completion-feedback:212 the third completion prioritizes one 3-of-3 milestone…` に3枚残存・完了表示・開始非表示・3/3を移してから削除。skip3件も削ればファイルを廃止できる。 | 初期ロード時の完了状態は別に残す。1/1・2/2を誤って次の3件扱いしないことは、元テストの名前だけでは保証されていない。 |
| `phase82-nextstep-wishlist.spec.ts:239 promotion returns the old NextStep and survives reload` | `phase81-entry-contracts:287 Wishlist promotion starts from a reset execution package` に再読込後表示・旧項目返却の固有assertを移して削除。 | 実行設定リセット、Today不変、無実行/無記録は維持。異なる入口の `phase84-nextstep-create-pick:74` は保存結果の繰返しを減らし、入口の結線は残す。 |
| `phase82-nextstep-wishlist.spec.ts:857 Wishlist item drop sets or replaces a NextStep…` | 同 `:809 Wishlist D&D always promotes to the source Project` に旧一手返却・buttonIds・ガイダンスを統合候補。 | 異なるProjectへ落とす経路と同じProjectへ落とす経路は区別する。同一処理へ収束することを確認できた範囲だけ削り、通常drop分岐の固有保証は残す。 |
| `phase84-nextstep-create-pick.spec.ts:113 NextStep picker blocks unfinished Today sources` | 削除候補。`phase84-source-lock-ui:49 unfinished Today3 locks only the matching Wishlist identity` に同じ条件と解除後操作がある。 | matching identityの拒否は残る。単純ロック確認の重複起動を削減。 |
| `phase84-e2e.spec.ts:130` のNextStep/Wishlist除去とUndoの2ケース | `phase84-today-remove-dropzone:120` の同2sourceテストへ集約して削除。 | 後者はsourceCompletions不変も確認。snapshot・順序を残す前提で固有損失はない。 |
| `phase84-e2e.spec.ts:56 empty Today selects NextStep then Wishlist…` | `phase84-today-picker` の採用テストに、途中決定→再開・両source保持を移して削除。 | 移さないと再開後の選択保持を失う。その他のe2e2件も下記に統合後、重複e2eファイルを廃止可能。 |
| `phase84-e2e.spec.ts:167 Do Now remains available with zero focus…` | `phase84-do-now-ranking:67 Other Step cycles every ranked candidate without mutating config` が包含。削除。 | 固有の順位計算は元から検証していない。応答順の表示と循環は残る。 |
| 同 `:187 mixed focus ranks the focus Project first…`、`phase84-do-now-ranking:46 mixed focus response shows…` | 理由表示をranking側へ移し、前者削除。後者は `:24 one focus-OFF Project…` に空NextStepの重点Projectを含めて統合。 | 順位をfixtureで指定しただけなのでRustランキングの証拠にはならない。表示理由・候補1件時の他の一手非表示は維持。 |
| `phase84-today-picker.spec.ts:41 Today count/3 exposes…` の1/3版 | 0件の入口と満杯遷移で挟み、1件だけの起動を削除候補。 | 1件時だけの表示不良は失うが、選択後1件の状態を本採用テスト内で確認できる。 |
| 同 `:87 Today 3/3…`、`:100 Picker shows NextStep and Wishlist…`、`:200 reaching 3/3…`、`:499 Picker separates selected items…`、`:526 moves a selected Wishlist item only to Today3` | `:162 selection preserves source and snapshot…` を主とし、NextStep/Wishlist採用と満杯遷移の少数ケースへ統合。旧除外キー無視、選択済み候補の消去、3件目保存後の自動閉鎖/通知/入口非表示、再開後表示を移す。 | 固有assertが多いため、単一の巨大な旅程にせず機能単位へ分ける。保存失敗 `:332`、取消復元 `:222` は残す。 |
| 同 `:317 removal is button-only and exposes no drag-and-drop affordance` | 非draggable・dropzoneなしを `:253 removes selected cards directly…` に移して削除。 | Picker内で誤ったD&Dが使える退行を引き続き守る。二重起動だけ除去。 |
| 同 `:602 destination slots separate project identity…`、`:670 Today add reuses the Project gold grammar…` | 単独テストは統合候補。意味のある項目識別を採用テストに、共通色/ホバーを代表スタイル検査へ。SPANタグ、11px間隔など実装値の固定は削除。 | 出自と本文が区別できなくなる故障は残す。固定タグ・パレット値の変更だけで落ちる負担を取り除く。 |
| `phase84-today-remove-dropzone.spec.ts:92 Remove Drop Zone spans…76px…` の3幅 | 実drop成功の `:120` と狭幅 `:292` に領域収容を移して、寸法だけの3起動を削減。 | 中間1000幅固有の崩れは弱まる。上/下拡張 `:267`、範囲外 `:281`、狭幅下側 `:292` は異なる命中判定を守るため残す。 |
| `phase82-countup-core.spec.ts` の `SESSION_MINIMUM_MINUTES === 1` 単独assert | 直前/直後の実動作assertがあるため、定数値そのもののassertは削除可能。5本の関数テストは残す。 | 定数宣言の綴りだけを失う。nullなら満了しない、分の切捨て、pause、開始時刻1000に対する満了直前300999/満了301000の境界は現実的故障なので削らない。 |

## スタイルとレイアウトの整理

装飾のテストを一律に無価値とはしない。過去に報告された幅不一致、プロジェクト色の不一致、閉じるボタンの欠けは現実の不具合。固定CSS値ではなく、実際の配置と操作を少数のテストで守る。

| 対象 | 判断・整理方法 | 残す保証・許容する損失 |
| --- | --- | --- |
| `phase83-main-action-hover.spec.ts:138 semantic modifiers win existing selector specificity` | 人工DOMでのclass/RGB検査を削除候補。実画面の代表ボタン検証へ。 | 人工的なselector組合せだけの退行は失う。本番で利用する肯定/危険/中立の見分けとhoverを残す。 |
| 同 `:155 Today empty CTA matches…`、`:166 Records positive action wins…`、`:207 edit and configure buttons use…`、`:289 Do Now alternate uses…`、`:528 Records actions use semantic classes…` | 同じパレットやclassを別画面で反復する起動を統合。shared grammarの代表と、本当に固有なカスケード差だけ残す。 | 各場所だけのスタイル上書きを全件では追わなくなる。その代償を明記し、操作可能性・「次の一手を見る」の中立色など現在の個別契約は代表に含める。 |
| 同 `:178 gold and neutral actions share the 120ms interaction primitive`、`:274 gold create hover and active keep their dimensions` | 代表1件へ統合し、0.12s、0.985、class名の固定を削除。hover/focus/押下で見分けられること、レイアウトを動かさないことを確認。 | アニメーション係数の変更は許容。reduced-motionの `:333` は維持。固定待機の繰返しを減らす。 |
| 同 `:314 Today instruction and remove actions keep neutral geometry`、`:377 Today3 cards use the same…surface and lift…`、`:421 timer controls and NextStep cards keep…dimensions` | 操作領域収容をcountupのレイアウトへ、色整合性をSource Lockの色検査へ移し、固定値専用部分を削除。 | タイマー操作が他の文字に重なる故障は維持。全場面の厳密な同一寸法・浮上量の固定は失う。 |
| `phase84-wishlist-nextstep-hover.spec.ts:46 Next Step card hover border follows its project color` | `phase84-source-lock-ui:88 Do Now, Today3, and NextStep use their Project hover color` に同じNextStep色が含まれるため統合可能。 | **Do Nowだけの検査を代替にはしない。** Today/NextStepは別selectorなので代表1件内で各対象を確認。`phase84-do-now-ranking:100` の候補切替後に古い色が残らない検査も別に残す。 |
| `phase84-wishlist-nextstep-hover.spec.ts:64 Wishlist promote action is status-aware…` | class配列・固定RGB・撮影を縮小。hover/focusで操作が現れる、Enterで開く、二重設定済み状態、520幅で非重複は維持。 | 装飾の完全一致だけを失う。ボタンが使えなくなる故障は残す。 |
| 同 `:196 Today activity keeps its automatic badge inside the compact trailing lane` | `phase810-activity-axis` の右端整列確認に必要な非重複を移して削除。8〜24pxの余白固定は不要。 | badgeを含む表示崩れは代表で守る。厳密な余白値の変化を許容する。 |
| `phase82-countup-ui.spec.ts:153 Measure layout stays bounded…` | 固定RGB・34/36/68/82/200px等を削り、列数・開始操作・稼働時非重複・高さ不変へ。 | 3/2/1列は実際に列数を測ること。現在1000幅の「2列」というテスト名だけではその列数を証明しない。 |
| `phase82-nextstep-wishlist.spec.ts:601 NextStep and Wishlist headers keep compact…`、`:659 NextStep uses a compact 3x2 grid…` | 前者のボタン外側5pxが誤発火しない確認を作成入口テストへ移して統合。後者は展開/収納と列数を残し、寸法・色の重複だけ削る。 | 表示枠のクリック領域、6件からの展開は本番操作なので維持。 |
| `phase84-section-empty-state-polish.spec.ts:25 section bars…refined hierarchy`、`:74 populated Today…same horizontal bounds`、`:113` の空状態配置 | `:25` の装飾断言を減らし、**空状態と登録済み状態の水平端の一致は各1件残す**。他ファイルの同じ幅assertをここへ集約。 | 登録後だけ幅がずれるのは既知の別故障なので、空状態1件で代替しない。 |
| 同 `:229 Wishlist mode is gold while settings…hover gold` | モード切替だけでは破棄確認を出さないassertを `phase84-nextstep-create-pick:28` へ移し、配色の単独起動を削除。 | 色・hoverは共通代表に移す。モード変更とデータ変更の区別は残す。 |
| `phase84-do-now-ranking.spec.ts:159 empty Do Now with no Projects uses…` | Do NowのProject追加入口を空状態検査 `phase84-section-empty-state-polish:113` に移して統合。 | ProjectなしとNextStepなしで導線が異なる点は残す。定型文とfont値の重複を減らす。 |
| 同 `:217 Do Now task offset and metadata icon rows…`、`phase84-project-delete-and-wishlist-today.spec.ts:65 Today removal toast, picker alignment…` | offset、font、下線長など固定値中心の検査を削除/統合。必要な項目識別・進捗値・操作可能性はPicker本体に置く。 | 単なる2〜4pxずれ、17/11pxや下線6pxの変更は検出対象から外す。横幅の一致・非重複そのものは残す。 |
| `phase84-today-picker.spec.ts:253 removes selected cards directly…` の720px・色・定型寸法assert | 削除。Spaceによる解除、長文でも操作が届く、高さ不変、進捗値を維持。 | 正確な横幅・palette変更だけを失う。低高さ `:472`、長文 `:374`、狭幅 `:451` は別条件なので一律に削らない。 |
| `phase89-main-display.spec.ts:163 heading names move without shifting counts or descriptions` | `left:-4px`、`position:static`、`margin-left:10px` の固定を削除。`phase87-followup-polish:49 Today header collapses…` の実際の縦/横位置測定へ集約。 | CSSの実現方法が変わっただけの失敗を減らす。目で分かる列ずれ・開閉・バーの色違いは代表で残す。 |

## 辞書と手順書と拡大タイマー

| 対象 | 判断・統合先 | 削ると見逃すもの・残す条件 |
| --- | --- | --- |
| `phase87-dictionary-ux.spec.ts:31 Main dictionary entry uses the outline book icon…` | icon存在と初期Ctrl+Kを `phase87-followup-polish:198 Dictionary shortcut badge follows config and actual registration` へ移して削除。 | 移植後は独立した保証なし。現状もSVGの具体的なoutline形状を検査しているわけではない。 |
| 同 `:157 Dictionary settings is modeless…` | `:88 Dictionary settings opens from the icon and titlebar context menu` にmodeless・背景操作・必要な配色を統合。 | 別ウィンドウの外が操作可能という契約は残す。単にaria-modalがないだけではOS全体の非modalを保証しない点は元から同じ。 |
| 同 `:127 Dictionary defaults to auto and Cancel keeps…` | `:106 Dictionary size applies and persists` の保存前へauto初期値・Cancel不変を統合。 | small/medium/largeの配線は個別に壊れ得るので、mediumを機械的に捨てない。共通のreload反復は代表1回に減らせる。 |
| `phase87-drop-register.spec.ts:70 group mode shows one intentional field…` | `:140 new group saves through the existing config contract…` に既存/新規の排他表示を移して削除。 | 入力後の保存結果を同時に確認することで、単にfillした直後の値だけを再確認する負担を減らす。 |
| `phase87-followup-polish.spec.ts:37 Timer cannot select text and changing its minutes stays quiet` | `phase810-timer-focus:5` に選択不可とtoast不在を統合。 | 後者の保存応答cloneは参照変化によるfocus奪取を再現するため維持。タイマー時間変更の同じ準備を減らす。 |
| 同 `:161 Timer right click does not offer group actions…`、`:183 Group add uses positive Add…` | group追加の前にtimer右クリック拒否・sidebar右クリック許可を確認して統合。main側では `post-v133a:279 creating an empty group…` に保存・表示と一緒にまとめられる。 | イベント伝播の誤りを拾うためtimer/sideの両方を残す。ボタン順・空欄disabled・Cancelを移さず削除しない。 |
| 同 `:169 Main and Dictionary shortcut badges use the app accent` | Main側を `phase810-main-shortcut:89`、辞書側を同polish `:198` へ移して独立起動を削除。 | 設定追従、登録不可時も黄色、太さが一致することは既知の表示契約として代表に残す。両者を別々の固定値で二重管理しない。 |
| `phase87-instruction-viewer.spec.ts:106 viewer toolbar is contextual…` | `:35 empty viewer uses the toolbar load action…` にタイトル・Edit不在・toolbar到達性を統合。 | 空ビューアの初期状態の重複起動のみ減る。load取消・pending再入防止は維持。 |
| 同 `:159 rename instruction uses the positive Change action…` | 名前変更操作の検証にfooter順・色を統合できれば単独テストを廃止可能。現状は**無条件削除を推奨しない**。 | 別マークアップなので他のdialogの緑/赤は代替にならない。削除すれば過去に報告されたこのdialog固有の順番・色の再発を見逃す。現状のテストも名前変更成功は保証していない。 |
| `phase810-expanded-timer.spec.ts:251 Escape closes after focus leaves…` | `:17 manual expand shares timer state and Esc keeps it running` に通常Escape後→再表示→blur→Escapeを移して統合。 | blur経路は実際のEsc不具合の再現なので消さない。開始・拡大の独立起動だけ減らす。 |
| 同 `:141 NextStep without preference does not auto-expand` | 代表開始フローへToday空・preference欠落時の負側を統合。 | 欠落時に勝手に拡大するバグを守るassertは必要。既定値true/falseの定数比較だけに置換しない。 |
| 同 `:211 expanded timer fits viewport…` | 430x380 countdown、measure、1920x1080の実測を既存操作へ統合。1200x800は分岐が同じなら削減候補。 | 中間幅だけの折返しは失う。measureはprogress有無が違うためcountdownで代替しない。Tab捕捉・hidden/minimize・復帰・lease解放は残す。 |
| `phase810-main-shortcut.spec.ts:25 Main shortcut hides only a visible focused window` の結果state assert | モックが直接設定するvisible/minimized/focusedの事後assertを削除。4初期状態ごとの送信command・不要closeの不在を残す。 | 実OSのfocus成功は現在も検証できていない。モックの自己確認だけを外し、本番UIの分岐は維持。 |
| `today3-remove.spec.ts:106 active and paused item cannot be removed even through its React handler…` | disabled buttonへのclick/Enter/Space反復と `__reactProps$` の直接呼出しを削除/置換。 | DOM側のdisabled保証を何度も検査する必要はない。ただしアプリ側ガードの競合確認を必要とするなら正規イベントで再現する。disabled/menu/paused、他項目は削除可能、終了後解除は残す。 |
| 同 `:189 completed removal preserves existing batch rules…` | `:38` の除去操作へ全件完了→1件除去時の次の3件ボタン消失を統合。 | 移さないとbatch表示の再評価が抜ける。3/2/1列の操作領域は別に維持。 |
| `phase89-main-display.spec.ts:125 Cancel keeps current Main size…` | `:246 Main toolbar matches the content width and menu density` にCancel→破棄→サイズ不変・Records切替を統合。 | 本文/toolbarの位置・幅一致は維持。親font-size値の不変を捨てても実際の収まりを測る。 |

`phase87-dictionary-ux:54` の辞書側ボタン編集と `phase87-followup-polish:17` のMain側編集は別実装なので両方残す。Guideフッターの低高さでの収容、HTML本文のスタイル隔離/安全性、splitterの実ドラッグと制限、global timerの追従と上書き/孤立snapshot区別は、それぞれ実際の故障を守っている。

## main にのみある追加テスト

この節の行番号は `origin/main 1b12994` に対するもの。現在の作業フォルダに対象ファイルはないため、削除作業の際は対象ブランチを再確認する。

| 対象 | 判断・統合先 | 失う保証・コスト |
| --- | --- | --- |
| `post-v133b-captures.spec.ts:13 P133B visual QA: keyboard, menus, Settings and Builder` | 削除。followupの `:208` keyboard、`:192` menu、`:143` conflict、`:23` Builder往復に機能assertがある。 | 連続した撮影旅程と9枚の資料を失う。画像比較は現在もない。 |
| 同 `:59 visual QA: large Timer and positive completion` | 削除。expanded-timer `:17/:97` とfollowup `:306` が担当。 | 拡大→戻る→早期終了という撮影の連続smokeと2枚の資料を失う。個別操作の保証は残る。 |
| 同 `:77 visual QA: Wishlist self-drop and post-midnight Today` | 削除。followup `:56` が反復self-dropまで検証する。 | この撮影テスト自身はタイトルと異なり日跨ぎをしていない。画像資料のみ失う。 |
| 同 `:102 visual QA: Today after the configured local midnight` | 削除。followup `:110` が合計・一覧・選択の同時更新を詳しく確認。 | 日跨ぎ後の撮影資料を失う。以上4件でこの撮影ファイル全体を通常テストから削除できる。 |
| `post-v133a-additional-fixes.spec.ts:321 deterministic visual QA captures key states` | 通常満了後のhold確認を `:153 Do Now excludes by project identity…` 等の該当操作へ移して、通常CIから削除。撮影が必要なら手動へ。 | 10枚の資料と長い横断smokeを失う。`post-v133c:185` は継続後の終了なので通常満了を移さず代替にしない。 |
| 同 `:144 manual Builder cancel does not save and incomplete target keeps draft` | `post-v133b-followup:23 Builder preserves each source and user label across mode round-trips` に空target送信時は閉じない確認を移す。 | 移植後は重複起動だけ削減。Cancel→再表示・config非保存を残す。 |
| 同 `:92 saved empty groups remain visible after reload; no phantom group…` | reloadを `:279 creating an empty group…` に統合し、groups/buttons両方空の幻groupなしも移す。 | 空設定での幻group防止は独自のため、移さない削除は不可。 |
| `post-v133b-followup.spec.ts:174 auxiliary static text is nonselectable…` | `post-v133a:21 static chrome cannot be text-selected…` に対象surfaceとSettings/Builder入力の選択可能を統合。 | static文字と編集入力の両方を確認し、CSSのuser-selectを一律noneにする誤修正を守る。 |
| 同 `:321 large Timer chrome remains nonselectable…` | `phase810-expanded-timer:40 overlay traps Tab…` に非選択とArrow到達を移植。 | Tabで届いても矢印で届かないバグは別なのでArrowを落とさない。 |
| 同 `:306 early completion uses positive completion and neutral unfinished actions` | `phase810-expanded-timer:97 early stop uses the existing Today confirmation` に意味に合う外観を移す。 | 完了と未完了が誤解される見た目を代表で維持。開始/仮想時間送り/終了の重複を削減。 |
| 同 `:280 representative hover controls have no transition delay` | CSS時間値の単独検査を削除候補。 | reduced-motion環境下でdelay=0、duration<=0.25秒という限定的保証を失う。実hover応答の遅延を測るテストではない。 |
| 同 `:192 Sidebar background menu orders group before button…` | 順序を `post-v133c:37`、focus移動/Escape復帰を同followup `:208` へ移して削除。 | group gap、pointer anchor、ContextMenuキーという固有入力は残す。 |
| 同 `:56 Wishlist self-drop does not duplicate or save…` | 5回反復を初回+再実行の2回へ縮小。必要なsave未呼出しはcommand差分で確認。 | 3〜5回目だけの蓄積故障を見逃す。現在のconfig同値だけでは「saveしない」まで証明できない。 |
| `post-v133c-followup.spec.ts:228 Record tabs stay opaque while scrolling…` | 比較しない5枚の撮影を減らし、代表scroll位置で不透明性・sticky位置・本文との非重複を実測。 | 撮影資料を失う。透ける/隠れるという利用者の不具合は残し、単に撮影テストという理由で全削除しない。 |

## 旧フェーズの有効テストの重複

旧フェーズという理由だけで削除しない。下記は現在も有効なテストのうち、重複や検査方法に問題があるもの。

| 対象 | 判断・統合先 | 失う保証・注意 |
| --- | --- | --- |
| `phase72-cross-dnd.spec.ts:363 date change at drop rejects a stale drag` | 置換。Picker行は現行ではドラッグ開始対象でなく、開始成功もassertしていない。`phase84-nextstep-today3-dnd:46` の実経路でプレビューが出た後に日付を変更する検査へ。 | 保存されないのが日付ガードなのか、最初からドラッグされていないのかを現状では区別できない。古い試験を残すだけでは保証にならない。 |
| 同 `:330 Builder Today button keeps scroll position…` | Pickerの採用試験へ統合。背景mainScrollとdialog内部scrollのどちらを守るか分けて確認。 | 現状は背景のscrollだけ。前行の置換とskip削除後、このファイルは廃止可能。 |
| `phase62-today-layer.spec.ts:236` 狭幅検査 | 長いNextStepデータを `phase84-today-picker:451` に移し、有効1件とskip5件を含めファイル削除候補。 | ページ全体の横溢れより、Picker内スクロール・操作到達性を残す。長文条件を移す前の全削除はしない。 |
| `phase62-records-guide.spec.ts:48` 記録見出し、`:64` Guide狭幅 | 記録は `phase8-records:153`、Guideは `phase61-guide:74` に統合し、ファイル削除候補。 | 元の見出しループは対象0件でも成功する。見出し存在と長文を確かめた上で収容を測る。 |
| `phase6-main.spec.ts:236` 完了、`:251` Do Now、`:330/:418` 採用、`:478` 保存失敗、`:498` 入力 | 完了を `phase62-source-lifecycle:186` / `phase72-completion-feedback:369`、採用をPicker `:162/:200`、失敗をPicker `:332`、入力をreadiness `:331` へ統合。 | 採用元が変わってもsnapshot保持、失敗toast、Shift+F10を移す。同名別ID `:361`、legacy識別 `:389` は別故障のためファイル丸ごとは削らない。 |
| `phase6-readiness.spec.ts:130` 事前完了、`:149` 短時間停止 | 完了はfeedback `:212` と同readiness `:209`、停止はaudit `:111` の59/60秒境界へ警告・未完了確認を移す。 | 実行中切替 `:164`、一時停止中切替 `:191`、3/2/1列 `:393` は別経路なので残す。 |
| `phase6-dictionary.spec.ts:302` 120件表示 | 末尾検索の固有確認を通常検索へ統合するか、多数項目の操作テストとして明確化。 | 時間計測していないので「性能が保たれる」保証は元からない。大量項目でフォーカスが壊れる条件は捨てない。 |
| 同 `:86` スタイル、`:125/:141` blur/resize | CSS全量比較を減らし、blur→resize→矢印操作へ統合可能。 | focusと選択の分離、再配置後の移動は残す。Quick/辞書のreveal、tile/groupのD&Dは別実装で相互代替しない。 |
| `phase61-wishlist-modal.spec.ts:225` 狭幅、`:102` 閉じ方 | 狭幅を `:68` の主要操作へ移し、同じ結果になる閉じ方の反復を削減。 | dirty状態の中断復帰 `:177`、IME `:149`、retry `:203`、metadata保全 `:247` は別保証として維持。 |
| `phase62-quick-picker.spec.ts:173` Wishlistからのキャンセル | `:129` の共有Pickerキャンセルとの反復を削り、Wishlist固有の初期値/保存先への接続だけ残す。 | 呼出元ごとのrollback `:95/:111`、既存の上限超過データ保持 `:195` は残す。 |
| `phase7-early-completion.spec.ts:277` 二重dispatch、`:298` 古いclosure、`phase71-edit-sync:107/:169` の内部handler | React内部取得ではなく、応答を保留した実操作や正規イベント経路へ置換。純粋guardを既に分離できていれば本番関数を直接検証。 | 二重記録・切替・保存競合は重要。React内部依存を外すだけであり、ガードの確認自体を削除しない。 |
| `phase7-audit.spec.ts:50` 境界5ケース、`phase7-early-completion:408` 2幅 | 計算境界は本番earlyCompletion/timerRuntimeの安価なテストへ集約し、ブラウザは閾値前/後とplanned経路を代表化。幅は狭幅を主に統合。 | 計算とUI接続の両方を残す。audit `:111` pause込み59/60秒、`:132` 時計ジャンプは別故障。純粋関数を呼んでいること自体を実装コピーと扱わない。 |
| `phase71-layout.spec.ts` の2幅 | footer順を既存編集/Picker、短時間→通常の並びをそのlayout検査へ移してファイル廃止候補。 | 安全な操作順、狭幅で上下に並ぶことは残す。mainと辞書など別実装への全体化はしない。 |
| `dashboard-disclosure-context.spec.ts:13` 確認順、`:60` メニュー、`:123` ラベル配置 | 確認順をsource-lifecycle `:40/:106` へ、メニュー全項目完全一致を必要な操作への到達性へ縮小。 | 危険操作の確認順は残す。メニュー名/項目配列変更だけの失敗と位置の固定を減らす。 |
| `phase72-lists-timer-size.spec.ts:63` 件数8ケース | Projectは実境界6/7へ縮小。Inboxは総件数ではなく**グループ内**の5/6、19/20境界で再構成。 | 現fixtureは所属/未所属へ分かれるため、総数20でも各groupの20件分岐を通らない。意味のない総当たりを削り実境界を残す。 |
| 同 `:102` ページング、`:168/:198` 寸法 | 最終項目削除後のページ補正・group間独立性を実際に確認。82x36等は操作可能性と非重複へ置換。 | ページ移動だけでは「clamp」を検証しない。新たなケースを増やす目的ではなく、現在の重複・空振りを置換する。 |
| `phase72-followup-five.spec.ts:202 key controls remain contained at 100, 125 and 150 percent DPI` | 同一CSS viewportでのDPR3反復を削減/通常テストから分離。 | CSS座標の収容だけを比べており、Windows表示倍率・文字のにじみを実証していない。DPR固有の描画故障を検査対象にするならpixelまたは実機で確認する必要がある。 |
| 同 `:235 Warm Rich Toast…`、`:47` D&D閾値 | 角丸11px、badge34px、inset10px、keyframe値を削り、画面内収容・寿命・Undoへ。閾値は `phase84-today-remove-dropzone:66` に集約。 | timeoutの誤りとUndo不能は残す。`:78` のタイマー分数ドラッグは独立操作として残す。 |
| `phase72-selection-edit-menus.spec.ts:148` 配置、`:26/:96` 旧除外 | 5px/2px等を削り、lists `:168` の長時間表示へ統合。旧除外キー無視はPicker採用側へ集約。 | reduced-motion操作、他候補へ切替 `:117`、候補1件なら切替なし `:138` は保持。 |
| `phase72-completion-feedback.spec.ts:226/:240` 早期完了yes/no、`:255` 失敗 | 早期完了 `:109` の既存操作に報酬あり/なしを追加し、失敗時は既存rollback検証へ移して統合。 | 保存に成功した時だけ演出する契約を残す。UI完了表示と永続化を混同しない。 |
| 同 `:297` 空候補、`:351` keyboard、`:401` 長文 | 空候補を `:309` 元データ削除後ack、keyboardを `:264` 主ack、長文狭幅を `:199` 個別完了へ統合。 | 読込/Undoで再演出しない、3件節目、日付/reload/別開始で消える、reduced-motionは別に維持。main `:289` の唯一候補再提示抑止も別機能として残す。 |
| `phase72-toast-undo.spec.ts:33` 隣接位置と設定保持 | モック内のUndoドメイン計算の期待値反復を減らし、対象/前後ID/tokenを送ることと応答表示へ。Rust `config.rs:4237` の本物のUndoを残す。 | UI接続を全部消すと送信引数の誤りを失う。mockの再実装が正しいことはRustの保証にならない。 |
| 同 `:85` 競合・retry・二重click | mockの状態計算を明示的な拒否→成功へ置換し、retryと連打抑止を維持。 | 容量上限拒否は確認済みRustテストに代替がないため、削除するなら本物の関数側の境界検証が必要。 |
| 同 `:137/:175` の無効なhover/focus・queue | 旧Builderの操作を現行の通知生成操作に置き換えて救済。skip状態の旧本文を永久に維持しない。 | 本番には今もhover/focus/documentでの寿命停止とqueue昇格時計時開始がある。document非表示だけの有効テストでは代替不可。 |

## 文書と公開安全性の整理

| 対象 | 判断 | 削ると失う保証・残すもの |
| --- | --- | --- |
| `readme-contract.spec.ts:34 Japanese and English READMEs share the same downloads and images` | 日英の全参照配列完全一致を削除。各READMEの資産と実リンク先を確認する方へ。 | 翻訳版で画像数・説明リンクを変えることを許容。誤ったダウンロード先は実害なので、リンクの正しさまで捨てない。 |
| 同 `:42 app metadata agrees…` 内の、既に同じchangelogから抽出した見出しを `toContain` で再確認するassert | 削除。 | 同じ読取り結果の再確認だけ。package/Cargo/Tauriのversion整合性と公開資産名・既存ローカルリンクは維持。 |
| `phase72-public-safety.spec.ts:7` の禁止内容2種類x許可パス2種類 | 低優先の縮約候補。CLI7起動を正常2・未知パス拒否1・禁止内容2へ整理可能。 | 削る交差組合せ固有の漏れは失う。許可JSONと許可Markdownの両方で内容検査を迂回できないことを残す。安全性検査全体は削除しない。 |
| `public-screenshots.spec.ts` の4件 | 公開用手動captureとして分離可能。削除は必須ではない。 | 現在も通常CIから除外されているため時間削減はない。合成データと生成順序を保ち、公開用画像作成の用途を失わせない。 |

## 全ファイル確認台帳

Playwrightの名前は `tests/visual/<名前>.spec.ts`。件数はmain基準の**宣言数**であり、パラメーター展開・有効/skip/manualの別を加味した実行数ではない。66ファイルすべて本文確認済み。「維持」は候補なし、または本文に記載した補助assert/撮影以外は維持の意味。

| 名前 | 宣言数 | 判定 |
| --- | ---: | --- |
| dashboard-disclosure-context | 5 | skip削除・確認順/文言/配置の統合 |
| dictionary-window-position | 3 | 本番geometry3分岐を維持 |
| instruction-html-browser-parity | 4 | HTML隔離・表示・安全性を維持 |
| phase6-dictionary | 9 | blur/resize・多数項目・装飾を整理、検索/D&Dは維持 |
| phase6-main | 13 | 旧skip削除・採用/完了統合、ID区別を維持 |
| phase6-readiness | 13 | 旧skip削除・境界統合、切替/列分岐を維持 |
| phase61-guide | 3 | 操作・focus・狭幅を維持、重複の受入先 |
| phase61-wishlist-modal | 7 | 閉じ方/幅を統合、IME/retry/metadata保持 |
| phase62-quick-picker | 6 | 共有UI重複を縮小、呼出元の接続を維持 |
| phase62-records-guide | 2 | 必要assert移管後ファイル廃止候補 |
| phase62-source-lifecycle | 6 | 解除/完了/削除/履歴/rollbackを維持 |
| phase62-today-layer | 6 | 長文条件移管後ファイル廃止候補 |
| phase7-audit | 3 | ブラウザ境界を縮約、本番関数と時間接続を維持 |
| phase7-early-completion | 15 | React内部依存を置換、失敗/競合/停止を維持 |
| phase71-edit-sync | 7 | 内部handlerを置換、本番sourceEditと競合を維持 |
| phase71-layout | 1 | 操作/配置の固有assert移管後廃止候補 |
| phase72-completion-feedback | 21 | 重複操作統合、再演出条件/唯一候補を維持 |
| phase72-cross-dnd | 14 | skip削除・空振りを置換後廃止候補 |
| phase72-followup-five | 6 | skip/DPR/装飾を削減、時間dragを維持 |
| phase72-lists-timer-size | 6 | group単位境界へ修正、固定寸法を縮小 |
| phase72-public-safety | 1 | 実CLI維持、直積縮小は低優先 |
| phase72-selection-edit-menus | 7 | skip/legacy/装飾を整理、候補切替維持 |
| phase72-toast-undo | 6 | mock業務検証を縮小、skip2件は現行操作へ救済 |
| phase8-dictionary-state | 5 | 幅違いを縮約、検索/focus復帰を維持 |
| phase8-entry-forms | 4 | 作成成功/共通色を統合 |
| phase8-guide-sync | 3 | 文書固定値削除、Guide操作へ置換 |
| phase8-records | 5 | 補助UIを統合、snapshot/ページングを維持 |
| phase8-today3-builder | 4 | 完了状態の移管後ファイル廃止候補 |
| phase81-entry-contracts | 9 | 原則維持、作成・昇格の重複受入先 |
| phase81-generation-boundary | 10 | 世代境界を維持、純粋関数重複1件を受入 |
| phase81-layout-qa | 5 | 幅/撮影を縮約、列分岐/長文/focusを維持 |
| phase81-source-followup | 13 | 世代重複1件を統合、後続処理/失敗を維持 |
| phase82-countup-core | 5 | 5宣言維持、定数そのもののassertのみ候補 |
| phase82-countup-ui | 6 | 寸法/撮影を整理、計測の別経路を維持 |
| phase82-nextstep-wishlist | 21 | skip/昇格/装飾を整理、stale/D&D失敗を維持 |
| phase83-clean-start | 2 | モック内部検査を削除、UI操作の接続を維持 |
| phase83-main-action-hover | 15 | 人工DOM・固定値・反復起動を大幅縮約 |
| phase83-settings-maintenance | 4 | 撮影2ケースを統合、handlerとTabを維持 |
| phase83-software-reset | 13 | 成功経路を統合、失敗/復旧/再入禁止を維持 |
| phase84-do-now-ranking | 7 | 応答表示へ責務限定、動的色と空状態を維持 |
| phase84-e2e | 4 | 固有assert移管後ファイル廃止候補 |
| phase84-nextstep-create-pick | 3 | lock重複削除、選択入口を維持 |
| phase84-nextstep-today3-dnd | 2 | 両宣言維持、正しい日付競合検証の受入先 |
| phase84-project-delete-and-wishlist-today | 7 | 装飾を統合、非破壊削除・今日採用を維持 |
| phase84-section-empty-state-polish | 5 | 固定値を削減、空/登録済み幅と保存を維持 |
| phase84-source-lock-ui | 4 | lock・実wheel・各カードのproject色を維持 |
| phase84-today-picker | 23 | 採用/表示/装飾を統合、取消/失敗/低高さを維持 |
| phase84-today-remove-dropzone | 11 | 寸法専用を統合、drop命中境界・失敗を維持 |
| phase84-wishlist-nextstep-hover | 3 | 色/余白重複を統合、hover/focusでの操作維持 |
| phase87-dictionary-ux | 8 | 入口/設定を統合、辞書固有編集を維持 |
| phase87-drop-register | 7 | group切替を統合、対象種別と失敗を維持 |
| phase87-followup-polish | 8 | 機能別に統合、Guide/整列/色契約を維持 |
| phase87-instruction-viewer | 8 | toolbar統合、splitter/安全な解除/geometryを維持 |
| phase89-main-display | 9 | 固定offset削除、幅直積を再設計、設定分岐維持 |
| phase810-activity-axis | 1 | 実測整列維持、撮影だけ削減 |
| phase810-expanded-timer | 15 | Esc/サイズを統合、中核状態・leaseを維持 |
| phase810-main-shortcut | 2 | mock結果state削除、4入力状態の分岐維持 |
| phase810-timer-focus | 1 | 維持、時間変更/非選択の統合先 |
| post-v133a-additional-fixes | 12 | mainのみ。撮影・Cancel・空groupを統合 |
| post-v133b-captures | 4 | mainのみ。重複撮影ファイル全削除候補 |
| post-v133b-followup | 14 | mainのみ。重複操作・装飾・反復を整理 |
| post-v133c-followup | 6 | mainのみ。機能維持、撮影を実測へ |
| public-screenshots | 4 | 手動captureとして維持/分離、通常CI効果なし |
| readme-contract | 4 | 日英画像完全一致削除、資産/リンク整合性維持 |
| today-global-timer | 2 | global追従とoverride/孤立snapshotを維持 |
| today3-remove | 9 | React内部依存削除/置換、非破壊除去を維持 |
| **合計** | **471** | **66ファイル** |

Rustのパスは `src-tauri/src/` 基準。capabilityのみ `src-tauri/tests/`。

| ファイル | mainのtest数 | 判定 |
| --- | ---: | --- |
| commands/config.rs | 51 | 重複/疑似defaultを整理、移行/保全/Undoを維持 |
| commands/drop.rs | 5 | 維持。mainは実装追加による行移動でtest追加なし |
| commands/explorer.rs | 5 | fixture削減、引数分離/拒否/情報保護を維持 |
| commands/icons.rs | 14 | 同値ソース1件削除、準備統合、安全性/実抽出を維持 |
| commands/instructions.rs | 16 | リンク/競合/長パス/書込制限を維持 |
| commands/main_shell_drop.rs | 6 | 実COM/形式/タイトル/drop効果を維持 |
| commands/notes.rs | 1 | 空白・空項目・件数制限を維持 |
| commands/reset.rs | 11 | 疑似workflowと準備を整理、rollback/復旧維持 |
| commands/sessions.rs | 14 | 候補抽出コピー置換、ranking準備統合、境界維持 |
| display_awake.rs | 2 | 複数利用者・expiry・失敗再試行を維持 |
| models.rs | 8 | test用sample検査削除、初期化/日付/移行維持 |
| tests/capability_contract.rs | 2 | 重複禁止権限1件削除、完全許可リスト維持 |
| **合計** | **135** | **12ファイル** |

`fixtures.ts`、`tauriMock.ts`、`scripts/check-public-safety.mjs` と実行設定/CIは別途確認済み。テスト属性のないRustのactions/mod/shell_drop_poc/lib/main/startup/stateも探索して、別のテスト配置がないことを確認した。

## 整理の優先順位

1. **直接削除するもの**: コピー自己試験、テスト用sample、既存の強い検査に包含されるRust4件、廃止された仕様のskip本文、重複capture。skip2件の現行仕様は下記のとおり救済する。
2. **固有assertを移してから削るもの**: Picker採用/満杯、削除/Undo、Guide、モーダル、完了演出、拡大タイマーの重複起動。失敗すると以降も全部実行不能になる巨大旅程へまとめない。
3. **検証先を置き換えるもの**: 本番抽出を呼ばないループ、モックが作った初期化/Undo結果、開始していないドラッグ、React内部handler、group境界に合わない件数fixture。
4. **維持コストを下げるもの**: CSS係数・タグ名・固定pxを利用者に見える配置/操作へ変え、無比較撮影を通常CIから外す。
5. **最後に評価するもの**: 特定画面幅や組合せを外す変更。取り逃す条件を記録し、件数目標のために削らない。

直ちにファイル全体の削除を提案できるのは、mainの `post-v133b-captures.spec.ts`。固有確認の移管後に廃止できる候補は `phase62-records-guide`、`phase62-today-layer`、`phase71-layout`、`phase72-cross-dnd`、`phase8-today3-builder`、`phase84-e2e`。古い名前だけを理由に、残りのphase6/7ファイルを全削除してはいけない。

## 過去の整理案の再評価

`ff14111` をそのまま取り込む提案ではない。sample/iconの重複削除、旧仕様skip、文書文字列固定の削除は妥当。一方、`phase82-countup-core` の計測非満了とcountdown境界2件の削除は採用しない。短く、本番関数を直接検証しており、別のUIテストだけでは境界の代替にならない。

幅を減らす案も、1000付近の2列など実際の分岐を落とさない形に修正する。mixed-focusの理由表示、初期完了状態、toast hover/focus寿命とqueueは必要な検証へ移す。既にskipだから要件も不要と判断しない。

## 確認の限界

- 当初の静的監査ではテスト成功/失敗、削減秒数、フレーク率を実測していなかった。実装後のテスト成否・所要時間は末尾に記載するが、整理前との時間比較は行っていない。
- PlaywrightはTauriをmockしている。Windowsのショートカット登録、実ウィンドウ復帰、実ZIP復元、実Explorer起動の成功まで証明するものではない。
- `instructions.rs` の改名追従テストにはGitHub Actionsで主要assert前に終了する条件がある。1000ファイル検索テストも本文読込回数や時間を測っていない。テスト名以上の保証を見積もらない。
- 「保存失敗後にcurrentConfigが同じ」だけでは、React画面の楽観更新が戻った証明にならない。カード/本文/再試行を確認する側へ寄せる。
- Pickerの再開時タブ初期化テストは、既にNextStepへ戻してから再開しており負側が弱い。Wishlistを選んだまま閉じる形に置換すべき。
- 当初の静的監査で変更したのは監査報告だけだった。その後、承認を受けて対象ブランチと未コミット変更を確認し、末尾のとおり実装と段階的検証を行った。

## 実施結果（完了版）

### 実施範囲と集計

ユーザー承認後、`origin/main` の `1b12994` を基点とする提出ブランチ `fix/test-audit-consolidation` で整理を実施した。ここでの比較元は、上記の静的監査で参照した旧作業ブランチではなく、この main 基点である。最終確認時にもmainの最新SHAと基点の一致を確認した。マージは未実施。

| 対象 | 整理前 | 整理後 | 数え方・現状 |
| --- | ---: | ---: | --- |
| Playwright specファイル | 66 | 59 | 7ファイルを廃止。固有保証を移管した統合と、重複撮影の削除による。 |
| Playwrightテスト宣言 | 471 | 344 | 127宣言減。パラメーター展開前の数であり、実行件数とは異なる。 |
| 通常Playwright実行ケース | 未集計 | 373 | パラメーター展開後、`@manual` 除外。最終373件全PASS、失敗・skip・flaky各0件。 |
| Rustテスト | 135 | 125 | 124 unit + 1 capability、全件PASS。 |

件数は差分・宣言集計・実行結果を区別して記載した。最終Playwright結果は `dist/test-audit-final.json` の `stats` で確認できる。宣言数の減少を、そのまま保証範囲や実行時間の減少率とは扱わない。

### 主な削除・統合・置換

以下のspec名は `tests/visual/` 配下、Rustのcommands名は `src-tauri/src/commands/` 配下を指す。

| 整理内容 | 実施結果と残した保証 |
| --- | --- |
| 旧仕様の無効テスト | 旧Builder等を前提とする39個のskip宣言を削除。toastの寿命・queueの2件は削除せず現行操作へ置換して有効化した。静的検索で `test.skip` の残存なし。 |
| 通常実行時の大量画像保存 | 比較に使われていない成功時撮影と、そのためだけの準備を除去。`post-v133b-captures.spec.ts` を廃止した。明示的な撮影呼び出しは `public-screenshots.spec.ts` の手動公開用4か所だけを残し、失敗時スクリーンショット設定は維持した。位置・収容・操作のassertを画像保存で代替しない。 |
| Picker採用と旧Builderの旅程 | `phase84-today-picker.spec.ts` にNextStep/Wishlistのsnapshot、元データ保持、再開後の選択、重複防止、3件目確定後のreloadを集約。初期状態で完了済みの3件が表示され、全3件完了時だけ次の選択へ進める確認も残した。長文候補の狭幅での非重複も移管した。 |
| 確認順・作成・昇格 | `phase62-source-lifecycle.spec.ts` に危険操作のボタン順、Cancelへの初期focus、Esc取消、予定完了の状態表示を移管。metadata作成時のfocusは `phase81-entry-contracts.spec.ts`、新規NextStepとtrigger保存は `phase84-nextstep-create-pick.spec.ts` に統合。Wishlist昇格の実行設定とreload後の保持も既存契約テストに残した。 |
| React内部依存 | `__reactProps` / `__reactFiber` による内部取得を廃止し、静的検索で残存ゼロを確認。早期完了は応答保留中の実クリックによる二重記録抑止と遅延したminiイベントへ、編集競合はDOMイベントへ置換した。無効なボタンから内部handlerを直接呼ぶ手法は除去した。 |
| Undoの責務分離 | `phase72-toast-undo.spec.ts` は送信するsnapshot・隣接ID・操作token、拒否後の再試行、処理中の連打抑止、返却内容の表示を検証する形へ置換。容量上限拒否と空き枠確保後の同一操作再試行は `config.rs` の本物の `apply_undo_today_selection` に移し、元の設定と挿入位置の保持も検証した。 |
| toastのskip救済 | hoverのみ、focusのみの各寿命停止を現行の解除通知で検証。3件表示中の4件目がqueue昇格後に寿命を開始し、Undoできることを確認する内容に置換した。document非表示時の停止は別ケースとして維持した。 |
| 空振りしていた境界 | `phase72-lists-timer-size.spec.ts` はProjectの6/7件と、Wishlistの同一グループ内5/6・19/20件へ組み替えた。最終ページの最後の項目削除後のページ補正と、別グループのページ独立性を実操作で確認する形にした。 |
| D&Dの日付競合 | `phase84-nextstep-today3-dnd.spec.ts` に、実際にdragが始まりdrop先に到達した後で日付変更を受け、採用保存しない検証を追加。dragが開始していないまま成功する旧検査を置換した。 |
| Guide・記録・編集レイアウト | Guideの固定文章・節数・文書行数比較を、目次選択、見出しfocus、閉じた後のfocus復帰へ置換。記録見出しは `phase8-records.spec.ts` で存在を確認してから長文・収容を測る。編集フッター順と短時間/通常の配置は `phase71-edit-sync.spec.ts` に移管した。 |
| 装飾・幅・タイマー | 固定RGB・px・transition係数の反復を減らし、hover/focus、寸法不変、非重複、操作到達性へ置換。`phase89-main-display.spec.ts` は3サイズの切替経路と最大サイズのレスポンシブ境界へ再構成。拡大タイマーのサイズ、Esc、focus復帰は既存の動作旅程に統合し、満了・早期停止・display leaseの固有経路は保持した。 |
| モック自己検証 | `phase83-clean-start.spec.ts` 等でモックが作った内部状態の再確認を減らし、UI操作と応答表示へ責務を限定。未使用となった `tauriMock.ts` の公開 `cleanStartState()` と自己検証専用の `externalSentinel`・`resetCompleted`・`restoreCount` を削除。UI応答を作る内部sessions・backup・notes・config処理は保持した。 |
| README・公開安全性 | 日英の全参照配列一致とchangelog見出しの自己再確認を削除。各READMEの公開資産名、実ダウンロード先、ローカル文書・画像の存在、metadataのversion整合性は維持。ローカルのリリースノートを配布URLと誤認した分類を修正し、関連5テストもPASSした。 |
| コピー版scanner selfTest | 本番ルールを通らない `selfTest()` と呼び出しだけを削除。本番scannerの検出ルール・許可リストは不変。package/CIにselfTest専用オプションはなく、既存の `public:check` 経路は保持した。 |

廃止した7ファイルは、`phase62-records-guide.spec.ts`、`phase62-today-layer.spec.ts`、`phase71-layout.spec.ts`、`phase72-cross-dnd.spec.ts`、`phase8-today3-builder.spec.ts`、`phase84-e2e.spec.ts`、`post-v133b-captures.spec.ts`。前6件は現行テストへの統合・置換または旧skipの整理、最後の1件は重複撮影の除去である。Guideの狭幅は既存の `phase61-guide.spec.ts` にも確認先を残しており、古いphase名だけを理由に他ファイルを一括削除していない。

### Rustの統合と本番変更の境界

今回の整理で本番アプリコードに加えた変更は、`sessions.rs` の候補抽出を `load_next_step_suggestions_from_path` へ最小限抽出した1点だけである。公開コマンドが従来どおりパスを取得して同じ処理に委譲し、絞り込み・順序・重複排除・上限の挙動は変えていない。テスト側の抽出ロジックコピーを廃止し、この本物の関数でproject別抽出、空白除去、重複排除、最新5件、空/未知projectを確認する。複数行の追記・読戻しと読み取り前後のファイル不変も検証する内容にした。scannerの変更は上記の自己試験削除に限定した。

- `models.rs` のsample固定値検査、`icons.rs` の優先順位を区別できない同値ケース、capability完全許可リストに包含される禁止権限の重複検査を削除。実初期化・異なるパスでの優先順位・OpenFile fallback・完全な権限契約は残した。
- `config.rs` はToday/Inboxの手順書改名・削除をProjectの参照更新テストへ統合。旧Inboxの省略フィールドは最小入力の互換性テストへ移した。辞書の非表示→再表示時の末尾復帰は、監査案の純粋な正規化テストではなく、本番ロードの移行テストへ統合してディスク往復・二重backup/write防止を残した。
- v2→v3のJSON値移行テストに型デコード・再保存・再デコードを統合。active/pending競合入力は、元データ保全まで確認する本番ロード側に検証を残した。Undo snapshotの省略/空配列は誤ったProject直下ではなく `nextStep.buttonIds` の実際の入れ子で検証する内容へ修正した。
- `reset.rs` の疑似的な再起動・手動構造体保存の旅程を削除し、Committedフェーズと空の初期状態の確認を実リセット成功テストへ統合。外部データ保全と失敗復旧は保持した。preflightとExplorerエラーの検査では、判定に使わない実ファイル準備だけを除去した。

### 維持した候補と低優先項目の判断

| 候補 | 最終的な扱いと理由 |
| --- | --- |
| scanner CLIの禁止内容×許可パス | 低優先だが実施。安全2回・未知パス拒否1回・禁止内容2回の計5起動へ統合した。JSONとMarkdownに2種類の禁止内容を入れ替えて投入し、各ファイルのパスと検出理由を両方assertするため、元の全4交差組合せは削っていない。 |
| Rust任意フィールドの全面統合 | 一部だけ実施。Project/Today/旧Inboxの最小入力確認を残し、`source_completion_history_is_optional_for_legacy_config` と `v120_optional_fields_keep_v113_and_partial_configs_compatible` は別に維持した。異なる最小入力の故障を明示でき、短い検査を件数目的でまとめる効果が小さいため。 |
| Do Now rankingテストの全面統合 | 準備用のProject/session生成を共通化し、重点fallback・履歴なし同順位・全候補空のテスト自体は維持した。同日時刻順・非重点の日付順も別故障として残す。fixture削減と保証ケースの削除を分けた。 |
| 計測非満了・countdown・1分境界 | `phase82-countup-core.spec.ts` の5宣言を維持し、定数が1であることだけのassertを除去。本番純粋関数の境界検証は安価で、UI代表例だけでは代替できないため。pause込み59/60秒や時計ジャンプも別の確認として残した。 |
| セキュリティ・破損復旧 | 非objectデコーダ、同version移行時backup、Undoの世代/token競合、置換失敗時の保全、リセットrollback、リンク拒否、faviconの取得先・容量制限等は維持。入力境界や実ファイル保護を守る検査は、重複した正常系とみなさなかった。 |
| 多数項目・個別操作 | 辞書の120件は維持し、テスト名を大量grid操作と末尾検索を表すものに修正。速度を測っていないため性能保証とは呼ばない。Quick/辞書D&D、IME、失敗後のdraft・retry、実行中/一時停止中の競合も別経路として残した。 |
| 画面幅・DPR | Mainは1050/1051等の実境界を両側で確認し、layout QAは1000付近の2列と最小幅を保持。長文・低高さも別条件として残した。同一CSS viewportでDPRだけを変える3反復は除去したが、Windows実表示倍率や文字描画品質を検証できたとは扱わない。省いた特定幅の固有崩れまで保証するものでもない。 |
| 公開画像作成 | `public-screenshots.spec.ts` の4件は手動用途として維持。既に通常実行から除外されており、これを削っても通常CIの削減にはならず、公開素材作成の用途を失うため。 |

### 最終検証結果

コードを凍結して実行した最終全体テストは、373件すべてPASSした。`dist/test-audit-final.json` の `stats` は `expected: 373`、`skipped: 0`、`unexpected: 0`、`flaky: 0`、`duration: 250782.725`（ms）。所要時間は250.8秒、約4.2分である。

| 検証 | 状況 |
| --- | --- |
| Rustテスト | 125件PASS（124 unit + 1 capability）。 |
| Rust fmt / check / clippy | PASS。clippyは `--all-targets`、警告をエラーとして扱う `-D warnings` 条件。 |
| フロントエンドlint / build | 最終PASS。既存の500KB超chunk警告は残るが、build失敗ではない。 |
| 先行Playwright | 10件、5件、21件、21件、55件の各実行でPASS。対象の重複を除いた件数とはせず、全体373件の結果とも合算しない。 |
| 全体Playwright | **最終373 PASS / 0 FAIL / 0 skipped / 0 flaky、250.8秒。** |
| 公開安全性scanner | export比較で、変更前HEADは422ファイル・検出0件、変更後は416ファイル・検出0件。両方PASS。本番ルール・許可リストは変更していない。 |
| 最終静的レビュー | 修正必須の指摘なし。主要保証の欠落なし。 |

### 修正・再検証履歴

- 全体1回目は367 PASS / 6 FAIL、353.6秒。失敗はtoast入場アニメーション中のbounds測定1件、hover時の浮き上がりを位置不変と誤判定した1件、queued toastの項目D表示待ち1件、透明triggerへのhoverを行ったtimer controlsの3幅に集中した。測定タイミング・対象選択・表示待ちを修正した。
- 対象4specの再検証は26 PASS / 2 FAIL。残るcountupの2件は、transformの影響を含む `boundingBox` の高さに生じる0.00004px未満の浮動小数差だった。前後とも同じレイアウト寸法 `offsetHeight` を測定して厳密比較する形へ修正した。許容誤差を広げたり、寸法不変の保証を削除したりしていない。
- 修正後に全体373件を再実行し、失敗・skip・flaky各0件で完了した。これらはテストの測定方法の修正であり、本番挙動は変更していない。

### 効果と検証の限界

整理前の全体所要時間は計測していない。そのため実行時間短縮、削減秒数、フレーク率改善、カバレッジ維持率は主張しない。353.6秒と250.8秒はいずれも整理後の各実行の記録であり、整理前後の比較ではない。説明できる効果は、旧仕様の本文、比較しない画像出力、重複するfixture/ブラウザ旅程、React内部構造や装飾係数への依存を減らし、仕様変更時に同じ期待値を何か所も修正する保守負担を減らしたことである。

ネイティブEXEの手動起動と、実Windows shellを通すスモークテストは今回未実施。PlaywrightはTauriをモックしたUI検証であり、Rustテスト・lint/buildの成功と合わせても、実EXEの起動、Windows shellとの連携、実ウィンドウやショートカットの実機動作保証とは区別する。本報告はテスト整理の提出変更に対する検証結果である。

### 作業領域と提出状態

実装・検証は指定された共有リポジトリで行い、Cドライブへの生成は行っていない。開始前から存在した `Cargo.toml`・生成schema等の未コミット変更は保護し、本整理の成果として扱わない。並行作業の変更を上書きせず、追加worktreeは作成していない。今回新規生成したRustのtargetキャッシュ2,066,235,270 bytes（約1.924 GiB、4,546ファイル）は削除済み。

提出ブランチは `fix/test-audit-consolidation`。コード変更70ファイルと本報告書を、テスト整理の1件のPRとして提出する。mainへのマージは本作業に含めない。本報告書の完了版更新ではコードを変更せず、検証時の凍結状態を維持した。絶対ローカルパスやローカル利用者名は記載していない。
