# P97-05 — ESLint の更新 報告

- 日付: 2026-11-07
- ブランチ: `feature/p97-05-eslint`（`main` = `a9e1947` から）
- 判定: **DONE**（`npm audit` の残りは下に理由を記載）

## 実装内容の要約

ESLint 8.57・`@typescript-eslint/*` 7.18 から、ESLint 10.13.0・`typescript-eslint` 8.72.0・`eslint-plugin-react-hooks` 7.1.1・`eslint-plugin-react-refresh` 0.5.7・`@eslint/js` 10.0.1・`globals` 17.13.0 に更新し、設定を `eslint.config.js` の flat config に移した。規則は今と同じ範囲（ESLint 推奨、typescript-eslint 推奨、react-hooks の `rules-of-hooks` と `exhaustive-deps`、react-refresh の `only-export-components`）で、新しく出た7件を直した。`npm audit` は開発用の依存だけに GHSA-g3hv-75wg-m249 が残る（理由は下）。

## 選んだ版と理由

すべて `package.json` に版を固定して書いた（`^` なし）。「公開から2週間以上」は 2026-10-24 以前に公開された版とした。

| 依存 | 選んだ版 | 公開日 | 理由 |
| --- | --- | --- | --- |
| `eslint` | 10.13.0 | 2026-10-16 | 10 系の最新は 10.14.0（2026-10-30）だが2週間未満。10.13.0 が条件を満たす最新。typescript-eslint 8.72.0・react-hooks 7.1.1・react-refresh 0.5.7・@eslint/js 10.0.1 の peer を `--force` / `--legacy-peer-deps` なしで満たす |
| `@eslint/js` | 10.0.1 | 2026-02-06 | peer `eslint ^10.0.0` |
| `typescript-eslint` | 8.72.0 | 2026-10-20 | 最新は 8.72.1（2026-10-26）だが2週間未満。8.72.0 が条件を満たす最新。peer `eslint ^8.57.0 || ^9.0.0 || ^10.0.0`、`typescript >=4.8.4 <6.1.0` |
| `eslint-plugin-react-hooks` | 7.1.1 | 2026-04-17 | peer に `eslint ^10.0.0` を含む |
| `eslint-plugin-react-refresh` | 0.5.7 | 2026-09-14 | peer `eslint ^9 || ^10` |
| `globals` | 17.13.0 | 2026-10-01 | 最新は 17.14.0（2026-11-01）だが2週間未満 |

- 古い `@typescript-eslint/eslint-plugin` と `@typescript-eslint/parser` は削除し、`typescript-eslint` に置き換えた。
- これ以外の開発用の依存は足していない。

## 設定

- `eslint.config.js`（新規）: `js.configs.recommended` と `tseslint.configs.recommended` を `files: ["**/*.{ts,tsx}"]` に適用し、`react-hooks/rules-of-hooks`（error）、`react-hooks/exhaustive-deps`（warn）、`react-refresh/only-export-components`（warn, `allowConstantExport: true`）を明示した。
- `eslint-plugin-react-hooks` 7 の `recommended` に入った React Compiler 向けの規則は入れていない（§提案）。
- `.eslintrc.cjs` を削除した。
- `lint` の命令は `eslint . --ext ts,tsx --max-warnings=0`（`ESLINT_USE_FLAT_CONFIG=false` を外した）。ESLint 10 でも `--ext` は使えるため、対象の範囲は今までと同じ ts/tsx。
- flat config は eslintrc と違って `.` で始まるフォルダーを自動で無視しないため、`.local-evaluation` と `**/.*` を `ignores` に足して、今までと同じ範囲にした。
- `Error` の `cause` を使うため、`tsconfig.json` の `lib` に `ES2022.Error` を足した（target は ES2020 のまま。出力は変えない）。

## 新しく出た指摘と直し

| 規則 | 件数 | 場所 | 直し |
| --- | --- | --- | --- |
| `preserve-caught-error` | 3 | `src/App.tsx`（手順書フォルダの登録解除）、`src/components/DictionaryFeatureParity.tsx`、`src/components/InstructionTree.tsx` | `throw new Error(..., { cause })` にして、元のエラーを cause に残した。メッセージは変えていない |
| `no-useless-assignment` | 2 | `src/App.tsx`（`insertIndex`）、`src/mhtml/parseMhtml.ts`（`decodedBytes`） | 使われない初期値を外し、両方の分岐で代入する形にした。動きは同じ |
| `no-constant-binary-expression` | 1行（2報告） | `src/App.tsx` の旧起動辞書オーバーレイ `{false && launcherOverlayOpen && ...}` | その行だけ `eslint-disable-next-line` にした。理由: このオーバーレイは今は使わない形で残しているもので、消すのは別の片付け（大きい）。動きは変えていない |

- 止めた規則は上の1行だけ。ほかの規則は止めていない。

