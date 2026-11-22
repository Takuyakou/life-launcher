# Life Launcher v1.6.2 Final Release Decision

**READY FOR USER APPROVAL**（自動で確かめられるゲートはすべて通った。ネイティブ確認・公開は、オーナーの判断で行う。ただし、5. #3 の `cargo audit` の脆弱性 1 件を、オーナーに伝えて、書いて進めると決まった）

- 日付: 2026-11-22（JST）
- 候補のソース: `main` の先頭 M = `b7925eb1bb25e5acc30a7baff15eadb3dcf19ff6`(PR #178 のマージのコミット)。**成果物は M をそのままビルドした**(`git checkout --detach` して `HEAD` が M である事を確かめた)。成果物をビルドした時点の作業ツリーはきれい。ビルドで `src-tauri/Cargo.toml` の改行だけが書き換わったので、`git diff --ignore-all-space` が空である事を確かめてから戻した。
- 公開は 2 つの PR と、`main` からの 1 回のビルドで行った(リリースは M の 1 回だけ。PR 1・PR 2 の時はタグ・Release を作っていない)。
  - PR 1 = #177(`72db57f`でマージ)。X1 = `379e75abcbc654a6dbbe01c5b2d70d70d5b7646b`。
  - PR 2 = #178(`b7925eb`でマージ)。X2 = `a29b7b8fb68fac59e385469173ac827772457e7f`。`git diff a29b7b8 b7925eb` は空(M の中身は X2 と同じ)。
- config schema: 3(変更なし)。`instruction-books.json` の形も変えていない。
- 公開（tag・GitHub Release・アセットのアップロード）は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26300（x64）、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1、`rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.6.2 で一致している(2.)。
- 成果物 3 つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- CI(GitHub Actions)は、PR 1 の X1・PR 2 の X2・`main` の M のそれぞれで、5 つの job(`verify`・`visual-shard (1)`〜`(3)`・`visual`)がすべて通った(5. #1)。
- 依存は増えていない・上がっていない(5. #5)。
- `npm audit` は開発用の `minimatch` の 9 件 moderate だけで、v1.6.1 と同じ。`--omit=dev` は 0 件。
- **Rust は脆弱性 1 件**(`RUSTSEC-2026-0592`、`url` 2.5.8)。v1.6.1 の時は 0 件だった。`Cargo.lock` は変わっていない(版の番号の行だけ)ので、助言が後から公開された物。5. #3 に書いた。情報警告は 14 件で、v1.6.1 と同じ。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #8)。
- 権限(capabilities・gen/schemas)と画面の許可(CSP)は v1.6.1 から変わっていない(5. #10)。
- 環境変数なしの起動で、タイトルが「Life Launcher」で「テスト」が出ない事を確かめた(5. #12)。
- テスト用の起動で、タイトルが「Life Launcher (テスト)」になる事を確かめた(5. #13)。普段のアプリは終了させていない。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.6.2 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.6.2 |
| `src-tauri/tauri.conf.json` | 1.6.2 |
| 単体 EXE の FileVersion / ProductVersion | 1.6.2 / 1.6.2(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.6.2 / 1.6.2(ProductName: Life Launcher) |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.6.2 / 1.6.2(単体 EXE と SHA-256 も一致) |
| CHANGELOG、`docs/releases/v1.6.2.md` | 1.6.2（履歴と前の版の記述は残る。README と `SECURITY.md` には版の番号を書いていない） |

## 3. v1.6.1 からの変更

各段の作業報告は、リポジトリの外の引き継ぎのフォルダ(`V162-PR1.md`・`V162-PR2.md`)にある。

| 段 | 内容 |
| --- | --- |
| PR 1 S1 | 本の画面:めくる所に乗せた時の黒ずみを無くし、左右の矢印を同じ見た目にした。「全体」でも小さい画像を画面いっぱいに合わせる(125% へ上げた時に大きさが跳ばない)。ページの周りの余白を詰め、下の進み具合の線と重ならないようにした。基準画像 4 枚を更新 |
| PR 1 S2 | 手順書の窓:左の一覧を、小さなボタンと、仕切りのダブルクリックで閉じる・開くようにした(閉じた状態を覚える)。一覧の最小の幅を 180px から 140px にした |
| PR 1 S3 | CI:`verify` から要らない Chromium の用意を外し、ブラウザを使わないテスト 8 ファイル 26 本を `test:fast` に分けて `verify` で回す |
| PR 1 S4 | テスト:効いていなかった `reducedMotion` の設定を消し、時計で揺れていたテスト 9 ファイルを、時計を止めてから進める形に直した |
| PR 1 F1 | 本の画面:読み終わった直後にめくると、同じページを ZIP からもう一度読んでいた隙間を直した(`inFlightRef` を、読みに行ったページの `Set` に替えた)。PR 1 の 1 回目の CI(run `45011859918`)で見つかった。v1.6.1 からある隙間。使う人には見えない(読み直していただけで、見た目は変わらない) |
| PR 2 R2 | Rust:`config.rs` を役割別の 6 ファイル(`config/`)に分けた。`#[tauri::command]` は `mod.rs` に残した。動きは変えていない |
| PR 2 R1-1〜3 | `DashboardApp` の分けやすい所(グループ・辞書ページ・初期化ダイアログ・トースト機構・「今日の実行」の帯・一覧・セッション・やりたいこと追加・タイマー完了ダイアログ)を部品に分けた。見た目と動きは変えていない(基準画像の差分 0)。設定ダイアログ(#10)は分けていない |
| PR 2 T3-2 | テスト:重なっていた 2 本を、確かめる中身を残して消した(下) |
| PR 2 文書 | 使い方・仕様書の更新と版の番号 1.6.2。CHANGELOG とリリースの文。F1 の取り込みと CHANGELOG の 1 行 |

消したテスト 2 本と、中身が入っている方:

| 消したテスト | 中身が入っているテスト |
| --- | --- |
| `phase81-source-followup.spec.ts`「Phase 8.1 still asks where to start when the Project has no Wishlist」 | `phase10-completion.spec.ts`「P10-09 asks where to start even when the Project has no Wishlist」と「P10-09 閉じる closes without saving」 |
| `phase10-mock-match.spec.ts`「P10-14d P1 the picker shows both groups without tabs」 | `phase84-today-picker.spec.ts`「P84 Picker shows both source groups without tabs on every open」(消す前に、見出し・ボタン名を確かめる 4 行をこちらへ移した) |

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.6.2/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.6.2-windows-x64-setup.exe` | 9,781,219 | `A645A44A902FB919436343358267BF0C9065FA25A25058D05ABF50B7FAF2770D` |
| `Life-Launcher-v1.6.2-windows-x64.exe` | 22,514,688 | `D08E12577EA8222AE7414C7ECD6D1DBBA4F1BEC50DFE82AD70E2012AB2BFDAA8` |
| `Life-Launcher-v1.6.2-windows-x64-portable.zip` | 11,140,665 | `22AC885408EE33E37AB88C8D777C5CF12F7220E8F364931708B94F508475FFBE` |
| `release-notes.md` | 1,864 | `216DEF08766FCC6161FBE7DD2C0F66965B31EC16978CFF1BAEC24496666D4AB3`（`docs/releases/v1.6.2.md` と同じ） |
| `SHA256SUMS.txt` | 327 | 上の 3 つのハッシュを記録 |

v1.6.1 と比べて、大きさは少し減った。

| ファイル | v1.6.1 | v1.6.2 | 差(バイト) |
| --- | ---: | ---: | ---: |
| インストーラー | 9,784,434 | 9,781,219 | -3,215 |
| 単体 EXE | 22,540,800 | 22,514,688 | -26,112 |
| ポータブル ZIP | 11,145,798 | 11,140,665 | -5,133 |

理由は測っていない(見た目の部分を整理した結果と見ている)。

`SHA256SUMS.txt` の 3 行を、`Get-FileHash` で独立に計算した値と照合し、一致した。ZIP を一時フォルダに展開した中身は `Life-Launcher-v1.6.2-windows-x64.exe`(22,514,688 バイト)と `README.txt`(283 バイト)の 2 つで、ZIP 内 EXE の SHA-256 は単体 EXE と一致した。

## 5. リリースゲート

すべて 2026-11-22 に測った値。

1. **CI**: GitHub Actions(attempt はどれも 1)。
   - PR 1 の X1 `379e75abcbc654a6dbbe01c5b2d70d70d5b7646b`:run `45016397176`、success、7 分 50 秒。`test:fast` 26、`test:visual` 309 + 308 + 308 = 925、`cargo test` 210。1 回目の run `45011859918`(`b3dcf37`)は V161-B2 で failure(F1 で直した。数えない)。
   - PR 2 の X2 `a29b7b8fb68fac59e385469173ac827772457e7f`:run `45017262918`、success、8 分 34 秒。`test:fast` 26、`test:visual` 308 + 308 + 307 = 923、`cargo test` 210。
   - `main` の M `b7925eb1bb25e5acc30a7baff15eadb3dcf19ff6`:run `45018318536`、success(2026-11-22T11:38:31Z → 11:47:21Z)。`test:visual` 308 + 308 + 307 = 923。
   - 5 つの job:`verify`・`visual-shard (1)`〜`(3)`・`visual`。必須のチェックは無い(`main` にブランチの保護が無い)。
   - 詳しくは `V162-PR1-CI.md`・`V162-CI.md`(引き継ぎのフォルダ)。
2. **手元のゲート**(push の前):PR 1 の X1 と PR 2 の X2 のそれぞれで、`public:check`(0 blockers)・`lint`(警告 0)・`build`・`test:fast`(26 passed)が通った。FULL と Rust は、作業者が `4f547ef`(PR 2)と `b3dcf37`(PR 1)の上で全部通している(`V162-PR1.md`・`V162-PR2.md`。FULL 922 passed、`cargo test` 210 passed)。F1 の後は、本と手順書の窓の 6 ファイル 49 本を通し、V161-B2 と V162-F1 を 2・8 並列で 20 回ずつ通した。F1 の直しを外すと V162-F1 が 10 回とも落ちる事を確かめた。
3. **cargo audit**(2026-11-22。助言のデータベースの最終更新 2026-11-22T10:50+01:00):
   - **脆弱性 1 件:`RUSTSEC-2026-0592`**(`url` 2.5.8、2026-11-20 公開、直った版は 2.5.9 以上)。入れ子にした `blob:` URL に `Url::origin()` を呼ぶと、スタックオーバーフローで落ちる。v1.6.1 の時は 0 件だった。`Cargo.lock` は v1.6.1 から版の番号の行しか変わっていないので、助言が後から公開された物と見ている。
     - `url` は Windows の依存の木に入っている(`tauri` 経由。`cargo tree --target x86_64-pc-windows-msvc -i url`)。
     - アプリの Rust のコードで `Url` を使っているのは、アイコン取得の `Url::parse`(`icons.rs`)だけで、`origin()` は呼んでいない。`tauri` の中で呼ばれるかは確かめていない。
     - 直すには `url` を上げる必要があるが、ビルドするコミットの後に製品のファイルを変えない決まりと、設計書にない依存を上げない決まりがあるため、この版では直していない。オーナーに伝え、「判定書に書いて進める」と決まった。**次の版で `url` を上げる**。
   - 情報警告 14 件(すべて設定で許した物):v1.6.1 と同じ助言・同じ crate と版。
4. **npm audit**(2026-11-22):9 件 moderate。すべて開発用の `minimatch`(GHSA-g3hv-75wg-m249)と、それを使う `eslint`・`typescript-eslint` の系統。v1.6.1 と同じ。`npm audit --omit=dev` は 0 件。
5. **新しく入った・版が変わった依存**:無い。`package-lock.json` と `Cargo.lock` の v1.6.1 からの違いは、`life-launcher` の版の番号の行(3 か所)だけ。
6. **作業者のゲート**:5. #2 のとおり。
7. **公開安全**: `public:check` は 0 blockers。
8. **Windows Defender**: 成果物のコピー 3 ファイルを CustomScan。スキャン前後で検出数は 1 のまま(新しい検出 0)。**署名 `1.463.412.0`**(2026-11-22 に測った値)。
9. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/`(138 ファイル、`.map` 0 件)を、ASCII と UTF-16LE(偶数・奇数の位置)で走査した。走査した語は 18 語(ユーザーパス、リポジトリの場所、ローカルユーザー名、利用者の名前、トークン接頭辞、秘密鍵、source map)。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。当たった物は v1.6.1 と同じ 3 種類で、どれも公開してよい物と判断した:
   - 単体 EXE と ZIP 内 EXE の ASCII の `Takuyakou`(3 か所):アプリの識別子 `com.takuyakou.lifelauncher`(2 か所)と、作者の名前(アプリの情報)。公開のアカウント名。
   - 単体 EXE と ZIP 内 EXE の UTF-16LE の `Takuyakou`(1 か所):EXE の版の情報の CompanyName `takuyakou`。
   - `dist/assets/index-Dd0Si2n5.js` の ASCII の `Takuyakou`(2 か所):設定の「メンテナンス」の「リリースページを開く」が開く `https://github.com/Takuyakou/life-launcher/releases`。
   - インストーラーと ZIP は 0 件。ユーザーパス・ローカルユーザー名・利用者の名前・トークン・秘密鍵・source map は 0 件。
10. **権限と画面の許可**:
    - `git diff v1.6.1 b7925eb1bb25e5acc30a7baff15eadb3dcf19ff6 -- src-tauri/capabilities src-tauri/gen/schemas` は差分なし。
    - `git diff v1.6.1 b7925eb1bb25e5acc30a7baff15eadb3dcf19ff6 -- src-tauri/tauri.conf.json` は、`version`(1.6.1 → 1.6.2)の 1 行だけ。
11. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.6.2。ProductName は Life Launcher。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA` と `LOCALAPPDATA` を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった(普段のアプリが動いていたため、表示/隠すのショートカットの登録は飛ばされた)。確認の後にその起動だけを閉じた。
13. **テスト用の起動**: `scripts/start-test-profile.ps1 -Exe <単体 EXE>` で起動し、タイトルが「Life Launcher (テスト)」になる事を確かめた。確認の後にその起動だけを閉じた。
14. **公開スクリーンショット**: `npm.cmd run screenshot:public` は回していない。

## 6. ネイティブ確認

`native-checklist.md` に書いた(8 件)。オーナー確認待ち。

## 7. レビュー

- PR 1・PR 2 は、リード(Claude)がコードと基準画像を見て確かめた(`LEAD-OK-v162-PR1.md`・`LEAD-OK-v162-PR2.md`)。F1 の原因と直しも、リードが確かめた。
- 公開の前の確認と公開は、Claude Code が行う。

## 8. 既知の制限

v1.6.1 から引き継ぎ、変更はない。

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

## 9. 公開の手順

`inbox\v1.6.2\PUBLISH-v1.6.2.md` の手順で、Claude Code が利用者と話しながら行う。
