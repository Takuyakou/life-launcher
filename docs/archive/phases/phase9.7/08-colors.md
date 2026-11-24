# P97-08 — プロジェクトカラーを4色増やす、止める操作のトーストを灰色にする 報告

- 日付: 2026-11-07
- ブランチ: `feature/p97-08-colors`（`main` = `4f2a719` から）
- 判定: **DONE**

## 実装内容の要約

プロジェクトカラーに `lime`（ライム #b5d35c）・`magenta`（マゼンタ #e07ad6）・`sand`（サンド #c9ab82）・`coral`（コーラル #ff8b78）を、今の8色のあとに足して12色にした。色を指定していないプロジェクトの自動の色は、元の8色だけを使う別の一覧で決めるので変わらない。止める・外す・解除・削除・元に戻すのトーストを灰色（`neutral`）にそろえ、自動起動をオンにしたときだけ緑（`ok`）のままにした。仕様書に色の一覧とトーストの色の決まりを書いた。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src/projectIdentity.ts` | `AUTO_PROJECT_COLOR_IDS`（元の8色）を追加。`PROJECT_COLOR_IDS` を12色に。`PROJECT_COLOR_LABELS` に4色を追加。`resolveProjectColorId()` は元の8色でハッシュを割る |
| `src/types.ts` | `ProjectColorIdSchema` に4色を追加 |
| `src/styles.css` | `[data-project-color="lime" / "magenta" / "sand" / "coral"]` の `--project-color` を追加 |
| `src/App.tsx` | トーストの色を変更（下の表）。`PC起動時の起動を止めました` はオフのときだけ `neutral`、オンは `ok` のまま |
| `src-tauri/src/commands/config.rs` | JSON スキーマの `colorId.enum` を12色に、読み込み時の修復の一覧を12色に。スキーマのテストを12色に。12色の保存と不明な色の修復のテストを追加 |
| `docs/spec/current-spec.md` | プロジェクト色の一覧を12色に。§21 にトーストの色の決まりを追加 |
| `tests/visual/phase97-colors.spec.ts` | 色のテスト4件（下記） |
| `tests/visual/phase97-toast-colors.spec.ts` | トーストのテスト5件（下記） |
| `tests/visual/phase97-colors.spec.ts-snapshots/phase97-project-colors-win32.png` | 12色のパレットの新しい基準画像（722×35、4,880バイト） |
| `docs/phase9.7/08-colors.md` | この報告 |

`config.schema.json` はリポジトリに書き出していないため、変更していない（Rust の `config_schema_json()` がスキーマの元）。

## A. プロジェクトカラー

### 足した色（この順で8色のあと）

| id | 表示名 | 値 |
| --- | --- | --- |
| `lime` | ライム | `#b5d35c` |
| `magenta` | マゼンタ | `#e07ad6` |
| `sand` | サンド | `#c9ab82` |
| `coral` | コーラル | `#ff8b78` |

### 自動の色を変えない

`src/projectIdentity.ts` に元の8色の一覧 `AUTO_PROJECT_COLOR_IDS`（amber・blue・green・violet・rose・cyan・orange・slate）を別に置き、`resolveProjectColorId()` のハッシュはこの8色で割る。12色で割ると、色を指定していない既存プロジェクトの色が変わってしまうため。テストでは、変える前の関数をテストの中に写し、`project-0` から `project-999` までの1,000個で結果がすべて一致することを確かめた。

### テスト（色）

- `tests/visual/phase97-colors.spec.ts` **4件**
  1. 12色の一覧・表示名と、1,000個の ID で自動の色が変わらないこと（旧関数と一致）
  2. プロジェクト編集の12色がすべて表示され、12色のどれを選んでも保存・再読み込み・再編集で同じ色が選ばれていること。パレットの画像比較（新しい基準画像）
  3. 560px の狭い窓でも、12色が編集ダイアログの中に収まり、重ならないこと
  4. 元の8色と新しい4色を混ぜた12プロジェクトで、再読み込みと編集（名前の変更）をしても、どの色も変わらないこと
