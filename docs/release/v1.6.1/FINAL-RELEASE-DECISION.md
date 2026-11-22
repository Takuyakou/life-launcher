# Life Launcher v1.6.1 Final Release Decision

**READY FOR USER APPROVAL**（自動で確かめられるゲートはすべて通った。ネイティブ確認・公開は、オーナーの判断で行う）

- 日付: 2026-11-22（JST）
- 候補のソース: ブランチ `v161/01-book`(タグ `v1.6.0` の後の `main` の `7f75546` から。タグとの違いは v1.6.0 の公開の報告の文書だけ)、ビルドしたコミット `c18d1814aa87931ebc4e72f16a8c65106e48d0de`(X)。**GitHub Actions の CI(run `44994220760`、attempt 1)が確かめたコミットと同じ**。成果物をビルドした時点の作業ツリーはきれい（`git status --porcelain` が空）。ビルドの後も作業ツリーはきれいだった(`src-tauri/Cargo.toml` の改行も書き換わらなかった)。
- X は、S6 の最後のコミット `504b70b` に、S7 の 5 コミット(`0d7fdd6`〜`c18d181`)を足した物。`git diff --name-only 504b70b c18d181` は 6 ファイル(`.github/workflows/ci.yml`、`tests/visual/` の 3 つ、`CHANGELOG.md`、`docs/releases/v1.6.1.md`)だけ。`git diff v1.6.0 c18d181 -- package-lock.json src-tauri/Cargo.lock` は版の番号の行(3 か所)だけ。
- config schema: 3(v1.6.0 から変更なし)。教材ごとの覚え `instruction-books.json` に、拡大の倍率 `zoomPercent`(100・125・150・200・300・400 の整数。それ以外は 100 として読む)を足した。前の版は `zoomPercent` を読まないので、前の版に戻しても困らない。
- 公開（tag・GitHub Release・アセットのアップロード）は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26300（x64）、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1、`rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.6.1 で一致している(2.)。
- 成果物 3 つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- CI(GitHub Actions)は X で 1 回、5 つの job(`verify`・`visual-shard (1)`〜`(3)`・`visual`)がすべて通った。`test:visual` 946 件(3 組の合計)、`cargo test` 210 件(5. #1)。CI の時間は 8 分 19 秒で、v1.6.0 の 25 分 6 秒から約 3 分の 1 になった。
- `npm audit` は開発用の `minimatch` の 9 件 moderate だけで、v1.6.0 と同じ。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 14 件で、v1.6.0 と同じ(`Cargo.lock` は版の番号の行しか変わっていない)(5. #3)。
- 新しく入った依存・版が変わった依存は無い(5. #5)。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #8)。
- 権限(capabilities・gen/schemas)と画面の許可(CSP)は v1.6.0 から変わっていない(5. #10)。
- 環境変数なしの起動で、タイトルが「Life Launcher」で「テスト」が出ない事を確かめた(5. #12)。
- テスト用の起動で、タイトルが「Life Launcher (テスト)」になる事を確かめた(5. #13)。普段のアプリは終了させていない。
- `main` には必須のチェックの設定が無い(ブランチの保護が無い)。オーナーに聞き、設定は変えないと決まった(5. #1)。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.6.1 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.6.1 |
| `src-tauri/tauri.conf.json` | 1.6.1 |
| 単体 EXE の FileVersion / ProductVersion | 1.6.1 / 1.6.1(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.6.1 / 1.6.1(ProductName: Life Launcher) |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.6.1 / 1.6.1(単体 EXE と SHA-256 も一致) |
| CHANGELOG、`docs/releases/v1.6.1.md` | 1.6.1（履歴と前の版の記述は残る。README と `SECURITY.md` には版の番号を書いていない） |

## 3. v1.6.0 からの変更

各段の作業報告は、リポジトリの外の引き継ぎのフォルダ(`V161.md`)にある。

| 段 | 内容 |
| --- | --- |
| S1 | 本のめくりを、重ね替えをやめてすぐ替える形にした(新しい組のページが全部デコード済みならその場で、まだなら 150ms まで前の組を出す)。先読みは、めくっても読み込み中の物を捨てず、本が替わった時だけ捨てる(読み込み中のまま残る取りこぼしを直した)。ZIP のページを読む時の 1 バイトのずらしをやめ、本の画面・手順書の窓を閉じる時と、アプリの中で名前を変える・動かす・ゴミ箱へ送る前に、ZIP のファイルを放す(Rust 側でも、手順書の窓を閉じた時に放す) |
| S2 | ページへ跳ぶ:ページ表示を押すか Ctrl+G で数を打つ欄を開き、Enter でそのページを含む組へ移る(変換中の Enter では移らない・全角の数字を読む)。下の進み具合の線を押す・引くでその場所へ移る(押せる高さ 24px・吹き出し)。進み具合の位置の計算を `(p − 1) / (ページ数 − 1)` にそろえた |
| S3 | 拡大・縮小(全体・125・150・200・300・400%):上の帯の「− 全体 +」・Ctrl+ホイール・+ − 0 のキー。拡大中は画像の幅と高さを計算して置き、ホイールと引く操作で動かし、← → でめくる。倍率を教材ごとに `zoomPercent` で覚える。基準画像を 1 枚足し(200%)、上の帯に操作が増えた v1.6.0 の本の基準画像 3 枚を撮り直した |
| S4 | 細かい直し:「元に戻す」付きの知らせを 8 秒から 5 秒に。フォルダの名前の変更・移動で、その下の教材の覚えを新しい場所へ移す。README の ZIP の行の形をそろえた。P82-03 のテストの揺れ(時計を止めてから読む) |
| S5 | テストの基盤と分ける作業(見た目と動きは変えない):画面のテストをビルドした物に対して回し、1 つのファイルの中も並べて回す(手元の並列は 8 まで)。CI の画面のテストを 3 つの組に分けて並べて回す。`styles.css` を並びを変えずに 9 つのファイルに分けた(ビルドした CSS は 1 バイトも違わない)。`App.tsx` の外側の補助の部分を `src/app/` と `src/components/` へ移した(中身は 1 文字も変えていない) |
| S6 | 文書:使い方(ページへ跳ぶ・拡大縮小とキー)・仕様書 §17.5。版の番号 1.6.1。ゲートで見つかった P82-03 のもう 1 本の揺れ(テストだけ) |
| S7 | 公開の前の最後の段:CI のまとめの job `visual` を、組が 1 つでも落ちたら落ちる形にした。先読みのテストに、待たせたページの取りに行きがちょうど 1 回な事の確かめを足した(直しを外すと 10 回とも落ちる)。CHANGELOG とリリースの文。ゲートの FULL で揺れた 2 本(P84 の小さい窓・Phase 8.1 の続きの確かめ)の、テストだけの直し |

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.6.1/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.6.1-windows-x64-setup.exe` | 9,784,434 | `1A936FE7EC0A7CF77F87D3321263DDD58F9ADF0BC9E7FB6A3DA564C67B8BCDEE` |
| `Life-Launcher-v1.6.1-windows-x64.exe` | 22,540,800 | `02E1F4DB5083D0206841FBE7DD162ED008D98E812A9B724AD8407B96ABB617A2` |
| `Life-Launcher-v1.6.1-windows-x64-portable.zip` | 11,145,798 | `D34FA43CFB840C34B43BDBA964E84F44DF3F0403098C60D0B26AD77ED7A4F622` |
| `release-notes.md` | 2,131 | `1117E2F18183F4D5F44B6D3C122B028D96FF3CC7DE116DDA3AA950561C999DFE`（`docs/releases/v1.6.1.md` と同じ） |
| `SHA256SUMS.txt` | 327 | 上の 3 つのハッシュを記録 |

