# P95-03 — インストーラーの「アンインストールできません。」の案内

**判定: FIXED**(ブランチ `fix/p95-03-installer-message`、`main` = `e931960`(P95-02 のマージ後)から)

## 実装内容の要約

- インストーラーの日本語・英語の言語ファイルを Tauri の元のファイルから写し、`unableToUninstall` の1行だけを、原因と対処が分かる案内に変えた(`tauri.conf.json` の `customLanguageFiles` で指定)。
- 元のファイルとの差は、その1行と、先頭の出典コメントだけ(`diff` で確認)。インストーラーは作れて、言語ファイルに関する警告は出ない。
- `README.md` と `README.en.md` の「更新について」(英語版は「Updating」)に、同じ内容の案内を足した。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src-tauri/installer/languages/Japanese.nsh`(新規) | Tauri の元の `Japanese.nsh` に、先頭の出典コメント(6行)を足し、`unableToUninstall` の1行を変えたもの |
| `src-tauri/installer/languages/English.nsh`(新規) | 同上(`English.nsh`) |
| `src-tauri/tauri.conf.json` | `bundle > windows > nsis > customLanguageFiles` に上の2つを指定(`languages` は `["English", "Japanese"]` のまま) |
| `README.md` / `README.en.md` | 「更新について」(「Updating」)に案内の段落を1つ足した |
| `docs/phase9.5/03-installer-message.md` | この報告 |

アプリのコード、テスト、基準画像、`docs/spec/current-spec.md`(インストーラーの文言は仕様書に書かれていない)は変えていない。

## 写した元

- ツール: `@tauri-apps/cli` 2.11.4(`package-lock.json`)。`npx tauri --version` は `tauri-cli 2.11.4`。
- その中の `tauri-bundler` は **2.9.4**(`tauri-cli` 2.11.4 の `Cargo.lock` で確認)。
- 写した元のリポジトリとコミット: `tauri-apps/tauri` のタグ `tauri-cli-v2.11.4`(コミット `8909f221d1515955fc843808032bdc5d62209c96`)の
  - `crates/tauri-bundler/src/bundle/windows/nsis/languages/Japanese.nsh`
  - `crates/tauri-bundler/src/bundle/windows/nsis/languages/English.nsh`
- 取得方法: 上のコミットの raw ファイルを `curl` で取得した(ネットワークからの取得は、このときだけ)。出典はそれぞれのファイルの先頭のコメントにも書いてある。
- ビルド中にバンドラーが使う元のファイルとの照合: 作ったインストーラーのビルド出力(`src-tauri/target/release/nsis/x64/Japanese.nsh`、`English.nsh`)から、バンドラーが付けた BOM(3 バイト)を除くと、このリポジトリのファイルと一致する(`cmp` で確認)。

## 変えた文言

日本語(`Japanese.nsh`):

> 以前のバージョンをアンインストールできませんでした。
>
> ・Life Launcher が起動中なら、終了してからもう一度お試しください(タスクトレイも確認してください)。
> ・以前のインストールの情報だけが残っている場合は、「アンインストールしない」を選ぶと、そのままインストールできます。設定と記録は消えません。

英語(`English.nsh`):

> Could not uninstall the previous version.
>
> - If Life Launcher is running, quit it (check the system tray) and try again.
> - If only the previous installation's registration remains, choose "Do not uninstall" to continue installing. Your settings and records are kept.

NSIS の書き方: 改行は、元のファイルのほかの文字列(`appRunningOkKill`、`silentDowngrades`)と同じ `$\n`(空行は `$\n$\n`)。英語の引用符は `$\"`。文字コードは元と同じ(BOM なしの UTF-8)で、バンドラーが BOM を付けて読み込む(`write_utf8_with_bom`)。「アンインストールしない」「Do not uninstall」は、元のファイルの `dontUninstall` の文字列と同じ語にした。

## 元のファイルとの差(`diff`)

