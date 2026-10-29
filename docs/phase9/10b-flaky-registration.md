# P9-10b 不安定なテストの原因を直す 報告

ブランチ: `test/p9-10b-flaky-registration`(起点: P9-08〜P9-10 をマージした後の `main`、`6bbee2d`)

## 1. 判定

`FIXED`(CI の結果は 10.)

2つとも原因はテストの待ち方だった。製品コードの競合ではなかったので、停止せずにテストだけを直した。製品コードは変えていない。

## 2. 要約

- **A. `phase6-readiness` の `registration`**: ダイアログを閉じたあと、フォーカスが開いた元のボタンへ戻るのは次の描画フレームになる(製品の仕様)。テストはそれを待たずに行へ `focus()` して Shift+F10 を押していたため、戻るフォーカスが後から来ると「やりたいこと」の右クリックメニューが開いていた。戻ったことを待ってから進むようにした。
- **B. `phase9-color-roles` の「P9-06 add buttons on Main…」**: hover のあと、背景色は `expect.poll` で待っていたが、枠線の色は1回だけ読んでいた。色は transition で切り替わるので、背景が先に期待の色になり、枠線が途中の色(`rgb(182, 174, 158)`)のことがあった。枠線も、期待の色になるまで待つ確認にした。同じ形のフォーカスの輪の確認もまとめて直した。
- 修正後の繰り返し実行で、失敗は 0 になった(8. の表)。

## 3. 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `tests/visual/phase6-readiness.spec.ts` | `registration` で、やりたいことの追加ダイアログを閉じたあと、フォーカスが「やりたいことを追加」ボタンへ戻るのを待つ1行(とコメント)を追加 |
| `tests/visual/phase9-color-roles.spec.ts` | 色の確認用の `expectStyle`(`expect.poll`)を追加し、hover の背景色・枠線、フォーカスの輪の確認5か所をこれに置き換え |
| `docs/phase9/10b-flaky-registration.md` | この報告 |

製品コード(`src/`、`src-tauri/`)、基準画像、仕様書(`docs/spec/current-spec.md`)、ヘルプ(`helpGuide.ts`)は変えていない(テストだけの修正のため)。

## 4. 失敗の再現(修正前)

`main`(`6bbee2d`)で、`--repeat-each` を指定して4並列で実行した。

| テスト | 実行回数 | 失敗 | 失敗した場所 |
| --- | --- | --- | --- |
| A. `phase6-readiness` の `registration stays in source sections and persists after reload` | 200 | 23(11.5%) | `phase6-readiness.spec.ts:196` の `toBeEnabled()`。メニューの項目「次の一手を編集」が見つからない(5秒待っても出ない) |
| B. `phase9-color-roles` の `P9-06 add buttons on Main use the neutral tokens…` | 150 | 6(4%) | `phase9-color-roles.spec.ts:79` の `toBe()`。枠線の色が期待 `rgb(184, 176, 160)`(`--muted`)に対し `rgb(182, 174, 158)` |

B は、報告にあった値と同じ(期待 `rgb(184, 176, 160)`、実際 `rgb(182, 174, 158)`)。失敗の画像は `dist/visual-qa/test-results/` に出る(コミットしていない)。

## 5. 原因

### A. `registration`

1. 「やりたいことを追加」のダイアログは、閉じると `requestAnimationFrame` で開いた元のボタンにフォーカスを戻す(`src/App.tsx` のダイアログのフォーカス復帰。既存のテスト `phase81-layout-qa` が、すべての閉じ方でこの復帰を確認している。意図した製品の振る舞い)。
2. テストは、ダイアログが消えたこと(`toHaveCount(0)`)だけを待って、すぐに `addedProjectRow.focus()` と `Shift+F10` に進む。
3. 消えたあと、次のフレームで「やりたいことを追加」ボタンへのフォーカス復帰が来る。これがテストの `focus()` と `Shift+F10` の間に入ると、「やりたいこと」のセクションの右クリックメニュー(項目は「やりたいことを追加」だけ)が開き、「次の一手を編集」が見つからない。

切り分けに、テストの複製で、`focus()` の直後と `Shift+F10` の後に `document.activeElement` と開いたメニューの項目を記録して、80回実行した(複製は削除済み)。

| 結果 | 回数 |
| --- | --- |
| 正しいメニュー(プロジェクトの項目)が開き、フォーカスもそのまま | 55 |
| 正しいメニューが開いたあとで、フォーカスだけが「やりたいことを追加」ボタンへ移った(この回は通る) | 15 |
| `Shift+F10` の時点でフォーカスが「やりたいことを追加」ボタンにあり、「やりたいことを追加」のメニューが開いた(この回は失敗) | 10 |

失敗の回は、メニューの項目が「やりたいことを追加」だけだった。フォーカスの復帰が、テストの操作より後に来ることがある、という説明と合う。製品側の競合ではない(復帰のタイミングが次のフレームなのは仕様で、操作者が入力する速さでは起きない)。

