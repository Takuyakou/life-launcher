# P7.0 Work Report

## Scope

Timer / shortDuration / Session契約の監査のみ。P7.1は未着手。
対象: Takuyakou/life-launcher、base main `978474564b0ab2b9002b387057e6eaa684027301`。
開始時HEAD=origin/main。無関係な既存未追跡Phase6.2報告書は変更・stageしない。
root AGENTS.mdはなし。提供された開始文書、概要、作業指示、状態、参考報告、
現行spec/Guide、コードと既存テストを確認した。

## Deliverables

- [動的閾値の契約](../00-dynamic-threshold-contract.md)
- [状態表](../00-state-matrix.md)
- [データ影響](../00-data-impact.md)
- [再開状態](../execution-state.json)を以後のcanonical stateとする。元の依頼packetは変更しない。
- `tests/visual/phase7-audit.spec.ts`: 現行境界14件、実スキーマ、pause/resume、wall-clock jump。
- `src-tauri/src/commands/config.rs`: snapshot範囲維持とlegacy補完の追加テスト2件。

## Decision

閾値は有効なToday3採用時short snapshotと5分の小さい方。防御fallback5分。
設定最小とSession最小がともに1分なので追加max下限は不要。
Project現在値で採用済み閾値を変えない。予定時間以上はplanned優先。
early確認の機能そのものをテストPASS/実装済みとは扱わない。

## Validation

| 検証 | 結果 |
| --- | --- |
| npm run lint | PASS |
| npm run build | PASS |
| npm run public:check | PASS（stage後も再実行） |
| npm run test:visual | PASS: 129/129（追加17件を含む） |
| cargo fmt -- --check | PASS |
| cargo check | PASS |
| cargo clippy --all-targets -- -D warnings | PASS |
| cargo test | PASS: unit 100 + capability integration 2 |
| git diff --check | PASS |

全コマンドはrepository標準。Rustコマンドは `--manifest-path src-tauri/Cargo.toml` を指定。
追加browserテスト初回はテスト側のAPI引数名/アクセシブル名に誤りがあり修正。
修正後の単独17件と全体129件がともにPASS。製品動作を変更してテストを通してはいない。

Visual QA: 既存suiteの1366/1440/1920/1000/860等の画面チェックを実行。
1440pxの長文・Timer実行中・disabled解除ボタンと、860pxの1列・focus-visible画像を目視確認。
重なりや操作部の欠落なし。画像は `dist/visual-qa/test-results` に生成。
早期完了dialogは未実装のため、そのVisual QAはP7.1で実施する。
既存suiteが過去の追跡済み画像27件も再生成したが、本PRには含めない。
画像復元は安全機構により拒否されたため未コミットで保持し、利用者の承認待ち。

## Residual Risk / Review Gate

保存の非原子性、二重/古い終了callback、plannedの複数一致、延長state/ref差を検出。
Escape/closeとdialog待機時間の扱いは次段階仕様を確認してから実装する。
今回はコード監査とmocked browser検証。実Tauri/OS suspendは未実施。
version/tag/Release/EXE/Web/依存パッケージ変更なし。
人間がP7.0を承認するまでmergeせず、P7.1へ進まない。
branch: `docs/p7-00-dynamic-threshold-audit` / PR base: `main`。
P7.0は監査完了・人間レビュー待ち。P7.1承認やRelease承認は含まない。
