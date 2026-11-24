# P7.1 Work Report

## Scope / Baseline

P7.0の承認を受け、CI成功を確認したPR #30をmainへmergeした。
P7.1開始commit: `aa0a9756f009cebe5656ef424cd4e657a9886046`。
branch: `feature/p7-01-early-completion`、PR base: `main`。
P7.1実装のみ。version=1.1.0 / schema=2を維持し、Release・EXE・Web Demoは変更しない。

## Implemented

- manual stopかつ未完了Today3に一意に対応し、閾値以上・現在の予定時間未満の場合だけ確認する。
- 閾値は採用時short snapshotと5分の小さい方。runtime欠落/不正値は5分。
- Projectの現在値や80%比率を使わない。既存の旧データ補完は変更しない。
- 左「今日の分は完了」、右「未完了のまま終了」。右初期focus、native buttons、既存tokenを使用。
- Escape/閉じるは右と同じ未完了終了。backdropでは閉じない。IME確定のEnter/Escapeを無視。
- 停止要求時の実効時間を固定し、回答待ち・保存待ち・再試行待ちを記録に加えない。
- 両選択でSessionを保存。左だけ対象TodayItem.doneを更新する。
- NextStep/Wishlist/Project nextStep/候補/既存Session/source completion historyは変更・削除しない。
- Today直接sourceKeyを優先し、Project紐づけWishlistから別のProject採用を巻き込まない。
- Do Nowは採用Project sourceに一致する場合のみ対象。未採用Do Nowは記録のみ。
- 3/3完了時だけ既存の手動次batch CTA。2/3補充・空きslot自動補充は追加しない。
- 完了カードを「今日の分は完了」と表示し、早期完了を予定時間満了と誤表示しない。

## Save / Concurrency

Sessionを先に保存してからToday3を更新する。Today保存失敗時は既存persistConfigがUIを戻し、
Sessionは残してエラーを表示し終了する。Session失敗時は凍結した確認を維持して再試行できる。
Session保存済みflagにより、後段の再試行で再appendしない。
表示更新の失敗をSession append失敗と混同しない。

Timer開始ごとのinstanceIdと同期ref guardで、二重停止・二重回答・古い停止handlerを拒否する。
確認/保存中は別Timer開始・resume・miniの重複終了もhandlerで拒否する。
miniからの終了でもmainを前面へ戻し、他のdialogより前面で確認する。
予定完了は従来の画面を維持し、manualの予定時間到達判定もそちらへ渡す。
延長時のstate/refを同期し、延長後の予定時間で判定する。

通常停止/切替でも記録失敗時はTimerを消さず再試行可能にした。
plannedの直接source OR Project一致という既存完了範囲は変更していない。

## Changed Files

- `src/earlyCompletion.ts`: 閾値検証と一意なsource対応。
- `src/App.tsx`: 停止要求、Session確定、確認UI、Timer identity、状態ラベル。
- `src/components/ConfirmDialog.tsx`: IME-safeキー処理と最前面dialog限定のキー制御。
- `tests/visual/phase7-early-completion.spec.ts`: 新規20件。
- `tests/visual/phase7-audit.spec.ts`: 監査時の境界fixtureをP7.1動作へ更新。
- `tests/visual/phase6-main.spec.ts`: 完了状態のアクセシブル名を更新。
- `tests/visual/tauriMock.ts`: Session失敗制御を追加。
- P7 execution-state、本報告、レビュー用の合成画像。

## Validation

| 検証                                                                           | 結果                           |
| ------------------------------------------------------------------------------ | ------------------------------ |
| npm.cmd run lint                                                               | PASS                           |
| npm.cmd run build                                                              | PASS                           |
| npm.cmd run test:visual                                                        | PASS: 149/149                  |
| P7.1新規テスト単独                                                             | PASS: 20/20                    |
| cargo fmt --manifest-path src-tauri/Cargo.toml -- --check                      | PASS                           |
| cargo check --manifest-path src-tauri/Cargo.toml                               | PASS                           |
| cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings | PASS                           |
| cargo test --manifest-path src-tauri/Cargo.toml                                | PASS: unit 100 + integration 2 |

`npm.cmd run public:check`: PASS（216 files、0 blockers）。`git diff --check`: PASS。
最後のモーダル配置調整後にもlint/build/全browserテストを再実行した。
Rustコード・依存パッケージは今回変更していない。

## Visual QA

1366 / 1440 / 860pxで左右配置、初期focus、Tab循環、長文カード、hover、focus-visibleを確認。
任意の経過時間表示は追加せず、既存確認UIの簡潔な本文を使用する。

- [1366px](../screenshots/p7-01-1366-focus.png)
- [1440px](../screenshots/p7-01-1440-focus.png)
- [860px](../screenshots/p7-01-860-focus.png)

## Residual Risk / Next Gate

実Tauri/OS suspendの今回の起動smokeは未実施。browserはTauri mockであり、ネイティブ実機試験ではない。
実効時間は既存のpause差引き方式。非pause中のOS suspend/壁時計前進を除外する新時計は追加しない。
configとSessionは別保存で、プロセス異常終了をまたぐ原子性やbackend appendの不確定失敗時のexactly-onceは保証しない。
pending確認はメモリ内のみ。アプリ強制終了からの復元機能は追加しない。
plannedの複数source一致と保存順序は既存範囲を維持する。
Guide/current-spec/Webへの文言同期は指定どおりP7.2へ残すため、P7.1だけをReleaseしない。
過去の生成画像差分・既存の未追跡Phase6.2報告書は保持し、本PRに含めない。

P7.1 PR作成後STOP。人間の承認まではmergeせず、P7.2へ進まない。
