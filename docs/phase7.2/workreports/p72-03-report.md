# P72-03 作業報告

日付: 2026-09-10。対象: NextStep/Wishlist件数表示、Today3 Timerボタンのサイズ限定調整。

## 実装

- NextStepとWishlistへ共通の表示範囲計算を追加した。0〜5件は全件、6〜19件は先頭5件と展開/縮小、20件以上は10件/pageで表示する。
- 見出し件数とconfig配列は全件のまま維持し、展開とページ移動では保存しない。Builderの5件/pageは変更していない。
- 表示中rowはProject IDまたはWishlist stable IDと全配列indexを保持するため、既存D&D・右クリック・上下移動は未表示項目の順序を壊さない。
- 配列変更後はstable IDをanchorに展開状態またはpageを選ぶ。対象削除時は直後、なければ直前の項目へanchorを移し、最終pageをclampする。
- Today3の待機中Timerボタンだけを高さ36pxのまま幅48pxから90pxへ広げた。label、title、hover時分数、色、font、icon、handler、カード高、他画面Timerは変更していない。

## テスト

- `tests/visual/phase72-lists-timer-size.spec.ts` を追加した。
- Project/Wishlistそれぞれ0/1/5/6/19/20/21/30/100件、展開/縮小、pagination、保存0回、19→20、削除clamp、stable focusを確認した。
- 3桁分数、幅90px、高さ36px、title、短時間/通常の色差、hover分数、実際のTimer開始、1920/1000/860pxの3/2/1列相当とhorizontal overflow 0を確認した。
- 対象Playwright: 25/25 PASS。
- 全Visual QA: 210/210 PASS（1.4分）。
- public:check: 272 files / 0 blockers PASS。
- lint / build: PASS。
- Rust fmt / check / clippy / 103 unit + 2 integration: PASS。
- npm audit全依存 / production: 0 vulnerabilities。
- git diff --check: PASS（既存ファイルの改行警告のみ）。

初回対象テストは量テスト用fixtureが全ProjectをweeklyFocusに複製し、既存の重点最大3件制約で9件失敗した。fixtureから重点指定だけを外した後、25/25 PASSを確認した。製品実装の件数制約に不具合はなかった。

## 残存事項

- cross-section D&DはP72-04で実装する。
- 完了演出はP72-05、Guideと最終回帰はP72-06で扱う。
- Native Tauri/DPIの実機確認はP72-06の最終報告で明示する。

PR・CI・merge commitはGitHub送信承認後に本報告と実行台帳へ追記する。
