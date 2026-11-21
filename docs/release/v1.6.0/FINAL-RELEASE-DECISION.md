# Life Launcher v1.6.0 Final Release Decision

**READY FOR USER APPROVAL**（自動で確かめられるゲートはすべて通った。ネイティブ確認・公開は、オーナーの判断で行う）

- 日付: 2026-11-21（JST）
- 候補のソース: ブランチ `v160/01-book`(`main` の `72ac4b0` から)、ビルドしたコミット `aa19a40e1b9bab9f3e54bdfeeb04370597dced40`(X)。**GitHub Actions の CI(run `44879987037`、attempt 1)が確かめたコミットと同じ**。成果物をビルドした時点の作業ツリーはきれい（`git status --porcelain` が空）。ビルドの後も作業ツリーはきれいだった(今回は `src-tauri/Cargo.toml` の改行も書き換わらなかった)。
- X は、S7 のコミット `37d86f3` に S8 の 3 コミット(テストの待ち 2 行・版の番号・CHANGELOG とリリースの文)を足した物。`git diff --name-only 37d86f3 aa19a40` は 8 ファイルで、`Cargo.lock`・`package-lock.json` の差分は版の番号の行だけ。
- config schema: 3(v1.5.1 から変更なし)。新しいファイル `instruction-books.json` を足した。教材ごとの覚え(向き・見開き・表紙・最後のページ。500 冊まで)を、`config.json` と同じフォルダに置く。前の版はこのファイルを読まないので、前の版に戻しても困らない。
- 公開（tag・GitHub Release・アセットのアップロード）は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26200（x64）、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1、`rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.6.0 で一致している(2.)。
- 成果物 3 つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- CI(GitHub Actions、`windows-latest`)は X で 1 回、すべての手順が通った。`test:visual` 925 件、`cargo test` 205 件(5. #1)。
- `npm audit` は開発用の `minimatch` の 9 件 moderate だけで、v1.5.1 と同じ。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 14 件で、v1.5.1 と同じ助言・同じ crate と版。`zip` を足した事で新しい警告は出ていない(5. #3)。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #8)。
- 権限(capabilities・gen/schemas)は v1.5.1 から変わっていない。画面の許可(CSP)は `img-src` に `blob:` を足しただけ(5. #10)。
- 環境変数なしの起動で、タイトルが「Life Launcher」で「テスト」が出ない事を確かめた(5. #12)。
- テスト用の起動で、タイトルが「Life Launcher (テスト)」になる事を確かめた(5. #13)。普段のアプリは終了させていない。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.6.0 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.6.0 |
| `src-tauri/tauri.conf.json` | 1.6.0 |
| 単体 EXE の FileVersion / ProductVersion | 1.6.0 / 1.6.0(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.6.0 / 1.6.0(ProductName: Life Launcher) |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.6.0 / 1.6.0(単体 EXE と SHA-256 も一致) |
| CHANGELOG、`docs/releases/v1.6.0.md` | 1.6.0（履歴と前の版の記述は残る。README と `SECURITY.md` には版の番号を書いていない） |

## 3. v1.5.1 からの変更

各段の作業報告は、リポジトリの外の引き継ぎのフォルダ(`V160.md`)にある。

| 段 | 内容 |
| --- | --- |
| S1 | ZIP を安全に開く土台:目録だけを読み、ディスクへ展開しない。頭のバイトで確かめた JPEG・PNG・WebP・GIF だけをページにする。上限(ZIP 4 GiB・項目 20,000・ページ 5,000・1 枚 64 MiB・圧縮率 200 倍)、stored と deflate だけ。教材ごとの覚え `instruction-books.json`。依存に `zip` 9.4.1 を足した。CSP の `img-src` に `blob:` |
| S2 | 本の画面(見開き/1ページ、右から左/左から右、表紙は1ページ、キー・押す・ホイールでめくる)と、一覧・検索の ZIP の桃色の画像の印 |
| S3 | 今やる一手の手順書の札に、覚えたページを `p.34` のように出し、押すとそのページから開く |
| S4 | 細かい直し:「すべての記録」へ切り替える時の横スクロールバーの一瞬の出入り、v1.5.1 から回したキーで移る先のテストの揺れ。開発用の `eslint` 10.14.0・`typescript-eslint` 8.72.1 |
| S5 | 文書:使い方・README・仕様書。ZIP の一覧の基準画像 |
| S6 | リードの確かめで見つかった 3 件:`Cargo.lock` の 2 つを公開から 14 日たった版に戻した(`crc32fast` 1.5.4・`nix` 0.31.3)。記録のタブの帯が滑って見える形に戻した。本を開いた後・押した後に ← → でめくれるようにした |
| S7 | リードの 2 回目の確かめで見つかった 2 件:`ignore` を 7.0.14 に戻した(`package-lock.json` の 3 行)。本のページの輪を、キーで来た時だけ出す |
| S8 | 公開の前の最後の段:取り込みの窓へフォーカスが入ってから Esc を押すテストの待ち(2 行)、版の番号 1.6.0、CHANGELOG とリリースの文 |

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.6.0/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.6.0-windows-x64-setup.exe` | 9,771,606 | `F5A9F2B6630DAB3960196345A415AA8399FFB9ECA4C5D2F879AEA9653D7556DE` |
| `Life-Launcher-v1.6.0-windows-x64.exe` | 22,484,992 | `9249C898E34A3E7B947F1FBC2443240F496B573FAF86F4C212C619A26406DAFB` |
| `Life-Launcher-v1.6.0-windows-x64-portable.zip` | 11,128,607 | `1B91D72DDD2CABC1F195B71A6063FB0CC56FA274BD187242E348F881477C31E4` |
| `release-notes.md` | 2,392 | `0859E8917B536BF2786D0544B4B1B4D9A00E9D68A524008F703C240FECAECEF5`（`docs/releases/v1.6.0.md` と同じ） |
| `SHA256SUMS.txt` | 327 | 上の 3 つのハッシュを記録 |

