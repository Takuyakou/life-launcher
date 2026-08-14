# Life Launcher

**日本語** | [English](README.en.md)

**「何をしよう？」を「今これをやる」に変えるWindowsアプリ。**

Life Launcherは、迷っているときに「今やる一手」を1つ示し、必要な環境を開いて、開始まで連れていくlocal-firstのWindowsデスクトップアプリです。

[Windows版をダウンロード](https://github.com/Takuyakou/life-launcher/releases/tag/v1.0.0)

![Life Launcher メインダッシュボード](docs/screenshots/main-dashboard.png)

## Web Demo

インストールせず、ブラウザからLife Launcherの中心的な流れを試せます。

[Web Demoを開く](https://life-launcher-web.takuyakou.workers.dev)

<img src="docs/screenshots/web-demo.png" alt="Life Launcher Web Demo" width="720">

Web Demoではsynthetic dataを使用し、変更した状態をブラウザのlocalStorageに保存します。Windows版のアプリ・ファイル・URL起動は実際には行わず、「開始すると環境が揃う」流れをDemo演出として確認できます。※Windows製品版の完全移植ではありません。

## 主な機能

- **今やる一手**
  今週の重点から、説明可能な固定ルールで「今やる一手」を1件だけ提示します。

- **今日の勝利条件 / 今日の3件**
  今日の基準を1つ決め、取り組む項目は最大3件に絞ります。

- **Quick Launcher / 辞書**
  アプリ・フォルダ・ファイル・URLを登録し、サイドバーや`Ctrl+K`検索から呼び出せます。

- **タイマー / セッション記録**
  短時間または通常タイマーで開始し、1分以上の実行内容をローカルに記録します。

- **手順書ビューア**
  登録フォルダ内のMarkdown・テキスト・サニタイズ済みHTMLを別ウィンドウで参照できます。

## Screenshots

### Dictionary / Instruction Viewer

| 辞書 | 手順書ビューア |
| --- | --- |
| ![検索可能な辞書](docs/screenshots/dictionary.png) | ![手順書ビューア](docs/screenshots/instruction-viewer.png) |

スクリーンショットは合成データから生成されています。実際のユーザー設定・アクティビティ・パス・ノートは含まれていません。

## Download

Life Launcherは、[GitHub Releases](https://github.com/Takuyakou/life-launcher/releases/tag/v1.0.0)からダウンロードできます。

### Installer - Recommended

通常はこちらを利用してください。

`Life-Launcher-v1.0.0-windows-x64-setup.exe`

### Standalone EXE

インストールせず直接起動できます。

`Life-Launcher-v1.0.0-windows-x64.exe`

### Portable ZIP

ZIPを展開して利用できます。

`Life-Launcher-v1.0.0-windows-x64-portable.zip`

> 現在のWindowsバイナリはコード署名されていないため、Windows SmartScreenの警告が表示される場合があります。Microsoft Edge WebView2 Runtimeが必要です。

配布ファイルの整合性はReleaseに含まれる`SHA256SUMS.txt`で確認できます。

## 動作要件

- Windows 10以降（x64）
- Microsoft Edge WebView2 Runtime

## 開発

### Requirements

- Node.js 24
- Rust stable（MSVC toolchain）

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run build
npm.cmd run test:visual
cargo check --manifest-path src-tauri/Cargo.toml
```

Tauri開発用アプリを起動:

```powershell
npm.cmd run tauri -- dev
```

ローカル向けWindowsパッケージをビルド:

```powershell
npm.cmd run package:windows
```

公開品質はReact / TypeScriptのlint・build、Playwright Visual QA、Rust check・test・clippy、public safety scanで検証しています。

## 技術スタック

- Tauri 2 / Rust
- React 18 / TypeScript
- Vite 8
- Playwright（決定論的なVisual QA）
- Zod（フロントエンドのデータ検証）

## セキュリティ

公開ソースには、範囲を制限したfavicon取得、ローカル / プライベート宛先の拒否、リダイレクト再検証、レスポンス検証、ウィンドウ単位のTauri capabilitiesが含まれます。ネットワークと権限の契約はRustの自動テストでカバーされています。

## ローカルデータとネットワーク利用

Life Launcherはアカウントや専用サーバーを必要としません。設定・セッション・ノート・バックアップ・アイコンキャッシュは、`%APPDATA%\life-launcher`またはユーザーが選んだバックアップフォルダにローカル保存されます。

テレメトリ、解析、クラッシュレポート、クラウド同期、自動アップデータはありません。URLを登録すると、Life Launcherはそのfaviconを対象オリジンから直接取得する場合があります。取得経路は明らかなローカル / プライベート宛先を拒否し、リダイレクト・タイムアウト・レスポンスサイズの制限を適用します。登録したURLを開くとユーザーのブラウザが起動し、そのネットワーク挙動はLife Launcherの管理外です。

詳細は[PRIVACY.md](PRIVACY.md)と[SECURITY.md](SECURITY.md)を参照してください。

## 公開ソースについて

このリポジトリはLife Launcher v1.0.0から、クリーンな公開履歴で始まっています。非公開の開発履歴、内部の計画書・報告書、実際の実行データ、非公開スクリーンショット、ビルド成果物、リリースバイナリは意図的に除外しています。

## ライセンス

オープンソースライセンスは付与されていません。ソースは閲覧可能ですが、著作権者の明示的な許可なく、使用・改変・再配布は認められません。All rights reserved.
