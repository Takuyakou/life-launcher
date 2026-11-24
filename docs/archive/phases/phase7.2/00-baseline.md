# P72-00 実装前監査

監査日: 2026-09-10。製品変更なし。P72-01以降は未承認。

## 基準

- repository: Takuyakou/life-launcher / base: main
- fetch後のHEAD = origin/main: `873219cc099514fef5be292a01f97aa50d3e3468`
- branch: `docs/p72-00-audit`
- P71最終報告SHA `c7c28ea4f29c62e738e15e369705a71cb35ae109` の包含をmerge-baseで確認（exit 0）。
- 直近: #39統合報告、#40 Guide再整理、#41 Do Now本文15pxインデント。いずれも今回巻き戻さない。
- #32: CLOSED / mergedAt=null。#40で必要内容を取り込んだ旧PR。変更しない。
- 開始時のopen PR: 0。製品宣言version: 1.1.0。
- `.github/workflows/ci.yml`: main push / PRの検証のみ。Release/tag/deployの自動実行なし。
- 開始時から既存phase6系画像と別報告書の未コミット差分あり。保持し、本PRから除外。
- 指示書は外部の `life-launcher-phase7.2` パケット。validator: 35 files / 34 hashes / 7 stages / 89 scenarios PASS。
- リポジトリ内AGENTS.mdは検索で見つからず。1作業1ブランチ1PRの運用規約を適用。

## 要件分類

| 要件 | 分類 | 実コードの根拠・差分 |
| --- | --- | --- |
| stable source identity・明示保存時の再snapshot | ALREADY_IMPLEMENTED | `src/sourceEdit.ts:6,23`。ID・位置・doneを維持。legacy曖昧性を拒否 |
| Project/Wishlist編集の1config保存・失敗時draft維持 | ALREADY_IMPLEMENTED | `src/App.tsx:5632` saveSourceEdit、phase71-edit-sync 7 tests |
| 上記編集の同source実行中/paused guard | ALREADY_IMPLEMENTED | `src/App.tsx:5626`。開始側もsourceEditBusyRef確認。保存中は別source編集も一時直列化 |
| Today3本文・きっかけの全編集入口統一 | CONFLICT | `src/App.tsx:5517,5560,8253` はToday3だけを直接保存する旧経路。source同期とTimer guardは共通editorとは別。勝手に削除しない |
| 3一覧48px/上下5px、見出し13px/650、Wishlist左線なし | ALREADY_IMPLEMENTED | styles.cssのsourceListRow最終override、unified-source-layout tests |
| sourceのellipsis/右クリック/Shift+F10 | ALREADY_IMPLEMENTED | AppのsourceRowMenuButton、ContextMenu.tsx。アンカー消失時fallbackは未実装 |
| Builder・Today3のellipsis、Builder編集 | NEW | 既存右クリックを再利用。Builderメニューは上下移動・候補除外のみ |
| 下層の直接「今日へ」を廃止 | CHANGE | 現行project/inboxメニューと表示ボタンに存在。dashboard-disclosure-contextの現行契約テストも更新対象 |
| 当日除外中だけ「今日の候補に戻す」 | NEW | 除外storageはあるが解除commandなし。全候補selectorを共用する |
| Builder候補生成・5件/page・選択済み維持 | ALREADY_IMPLEMENTED | App:6429-6486。Project→Wishlistの初期順、localStorage手動順は種別を跨げる |
| removeToday / excludeCandidate | ALREADY_IMPLEMENTED | App:5524 / 6494。config保存失敗rollback、sourceとSessionを保持。Undoはなし |
| 新経路の直前guard/最新状態評価 | CHANGE | addCandidateToTodayはclosure config・max3/重複のみ。採用中Timer/source-saveの再検証が必要 |
| 空Today3 CTA | CHANGE | 開いてfocusする既存helperあり。現行文言は「今日の候補を見る」。候補0の分岐を追加 |
| Warm Rich右下Toast | CHANGE | 既に右下18px。4200ms+退場200ms、textのみ、pause/queue/actionなし |
| remove/excludeのUndo | NEW | 逆差分・競合拒否・保存後通知が必要。既存save_configはCASなし |
| 下層6-19先頭5 / 20以上10件page | NEW | 下層は全件map。Builderの5件pageとは分離 |
| B2寸法のみ | CONFLICT | 現在48x36、親grid48+48/cluster160。90-91pxへ単純拡大不可。サイズ以外の変更不可 |
| 既存同一リスト並替 | ALREADY_IMPLEMENTED | pointermoveはpreview、dropで保存。BuilderのみlocalStorage、例外処理なし |
| 2種類のcross-section D&D | NEW | 現行hit-testは各同一リスト。復帰/採用を既存commandから共有する必要 |
| v2.1 target・500ms展開・共通preview/cleanup | CHANGE | 既存ghostと各pointer処理はあるが新target/共通cleanupなし。Projectのみauto-scroll |
| 保存成功でのみ達成演出 | NEW | done表示は既存。演出event/dedupはなし。victoryは保存結果をawaitしていない |
| dynamic early completion / 3件次batch | ALREADY_IMPLEMENTED | earlyCompletion.ts、App:5038-5360,6521。判定変更なし |
| native WebView2 tooltip遅延・Windows DPI | UNVERIFIED | 今回はChromium+DPR1。native smoke実施済みとはしない |

## 実装前の承認点

1. **Undo安全保存**: 既存Mutexは書き込みを直列化するだけで、古いconfigを拒否しない。最新読み直しだけではTOCTOUが残る。Undo用の対象差分commandまたは条件付き保存を既存lock内に限定追加する案を承認後に精査する。現行APIだけで安全と宣言しない。
2. **Builder順序**: configの除外解除とlocalStorageの任意位置保存は別トランザクション。1保存契約を保つには、後方互換なBuilder順序fieldをconfigへ移す限定migrationが必要。承認なしでは位置付き復帰を実装しない。
3. **B2寸法**: 親grid/clusterも寸法調整が必要。狭幅でカード高を増やさず90pxを維持できない場合、縮幅またはfooter配置の例外承認が必要。remove/ellipsisを隠さない。
4. **既存inline編集**: 今回の「全入口のguard」をどこまで含めるか。旧inlineを共通source editorへ接続する案はユーザー操作変更になるため、P72-01前に承認対象とする。

これらは監査での提案であり、未実装。P72-00のPR承認がPhase全体の実装許可になるわけではない。

関連: [安全契約](00-contracts.md) / [Timer基準](00-timer-size-baseline.md) / [テスト計画](00-test-plan.md) / [報告](workreports/p72-00-report.md)。
