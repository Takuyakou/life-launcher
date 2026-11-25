# P72-01 作業報告

日付: 2026-09-10。対象: 候補復帰、Builder編集、Today3/Builderメニュー、空Today3。

## 実装

- NextStepの直接「今日へ」メニューを削除し、Today3採用はBuilderへ一本化した。
- 当日の明示的な候補除外に一致するstable sourceだけ、NextStep/Wishlistメニューへ「今日の候補に戻す」を表示する。
- 候補復帰はBuilder除外だけを解除し、Today3・source・履歴を変更しない。保存失敗時は既存config rollbackを使う。
- Builderの右クリックと「…」へ編集を追加し、P71のProject/Wishlist editor、Timer guard、1config再snapshotへ接続した。
- Today3へ既存右クリックと同じ「…」入口を追加した。BuilderとToday3のクリック、右クリック、Shift+F10は同じmenu commandを使う。
- Today3空状態を「今日やるものを選びましょう」「今日を組み立てる」へ変更し、Builder展開後に先頭候補または見出しへスクロール・フォーカスする。
- 復帰成功結果は操作ID、sourceKey、同期先を持つ構造化結果としてP72-02から利用できる形にした。

## テスト

- `tests/visual/phase72-selection-edit-menus.spec.ts` を追加した。
- stable Wishlist IDの同文別項目、page/表示状態に依存しない除外復帰、Today3非自動採用、Builder編集同期、実行中・一時停止中の編集禁止、空状態フォーカス、ellipsis/keyboard、保存失敗rollbackを自動確認した。
- 対象テスト: 6/6 PASS。
- 全Visual QA: 177/177 PASS（1.3分）。
- public:check: 269 files / 0 blockers PASS。
- lint / build: PASS。
- Rust fmt / check / clippy / 100 unit + 2 integration: PASS。
- npm audit全依存 / production: 0 vulnerabilities。
- git diff --check: PASS（既存ファイルの改行警告のみ）。

全Visual QA初回は旧仕様を固定していた5件が失敗し、2回目は残った旧selector 2件が失敗した。直接Today採用、空状態文言、追加したellipsisによる曖昧なbutton selector、D&D開始点をP72-01契約へ更新し、関連39件PASS後に全177件PASSを確認した。製品側の保存・D&D contractは変更していない。

## 残存事項

- Warm Rich ToastとUndoはP72-02で実装する。
- 下層からBuilderへのD&D復帰はP72-04で実装する。
- native Tauri/DPIの実機確認はP72-06の最終報告で明示する。

PR: [#43](https://github.com/Takuyakou/life-launcher/pull/43)。内容commit `533d015` に対するGitHub Actions run `34439076402` はverify PASS（4分57秒）。この記録commitは同じCIで再確認してから、ユーザーのPhase 7.2完了までの包括指示に基づきマージする。