v1.5.1 と比べて、大きさは増えた。

| ファイル | v1.5.1 | v1.6.0 | 差(バイト) |
| --- | ---: | ---: | ---: |
| インストーラー | 9,645,895 | 9,771,606 | +125,711 |
| 単体 EXE | 22,164,480 | 22,484,992 | +320,512 |
| ポータブル ZIP | 10,972,084 | 11,128,607 | +156,523 |

主な理由は、`zip`(deflate)とその下の依存、本の画面を足した事と見ている(内訳は測っていない)。

`SHA256SUMS.txt` の 3 行を、`Get-FileHash` で独立に計算した値と照合し、一致した。ZIP を一時フォルダに展開した中身は `Life-Launcher-v1.6.0-windows-x64.exe`(22,484,992 バイト)と `README.txt`(283 バイト)の 2 つで、ZIP 内 EXE の SHA-256 は単体 EXE と一致した。

## 5. リリースゲート

すべて 2026-11-21 に、X で測った値(6. の作業者のゲートは、その段のコミットで測った値)。

1. **CI**: GitHub Actions run `44879987037`(attempt 1、`windows-latest`)。
   - 確かめたコミット:`aa19a40e1b9bab9f3e54bdfeeb04370597dced40`(X)
   - 時刻:2026-11-21T07:22:55Z 〜 07:43:55Z
   - 結果:success
   - 通った手順:`npm ci`・`public:check`・`lint`・`build`・`test:visual`(**925 passed**、16.0 分)・`cargo fmt --check`・`cargo check`・`cargo clippy --all-targets -- -D warnings`・`cargo test`(204 + 1 = 205 passed)・`npm audit`(`continue-on-error`)・`npm audit --omit=dev`(0 件)
   - このブランチの CI はこの 1 回だけ。
