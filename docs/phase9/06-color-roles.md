# P9-06 色の役割を定義してそろえる 報告

ブランチ: `feature/p9-06-color-roles`(起点: `feature/p9-05-do-now-prefer-today3`。PR のマージ先も同ブランチ。P9-04・P9-05 が main にマージされたら `main` へ付け替える)

## 1. 判定

`DONE`(CI の結果は 12. に追記)

## 2. 実装内容の要約

- 追加ボタン3種と、メンテナンスの3ボタンを、黄色から既存の中立ボタンの見た目に変えた。「バックアップから復元」を、「バックアップを未設定にする」と同じ赤の扱いにした。
- 色の指定は、既存のクラス(`mainActionButton--neutral`、`settingsButton--neutral`、`dangerButton settingsButton--danger`)に付け替えただけで、新しい色・新しい CSS は作っていない。
- 仕様書 §4 に色の役割表を追加した。保存・決定の緑とキャンセルの赤、文言、ボタンの数、配置、大きさは変えていない。

## 3. 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src/App.tsx` | 6つのボタンのクラス名を付け替え(下の 5.)。CSS の変更なし |
| `docs/spec/current-spec.md` | §4.1.1「色の役割」を追加。§4.2 の gold / neutral の説明を役割に合わせた |
| `tests/visual/phase9-color-roles.spec.ts` | 新規。4件 |
| `tests/visual/phase83-main-action-hover.spec.ts` | 既存テストの「金色の例」を、まだ金色のボタンへ差し替え(9. 参照) |
| `docs/phase9/06-screens/*.png` | 変更前後のスクリーンショット8枚 |
| `docs/phase9/06-color-roles.md` | 新規。この報告 |

## 4. 完了条件ごとの結果

- [x] 仕様書 §4 に色の役割表がある(§4.1.1。「ボタンの役割」と「タイマーの種類・状態」の2軸で緑・赤を区別)
- [x] 一覧のボタンが役割どおりの色になっている(5. の表。テストで計算後の色をトークンの色と比較)
- [x] 保存・決定=緑、キャンセル=赤が変わっていない(テストで確認。旧コードでも同じ値)
- [x] 必須ゲートがすべて通る(ローカル。CI は PR で確認)

## 5. 変更したボタンごとの変更前後の色

通常時の計算後の色。変数名の右が実際の色。

### 5.1 Main

対象: 「＋ プロジェクト」(`.nextStepHeaderAdd--project`)、「＋ やりたいこと」(`.nextStepHeaderAdd--wishlist`)、次の一手カードの「＋ 今日へ」(`.nextStepTodayAdd`)。クラスは `mainActionButton--gold` → `mainActionButton--neutral`。

| 部分 | 変更前 | 変更後 |
| --- | --- | --- |
| 文字 | `--accent-strong` `#ffce5b`(rgb(255, 206, 91)) | `--text-muted-readable` `#a39c8e`(rgb(163, 156, 142)) |
| 背景 | `rgba(231, 185, 77, 0.1)`(`--accent` の10%。CSS 内の直値) | `--control-neutral-bg` = `--surface` `#211f1a`(rgb(33, 31, 26)) |
| 枠 | `rgba(231, 185, 77, 0.58)`(`--accent` の58%。直値) | `--line` `#4a4639`(rgb(74, 70, 57)) |
| hover | 背景 `rgba(231,185,77,0.18)`、枠 `--accent` | 背景 `--control-neutral-hover-bg` = `--surface-strong` `#2b2922`、枠 `--muted` `#b8b0a0` |
| 押下 | 背景 `rgba(231,185,77,0.08)` | 背景 `--control-neutral-active-bg` = `--surface-soft` `#1b1a17` |
| キーボードフォーカス | 黄色の輪(`--accent-strong`) | 変更なし(黄色の輪のまま) |

### 5.2 設定 > メンテナンス

対象: 「アイコンキャッシュ再生成」「ミニウィンドウ位置をリセット」「手順書ウィンドウ位置をリセット」。クラスは `secondaryButton settingsButton--warning` → `secondaryButton settingsButton--neutral`(同じ画面の「configフォルダを開く」と同じ)。

| 部分 | 変更前 | 変更後 |
| --- | --- | --- |
| 文字 | `--accent-strong` `#ffce5b` | `--muted` `#b8b0a0`(rgb(184, 176, 160)) |
| 背景 | `rgba(231, 185, 77, 0.08)`(直値) | `--surface` `#211f1a` |
| 枠 | `--accent` `#e7b94d`(rgb(231, 185, 77)) | `--line` `#4a4639` |
| hover / focus | 枠 `--accent`、背景 `rgba(231,185,77,0.18)` | 変更なし(既存の中立ボタンの hover。枠 `--accent`、背景 `rgba(231,185,77,0.18)`) |

### 5.3 設定 > バックアップ

対象: 「バックアップから復元」。クラスは `secondaryButton settingsButton--warning` → `dangerButton settingsButton--danger`(「バックアップを未設定にする」と同じ)。