先頭の出典コメント(6行)を除いて、元のファイルと比べた結果。差は 17 行目の1行だけ。

```
== Japanese
17c17
< LangString unableToUninstall ${LANG_JAPANESE} "アンインストールできません。"
---
> LangString unableToUninstall ${LANG_JAPANESE} "以前のバージョンをアンインストールできませんでした。$\n$\n・Life Launcher が起動中なら、…(上の文言)"
== English
17c17
< LangString unableToUninstall ${LANG_ENGLISH} "Unable to uninstall!"
---
> LangString unableToUninstall ${LANG_ENGLISH} "Could not uninstall the previous version.$\n$\n- If Life Launcher is running, …(上の文言)"
```

(`…` は、この報告で省いた箇所。実際のファイルでは全文が1行に入っている。)ほかの 26 の文字列は、1つも変えていない・消していない(行数も 27 行のまま)。

## 完了条件ごとの結果

| 完了条件 | 結果 |
| --- | --- |
| 日本語・英語の `unableToUninstall` が上の文言になり、ほかの文字列は Tauri の元のファイルと同じ | 達成(上の `diff`) |
| インストーラーが作れて、言語ファイルの警告がない | 達成。`npm.cmd run tauri -- build --bundles nsis` が成功(終了コード 0)。ビルドの出力に、言語ファイルの警告(「翻訳がない」など)はない(出た警告は、画面側のビルド(Vite)のチャンクサイズの警告だけで、もとからある) |
| README(日英)に案内がある | 達成 |
| 必須ゲートが通り、CI が通る | ゲートは通過(下の表)。CI はこの報告のあと PR で確認する |

## インストーラーのビルド

- コマンド: `npm.cmd run tauri -- build --bundles nsis`(`scripts/package-windows-installer.ps1` の中身と同じ呼び出し。スクリプトそのものは、リリース候補の出力先を作るので使っていない)
- できたもの: `src-tauri/target/release/bundle/nsis/Life Launcher_1.4.0_x64-setup.exe`(3,722,265 バイト)。公開用ではなく、この確認のためのビルド(ローカルのみ。配布・公開はしていない)。バージョンは `Cargo.toml` のまま 1.4.0 で、v1.4.1 への更新は P95-05 で行う。
- NSIS の出力(`makensis`)の中の警告は、Tauri のビルドの出力には出ない形式なので、別に確かめた(次の節)。

## 文言の表示の確認(インストールせずに行った範囲)

インストーラーを実行すると PC のインストール情報が変わるので、この Stage では実行していない。代わりに、**文字列が正しく読み込まれ、改行が正しく入るか**だけを、インストーラーとは別の小さな NSIS のスクリプト(スクラッチ用。リポジトリには入れていない)で確かめた。

- 作ったインストーラーのビルドが使った `Japanese.nsh`、`English.nsh`(BOM つき)を、そのまま `!include` し、`MUI2` の `MUI_LANGUAGE` で言語を登録した小さな実行ファイルを、同じ `makensis`(Tauri が使う NSIS 3 Unicode)でコンパイルした。コンパイルは通り、言語ファイルに関する警告・エラーは出なかった(出たのは、ページを置いていない確認用のスクリプトだけに当たる `MUI_LANGUAGE should be inserted after the MUI_[UN]PAGE_* macros` の1件)。
- その実行ファイルに `$(unableToUninstall)` を `UTF-16LE` のファイルへ書かせて読んだ。日本語・英語とも、上の文言のとおりに出て、見出しの行、空行、2つの箇条書きの行が、意図した位置で改行されていた。文字化けや切れはない。
- 英語は、日本語と別のスクリプトで確かめた(日本語と同じスクリプトでは、実行時の言語切り替えが効かず、日本語が2回出たため)。

**確かめていないこと**: 実際のメッセージボックスの見た目(幅、折り返し、画面での切れ)。メッセージボックスの幅は NSIS が自動で決めるので、長い行は折り返される。これは P95-05 の実機確認の一覧に入れる。