### B. 「P9-06 add buttons on Main…」

- ボタンの背景色と枠線の色は、どちらも transition で切り替わる。
- テストは、hover のあと背景色だけを `expect.poll` で待ち、その直後に枠線の色を1回だけ読んでいた。
- 背景色が期待の色になった瞬間に、枠線がまだ切り替え途中だと、`--muted` に届いていない途中の値(`rgb(182, 174, 158)`)を読んで失敗する。
- 失敗する確率は実行時の状態(負荷)で変わる。P9-08 の作業中の「6回中5回」は、そのときのこのマシンの状態によるものと見ている(今回の測定は4%)。CI では通っていたが、同じ形なので CI でも起こり得た。

## 6. 修正

### A. `registration`

```ts
await expect(wishlistDialog).toHaveCount(0);
// Closing a dialog hands focus back to its opener on the next animation frame. Wait for that,
// or it can land after the focus below and open the Wishlist section menu instead.
await expect(wishlist.getByRole("button", { name: "やりたいことを追加" })).toBeFocused();

await addedProjectRow.focus();
```

固定時間の待機は使っていない。待つ状態は「フォーカスが開いた元のボタンに戻った」。

### B. `phase9-color-roles`

`expectStyle(page, selector, expected, message)` を追加した。`expect.poll` で計算後のスタイルを繰り返し読み、期待のプロパティが全部そろうまで待つ。次の5か所をこれに置き換えた。

| 場所 | 変更 |
| --- | --- |
| 「add buttons on Main」の hover | 背景色だけを待っていたのを、背景色と枠線の両方に(今回の失敗の場所) |
| 「add buttons on Main」のキーボードフォーカス | 輪の種類と色を1回読むのを、待つ形に |
| 「Today3 entry, the victory bar, keyboard focus…」のフォーカス | 同上 |
| 「neutral settings buttons react like…」の hover | 背景色と枠線の両方を待つ形に(同じ形の読み出しが残っていた) |
| 「neutral settings buttons react like…」のキーボードフォーカス | 輪の種類と色を待つ形に |

期待値はどれも変えていない(同じトークンの色と比べている)。

## 7. 調べて、直さなかったもの

- `phase9-border-roles.spec.ts`(P9-07)にも、hover・フォーカスのあとに1回だけ読む同じ形がある。50回の繰り返しで失敗が出なかったので、今回は変えていない(提案、12.)。
- `phase9-color-roles` の ほかの1回読み(静止状態の色、実行中の時計の色など)は、transition の途中にならない状態を読んでいるので、そのままにした。

## 8. 修正後の繰り返し実行

修正前と同じ条件(4並列)で実行した。

| テスト | 実行回数 | 失敗 (前 → 後) |
| --- | --- | --- |
| A. `registration` | 200 | 23 → **0** |
| B. 「add buttons on Main…」 | 150 | 6 → **0** |
| `phase9-color-roles` の6件すべて | 各50 | 0 |
| `phase6-readiness` の7件すべて | 各50 | 0 |
| `phase9-border-roles` の9件すべて(参考) | 各50 | 0 |

## 9. 完了条件ごとの結果

| 条件 | 結果 |
| --- | --- |
| 原因が特定され、報告に書かれている | 5. |
| 修正後の繰り返し実行で失敗が0 | 8. |
| 必須ゲートがすべて通る | 下の表 |

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3544ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 467件すべて通過、1.7分 |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

## 10. CI の結果

(push 後に追記)

## 11. 判断メモ

- **「フォーカスが戻るのを待つ」で足りる理由**: 戻る先はクリックして開いた元のボタンで、テストの流れでは毎回「やりたいことを追加」。製品の仕様なので、テストが待つのが正しい。製品側でフォーカスを戻さない、または同期的に戻す変更は、既存のテスト(`phase81-layout-qa` の「すべての閉じ方で復帰」)の意図に反するので行わない。
- **`registration` の ほかのダイアログ**: プロジェクト追加と次の一手の保存のダイアログの後にも同じ復帰はあるが、そのあとのテストの操作は、フォーカスに依存しない(ボタンのクリック)ので、待ちを足していない。必要になったら同じ形で足す。
- **B の「このマシンだけ」という以前の見立て**: P9-08・P9-09・P9-10 の報告に、「このマシンだけで失敗する」と書いた。原因は、このマシンだけの問題ではなく、transition の途中を読むテストの書き方で、読み出しのタイミングで確率的に起きる。CI でも起こり得た。

## 12. 提案(実装していないこと)

- `phase9-border-roles.spec.ts` の hover・フォーカスの確認(`look` の1回読み)も、`expect.poll` の形にそろえる。今回の繰り返しでは失敗は出なかった。
- ダイアログを閉じたあとにフォーカスの位置へ依存するテストが、ほかにもないか確認する(`registration` と同じ形の失敗の予防)。
