# Life Launcher v1.5.1 Final Release Decision

**READY FOR USER APPROVAL**（自動で確かめられるゲートはすべて通った。ネイティブ確認・公開は、オーナーの判断で行う）

- 日付: 2026-11-21（JST）
- 候補のソース: ブランチ `v151/01-tests`、ビルドしたコミット `712f4957f8b210a01fe6dab9f12de8c9f5b7dce9`(X)。**GitHub Actions の CI(run `44766836898`、attempt 1)が確かめたコミットと同じ**。成果物をビルドした時点の作業ツリーはきれい（`git status --porcelain` が空）。ビルド中に `tauri build` が `src-tauri/Cargo.toml` の改行だけを書き換えた。`git diff --ignore-all-space -- src-tauri/Cargo.toml` が空である事を確かめ、ビルド後に戻した。
- X は、S7 のコミット `5ac469f` に S8(テストだけ)の 4 コミットを足した物。`git diff --name-only 5ac469f 712f495` はすべて `tests/` の中(67 ファイル)。
- config schema: 3(v1.5.0 から変更なし)。タイマーの実行中の状態に `expiredAtMs` を足したが、これはメモリの中だけの値で、設定ファイルと記録には書かない。
- 公開（tag・GitHub Release・アセットのアップロード）は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26200（x64）、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1、`rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.5.1 で一致している(2.)。
- 成果物 3 つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- CI(GitHub Actions、`windows-latest`)は X で 1 回、すべての手順が通った。`test:visual` 898 件、`cargo test` 192 件(5. #1)。
- `npm audit` は開発用の `minimatch` の 9 件 moderate だけで、新しい助言はない。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 14 件で、v1.5.0 と同じ。`chrono` は製品の依存から外れた(5. #3)。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #8)。
- 環境変数なしの起動で、タイトルが「Life Launcher」で「テスト」が出ない事を確かめた(5. #12)。
- テスト用の起動で、タイトルが「Life Launcher (テスト)」になる事を確かめた(5. #13)。普段のアプリは終了させていない。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.5.1 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.5.1 |
| `src-tauri/tauri.conf.json` | 1.5.1 |
| 単体 EXE の FileVersion / ProductVersion | 1.5.1 / 1.5.1(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.5.1 / 1.5.1(ProductName: Life Launcher) |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.5.1 / 1.5.1(単体 EXE と SHA-256 も一致) |
| README、README.en.md、CHANGELOG、`docs/releases/v1.5.1.md`、`SECURITY.md` | 1.5.1（履歴と前の版の記述は残る） |

## 3. v1.5.0 からの変更

各段の作業報告は、リポジトリの外の引き継ぎのフォルダ(`V151.md`)にある。

| 段 | 内容 |
| --- | --- |
| S1 | 時間に頼るテストを作り直した(`waitForTimeout` を 58 か所から 0 に。`test-timing-contract` を足した) |
| S2 | 画面の細かい直し(使い方で項目を押すと見出しが外へスクロールしていた・今週を決めるの記録が無い時の表示・検索の窓の外で Esc が効かなかった) |
| S3 | 依存:Rust の日時の扱いを `chrono` から `time` に替えた(書き出す日時の字の形は同じ。黄金のテストで確かめた)。npm の開発用ツールは、公開から 14 日たっていないので上げていない |
| S4 | 文書と版の番号 1.5.1、`SECURITY.md` の知らせ方 |
| S6 | 「予定時間になりました」の並び(丸い印・題・帯)、サイドバーの見出しの開け閉めの 10px のずれ、今やる一手の「一時停止」「終了」の幅と乗せた時の動き、README の一行目と `demo-start.gif` |
| S7 | 不具合の直し:「予定時間になりました」を開いている間も時間を数え、記録に足していた(v1.4.3 から)。タイマーが動いている間、検索で ↓ で選んだ行が 1 行目に戻っていた(v1.5.0 から) |
| S8 | テストだけ:字の大きさを測る 65 の spec を、同梱のフォントを読んでから測る形にそろえた。動きの途中・別々の測り方・時計の進め方で揺れていた 5 つのテストを直した |

- S5(ゲート・CI・配布物)は、この判定書と公開の手順そのもの。CI で `cargo fmt --check` が落ちた所を、`82199b9` で直した(改行の位置と、行を分けたタプルの最後のカンマ 3 つだけ)。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.5.1/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.5.1-windows-x64-setup.exe` | 9,645,895 | `BAA8D12F30A42CB1C338DDA0DECE6560D9FA425D4335FA27D56C0A5DC824767E` |
| `Life-Launcher-v1.5.1-windows-x64.exe` | 22,164,480 | `6AA7AC3A8AEDFA58F4D60432F516A301B7771049BCC4A10E406C8EFDB5182CAD` |
| `Life-Launcher-v1.5.1-windows-x64-portable.zip` | 10,972,084 | `4BA13BC172BC090C7014839015293EC5DADAD114D9BE7C2D56461662A1096E45` |
| `release-notes.md` | 2,458 | `DBFD21408DF52F89E26092CBF6261D2BFFF303F3E935A7E71D445A66D78ECB3E`（`docs/releases/v1.5.1.md` と同じ） |
| `SHA256SUMS.txt` | 327 | 上の 3 つのハッシュを記録 |