v1.6.0 と比べて、大きさは少し増えた。

| ファイル | v1.6.0 | v1.6.1 | 差(バイト) |
| --- | ---: | ---: | ---: |
| インストーラー | 9,771,478 | 9,784,434 | +12,956 |
| 単体 EXE | 22,486,016 | 22,540,800 | +54,784 |
| ポータブル ZIP | 11,130,318 | 11,145,798 | +15,480 |

主な理由は、本の画面のページへ跳ぶ・拡大の部分を足した事と見ている(内訳は測っていない)。依存は増えていない。

`SHA256SUMS.txt` の 3 行を、`Get-FileHash` で独立に計算した値と照合し、一致した。ZIP を一時フォルダに展開した中身は `Life-Launcher-v1.6.1-windows-x64.exe`(22,540,800 バイト)と `README.txt`(283 バイト)の 2 つで、ZIP 内 EXE の SHA-256 は単体 EXE と一致した。

## 5. リリースゲート

すべて 2026-11-22 に、X で測った値(6. の作業者のゲートは、その段のコミットで測った値)。

1. **CI**: GitHub Actions run `44994220760`(attempt 1)。
   - 確かめたコミット:`c18d1814aa87931ebc4e72f16a8c65106e48d0de`(X)
   - 時刻:2026-11-22T06:33:00Z 〜 06:41:19Z(8 分 19 秒)
   - 結果:success(5 つの job がすべて success)
   - `verify`(`windows-latest`、4 分 10 秒):`npm ci`・`public:check`・`lint`・`build`・`cargo fmt --check`・`cargo check`・`cargo clippy --all-targets -- -D warnings`・`cargo test`(209 + 1 = 210 passed)・`npm audit`(`continue-on-error`)・`npm audit --omit=dev`(0 件)
   - `visual-shard (1)`〜`(3)`(`windows-latest`):`test:visual -- --shard=N/3` が 316・315・315 passed(合わせて **946 passed**)。一番長い組は 8 分 10 秒
   - `visual`(`ubuntu-latest`、4 秒):3 つの組がすべて success
   - v1.6.0 の数えた run(`44907618261`)は 25 分 6 秒(`test:visual` 937 件が 1 つの job で 21.9 分)。v1.6.1 は約 16 分 47 秒短い。
   - 必須のチェック:`main` にブランチの保護が無く(`required_status_checks` は 404)、rulesets も無い。オーナーに聞き、設定は変えないと決まった。