2. **手元のゲート**(push の前に、X で):`npm ci`・`public:check`(3,739 ファイル、0 blockers)・`lint`(警告 0)・`build`・`cargo fmt --check`・`cargo check`・`clippy -D warnings`・`cargo test`(205 passed)が通った。`test:visual` は、作業者が S8 で作業ツリーが空の X で FULL 925/925 を通している。
3. **cargo audit**(2026-11-21):
   - 脆弱性 0 件。情報警告 14 件(すべて設定で許した物)。v1.5.1 のタグの `Cargo.lock` で回した結果と、助言の ID・crate・版がすべて同じ。`zip` とその下の依存による新しい警告はない。
   - `RUSTSEC-2026-0543`(`chrono 0.4.45` / unmaintained)は lock に残る。`cargo tree --manifest-path src-tauri/Cargo.toml --target all -i chrono` は `warning: nothing to print.` で、どの対象の依存の木にも入らず、配布物に含まれない(v1.5.1 と同じ)。
   - `RUSTSEC-2026-0486`(`rustix`)と `RUSTSEC-2024-0429`(`glib`)は、v1.5.1 と同じく Windows の依存の木に入らない。
4. **npm audit**(2026-11-21):9 件 moderate。すべて開発用の `minimatch`(GHSA-g3hv-75wg-m249)と、それを使う `eslint`・`typescript-eslint` の系統。v1.5.1 と同じ件数・同じ助言。`npm audit --omit=dev` は 0 件。
5. **新しく入った・版が変わった依存**(`72ac4b0` → X。全部、作業の時点で公開から 14 日たった版):
   - Rust:`zip` 9.4.1(2026-11-06、直接)、`crc32fast` 1.5.4(2026-11-01、1.5.0 から)、`log` 0.4.35(2026-10-30、0.4.33 から)、`simd-adler32` 0.3.10(2026-07-14、0.3.9 から)、`typed-path` 0.13.0(2026-10-20、新規)、`zlib-rs` 0.6.8(2026-09-15、新規)、`zopfli` 0.8.4(2026-10-11、新規)、`cfg_aliases` 0.2.2(2026-07-16、新規)、`nix` 0.31.3(2026-05-11、新規。unix の時だけで、Windows の配布物には入らない)。
   - npm(開発用だけ):`eslint` 10.14.0(2026-10-30)、`typescript-eslint` と `@typescript-eslint/*` の 10 個 8.72.1(2026-10-26)。`ignore` は S7 で 7.0.14(2026-10-23)に戻したので、v1.5.1 から変わっていない。
6. **作業者のゲート**(`V160.md`):
   - S5(`bd9c02b`):`ci.yml` の手順すべて。FULL 916 passed。`cargo test` 205 passed。足した 18 本 × 20 は 2・4 並列とも 360 passed。
   - S6(`3737f49`):FULL 921 passed。変えたテスト 20 本 × 20 は 2・4 並列とも 400 passed。
   - S7(`37d86f3`):FULL 1 回目は 924 passed・1 failed(`phase10-details` P10-14、取り込みの窓が閉じる前に次を押した)、2 回目は 925 passed。`v160-book` 23 本 × 20 は 2・4 並列とも 460 passed。この揺れは S8 でテストの待ち方を直した。
   - S8(X):FULL 925 passed(1 回目で全部。失敗・揺れ 0)。`phase10-details` 18 本 × 20 は 2・4 並列とも 360 passed。
7. **公開安全**: `public:check` は 3,739 ファイル、0 blockers。
8. **Windows Defender**: 成果物のコピー 3 ファイルを CustomScan。スキャン前後で検出数は 1 のまま(新しい検出 0)。**署名 `1.463.397.0`**(2026-11-21 に測った値)。
9. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/`(138 ファイル、`.map` 0 件)を、ASCII と UTF-16LE(偶数・奇数の位置)で走査した。走査した語は、v1.5.1 と同じ 16 語(ユーザーパス、リポジトリの場所、ローカルユーザー名、トークン接頭辞、秘密鍵、source map)。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。当たった物は v1.5.1 と同じ 3 か所で、どれも公開してよい物と判断した:
   - 単体 EXE と ZIP 内 EXE の ASCII・UTF-16LE の `Takuyakou`:
     - 1 つは、設定の「メンテナンス」の「リリースページを開く」が開く `https://github.com/Takuyakou/life-launcher/releases`(公開の URL。v1.5.0 からある)。
     - もう 1 つは、EXE の版の情報の CompanyName `takuyakou`(公開のアカウント名。走査は大文字小文字を区別しない)。
   - `dist/assets/index-qtzBwZV3.js` の ASCII の `Takuyakou`:上と同じリリースページの URL。
   - インストーラーと ZIP は 0 件。ユーザーパス・ローカルユーザー名・トークン・秘密鍵・source map は 0 件。