v1.5.0 と比べて、大きさはわずかに減った。

| ファイル | v1.5.0 | v1.5.1 | 差(バイト) |
| --- | ---: | ---: | ---: |
| インストーラー | 9,668,799 | 9,645,895 | −22,904 |
| 単体 EXE | 22,234,624 | 22,164,480 | −70,144 |
| ポータブル ZIP | 10,995,837 | 10,972,084 | −23,753 |

主な理由は、`chrono` を `time` に替えた事と見ている(測ってはいない)。

`SHA256SUMS.txt` の 3 行を、`Get-FileHash` で独立に計算した値と照合し、一致した。ZIP を一時フォルダに展開した中身は `Life-Launcher-v1.5.1-windows-x64.exe`(22,164,480 バイト)と `README.txt`(283 バイト)の 2 つで、ZIP 内 EXE の SHA-256 は単体 EXE と一致した。

## 5. リリースゲート

すべて 2026-11-20〜21 に、X で測った値。

1. **CI**: GitHub Actions run `44766836898`(attempt 1、`windows-latest`)。
   - 確かめたコミット:`712f4957f8b210a01fe6dab9f12de8c9f5b7dce9`(X)
   - 時刻:2026-11-20T15:47:40Z 〜 16:10:45Z
   - 結果:success
   - 通った手順:`public:check`・`lint`・`build`・`test:visual`(**898 passed**、19.6 分)・`cargo fmt --check`・`cargo check`・`cargo clippy --all-targets -- -D warnings`・`cargo test`(191 + 1 = 192 passed)・`npm audit`(`continue-on-error`)・`npm audit --omit=dev`(0 件)
   - 前の X の run(数えない):`44724536155`(`5318028`、`cargo fmt --check` で失敗)、`44730571692`(`82199b9`、成功したが S7 を足すため X にしなかった)、`44745592051`(`5ac469f`、`phase9-border-roles` P9-07 で字の読み込み前に幅を測って失敗 → S8)。
2. **手元のゲート**:
   - X で `public:check`・`lint`・`build` が通った。
   - Rust の `cargo fmt --check`・`cargo check`・`clippy -D warnings`・`cargo test`(192 件)は `5ac469f` で通った(X との差分は `tests/` だけ)。
   - FULL(`npm.cmd run test:visual`)は、作業者が作業ツリーが空の X で 898/898 通した。
   - S5 のゲート(`3de50eb`)の時点では、`cargo fmt --check` を回していなかった。これが CI で初めて見つかった。今後は、push の前に `ci.yml` の手順を手元で通す。
3. **cargo audit**(2026-11-21):
   - 脆弱性 0 件。情報警告 14 件(すべて設定で許した物)。v1.5.0 と同じ件数・同じ助言。
   - `RUSTSEC-2026-0543`(`chrono 0.4.45` / unmaintained)は lock に残る。理由:`Cargo.lock` の `serde_with 3.21.0` が、使っていない `chrono` 機能の依存として書いているため。
   - `cargo tree --manifest-path src-tauri/Cargo.toml --target all -i chrono` の結果は `warning: nothing to print.`。どの対象の依存の木にも入らず、配布物に含まれない。
   - `RUSTSEC-2026-0486`(`rustix`)と `RUSTSEC-2024-0429`(`glib`)は、v1.5.0 と同じく Windows の依存の木に入らない。
4. **npm audit**(2026-11-21):9 件 moderate。すべて開発用の `minimatch`(GHSA-g3hv-75wg-m249)。`npm audit --omit=dev` は 0 件。新しい助言はない。
   - 直る版の開発用ツールは、公開から 14 日たっていないので上げていない(`eslint` 10.15.0 は 11-27、`typescript-eslint` 8.73.0 は 11-30 に 14 日たつ)。
