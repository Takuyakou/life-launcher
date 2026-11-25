# Phase 8.1 config v2→v3移行

## 目的

config v3では、プロジェクトのメタデータと、現在の次の一手に属する実行設定を分離する。

- Project: `id`、`name`、`northStar`、`weeklyFocus`、`colorId`
- NextStep: `text`、`trigger`、開始環境、手順書、Timer、鮮度時刻、optionalな世代境界
- Wishlist: stable IDを保ち、Project未所属または1 Project所属
- Today3: 採用時snapshotを変更しない
- Session / 完了履歴: 既存記録を変更しない

## v2からの変換

v2 Projectに空でない`nextStep`がある場合、flatな実行設定を同じProjectの`nextStep` objectへまとめる。stable source identityは従来どおり`project:{Project.id}`で、別のsource keyは作らない。v2由来の`NextStep.generationId`は生成せず、欠落したlegacy世代として扱う。

v2 Projectの`nextStep`が空で、開始環境、手順書、Timer等だけが残っている場合は、空のNextStepを作らず`legacyNextStepSettings`へ保留する。ユーザーがそのProjectへ次の一手を設定するときに限り、`引き継ぐ`または`破棄して全体設定を使う`を明示的に選ぶ。選択前は保存できない。キャンセルでは保留設定を維持し、NextStepの保存成功時にだけ`legacyNextStepSettings`を同じconfig保存で解消する。

実行設定もない空Projectは、NextStep未設定のまま移行する。

## 移行失敗時の保護

現行実装の失敗保護は次の順序で動く。

1. raw `config.json`をJSONとして読み、rootとversionを確認する。
2. v2の場合はv2専用decoderでProject配列全体を検証し、Projectだけを純粋変換する。
3. 変換後のconfig全体をv3 `AppConfig`としてdecodeし、`nextStep`と`legacyNextStepSettings`が同時に存在しないことも検証する。
4. ここまでに失敗した場合は`changed: false`、`saveBlocked: true`の読み込み結果を返し、ディスク上のrawファイルへ書き込まない。画面用の初期configを返しても、それを元ファイルへ保存しない。
5. 検証成功後、書き換え前のrawファイルを`backups/config-<timestamp>.json`へコピーする。バックアップ作成に失敗した場合も書き込みを開始しない。
6. v3を`config.json.tmp`へ書き、Windowsでは`ReplaceFileW`で置換する。置換に失敗した場合はエラーを返し、移行前raw backupを保持する。

`version: 3`は変換せず、移行による2回目のbackupや書き換えを行わない。対応版より新しいversionはdowngradeせず拒否し、通常保存も既存configのdecodeに失敗した状態では拒否する。

Today3、Wishlist、Session、source completionはProjectから再構築しない。v2→v3変換はrootをcloneしてProject構造とversionだけを置き換えるため、Today3の順序・`done`・snapshot・source identity、Wishlist stable ID、履歴はそのまま保持する。既存Today3へ`sourceGenerationId`を遡及付与せず、Sessionも書き換えない。

## config v3内の世代境界拡張

最終レビューで、同一Projectに同じ文面のNextStepを置換した場合、`project:{Project.id}`と本文だけでは古いToday snapshotと現在NextStepを安全に区別できないことが判明した。未リリースのconfig v3へ次のoptional fieldを追加する。

- `NextStep.generationId`
- `TodayItem.sourceGenerationId`

config versionと`sourceKey`は変更しない。既存v2移行データとgeneration field追加前のv3データは、両field欠落のlegacy世代として読み込む。

- 新規設定・置換・Wishlist昇格: stableな新しい`generationId`を生成する。
- 既存NextStep編集: 現在の`generationId`を保持する。
- Today3採用: `generationId`を`sourceGenerationId`へcopyする。
- completion、source re-snapshot、直接Do NowからのToday対応付け: generationが一致する場合だけ処理する。両方欠落はlegacy同世代として一致する。
- old Today snapshotと新replacementのgenerationが異なる場合、本文が同じでもold snapshotは新NextStepを完了・空化・再snapshotしない。

この拡張は過去のToday3やSessionを修復・再構築するmigrationではない。既存値は欠落のまま保持し、新しい操作から世代境界を付ける。

## legacy pendingの扱い

| 状態 / 操作 | 結果 |
| --- | --- |
| v2に非空NextStepあり | 本文と実行設定を`nextStep` objectへ移し、generationとpendingは作らない |
| v2にNextStepなし、残存設定あり | 空候補を作らず`legacyNextStepSettings`へ保留 |
| v2にNextStepも残存設定もなし | `nextStep`、pendingとも作らない |
| `引き継ぐ` | pendingの開始環境・手順書・Timer等をdraftへ反映 |
| `破棄して全体設定を使う` | draftを空の開始環境・手順書、全体Timer設定へ戻す |
| ダイアログをキャンセル | pendingを維持 |
| 保存失敗 | 元configとpendingを維持し、draftから再試行可能 |
| 保存成功 | 新NextStepを保存し、同じ保存でpendingを削除 |
| 後のv3 NextStep完了 | NextStepを空にするだけで、新しいmigration pendingは作らない |

## 新規・置換時

新しいNextStepの設定または既存NextStepの置換では、以前の開始環境、手順書、Timer overrideを自動継承しない。明示的なlegacy移行を除き、開始環境と手順書は空、Timerは全体設定を使用する。

## 検証状態

世代境界追加前にはbrowser 238件、Rust unit 112件 + capability 2件、Tauri no-bundle buildが成功した。ただし、この結果は最後のgeneration patchを含まない。Phase 8.1全体の最終gateはpatch後の再実行待ちであり、本書では最終PASSを確定しない。