2. **手元のゲート**(push の前に、X で):`npm ci`・`public:check`(0 blockers)・`lint`(警告 0)・`build`・`cargo fmt --check`・`cargo check`・`clippy -D warnings`・`cargo test`(210 passed)が通った。`test:visual` は、作業者が S7 で作業ツリーが空の X で FULL 946/946 を通している。
3. **cargo audit**(2026-11-22):
   - 脆弱性 0 件。情報警告 14 件(すべて設定で許した物):unmaintained 10 件(`proc-macro-error`・`unic-*` の 5 つ・`zvariant`・`zbus_names`・`zvariant_derive`・`chrono`)、unsound 3 件(`glib`・`tokio`・`rustix`)、yanked 1 件(`async-executor`)。`Cargo.lock` は v1.6.0 から版の番号の行しか変わっていないので、v1.6.0 と同じ助言・同じ crate と版である。
4. **npm audit**(2026-11-22):9 件 moderate。すべて開発用の `minimatch`(GHSA-g3hv-75wg-m249)と、それを使う `eslint`・`typescript-eslint` の系統。v1.6.0 と同じ件数・同じ助言。`npm audit --omit=dev` は 0 件。
5. **新しく入った・版が変わった依存**:無い。`package-lock.json` と `Cargo.lock` の v1.6.0 からの違いは、`life-launcher` の版の番号の行(3 か所)だけ。
6. **作業者のゲート**(`V161.md`):
   - S5:`fullyParallel` の前後と並列の数の実測(8 並列で FULL 3 回とも 946 passed)。B7-1 の手元の `--shard` 1/3〜3/3 は 316・315・315 passed。B7-2・B7-3 の後の FULL はどちらも 946 passed。
   - S6(`f42b3e2`・`504b70b`):`ci.yml` の手順すべて(FULL 946 passed、`cargo test` 210 passed)。足した・変えた spec 88 本 × 20 は、2・4 並列で 1,760 passed、14 並列で 1 本落ちた(P82-03 の 1 本目。テストの時計を止めていなかった)ので `504b70b` で直し、14 並列で 1,760 passed。直しを外すと落ちる事を確かめた(B1・B2・B6.2)。
   - S7(`a93dd98`〜X):FULL の 1 回目(`a93dd98`)は 945 passed・1 failed(P84 の小さい窓。開く動きの間に 4 つの箱を別々に読んでいた)、2 回目(`15aa3b1`)は 945 passed・1 failed(Phase 8.1 の続きの確かめ。テストの時計を止めていなかった)。どちらもテストだけを直し、X の FULL は 946 passed(作業ツリーが空)。`v161-book` 9 本 × 20 は 2・4・14 並列とも 180 passed。