5. **公開安全**: `public:check` は 3,726 ファイル、0 blockers。
6. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/`(138 ファイル、`.map` 0 件)を、ASCII と UTF-16LE(偶数・奇数の位置)で走査した。走査した語は、v1.5.0 と同じ 16 語(ユーザーパス、リポジトリの場所、ローカルユーザー名、トークン接頭辞、秘密鍵、source map)。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。当たった物は次の 3 か所で、どれも公開してよい物と判断した:
   - 単体 EXE と ZIP 内 EXE の ASCII・UTF-16LE の `Takuyakou`:
     - 1 つは、設定の「メンテナンス」の「リリースページを開く」が開く `https://github.com/Takuyakou/life-launcher/releases`(`src/App.tsx` にある公開の URL。v1.5.0 からある)。
     - もう 1 つは、EXE の版の情報の CompanyName `takuyakou`(公開のアカウント名。走査は大文字小文字を区別しない)。
   - `dist/assets/index-azt0hS00.js` の ASCII の `Takuyakou`:上と同じリリースページの URL。
   - インストーラーと ZIP は 0 件。ユーザーパス・ローカルユーザー名・トークン・秘密鍵・source map は 0 件。
7. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.5.1。ProductName は Life Launcher。
8. **Windows Defender**: 成果物のコピー 3 ファイルを CustomScan。スキャン前後で検出数は 1 のまま(新しい検出 0)。**署名 `1.463.387.0`**(2026-11-21 に測った値)。
9. **ビルドに使ったコミットの `dist/`**: 上の 6. のとおり(当たった物はリリースページの URL だけ。`.map` 0 件)。
10. **権限**: `git diff v1.5.0 712f4957f8b210a01fe6dab9f12de8c9f5b7dce9 -- src-tauri/capabilities src-tauri/gen/schemas` は差分なし。新しい Rust の命令はない。
11. **FULL**: 上の 1.(CI で 898 件)と 2.(手元で 898 件)のとおり。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA`(および `LOCALAPPDATA`)を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった。確認の後にその起動だけを閉じた。
13. **テスト用の起動**: `scripts/start-test-profile.ps1 -Exe <単体 EXE>` で起動し、タイトルが「Life Launcher (テスト)」になる事を確かめた。確認の後にその起動だけを閉じた。
14. **公開スクリーンショット**: `npm.cmd run screenshot:public` は回していない(S6 の指示書のとおり。公開の画像に、今回変わった画面は写っていない)。`docs/screenshots/demo-start.gif` は、リードが撮り直した物に S6 で置き換えた。

## 6. ネイティブ確認

`native-checklist.md` に書いた(9 件)。オーナー確認待ち。

## 7. レビュー

- 各段の指示書と変更は、リード(Claude)が手元で同じ変更を当てて確かめた(`LEAD-OK-v1.5.1.md`)。
- S8 は、`5ac469f` との差分が `tests/` だけである事を、Claude Code が確かめた。
- 公開の前の確認と公開は、Claude Code が行う。

## 8. 既知の制限

v1.5.0 から引き継ぐ。`chrono` の行は、`time` に置き換えたので外した。

- UIは日本語中心で、英語対応は主に上部ツールバーなどの一部。
- Windows 11 のスナップレイアウト（最大化ボタンに乗せたときの配置の選択）は、アプリのボタンでは出ない。画面の端へのスナップと Win+Z は Windows の機能だが、この版では使える前提にしていない。
- HTML手順書は静的HTML/CSSと登録フォルダー内の相対assetだけ。JavaScript、フォーム、入れ子フレーム、外部assetは動かない。編集はできない。
- MHTMLはPNG・JPEG・GIF・WebPとCSSだけを埋め込む。SVGなどの画像、埋め込みフォント、スクリプトで動く部分、フォーム、入れ子フレーム、外部画像/CSSは表示されない。20 MBを超えるファイルは開けない。
- プロジェクトの新しい4色（lime・magenta・sand・coral）は、v1.4.2以前の版では自動の色で表示され、その版で保存すると色の指定が消える。戻す前にバックアップが必要。
- タイマーの開始・一時停止はスクリーンリーダーで自動読み上げしない。
- 画面の確認は、開発環境のWindows(Chromium)の画像比較と、ビルド済みアプリでの確認を組み合わせている。表示倍率やフォントが違う環境では折り返しが少し違う場合がある。
- 「次はここから」は、予定時間になったときの画面(今日の3件に入っていない次の一手のとき)と、次の一手の編集で書ける。途中でタイマーを終了したときは画面が出ないので、編集で書く。
- 見つからない物の知らせは、ネットワークの場所(\\server\… や //…)と URL を確かめない。割り当てたネットワークドライブ(Z:\ など)がつながっていないと、知らせが出るまで時間がかかることがある。

## 9. 公開の手順

`inbox\v1.5.1\PUBLISH-v1.5.1.md` の手順で、Claude Code が利用者と話しながら行う。
