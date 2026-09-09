# P7.2 Guide / Spec / Web Sync

## Entry

P7.1のマージとP7.2への進行承認を受け、PR #31をmainへマージした。
Release sourceではなく今回の作業baseは `d2b52739c82e3934174f54aafa29f6f9e30b27ac`。

## Product

- Guideの「予定時間前は完了しない」を動的早期完了の説明へ更新。
- 採用時snapshot、通常5分cap、短時間設定、今日だけの完了、元source保持を説明。
- current-specに式・有効範囲・fallback・inclusive境界・予定時間優先・pause/待ち時間・左右配置・初期右focus・保存失敗・部分補充なしを記載。
- Guideの操作検査を更新し、現行仕様と旧文言の混在を防ぐcopy contract testを追加。

## Web

別branch `feature/p7-02-early-completion-demo` で簡略同期。手動終了時の確認、snapshot基準、Demo短時間まで進める操作、保存失敗時の状態保持を追加した。
ページ構成・Hero・既存seedは維持。Project設定UIは移植しない。3分snapshotはunit testで検証。
Demo既存のSession切り上げ・最低1分は本体と異なるためWeb docsに明記した。

## Validation

| Check | Result |
| --- | --- |
| Product lint / build / public:check | PASS |
| Product test:visual | 150 PASS (copy contract 1追加) |
| Rust fmt / check / clippy -D warnings | PASS |
| Rust tests | 100 unit + 2 capability PASS |
| Current Guide/spec/OVERVIEW stale text scan | 該当なし |
| Web lint / build / public:check | PASS |
| Web unit | 53 PASS |
| Web production E2E | 32 PASS、CSP・XSS・通信ゼロを含む |
| Web visual | 16 PASS |
| git diff --check (both) | PASS |

本体初回Visualは既存Quick keyboard menuの開閉期待で1件失敗し、同serial suiteの3件が未実行。コード変更を追加せず全体再実行して150件PASS。flakyの可能性は残る。
Web初回Visualはマウス操作とfocus-visibleのテスト条件を修正して再実行PASS。
Web確認画面を1366/1440/1920/390pxで検査し、1440/390px画像を目視確認。Native Tauri実機smokeは今回未実施。

## Stop / Remaining

提出PR: [Product #32](https://github.com/Takuyakou/life-launcher/pull/32) / [Web #10](https://github.com/Takuyakou/life-launcher-web/pull/10)。作成直後のGitHub Actionsは両方pending。Webの接続済みWorkers BuildsはPASS。手動deployは実行していない。

- ProductとWebのPRを分離し、人間レビュー待ちで停止する。P7.3へ自動進行しない。
- P7.2のmerge、Web deploy、EXE生成、version変更、tag、Releaseは行わない。
- 既存の未コミット報告書と、自動テストで更新された過去Phaseの画像は今回のPRへ含めない。削除・復元も行わない。
