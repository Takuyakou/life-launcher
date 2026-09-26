# UI-05 NSISインストーラー作業報告書

作業日: 2026-09-26
対象: [PR #111](https://github.com/Takuyakou/life-launcher/pull/111) (`feature/ui-05-nsis-branding` → `main`)

## 実施内容

- オーナー提供のインストーラー専用アイコンとBMPを `src-tauri/installer/` に配置した。アプリ本体のアイコンは変更していない。
- 日本語Windowsで日本語表示になるよう、NSIS言語を `English`、`Japanese` の順に設定した。
- 追加修正では、サイドバー画像を提供ZIP内の190×290・24-bit BMPへ無加工で差し替えた。原本と配置ファイルのSHA-256はともに `9CB07C76DD5F40F58D26EEDE4566FF9C457B5580334BCFFE63CD3B8F69620CB0`。
- `headerImage` と `uninstallerHeaderImage` の設定、および未使用になった `nsis-header.bmp` を削除した。`installerIcon`、`uninstallerIcon`、`sidebarImage` は維持した。独自NSISテンプレートは使っていない。

## 変更ファイル

- `src-tauri/tauri.conf.json`: NSISの画像・アイコン・言語設定。
- `src-tauri/installer/nsis-installer.ico`: インストーラー専用アイコン。
- `src-tauri/installer/nsis-sidebar.bmp`: 差し替えサイドバー画像。
- `src-tauri/installer/nsis-header.bmp`: 追加後、今回の修正で削除。
- `docs/screenshots/ui-05-nsis/`: 実機画面5枚。
- `docs/release/v1.3.3/ui-05-nsis-work-report.md`: 本報告書。

## 実機確認

| 項目 | 結果 |
| --- | --- |
| `npm.cmd run package:windows:installer` | 成功。Dドライブにv1.3.3のsetup.exeを生成 |
| ようこそ・完了画面 | 新しいサイドバー画像のLの角丸が正方形に表示 |
| インストール先選択・インストール中 | カスタムヘッダーBMPは表示されない。ただし右端のLアイコンは残る |
| EXEアイコン | setup.exeは黄色いL、インストール後の`life-launcher.exe`は従来のアプリアイコン |
| インストール・起動・アンインストール | Dドライブの試験先で成功。隔離した設定が作成され、アンインストール時はデータ削除を選ばず保持 |
| ローカルチェック | `npm.cmd run lint`、`npm.cmd run public:check`（422ファイル、blocker 0）、`git diff --check` 成功 |
| PRのコード変更CI | `f133381`で成功。ビルド、画面テスト、Rust check/clippy/test、npm auditを含む |

実画面は `docs/screenshots/ui-05-nsis/` の `welcome-100.png`、`directory-100.png`、`installing-100.png`、`finish-100.png`、`uninstall-100.png` に保存し、PR本文にも掲載した。撮影環境はWindowsの100%表示（96 DPI）。

## 未達・確認事項

- 「途中画面のヘッダーを文字だけにする」は厳密には未達。画像設定を外しても、NSIS標準UIは右端にインストーラーのLアイコンを表示する。インストーラーアイコン維持、画像の加工禁止、独自テンプレート不使用を優先し、このアイコンを隠すための別方式は追加していない。
- 150%表示での実機撮影・にじみ確認は、オーナー判断により今回は未実施。日本語以外のOSでの英語フォールバックも実機未確認。
- エクスプローラーの一覧画面そのものは未撮影。EXEの埋め込みアイコンを抽出して目視確認した。

## 成果物

- 改訂版setup.exe: `D:\dev\Life Launcher-v133-release\release-candidate\ui-05-revision\Life-Launcher-v1.3.3-windows-x64-setup.exe`
- setup.exe SHA-256: `DE078A071AE0A14661C6E8CDD128733AAC34B5EEC5A852DE55AEC50FA4F3E675`
- ビルド成果物と試験用プロファイルはDドライブに配置。試験インストールはアンインストール済み。
