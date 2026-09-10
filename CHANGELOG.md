# Changelog

## 1.2.0 - 2026-09-11

### 追加・改善

- 短時間タイマーの基準を満たして通常タイマーを途中停止したとき、「今日の分は完了」または「未完了のまま終了」を選べる動的早期完了を追加。
- Today3、次の一手、やりたいことの編集をstable source identityで同期。採用済みsnapshotを明示的な編集保存時に更新。
- Today3と「今日を組み立てる」へ右クリック・「…」メニューを追加し、編集や候補復帰へ同じ操作で到達可能にした。
- Today3から外す操作と候補除外に、後続の変更を壊さない対象差分Undoを追加。
- 通常Toastを4秒、Undo付きToastを8秒のWarm Rich表示へ統一。ホバー・フォーカス・画面非表示中は残り時間を停止。
- 次の一手・やりたいことの件数に応じて、全表示・5件＋展開・10件単位のページ表示を切り替える一覧制御を追加。
- Today Builder候補からToday3、明示除外した登録元からToday Builderへのcross-section D&Dを追加。
- D&D開始直後から有効な移動先を黄色の枠・背景・案内で表示。案内はoverlay表示とし、画面の高さを変えない。
- 勝利条件、Today3、3件完了、今やる一手に、保存成功後だけ短く表示する完了フィードバックを追加。
- サイドバーの待機中タイマー分数を上下D&Dで変更可能にし、Today3の開始ボタン幅と一覧の密度・ホバー表示を調整。

### 修正・保守

- Timer実行中の同一source編集を、入口と保存handlerの両方で拒否。編集中にTimerが始まった場合も保存しない。
- D&Dはdrop時だけ保存し、日付・source・重複・3件上限・active Timerを再検証。保存失敗時は元の表示へ戻す。
- 早期完了の確認待ちや保存待ちをSession時間へ加算せず、二重停止・二重記録・古いTimer操作を拒否。
- Today3、今日を組み立てる、次の一手、やりたいことの行配置・余白・操作表示を統一。
- アプリ内Guideと現行仕様書をPhase 7.2の操作フローへ同期。

### アップデート時の注意

- config schemaはv1.1と同じ`2`で、v1.1からの追加migrationはない。既存の登録、Today3、Session、完了履歴を引き続き使用する。
- 更新前にアプリを完全終了し、必要に応じて`%APPDATA%\life-launcher`をバックアップすることを推奨。
- 詳細は [v1.2.0 Release notes](docs/releases/v1.2.0.md) を参照。

## 1.1.0 - 2026-09-09

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
