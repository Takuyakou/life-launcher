# P62-03 Quick / Dictionary Move & Start Environment Picker 作業報告書

## 状態

- Stage: P62-03
- 判定: `COMPLETE — APPROVED FOR CONTINUATION`
- Base branch / SHA: `main` / `249c122d38a404b2af8fe000c17ca8e357f81fa2`
- Implementation commit: `03fa299659bba7a0bc0d1e7d320e291d6c68b15a`
- Branch: `feat/p62-03-quick-picker`
- Product version: `1.0.0`（変更なし）

## 実施内容

- Sidebarのボタン操作へ`辞書に移動`を追加した。Sidebar表示だけを外し、Dictionary登録・アクション・参照元を保持する。
- Dictionary側の操作名を`サイドバーに移動`へ統一した。すでにSidebar表示中の場合はdisabledのままにした。
- 双方向の移動を削除操作と区切り、キーボードの`Shift+F10`からも同じ操作を利用できるようにした。
- 移動保存に失敗した場合は、Sidebar/Dictionaryの表示状態と設定を変更前へ戻すようにした。
- Project編集とWishlist編集のraw checkbox一覧を共通のStart Environment Pickerへ置き換えた。
- Pickerへactual icon/favicon、名前、カテゴリ、検索、`すべて / サイドバー / 辞書`タブ、選択状態を追加した。
- 選択済み項目を外側に要約表示し、保存済みID順と起動順を保持した。新規選択は末尾へ追加する。
- 新規選択は最大2件とし、保存済みデータが2件を超える場合は切り捨てず保持し、2件以下になるまで追加だけを止める後方互換動作にした。
- Enter / Space、Esc、キャンセル、適用後のopener focus復帰、scroll、860px表示へ対応した。

## 追加test

- QuickからDictionary、DictionaryからQuickへのkeyboard context-menu移動。
- 移動後もbutton actionとDictionary登録が維持され、削除されないこと。
- 双方向のsave failure rollback。
- Project Pickerのcurrent selection、検索、選択解除、最大2件、保存順。
- PickerのEsc / cancel / focus return。
- Wishlist編集で共通Pickerが使用されること。
- legacy 3件選択を切り捨てず保持し、新規追加を拒否すること。
- 長い日本語名と860px / 1440pxでhorizontal overflowがないこと。

## 検証

| コマンド | 結果 |
|---|---|
| `npm.cmd run public:check` | PASS（189 files / blocker 0） |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | PASS（90 / 90） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS（98 unit + 2 capability contract） |
| `git diff --check` | PASS |

## 残存事項

- Records説明文、Guide、current-spec同期はP62-04で行う。
- Web Demo同期は別repositoryのP62-05で行う。
- 実Tauri smokeと全体readiness判定はP62-06で行う。
- version、tag、Release、binaryは変更していない。

`P62-03 COMPLETE — CONTINUING UNDER USER APPROVAL`