- Rust（`config.rs`）
  - `project_colors_accept_the_twelve_known_ids_and_repair_unknown_ones`: 12色がすべて修復で消えないこと、`unknown` が今までどおり消えて警告が出ること
  - スキーマのテスト: `colorId.enum` が12色で、`lime`・`magenta`・`sand`・`coral` を含むこと

### コントラスト

プロジェクト色は、カードの左の線・点・上端の線・選択枠に使い、**色の上に文字を載せていない**（`color: var(--project-color)` の文字色はない）。参考として、4色と背景 `--surface`（#211f1a）のコントラスト比を計算した: ライム 9.75、マゼンタ 6.21、サンド 7.55、コーラル 7.23。すべて 4.5:1 以上で、線・点としても十分に見える。

## B. 止める操作のトースト

### 変えたもの

| 今の文 | 前 | 後 |
| --- | --- | --- |
| PC起動時の起動を止めました（自動起動オフ） | 緑 | **灰色**（オンにしたときの「PC起動時に開くようにしました」は緑のまま） |
| 手順書フォルダの登録を解除しました | 緑 | **灰色** |
| 実行記録を削除しました | 緑 | **灰色** |
| やりたいことへ戻しました / 次の一手を未設定にしました | 緑 | **灰色** |
| 元に戻しました（共通の `runToastAction()`） | 緑 | **灰色** |
| 辞書ページの「〜 を削除しました」 | 緑 | **灰色**（下記のとおり、この経路は今は画面に出ない） |

- 「今日の候補から外しました」は、P97-06 で旧「今日を組み立てる」の経路ごと消えた。今の「今日の3件から外しました」は前から `neutral` で、今回もそのまま。
- 失敗（`error`）・注意（`warn`）・危険（`danger`）の色、トーストの形・位置・時間は変えていない。
- 自動起動のトーストは、設定画面のチェックボックスではなく、上部メニューの「Windows自動起動」の切り替え（`toggleAutoStart`）から出る。設定画面のチェックボックスは下書きを変えるだけで、保存時にコマンドを呼ぶ（トーストは出ない）。

### 辞書ページ削除について

`App.tsx` の「辞書ページを削除しました」のトーストは、旧ランチャーオーバーレイ（`{false && launcherOverlayOpen && …}`）の中にあり、**今は画面に出ない**。生きている辞書ウィンドウのページ削除は `DictionaryFeatureParity.tsx` の `showStatus()` で、トーストではなく設定画面内の状態表示を使う。今回は `App.tsx` の死んだ経路の色も灰色にそろえたが、テストでは確かめられない（報告の「判断メモ」）。

### テスト（トースト）

`tests/visual/phase97-toast-colors.spec.ts` **5件**（すべて `toHaveClass(/toast--neutral/)` と `not.toHaveClass(/toast--ok/)` を確認）

1. 自動起動オフ → 灰色「PC起動時の起動を止めました」、オン → 緑「PC起動時に開くようにしました」
2. 設定 > 手順書の「解除」→ 灰色「手順書フォルダの登録を解除しました」
3. 記録 > すべての記録 > 実行記録の削除 → 灰色「実行記録を削除しました」
4. 次の一手の解除（「やりたいことへ戻す」と「削除して未設定にする」の両方）→ 灰色
5. 今日の3件から外す → 灰色「今日の3件から外しました」、元に戻す → 灰色「元に戻しました」

## 完了条件ごとの結果