| 部分 | 変更前 | 変更後 |
| --- | --- | --- |
| 文字 | `--accent-strong` `#ffce5b` | `#ffb4ad`(rgb(255, 180, 173)。`.settingsButton--danger` の直値。「未設定にする」と同じ) |
| 背景 | `rgba(231, 185, 77, 0.08)` | 透明(「未設定にする」と同じ) |
| 枠 | `--accent` `#e7b94d` | `--error` `#f06f68`(rgb(240, 111, 104)) |
| hover / 押下 | 黄色の hover | 赤の hover(枠 `--error`、背景 `--control-danger-hover-bg` `#4a302a`)、押下は背景 `--control-danger-active-bg` `#32231f`(既存の `dangerButton`) |

## 6. スクリーンショット(`docs/phase9/06-screens/`)

1080×680、公開 fixture、日付は固定。

| 画面 | 変更前 | 変更後 |
| --- | --- | --- |
| メイン(標準) | [main-top-old.png](06-screens/main-top-old.png) | [main-top-new.png](06-screens/main-top-new.png) |
| メイン(次の一手とやりたいことが見える位置までスクロール) | [main-sources-old.png](06-screens/main-sources-old.png) | [main-sources-new.png](06-screens/main-sources-new.png) |
| 設定 > バックアップ | [settings-backup-old.png](06-screens/settings-backup-old.png) | [settings-backup-new.png](06-screens/settings-backup-new.png) |
| 設定 > メンテナンス | [settings-maintenance-old.png](06-screens/settings-maintenance-old.png) | [settings-maintenance-new.png](06-screens/settings-maintenance-new.png) |

- `main-top` は、変更したボタンが画面外(次の一手以降)にあるため、変更前後で同じに見える(基準画像と同じ位置)。
- 次の一手カードの「＋ 今日へ」は、この fixture では今日の3件が3/3のため無効状態(暗い表示)で写っている。有効時の色は 5.1 と、テスト(今日の3件が2件のとき)で確認した。

## 7. テスト(`phase9-color-roles.spec.ts`、4件)

1. 追加ボタン3種が中立トークン(`--text-muted-readable`、`--control-neutral-bg`、`--line`)の色になり、hover(`--control-neutral-hover-bg`、枠 `--muted`)、押下(`--control-neutral-active-bg`)、キーボードフォーカス(黄色の輪)が見える
2. メンテナンス3ボタンが中立トークン(`--muted`、`--surface`、`--line`)で、hover で枠の色が変わる。「バックアップから復元」が「バックアップを未設定にする」と同じ色(枠は `--error`)で、押下の背景が変わる
3. 設定の保存が緑(`--good`、`--control-positive-bg`)、キャンセルが赤(薄い赤の文字、`--control-danger-bg`)のまま
4. 勝利条件の枠、「今日やるものを選ぶ」、キーボードフォーカスの輪(`--accent`)、実行中の時計(`--accent-strong`)が黄色のまま

1・2 は旧コードで失敗し、3・4 は旧コードでも通る(変更していない)。

## 8. 実行したゲート

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3474ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 425件通過、1.5分(P9-05 の421件 + 新規4件) |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

## 9. 更新した基準画像

なし。変更したボタン(次の一手・やりたいこと・設定のバックアップ/メンテナンス)は、基準画像 `main-*`(1080×680の先頭)、`settings-basic`、`today-picker` などに写っていないため、13枚すべて閾値 0.001 のまま一致した。変更前後の見た目は 6. のスクリーンショットで示す。

## 10. 判断メモ

- **既存テストの変更(1件、要確認)**: `phase83-main-action-hover.spec.ts` の「gold and neutral actions respond to hover…」は、金色の例として `.nextStepHeaderAdd--project`(「＋ プロジェクト」)を使っていた。今回中立色に変えたため、「今日の3件が0件のときの『＋ 今日やるものを選ぶ』」(まだ金色)に差し替えた。「金と中立の背景が違う」「どちらも hover・focus・押下に反応し、寸法が変わらない」という期待値は変えていない。
- **今やる一手の色**: 現在の実装では、今やる一手はプロジェクト色(青など)で描かれ、黄色は使っていない(勝利条件の枠と、フォーカスの輪、実行中の時計が黄色)。仕様書 §4.1.1 に「今やる一手の表示色はプロジェクト色」と書いた。
- **黄色のまま残したボタン**: 「＋ 今日やるものを選ぶ」(今日の3件の選択入口)、Picker 内の「＋ 今日へ」、空状態の最初の操作(「プロジェクトを設定」「やりたいことを設定」など)。指示書の変更対象に含まれないため、変えていない。
- **待機中タイマーの時計の色**: 変えていない(P9-09)。
- **P9-04・P9-05 が main に未マージ**: 指示書は main から切る前提だが、この時点で #120(P9-04)・#121(P9-05)が未マージのため、P9-05 のブランチから切った。

## 11. 提案(実装していないこと)

- 設定の中立ボタン(`settingsButton--neutral`)は、hover と focus で黄色の枠・背景になる(既存)。中立色の役割と、メンテナンスの hover が黄色になることが食い違って見える場合は、`.secondaryButton.settingsButton--neutral:hover` を Main の中立 hover(`--muted` の枠)にそろえるとよい。
- 設定 > 手順書の「解除」ボタン(`settingsButton--warning`)も黄色のまま。指示書の一覧に無いので触っていない。
- 今日の3件の選択入口と空状態の最初の操作(黄色のまま)が、役割表の「黄色」と一致しているか、P9-07 以降で見直す余地がある。

## 12. CI の結果

(PR 作成後に追記)
