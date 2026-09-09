# Changelog

## 1.1.0 (Unreleased)

### 追加・改善

- 「今日の3件」をプロジェクト色付きカードへ整理し、3列・2列・1列の表示に対応。
- 今日の項目はタイマー満了後の終了確定で完了。3件すべて完了したときだけ、手動で「次の3件を選ぶ」。
- 「今日の3件から外す」で今日への採用だけを解除。元の次の一手・やりたいこと・候補・実行記録は保持。
- きっかけをTimerの直上へ移動。未設定時はその領域のホバー・フォーカスでのみ表示。
- 「今日を組み立てる」を次の一手・やりたいこと由来の候補へ整理し、5件ずつ表示。「今日へ」で元の登録を残したまま採用。
- Builderの「今日の候補から外す」は当日だけ候補を除外し、同じ候補の今日の項目も解除。元の登録は保持。
- 次の一手・やりたいことの「完了にする」を登録の削除と区別し、記録画面に完了履歴を追加。
- やりたいことの追加を小型ダイアログへ整理。同じ文面の別項目は安定したIDで区別。
- Today3へ採用した時点の本文・手順書・開始環境の参照・タイマー分数を保持。
- 開始環境をサイドバー・辞書から検索して選ぶPickerを追加。新規選択は最大2件、既存の超過登録は保持。
- 辞書の矢印キー移動、Quickと辞書間の登録移動、Explorer表示、D&Dの操作表示を改善。
- 辞書を開く際、Life Launcher本体があるモニターに表示するよう調整。
- 開閉バーのクリック範囲を拡大。確認ダイアログの確定操作を左、キャンセルを右へ統一。
- 記録画面とアプリ内ガイドを現在の操作フローに合わせて更新。

### 修正・保守

- Today3のD&Dで掴んだ項目と黄色の挿入位置を表示。drop時の順序保存と保存失敗時の復元を検証。
- 対象タイマーが動いている間の採用解除や登録の完了・削除をUIと処理側で防止。
- ESLint経由の開発依存`js-yaml`を`4.3.2`へ更新し、GHSA-2883-xcg3-v3hhに対応。

### アップデート時の注意

- v1.0のToday3でsource keyが未設定の項目は、移行時に完了状態が未完了へ戻る。Sessionの実行記録は削除しない。
- 更新前にアプリを完全終了し、`%APPDATA%\life-launcher`を別の場所へバックアップすることを推奨。この移行だけでは、書き換え前の自動バックアップは保証されない。
- 詳細は [v1.1.0 Release notes](docs/releases/v1.1.0.md) を参照。

## 1.0.0

First public release of Life Launcher.

- Quick sidebar and searchable command dictionary
- Daily victory condition, today's three items, and next-step workflow
- Short and normal timers with local session records
- Project totals, daily activity, and local notes
- Markdown, text, and sanitized HTML instruction viewer
- Local-first storage with bounded favicon retrieval and per-window Tauri capabilities