- [x] A: 4色を足した。自動の色は変わらない → 12色、`AUTO_PROJECT_COLOR_IDS`、1,000個の ID の一致
- [x] B: 止める操作のトーストが灰色になった → 5件のテスト、自動起動オンは緑のまま
- [x] Rust のスキーマと修復、画面の型と一覧、CSS、仕様書がそろっている → すべて12色、仕様書に色の一覧とトーストの決まり
- [x] 必須ゲートがローカルで通る → 下の表

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS（3639ファイル、blocker 0） |
| `npm.cmd run lint` | PASS（警告0） |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **634/634 PASS**（2.5分 / 149.0秒） |
| `npx playwright test tests/visual/phase97-colors.spec.ts` | **4/4 PASS**（8.9秒） |
| `npx playwright test tests/visual/phase97-toast-colors.spec.ts` | **5/5 PASS**（6.6秒） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **147 PASS**（146 unit + 1 capability） |
| `git diff --check` | PASS |

`public:check`・`lint`・`build`・cargo の一式は 20.1秒。CSS バンドルは 206.04 kB から 206.24 kB に増えた（4色の規則の分）。

## 更新した基準画像

| 画像 | 理由 |
| --- | --- |
| `tests/visual/phase97-colors.spec.ts-snapshots/phase97-project-colors-win32.png`（新規） | プロジェクト編集の12色パレットを画像比較に追加した。既存の基準画像は0枚変更 |

## 判断メモ

1. **自動の色**: 元の8色を `AUTO_PROJECT_COLOR_IDS` として別に持ち、`resolveProjectColorId()` はこの8色で割る。12色で割ると既存プロジェクトの色が変わるため。新しく色を指定したプロジェクトだけが12色を使える。
2. **`config.schema.json`**: リポジトリに書き出していないため、Rust の `config_schema_json()` とそのテストだけを直した。
3. **辞書ページ削除のトースト**: 旧ランチャーオーバーレイが `false` で無効なため、`App.tsx` のトーストは届かない。生きている辞書ウィンドウのページ削除は `showStatus()`（設定画面内の状態表示）で、トーストではない。今回は死んだ経路の色もそろえたが、テストはしていない。
4. **「今日の候補から外しました」**: P97-06 で旧経路ごと削除済み。今の「今日の3件から外しました」は前から `neutral`。
5. **自動起動のテスト**: 設定画面のチェックボックスは下書きだけを変えるため、上部メニューの「Windows自動起動」の切り替えを使った。設定画面の保存経路でも `enableAutostart` / `disableAutostart` は呼ぶが、トーストは出ない（今の作り）。
6. **狭い窓**: パレットは `flex-wrap` で折り返す。560px で12色がダイアログ内に収まり、重ならないことをテストで確かめた。

## 提案

- **バックアップから復元しました**: 緑のまま。削除は灰色、復元は緑のまま、という判断もあり得る。次の判断にしてほしい。ボタン・グループの削除は今も `danger`（赤）で、緑ではない。
- **プロジェクトの削除**: 追記のとおり、オーナー指示（2026-11-07）で赤（`danger`）にした。
- **死んだランチャーオーバーレイ**: `App.tsx` の `{false && launcherOverlayOpen && …}` は、辞書ページの追加・変更・削除などのトーストを含む。P97-06 のような片付けでブロックごと消すと、死んだトーストの色をそろえる必要もなくなる。
- **P97-09 の取り込み形式**: JSON の色の名前の一覧も12色にする（P97-09 で行う）。
- **P97-11 の実機確認**: 指示の3点（12色が選べる、自動の色が v1.4.2 と同じ、自動起動オフの灰色トースト）を実機確認の一覧に入れる。

## 追記（2026-11-07、オーナー指示）

- プロジェクトの削除のトーストを**赤（`danger`）**にした（「プロジェクト「…」を削除しました」）。「削除は灰色」の例外として、仕様書のトーストの色の役割に「赤(`danger`)=プロジェクトの削除」を足した。
- `tests/visual/phase97-toast-colors.spec.ts` に、プロジェクトを削除すると `toast--danger` になるテストを追加した（5件 → 6件）。
- これで「提案」の「プロジェクトを削除しましたは緑のまま」は解消した。