7. **公開安全**: `public:check` は 0 blockers。
8. **Windows Defender**: 成果物のコピー 3 ファイルを CustomScan。スキャン前後で検出数は 1 のまま(新しい検出 0)。**署名 `1.463.406.0`**(2026-11-22 に測った値)。
9. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/`(138 ファイル、`.map` 0 件)を、ASCII と UTF-16LE(偶数・奇数の位置)で走査した。走査した語は 18 語(ユーザーパス、リポジトリの場所、ローカルユーザー名、利用者の名前、トークン接頭辞、秘密鍵、source map)。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。当たった物は次のとおりで、どれも公開してよい物と判断した(v1.6.0 の EXE で同じ走査をすると、同じ所に同じ物がある):
   - 単体 EXE と ZIP 内 EXE の ASCII の `Takuyakou`(3 か所):アプリの識別子 `com.takuyakou.lifelauncher`(2 か所。データの置き場所の名前と、アプリの設定)と、作者の名前 `Takuyakou`(アプリの情報)。どれも公開のアカウント名。
   - 単体 EXE と ZIP 内 EXE の UTF-16LE の `Takuyakou`(1 か所):EXE の版の情報の CompanyName `takuyakou`(走査は大文字小文字を区別しない)。
   - `dist/assets/index-DEmixjay.js` の ASCII の `Takuyakou`(2 か所):設定の「メンテナンス」の「リリースページを開く」が開く `https://github.com/Takuyakou/life-launcher/releases`(開く命令と、ボタンの説明)。
   - インストーラーと ZIP は 0 件。ユーザーパス・ローカルユーザー名・利用者の名前・トークン・秘密鍵・source map は 0 件。
10. **権限と画面の許可**:
    - `git diff v1.6.0 c18d1814aa87931ebc4e72f16a8c65106e48d0de -- src-tauri/capabilities src-tauri/gen/schemas` は差分なし。
    - `git diff v1.6.0 c18d1814aa87931ebc4e72f16a8c65106e48d0de -- src-tauri/tauri.conf.json` は、`version`(1.6.0 → 1.6.1)の 1 行だけ。
    - 新しい Rust の命令は、本を閉じる `close_instruction_book` と、全部の本を放す `release_instruction_books`(S1)。どちらも開いている ZIP を閉じるだけで、ファイルを読み書きしない。
11. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.6.1。ProductName は Life Launcher。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA` と `LOCALAPPDATA` を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった(普段のアプリが動いていたため、表示/隠すのショートカットの登録は飛ばされた)。確認の後にその起動だけを閉じた。
13. **テスト用の起動**: `scripts/start-test-profile.ps1 -Exe <単体 EXE>` で、新しいテスト用のプロファイルで起動し、タイトルが「Life Launcher (テスト)」になる事を確かめた。確認の後にその起動だけを閉じた。
14. **公開スクリーンショット**: `npm.cmd run screenshot:public` は回していない。

## 6. ネイティブ確認

`native-checklist.md` に書いた(10 件)。オーナー確認待ち。

## 7. レビュー

- 各段の変更は、リード(Claude)がコードと基準画像を見て確かめた(`LEAD-OK-v1.6.1.md`)。CSS を分けた前と後でビルドした CSS のハッシュが同じ事、`App.tsx` は移しただけな事も、リードが確かめた。
- S7 は、`504b70b` との差分が 6 ファイルで、`Cargo.lock`・`package-lock.json` が v1.6.0 から版の番号の行だけである事を、Claude Code が確かめた。
- 公開の前の確認と公開は、Claude Code が行う。

## 8. 既知の制限

v1.6.0 から引き継ぎ、「ZIP の入ったフォルダの名前を変える・動かすと、その中の教材の覚えが初めに戻る」を消した(v1.6.1 で直した)。

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

`inbox\v1.6.1\PUBLISH-v1.6.1.md` の手順(形は `inbox\v1.6.0\PUBLISH-v1.6.0.md` の A〜F)で、Claude Code が利用者と話しながら行う。
