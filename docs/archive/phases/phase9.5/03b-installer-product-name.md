# P95-03b — インストーラーの「{{product_name}}」の表示を直す

**判定: FIXED**(ブランチ `fix/p95-03b-installer-product-name`、`main` = `bd9b90a` から)

## 実装内容の要約

- `src-tauri/installer/languages/Japanese.nsh`、`English.nsh` の `appRunning`、`appRunningOkKill`、`failedToKillApp` の3つの文字列で、`{{product_name}}` を `${PRODUCTNAME}` に置き換えた(各ファイル3か所)。`${PRODUCTNAME}` は、同じファイルのほかの文字列がすでに使っている NSIS の定義で、インストーラーでは「Life Launcher」になる。
- ほかの文字列は変えていない。ファイル先頭の出典コメントに、この置き換えを書き足した(コメントの行数が6行から7行になった)。
- 背景: Tauri のバンドラーは言語ファイルの `{{product_name}}` を置き換えずにそのまま書き出すため、v1.4.0 でも、アプリが起動中にインストーラーを動かすと「{{product_name}} は動作中です。」のように印がそのまま出ると考えられる(P95-03 の報告の提案)。実際の v1.4.0 での表示は確認していない。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src-tauri/installer/languages/Japanese.nsh` | 3か所の置き換え、出典コメント |
| `src-tauri/installer/languages/English.nsh` | 同上 |
| `docs/phase9.5/03b-installer-product-name.md` | この報告 |

Rust・画面のコードは変えていない。仕様書(`docs/spec/current-spec.md`)にインストーラーの言語ファイルの記述はないので、更新していない。

## 元のファイルとの差(`diff`)

Tauri の元のファイル(P95-03 で写した元。`tauri-bundler` 2.9.4)と、先頭の出典コメントを除いて比べた結果。差は、P95-03 の `unableToUninstall` の1行と、今回の3行(日本語・英語それぞれ)だけ。

```
== Japanese
4,5c4,5   appRunning, appRunningOkKill       {{product_name}} -> ${PRODUCTNAME}
11c11     failedToKillApp                    {{product_name}} -> ${PRODUCTNAME}
17c17     unableToUninstall                  (P95-03。新しい案内)
== English
4,5c4,5   appRunning, appRunningOkKill       {{product_name}} -> ${PRODUCTNAME}
11c11     failedToKillApp                    {{product_name}} -> ${PRODUCTNAME}
17c17     unableToUninstall                  (P95-03。新しい案内)
```

(各行の本文は長いので、ここでは省いた。) `LangString` の行に `{{product_name}}` は1つも残っていない(残っているのは先頭のコメントの2行だけ)。

## 文字列の展開の確認(インストールせずに行った範囲)

P95-03 と同じ方法。インストーラーとは別の小さな NSIS のスクリプト(スクラッチ用。リポジトリには入れていない)で、`Japanese.nsh`、`English.nsh` を `!include` し、`PRODUCTNAME` を「Life Launcher」と定義して、同じ `makensis`(Tauri が使う NSIS 3 Unicode)でコンパイルした。コンパイルは通り、言語ファイルに関する警告・エラーはない(出たのは、ページを置いていない確認用スクリプトだけに当たる `MUI_LANGUAGE should be inserted after the MUI_[UN]PAGE_* macros` の1件)。実行して3つの文字列を書き出させた結果:

- 日本語
  - `appRunning`: 「Life Launcher は動作中です。動作中のプログラムを終了し、もう一度やり直してください。」
  - `appRunningOkKill`: 「Life Launcher は動作中です。」の改行のあと「「OK」を押すと動作中のプログラムを終了します。」
  - `failedToKillApp`: 「Life Launcher の終了に失敗しました。動作中のプログラムを終了し、もう一度やり直してください。」
- 英語(日本語と別のスクリプトで確認。同じスクリプトでは実行時の言語切り替えが効かない)
  - `appRunning`: 「Life Launcher is running! Please close it first then try again.」
  - `appRunningOkKill`: 「Life Launcher is running!」の改行のあと「Click OK to kill it」
  - `failedToKillApp`: 「Failed to kill Life Launcher. Please close it first then try again」

3つとも「Life Launcher」を含む文で出て、`{{product_name}}` は出ない。

## インストーラーのビルド

- コマンド: `npm.cmd run tauri -- build --bundles nsis`。終了コード 0。
- できたもの: `src-tauri/target/release/bundle/nsis/Life Launcher_1.4.0_x64-setup.exe`(3,727,100 バイト、SHA-256 `b3eff4fee01ad23f76b528b4abba65cbe298fa4f9c5ee543edb9b6fab8bf57cb`)。この確認のためのローカルのビルドで、配布・公開はしていない。バージョンは `main` のまま 1.4.0(v1.4.1 の版は P95-05b で扱う)。
- ビルドの出力の警告は、画面側のビルド(Vite)のチャンクサイズの1件だけで、もとからある。言語ファイルに関する警告はない。
- ビルドが使った `target/release/nsis/x64/Japanese.nsh`、`English.nsh`(BOM つき)は、リポジトリのファイルと BOM を除いて同じ。

## 確かめていないこと(P95-05b の実機確認の一覧に入れる)

インストーラーを実行して「アプリが起動中」の画面を出す確認は、PC のインストール情報を変えるので行っていない。

| 確認 | 方法 | 期待 |
| --- | --- | --- |
| 起動中の更新 | v1.4.0 を起動したまま(タスクトレイを含む)、v1.4.1 のインストーラーを動かす | 「Life Launcher は動作中です。…」と出て、`{{product_name}}` が出ない。OK でアプリを終了して更新が続く |

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3,583 ファイル、問題 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 通過(541 件、2.4 分) |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(130 件 + 1 件) |
| `git diff --check` | 通過 |

CI はこの報告のあと PR で確認する。インストーラーのビルドのあと、`src-tauri/Cargo.toml` に改行コードだけの差が出たので、元に戻した(内容の変更なし)。

## 更新した基準画像

なし(画面の変更なし)。

## 提案

- `@tauri-apps/cli` を更新したときは、新しい言語ファイルを写し直し、`unableToUninstall` の1行と、`{{product_name}}` の3か所を再び直す(ファイルの先頭のコメントにも書いた)。
