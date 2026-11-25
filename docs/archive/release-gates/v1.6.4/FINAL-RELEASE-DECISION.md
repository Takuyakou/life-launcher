# Life Launcher v1.6.4 Final Release Decision

**READY FOR USER APPROVAL**(自動で確かめられるゲートはすべて通った。ネイティブ確認・公開は、オーナーの判断で行う。`cargo audit` の脆弱性 2 件と警告 14 件は 5. #3 のとおり)

- 日付: 2026-11-25(JST)
- 候補のソース: `main` の先頭 M = `2a072579ae5a5d3e957599ce563c357830c61700`(PR #191 のマージのコミット)。**成果物は M をそのままビルドした**(`git checkout --detach` して `HEAD` が M である事を確かめた)。成果物をビルドした時点の作業ツリーはきれい。ビルドで `src-tauri/Cargo.toml` の改行だけが書き換わったので、`git diff --ignore-all-space` が空である事を確かめてから戻した。
- 公開は 5 つの PR と、`main` からの 1 回のビルドで行う(リリースは M の 1 回だけ。PR 1〜5 の時はタグ・Release を作っていない)。
  - PR 1 = #187(`29984fe` でマージ)。先頭 `8cd67e6ee8af01b025028f1b2292816d4b87c576`。
  - PR 2 = #188(`a654d1f` でマージ)。先頭 `43afb6aa9f6284cc0478d82269a74a0405ec627a`。
  - PR 3 = #189(`3719161` でマージ)。先頭 `988e5dd1f3ad197e8c5bf2557c91e4204750ba24`。
  - PR 4 = #190(`5fc3aa2` でマージ)。先頭 `d432697dc857a070e7e2a4957d78497bf6e92c6b`。
  - PR 5 = #191(`2a07257` でマージ)。先頭 `f9cd8a10c08091e0567df23293f145d230c36e23`。
- config schema: 3(変更なし)。Rust の製品のコードは v1.6.3 から変えていない(変わったのはテストだけ)。
- 公開(tag・GitHub Release・アセットのアップロード)は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26300(x64)、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1、`rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.6.4 で一致している(2.)。
- 成果物 3 つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- CI(GitHub Actions)は、PR 1〜5 の先頭と `main` の M のそれぞれで、5 つの job(`verify`・`visual-shard (1)`〜`(3)`・`visual`)がすべて通った(5. #1)。
- 依存は増えていない・上がっていない(5. #5)。
- `npm audit` は開発用の `minimatch` の 9 件 moderate だけで、v1.6.3 と同じ。`--omit=dev` は 0 件。
- **Rust は脆弱性 2 件**(`url` の RUSTSEC-2026-0592 と、`cookie` の RUSTSEC-2026-0594)。v1.6.5 で直す。情報警告は 14 件で、v1.6.3 と同じ Windows x64 限定の監査例外(5. #3)。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #8)。
- 権限(capabilities・gen/schemas)と画面の許可(CSP)は v1.6.3 から変わっていない(5. #10)。
- 環境変数なしの起動で、タイトルが「Life Launcher」で「テスト」が出ない事を確かめた(5. #12)。
- テスト用の起動で、タイトルが「Life Launcher (テスト)」になる事を確かめた(5. #13)。普段のアプリは終了させていない。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.6.4 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.6.4 |
| `src-tauri/tauri.conf.json` | 1.6.4 |
| 単体 EXE の FileVersion / ProductVersion | 1.6.4 / 1.6.4(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.6.4 / 1.6.4(ProductName: Life Launcher) |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.6.4 / 1.6.4(単体 EXE と SHA-256 も一致) |
| CHANGELOG、`docs/releases/v1.6.4.md` | 1.6.4(履歴と前の版の記述は残る) |

## 3. v1.6.3 からの変更

各 PR の作業報告は、リポジトリの外の引き継ぎのフォルダ(`V164-PR1.md`〜`V164-PR5.md`)にある。

| PR | 内容 |
| --- | --- |
| PR 1(E1〜E5) | ダイアログ・メニュー・検索・拡大タイマー・取り込みを閉じる時の動きを足した(`ExitPresence`)。閉じている間の面は `inert` で、動きが終わってから外す。開く動きが無かった 4 つに開く動きを足した。拡大タイマーはフェードだけ。動きを減らす設定では動かない。閉じかけのメニューやダイアログは、フォーカスとキーをすぐ返す(E5) |
| PR 2(A1〜A6) | `src/App.tsx` を、見た目と動きを変えずに部品とフックへ分けた(12,134 行から 6,843 行)。基準画像の差は 0 |
| PR 3(T2a〜T2d) | テストを見直した。古い段と重なる物・実装のコピー・分けすぎをまとめ、Playwright は 1,007 件から 884 件、Rust の `#[test]` は 217 件から 209 件、基準画像は 30 枚から 27 枚。製品の動きは変えていない |
| PR 4(R1〜R3b) | 文書を `docs/archive/` へ移し(442 ファイル)、OVERVIEW・仕様の頭・README(日英)を新しくした。CHANGELOG・リリースノート・版の番号を 1.6.4 にした |
| PR 5 | 「元に戻す」付きの通知を 4 秒にした(ほかの通知と同じ)。低い窓で、まとめて取り込むを真ん中に出す。選ぶ欄(`<select>`)の開いた一覧を、右クリックメニューと同じ見た目にした(`appearance: base-select`。古い WebView2 では今までの見た目のまま) |

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.6.4/`(`.gitignore` 済み。リポジトリには入れていない)。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.6.4-windows-x64-setup.exe` | 9,805,197 | `D17015C11EA198B337F6F2C1614A4D7CA4FEE0A99270C70A49911EC268E0E6D7` |
| `Life-Launcher-v1.6.4-windows-x64.exe` | 22,562,816 | `FB6EFD237D3FCBF4DD74D941311C5A68D96FD276C3F1A290CD1CDED5DD408ED7` |
| `Life-Launcher-v1.6.4-windows-x64-portable.zip` | 11,160,974 | `CCE5B88039BE90A80DA6D8438DB8D96998C2E237DDEF3574D1F5D2BBDC5E87FA` |
| `release-notes.md` | 1,810 | `docs/releases/v1.6.4.md` と同じ(ハッシュ一致) |
| `SHA256SUMS.txt` | 327 | 上の 3 つのハッシュを記録 |

v1.6.3 と比べて、大きさは少し増えた。

| ファイル | v1.6.3 | v1.6.4 | 差(バイト) |
| --- | ---: | ---: | ---: |
| インストーラー | 9,798,311 | 9,805,197 | +6,886 |
| 単体 EXE | 22,556,160 | 22,562,816 | +6,656 |
| ポータブル ZIP | 11,157,785 | 11,160,974 | +3,189 |

理由は測っていない(閉じる動きと選ぶ欄の見た目を足した分と見ている)。

`SHA256SUMS.txt` の 3 行を、`Get-FileHash` で独立に計算した値と照合し、一致した。ZIP を一時フォルダに展開した中身は `Life-Launcher-v1.6.4-windows-x64.exe`(22,562,816 バイト)と `README.txt`(283 バイト)の 2 つで、ZIP 内 EXE の SHA-256 は単体 EXE と一致した。

## 5. リリースゲート

すべて 2026-11-25 に測った値。

1. **CI**: GitHub Actions(attempt はどれも 1、すべて success)。
   - PR 1 `8cd67e6`:run `45515135840`。
   - PR 2 `43afb6a`:run `45517759120`。
   - PR 3 `988e5dd`:run `45519167909`。
   - PR 4 `d432697`:run `45522359029`。
   - PR 5 `f9cd8a1`:run `45523305590`。
   - `main` の M `2a07257`:run `45527023717`(2026-11-25T01:36:48Z → 01:44:09Z)。`test:fast` 24、`test:visual` 295 + 295 + 295 = 885、`cargo test` 210(単体 209、capability 契約 1)。
   - 5 つの job:`verify`・`visual-shard (1)`〜`(3)`・`visual`。必須のチェックは無い(`main` にブランチの保護が無い)。
2. **手元のゲート**:各 PR の作業者が、push の前に `public:check`・`lint`・`build`・`test:fast`・FULL を通している(`V164-PR1.md`〜`V164-PR5.md`)。PR 5 の FULL は 884 件合格・1 件失敗で、失敗の 1 件は `page.goto` の `ERR_ADDRESS_IN_USE`(テストの中身に入る前の、ローカルのポートの取り合い)。リードの判断で、そのファイルだけを 1 回回し直して 14 件合格。
3. **cargo audit**(2026-11-25):
   - **脆弱性 2 件**:`RUSTSEC-2026-0592`(`url` 2.5.8)と `RUSTSEC-2026-0594`(`cookie` 0.18.1)。**v1.6.5 で直す**。`url` は直った版が公開から 14 日たっていない(14 日の決まり)。`cookie` は Windows では当たらない知らせで、直った版も 14 日の決まりに当たる。
   - 情報警告 14 件:v1.6.3 と同じ crate と版。v1.6.3 で利用者が承認した、Windows x64(`x86_64-pc-windows-msvc`)限定の監査例外と同じ扱い(この版でも利用者が改めて承認する)。依存の更新や監査設定による抑制は加えていない。
4. **npm audit**(2026-11-25):9 件 moderate。すべて開発用の `minimatch` と、それを使う系統。v1.6.3 と同じ。`npm audit --omit=dev` は 0 件。
5. **新しく入った・版が変わった依存**:無い。`package-lock.json` と `Cargo.lock` の v1.6.3 からの違いは、`life-launcher` の版の番号の行(3 か所)だけ。
6. **作業者のゲート**:5. #2 のとおり。
7. **公開安全**: `public:check` は 0 blockers。
8. **Windows Defender**: 成果物のコピー 3 ファイルを CustomScan。スキャン前後で検出数は 1 のまま(新しい検出 0)。**署名 `1.463.457.0`**(2026-11-25 に測った値)。
9. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/`(143 ファイル、`.map` 0 件)を、ASCII(UTF-8)と UTF-16LE で走査した。走査した語は 18 語(ユーザーパス、リポジトリの場所、ローカルユーザー名、利用者の名前、トークン接頭辞、秘密鍵、source map)。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。当たった物は、公開のアカウント名 `Takuyakou` だけで、どれも公開してよい物と判断した:
   - 単体 EXE と ZIP 内 EXE の ASCII(各 1 か所):作者の名前(アプリの情報)。
   - `dist/assets/` の JS の ASCII(2 か所):設定の「メンテナンス」の「リリースページを開く」が開くリリースページの URL。
   - インストーラーと ZIP は 0 件。ユーザーパス・ローカルユーザー名・利用者の名前・トークン・秘密鍵・source map は 0 件。
10. **権限と画面の許可**:
    - `git diff v1.6.3 2a072579ae5a5d3e957599ce563c357830c61700 -- src-tauri/capabilities src-tauri/gen/schemas` は差分なし。
    - `git diff v1.6.3 2a072579ae5a5d3e957599ce563c357830c61700 -- src-tauri/tauri.conf.json` は、`version`(1.6.3 → 1.6.4)の 1 行だけ。
11. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.6.4。ProductName は Life Launcher。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA` と `LOCALAPPDATA` を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった(普段のアプリが動いていたため、表示/隠すのショートカットの登録は飛ばされた)。確認の後にその起動だけを閉じた。
13. **テスト用の起動**: `scripts/start-test-profile.ps1 -Exe <単体 EXE>` で起動し、タイトルが「Life Launcher (テスト)」になる事を確かめた。確認の後にその起動だけを閉じた。
14. **公開スクリーンショット**: `npm.cmd run screenshot:public` は回していない。

## 6. ネイティブ確認

`native-checklist.md` に書いた(14 件)。オーナーが 2026-11-25 に「確認したok」と返し、1〜13 を OK とした(単体 EXE の SHA-256 は `FB6EFD23` で始まる物)。14(インストーラーでの更新)は公開の後に利用者が行う。

## 7. レビュー

- PR 1〜4 は、リード(Claude)がコードと基準画像を見て確かめた。PR 5 の中身はリードが作って確かめ、作業者は `SHA256SUMS.txt` で照らしてから置いた。
- 公開の前の確認と公開は、Claude Code が行う。

## 8. 既知の制限

v1.6.3 から引き継ぐ。この版で足した物は最後の 2 つ。

- UIは日本語中心で、英語対応は主に上部ツールバーなどの一部。
- Windows 11 のスナップレイアウト(最大化ボタンに乗せたときの配置の選択)は、アプリのボタンでは出ない。画面の端へのスナップと Win+Z は Windows の機能だが、この版では使える前提にしていない。
- HTML手順書は静的HTML/CSSと登録フォルダー内の相対assetだけ。JavaScript、フォーム、入れ子フレーム、外部assetは動かない。編集はできない。
- MHTMLはPNG・JPEG・GIF・WebPとCSSだけを埋め込む。SVGなどの画像、埋め込みフォント、スクリプトで動く部分、フォーム、入れ子フレーム、外部画像/CSSは表示されない。20 MBを超えるファイルは開けない。
- プロジェクトの新しい4色(lime・magenta・sand・coral)は、v1.4.2以前の版では自動の色で表示され、その版で保存すると色の指定が消える。戻す前にバックアップが必要。
- タイマーの開始・一時停止はスクリーンリーダーで自動読み上げしない。
- 画面の確認は、開発環境のWindows(Chromium)の画像比較と、ビルド済みアプリでの確認を組み合わせている。表示倍率やフォントが違う環境では折り返しが少し違う場合がある。
- 「次はここから」は、予定時間になったときの画面(今日の3件に入っていない次の一手のとき)と、次の一手の編集で書ける。途中でタイマーを終了したときは画面が出ないので、編集で書く。
- 見つからない物の知らせは、ネットワークの場所(\\server\… や //…)と URL を確かめない。割り当てたネットワークドライブ(Z:\ など)がつながっていないと、知らせが出るまで時間がかかることがある。
- RAR の本には対応していない(ZIP だけ)。
- 選ぶ欄の新しい見た目は、WebView2(Chromium)135 以降で出る。それより古い PC では、今までの Windows の一覧のまま動く。
- 閉じた選ぶ欄で Enter を押しても一覧は開かない(Windows のふつうの選ぶ欄と同じ)。キーボードで開くのは Alt+↓。

## 9. 公開の手順

引き継ぎのフォルダの `PUBLISH-v1.6.4.md` の手順で、Claude Code が利用者と話しながら行う。
