# Phase 8.1 作業まとめ（内部ID: P81-01〜P81-08）

## 現在の状態

ユーザーはPhase 8.1全体の続行とconfig v2→v3本番移行を承認した。現在の`feat/p81-01-project-purification`作業ツリーにはStage 01〜07の実装とStage 08の文書整合が存在する。

**実装・文書整合・フル検証済み、レビュー待ち。未merge・未release。**

監査基準は`07904dd1c34b5f9bbc101a6dcae58a71a6bb4fd9`、現在HEADは監査承認commit `88a27d132cbdfc68be1160785eb5facc1582a17e`であり、Phase 8.1実装は未コミット作業ツリーとして記録する。

## Stage別まとめ

| 内部ID | 内容 | 状態 |
| --- | --- | --- |
| P81-01 | Project metadataとNextStep実行設定を分離 | 完了・レビュー待ち |
| P81-02 | NextStep専用設定、reset、legacy pending、Timer guard | 完了・レビュー待ち |
| P81-03 | Wishlist任意Project所属とstable ID | 完了・レビュー待ち |
| P81-04 | 黄色Project CTAと領域別context menu | 完了・レビュー待ち |
| P81-05 | Wishlistの明示昇格と置換確認 | 完了・レビュー待ち |
| P81-06 | 既実装reverse D&Dの監査・回帰維持 | 完了・レビュー待ち |
| P81-07 | source-aware完了後整理と履歴保持 | 完了・レビュー待ち |
| P81-08 | Spec/Overview/移行文書/報告/state整合 | 完了・レビュー待ち |

## 中核モデル

- Project = 継続テーマの入れ物。
- Wishlist = 任意Project所属の複数候補。
- NextStep = Projectごとの今進める0〜1件と実行設定。
- Today3 = 最大3件の今日の採用snapshot。

source identityは`project:{Project.id}`、`wishlist:{stable-id}`を維持する。同一ProjectのNextStep置換はoptionalな`generationId`とToday側の`sourceGenerationId`で区別する。Sessionとsource completionは別履歴であり、現在のsource本文から再構築しない。

## 移行保護

v2 Projectを専用decoderで検証し、非空NextStepはoptional objectへ、空NextStepの残存実行設定は`legacyNextStepSettings`へ移す。空候補を作らず、旧実行設定を無言で破棄しない。

JSON/root/decode/v3全体validation/future versionの失敗では`changed: false`、`saveBlocked: true`としてraw configを保持する。検証成功後もraw backup作成成功前に書き込まない。書き込みは一時ファイルとWindows `ReplaceFileW`を利用する。v3は再移行しない。

pendingはNextStep設定時の明示的なinherit/discardを必要とし、キャンセル・保存失敗では残る。保存成功時だけ新NextStepと同じconfig保存で削除する。詳細は[移行契約](../config-v2-to-v3-migration.md)を参照する。

最終レビューのgeneration拡張は未リリースconfig v3内で行い、versionと`sourceKey`を変更しない。v2由来のNextStepとToday3はfield欠落のlegacy世代として保持する。新規設定・置換・昇格だけがstable markerを生成し、編集は保持、採用はTodayへcopyする。完了・再snapshot・直接Do Now対応付けは同世代だけを対象とし、既存Today3やSessionを遡及更新しない。

## 既実装として維持したもの

完了Reward animation、Timer hover/time表示、HTML手順書renderer fidelity、Today3→Builder reverse D&DとUndoはPhase 8.1開始前に完了している。Phase 8.1の新規redesign成果として扱わず、移行後の回帰対象として維持する。

## 最終gate結果

generation patch後の最終差分に対してfull gateを再実行した。`npm ci`後のlockfile・依存関係に変更はなく、公開安全検査、静的解析、製品ビルド、全UI回帰を含めてすべて成功した。

| コマンド | 最終結果 |
| --- | --- |
| `npm.cmd ci` | PASS（172 packages、lockfile変更なし） |
| `npm.cmd run public:check` | PASS（321 files、0 blockers） |
| `npm.cmd run lint` | PASS（0 warnings） |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | PASS（246件、2.4分） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS（0 warnings） |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS（unit 112件 + capability 2件） |
| `npm.cmd audit` | PASS（0 vulnerabilities） |
| `npm.cmd audit --omit=dev` | PASS（0 vulnerabilities） |
| `git diff --check` | PASS |
| `npm.cmd run tauri -- build --no-bundle` | PASS |

## 確認済み

- migration matrixのdisk failure、raw backup、save guard、reload/idempotenceを最終gateで確認した。
- Project/NextStep/Wishlistの作成・編集・昇格・置換・rollbackとsame-text stable IDを確認した。
- Today3 snapshot、Session、source completion、reverse D&D、Undo、orderを確認した。
- Reward→follow-up順、未完了早期停止、replacement保護、reload非再演、keyboard/reduced motionを確認した。
- generationのlegacy absent-to-absent、新規生成、編集保持、採用copy、same-text置換分離、completion、re-snapshot、直接Do Now対応付けを確認した。
- 1920/1440/1000/860/narrow、long text、empty、多数項目、hover/focus/context/dialogを確認した。
- Guide・test・Specの整合とpublic safetyを確認した。

## 判定

`READY FOR v1.3/vNEXT RELEASE PREP`

Phase 8.1の実装・文書・検証は完了した。人間レビュー待ちであり、merge、version bump、tag、Release、deployは行っていない。
