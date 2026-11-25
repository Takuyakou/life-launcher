# P71-00 UI Inventory

| Surface | 現状 | 次段階 |
| --- | --- | --- |
| Today3 context | 上へ/下へ/今日の3件から外す。編集なし (App.tsx:9072) | canonicalを解決し編集を追加、orphan/Timer guard |
| NextStep context | 今日へ/移動/編集/完了/削除 (9187) | 編集disabledとhandler guard |
| Wishlist context | 移動/編集/完了/削除 (9140) | stable ID editorとguard |
| Project editor | 左キャンセル・右保存 (11150) | 左保存・右キャンセル、成功後close |
| Wishlist editor | 左キャンセル・右保存 (9443) | 同上、失敗時draft維持 |
| Start Environment Picker | 左キャンセル・右選択を反映 (StartEnvironmentPicker.tsx:267) | 左選択を反映・右キャンセル。親draftのみ更新 |
| Project Timer入力 | 通常→短時間 (App.tsx:10944,11021) | 短時間→通常、狭幅でも同じDOM順 |
| Settings Timer入力 | 通常→短時間 (9715,9751) | P71-02対象として短時間→通常へ統一 |
| Sidebar Timer | 通常実行のpreset (6894) | 二種類の編集UIではない。無関係に増やさない |
| 満了画面nextStep | updateCompletionNextStep別経路 (5350) | 同source Timer確定前の編集をguard |

Project/Wishlist共にStartEnvironmentPickerを再利用している。Pickerは親のdraft更新だけで永続保存しない。
色・既存token・ダイアログ寸法を再利用し、配置だけの変更と保存契約の変更を段階別に分ける。

## Visual Baseline

tests/visual/phase71-audit.spec.tsで1440x900/860x900のToday menuとProject editorを生成。編集入口、キャンセルによる終了、editor横溢れなしを検査。
画像はdist/visual-qa/test-results/phase71-audit-P71-edit-surface-audit-at-{width}/へ出力。860px画像で左キャンセル・右保存を目視確認した。
監査用testは新仕様を実装したとの主張ではない。P71-01/02で追加操作と新配置のassertionを拡張する。