## npm audit

- `npm.cmd audit --omit=dev`: **0件**（本番の依存は変わっていない）。
- `npm.cmd audit`: **10件 moderate**。すべて GHSA-g3hv-75wg-m249（`minimatch` の globparts amplification、影響範囲 `>=7.0.0 <11.0.1`）で、開発用の依存だけ。
  - 経路: `eslint` → `@eslint/config-array` → `minimatch`、`eslint` → `minimatch`、`typescript-eslint` → `@typescript-eslint/typescript-estree` → `minimatch`、およびそれらに依存するパッケージ。
- **0件にできなかった理由**: 修正版は `minimatch` 11.0.1 以降だが、今の各依存の範囲がそれを許さない（`eslint@10.13.0` は `^10.2.5`、`@eslint/config-array@0.23.5` は `^10.2.4`、`@typescript-eslint/typescript-estree@8.72.0` は `^10.2.2`）。`npm audit` が提案する `eslint@9.39.5` も、一時フォルダーで試すと `typescript-estree` の `minimatch@9.0.9` で7件残った。
- `overrides` で `minimatch@11.0.5` を強制すれば 0 にできる可能性はあるが、この Stage で足してよい依存の一覧にないことと、ESLint の内部で semver の範囲外の版を使うリスクがあるため、行っていない。次の判断（§提案）にしてほしい。
- 参考: 更新前は6件 moderate（同じ GHSA-g3hv-75wg-m249）。更新後は ESLint 10 の依存の経路が増えたため10件になった。助言そのものは同じ。

## 完了条件ごとの結果

- [x] ESLint を新しくし、規則は今と同じ範囲。選んだ版と理由が報告にある → 上の表
- [x] 新しく出た指摘を直した。止めた規則があれば、理由つきの一覧が報告にある → 上の表（止めたのは1行だけ）
- [x] `npm.cmd audit` が 0 件（または残る理由を報告に書いた） → 残る理由を上に書いた。本番の依存は 0 件
- [x] 必須ゲートがローカルで通る → 下の表

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS（3633ファイル、blocker 0） |
| `npm.cmd run lint` | PASS（警告0、flat config） |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **623/623 PASS**（2.6分 / 154.6秒） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **146 PASS**（145 unit + 1 capability） |
| `git diff --check` | PASS |
| `npm.cmd audit --omit=dev` | PASS（0件） |
| `npm.cmd audit` | 10件 moderate（上記の理由で残る） |

`public:check`・`lint`・`build` の3つは続けて実行し、合計 31.9秒。

## 更新した基準画像

**0枚**。開発用の依存と ESLint の設定・指摘の直しだけで、アプリの動きと見た目は変えていない。visual の画像比較は更新なしで通った。

## 判断メモ

- 2週間ルールのため、最新の 10.14.0・8.72.1・17.14.0 ではなく、1つ前の 10.13.0・8.72.0・17.13.0 を選んだ。公開日は npm の `time` で確認した。
- flat config の `ignores` に `**/.*` を入れたのは、eslintrc が既定で無視していた `.local-evaluation` などを、flat config では明示しないと読んでしまうため。これで今までと同じ対象（リポジトリ内の ts/tsx）になった。
- `--ext ts,tsx` は ESLint 10 でも有効だったので、`lint` の命令の形は最小限の変更（`ESLINT_USE_FLAT_CONFIG=false` の削除）にした。CI の `.github/workflows/ci.yml` は変えていない。
- `preserve-caught-error` の直しは、メッセージを変えずに `cause` を足すだけにした。`no-useless-assignment` の直しも、代入の順番・値は変えていない。
- 旧起動辞書オーバーレイの `false &&` は、消すと大きな削除になるため、その行だけ規則を止めた。P97-06（古い「今日を組み立てる」の削除）とは別物なので、今回は触っていない。

## 提案

- **React Compiler 向けの規則**: `eslint-plugin-react-hooks` 7 の `recommended` に入っている React Compiler 向けの規則を足すと、**85件**出る（`react-hooks/refs` 39、`react-hooks/set-state-in-effect` 22、`react-hooks/preserve-manual-memoization` 19、`react-hooks/immutability` 4、`react-hooks/purity` 1）。今回は入れていない。入れるかは次の判断で、まずは `refs` と `set-state-in-effect` の扱いを決めるとよい。
- **minimatch の助言**: 0 にするには `package.json` の `overrides` で `minimatch` を 11.0.5 に固定する（ESLint の動作を確認したうえで）か、ESLint / typescript-eslint が `minimatch` 11 を許す版を出すのを待つ。`npm audit` の提案（ESLint 9.39.5）では0にならないことを確認済み。
- 旧起動辞書オーバーレイの `false &&` は、次の片付けのときにブロックごと消すと、この行の `eslint-disable` も不要になる。