## P95-05 の実機確認の一覧に入れること

| 確認 | 方法 | 期待 |
| --- | --- | --- |
| 「以前のインストールの情報だけが残っている」状態で、「インストールする前にアンインストールする」を選ぶ | 本体のフォルダーを手で消し、レジストリの `Software\Microsoft\Windows\CurrentVersion\Uninstall\Life Launcher` だけを残した状態(PC のインストール情報を変えるので、実機確認の枠で、元に戻せる手順で行う)で、v1.4.1 のインストーラーを起動し、この選択をする | 新しい案内のメッセージボックスが出る。文字が切れず、改行が崩れず、日本語・英語とも読める。選択画面に戻り、「アンインストールしない」を選ぶとインストールできる |
| 英語の表示 | Windows の表示言語(または `/D=` なしのインストーラーの言語選択)を英語にして、同じ確認をする | 同上 |
| メッセージボックスの幅 | 上の確認のときに目で見る | 長い行が折り返され、ボタンが見える |

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3,580 ファイル、問題 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 1回目: 530 件通過、1 件失敗(辞書の `phase87-dictionary-ux` の「Dictionary settings opens from the icon and titlebar context menu」。「辞書の設定」ボタンが 5 秒待っても見つからなかった。このテストは単独で `--repeat-each=10` を流すと 10 回とも通る。今回の変更(README・インストーラーの設定・言語ファイル)は、この画面に関係しない)。**2回目: 531 件すべて通過**(130 秒)。失敗の原因は調べていない(再現しなかった)。下の「判断メモ」の 2. |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(130 件 + 1 件) |
| `git diff --check` | 通過 |

Rust のコードは変えていない。

## 更新した基準画像

なし(画面の変更なし)。

## 判断メモ

1. **文言は指示書のとおり**: 日本語の括弧は指示書と同じ半角 `( )`、英語の引用符は `"…"`(NSIS の `$\"`)。「Life Launcher」は指示書どおり直接書いた(`${PRODUCTNAME}` を使わない。元のファイルの文字列は、`${PRODUCTNAME}` と `{{product_name}}` が混在している)。
2. **`test:visual` の失敗1件**: 1回目の通しで1件だけ落ち、単独の10回と2回目の通しは通った。原因は調べておらず、再現しなかった(v1.4.0 の判定書にも、原因不明で再現しなかったテストの失敗が1件ある)。テストを緩めたり skip したりはしていない。次に出たときのために、失敗の画面と出力は残していない(再現しないため)。
3. **ビルドの副作用**: `tauri build` は `src-tauri/target/` を更新し、`src-tauri/Cargo.toml` の改行だけが変わる(`LF`/`CRLF` の差)ので、その差はコミットしていない。公開用のスクリーンショット(`docs/screenshots/`)も、テストの実行で作り直されるが、変更に含めていない。

## 提案

- **`{{product_name}}` がそのまま表示される可能性**: 写した元の `Japanese.nsh`、`English.nsh` には、`appRunning`、`appRunningOkKill`、`failedToKillApp` の文字列に `{{product_name}}` という置き換え用の印が入っている。バンドラーは、言語ファイルをこの印を置き換えずに読み込む(`mod.rs` の `write_utf8_with_bom` は、ファイルの中身をそのまま書く)ので、小さな確認用のスクリプトで同じファイルを読み込んだところ、`appRunning` は「`{{product_name}} is running! Please close it first then try again.`」と、印がそのまま出た。実際のインストーラー(v1.4.0)で同じ表示になるかは、確認していない。指示書は「ほかの文字列は1つも変えない」ので、この Stage では触っていない。確かめて、必要なら次の版で「Life Launcher」に置き換えることを提案する。
- 言語ファイルは、`@tauri-apps/cli` を更新したときに、新しい元のファイルから写し直す必要がある(足りない文字列があると、メッセージが空欄になる)。各ファイルの先頭のコメントに、その手順を書いた。更新時のチェックリストに入れておくとよい。