10. **権限と画面の許可**:
    - `git diff v1.5.1 aa19a40e1b9bab9f3e54bdfeeb04370597dced40 -- src-tauri/capabilities src-tauri/gen/schemas` は差分なし。
    - `git diff v1.5.1 aa19a40e1b9bab9f3e54bdfeeb04370597dced40 -- src-tauri/tauri.conf.json` は、`version`(1.5.1 → 1.6.0)と、CSP の `img-src` の末尾に ` blob:` を足した 1 か所だけ。
    - 新しい Rust の命令は、ZIP の本を開く・ページを読む・覚えを読み書きする物(S1)。本を開く・ページを読む命令は登録した手順書のフォルダの中だけを読み、ページを読むたびにフォルダの中かを確かめ直す。覚えは `config.json` と同じフォルダの `instruction-books.json` だけを読み書きする。
11. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.6.0。ProductName は Life Launcher。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA`(および `LOCALAPPDATA`)を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった。確認の後にその起動だけを閉じた。
13. **テスト用の起動**: `scripts/start-test-profile.ps1 -Exe <単体 EXE>` で、新しいテスト用のプロファイルで起動し、タイトルが「Life Launcher (テスト)」になる事を確かめた。確認の後にその起動だけを閉じた。
14. **公開スクリーンショット**: `npm.cmd run screenshot:public` は回していない。

## 6. ネイティブ確認

`native-checklist.md` に書いた(8 件)。オーナー確認待ち。

## 7. レビュー

- 各段の変更は、リード(Claude)がコードと基準画像を見て確かめた(`LEAD-OK-v1.6.0.md`)。
- S8 は、`37d86f3` との差分が 8 ファイルで、`Cargo.lock`・`package-lock.json` が版の番号の行だけである事を、Claude Code が確かめた。
- 公開の前の確認と公開は、Claude Code が行う。

## 8. 既知の制限

v1.5.1 から引き継ぎ、最後の 2 行を足した。

- UIは日本語中心で、英語対応は主に上部ツールバーなどの一部。
- Windows 11 のスナップレイアウト（最大化ボタンに乗せたときの配置の選択）は、アプリのボタンでは出ない。画面の端へのスナップと Win+Z は Windows の機能だが、この版では使える前提にしていない。
- HTML手順書は静的HTML/CSSと登録フォルダー内の相対assetだけ。JavaScript、フォーム、入れ子フレーム、外部assetは動かない。編集はできない。
- MHTMLはPNG・JPEG・GIF・WebPとCSSだけを埋め込む。SVGなどの画像、埋め込みフォント、スクリプトで動く部分、フォーム、入れ子フレーム、外部画像/CSSは表示されない。20 MBを超えるファイルは開けない。
- プロジェクトの新しい4色（lime・magenta・sand・coral）は、v1.4.2以前の版では自動の色で表示され、その版で保存すると色の指定が消える。戻す前にバックアップが必要。
- タイマーの開始・一時停止はスクリーンリーダーで自動読み上げしない。
- 画面の確認は、開発環境のWindows(Chromium)の画像比較と、ビルド済みアプリでの確認を組み合わせている。表示倍率やフォントが違う環境では折り返しが少し違う場合がある。
- 「次はここから」は、予定時間になったときの画面(今日の3件に入っていない次の一手のとき)と、次の一手の編集で書ける。途中でタイマーを終了したときは画面が出ないので、編集で書く。
- 見つからない物の知らせは、ネットワークの場所(\\server\… や //…)と URL を確かめない。割り当てたネットワークドライブ(Z:\ など)がつながっていないと、知らせが出るまで時間がかかることがある。
- RAR の本には対応していない(ZIP だけ)。
- ZIP の入ったフォルダの名前を変える・動かすと、その中の教材の覚え(最後のページ・切り替え)が初めに戻る(ZIP そのものの名前の変更・移動では引き継ぐ)。

## 9. 公開の手順

`inbox\v1.6.0\PUBLISH-v1.6.0.md` の手順で、Claude Code が利用者と話しながら行う。
