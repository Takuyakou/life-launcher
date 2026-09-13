# Life Launcher Overview

> 最終更新: 2026-09-13 / v1.3候補
> 詳細は [UI/UX・機能仕様書](spec/current-spec.md) を参照してください。

## 何ができるアプリか

Life Launcherは、選んだ「次の一手」を実行へ移すlocal-firstのWindowsデスクトップアプリです。
開始環境と手順書を開き、Timerで始め、実行記録を残す流れを一つにまとめます。

## 主な機能

### Quickサイドバー / 辞書

よく使うアプリ、フォルダー、ファイル、URLはQuickへ、数が多い項目は`Ctrl+K`の辞書へ登録します。
辞書はページ分類、検索、D&D、矢印キー操作に対応し、閉じる前のページ・フォーカス・スクロールを再表示時に復元します。

### 今日のフォーカス

「今日の勝利条件」「今やる一手」「今日の3件」で、今取り組む内容を絞ります。
「今日を組み立てる」から次の一手・やりたいことを最大3件選び、未完了項目は翌日へ自動繰り越ししません。

### 取り組み / やりたいこと

取り組みには目標、次にやること、始めるきっかけ、開始環境、手順書、Timerを設定できます。
まだ整理しない単発の候補は「やりたいこと」へ置き、必要な日にToday3へ採用します。

### Timer / 実行記録

短時間・通常Timerを同じ記録経路で開始し、実行中、一時停止、終了を管理します。
記録画面は「ふりかえり」「今週を決める」「すべての記録」に分かれ、保存時の実行内容を事実として表示します。

### 手順書ビューアー

登録したローカルフォルダーからMarkdown、Text、サニタイズ済みHTMLを閲覧します。
MarkdownとTextは編集でき、取り組みやToday3の開始時に関連付けられます。

### 登録 / バックアップ

ファイル、ショートカット、ブラウザーのURL、ごみ箱などをD&Dで登録できます。
指定フォルダーへ日次ZIPバックアップを保存し、検証後にアプリ内から復元できます。

## 画面構成

```text
Life Launcher
├─ Main
│  ├─ Quick sidebar / Timer
│  ├─ Today dashboard
│  │  ├─ 今日の勝利条件 / 今やる一手
│  │  ├─ 今日の3件 / 今日を組み立てる
│  │  └─ 次の一手 / やりたいこと / 今日の実行
│  ├─ Records（ふりかえり / 今週を決める / すべての記録）
│  ├─ Guide
│  └─ Settings
├─ Dictionary
├─ Instruction Viewer
└─ Mini Timer
```

## データ配置

通常の実行時データは`%APPDATA%\life-launcher`へローカル保存します。

| 場所 | 内容 |
| --- | --- |
| `config.json` | ランチャー、取り組み、Today3、やりたいこと、設定 |
| `sessions.jsonl` | Timerと手動の実行記録 |
| `notes.json` | 旧形式メモの互換データ |
| `icons/` | アイコンキャッシュ |
| `backups/` | 更新前バックアップ |
| ユーザー指定先 | 日次ZIPバックアップ |

## 非目標

- 期限、優先度、サブタスク、一般的なタグ管理。
- カレンダー、ヒートマップ、ストリーク、達成率、ランキング、統計グラフ。
- 未完了項目の自動繰り越し、Today3の自動補充、今週の重点の自動リセット。
- アプリ内AI、自動分類、外部AIへの自動送信、アカウント、クラウド同期。

## バージョン履歴

| Version | 概要 |
| --- | --- |
| 1.3候補 | Phase 8で登録フォーム、Today3/Builder、記録、辞書、Guideの表示と操作を整理 |
| 1.2.0 | 動的早期完了、編集同期、Undo Toast、cross-section D&D、完了フィードバックを追加 |
| 1.1.0 | Today3と候補選択、登録完了履歴、開始環境Picker、辞書操作を整理 |
| 1.0.0 | 最初のPublicリリース。Quick、辞書、実行支援、Timer、記録、手順書を収録 |

以降の変更は [CHANGELOG](../CHANGELOG.md) を更新し、この表は大きな節目だけを追記します。

## 関連文書

- [詳細UI/UX・機能仕様](spec/current-spec.md)
- [README (日本語)](../README.md) / [README (English)](../README.en.md)
- [CHANGELOG](../CHANGELOG.md)
- [Privacy](../PRIVACY.md) / [Security](../SECURITY.md)
- [Screenshots](screenshots/README.md)
