# Life Launcher v1.4.1 Final Release Decision

**READY FOR USER APPROVAL**(オーナーの実機確認が済めば公開できる、の意味。自動で確かめられるゲートはすべて通った。画面の項目のネイティブ確認〔9. C〕は、まだ**オーナー確認待ち**で、PASS とは書いていない。公開は、オーナーの明示承認があるまで行わない)

**オーナーの実機確認は 2026-11-01 に済んだ(9. C)。オーナーは P95-06 で公開を承認した。** 9. B(実装担当の起動確認)は未実施のままで、8.8 の起動確認で代える。

- 日付: 2026-11-01(JST)に作り直した(P95-05b)。前回の判定(2026-10-31、BLOCKED)の結果は流用していない。
- 候補のソース: ブランチ `release/v1.4.1`、コミット `afc608ccdcac3e8fae3340da158b99d5afed6db8`(`main` = `e425421`〔PR #138、P95-03b のマージ〕+ バージョン・公開文書・公開スクリーンショット)。**ビルドした時点の作業ツリーはきれい**(`git status --porcelain` は、無関係の未追跡ファイル `voicing-loop-current-chord-panel-mock.html` だけ。ビルド直前に記録)。この後に足すコミットは、この判定書と `native-checklist.md` だけで、成果物には含まれない(`git diff --name-only afc608c HEAD` で確認する)。
- PR: #137(`release/v1.4.1` → `main`)。マージしていない。
- config schema: 3(v1.4.0 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、Windows 11 Home 10.0.26200(x64)、`@tauri-apps/cli` 2.11.4(`tauri-bundler` 2.9.4)。Rust は `rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## オーナーの判断(2026-10-31)の反映

| 項目 | 判断 | この判定書での扱い |
| --- | --- | --- |
| `npm audit` の助言(GHSA-g3hv-75wg-m249、minimatch、moderate。開発用の ESLint の依存だけ。`--omit=dev` は 0 件) | 受け入れて進める。ESLint の更新は次の版で検討する | 5. の #1 に「受け入れ」と書いた。新しい助言は出ていない |
| インストーラーの `{{product_name}}` | v1.4.1 で直す | P95-03b(PR #138、マージ済み)。成果物に反映した(5. の #12) |
| タイマーの開始・一時停止の通知をやめたため、スクリーンリーダーが自動では読み上げない | このままでよい。既知の制限として書く | 公開文書と 10. に書いた |

## 1. 判定の要約

- バージョン情報は、すべて 1.4.1 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` を、正式スクリプトで**作り直し**、ハッシュは独立した再計算と一致した(4.、5.)。前回の候補とはハッシュが変わっている(4. の末尾)。
- 必須ゲートは通った(5.)。`test:visual` は 541 件すべて通過(落ちたテストなし)。
- `npm audit` は、オーナーが受け入れた助言の1件だけ(新しい助言なし)。Rust は脆弱性 0 件。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #9)。
- 言語ファイル(P95-03・P95-03b)は、成果物のビルドに入っている(5. #12)。
- 画面の項目のネイティブ確認は、2026-11-01 に済んだ(9. C。PASS 10 項目、任意の 5 は未実施。日本語 IME オンでの設定画面の操作は未確認だが、オーナー判断で公開を止める理由にしない)。実装担当による成果物の起動確認は、オーナーの実際のアプリが起動中の可能性があるため行っていない(9. B。8.8 の起動確認で代える)。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.4.1 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.4.1 |
| `src-tauri/tauri.conf.json` | 1.4.1 |
| 単体 EXE の FileVersion / ProductVersion | 1.4.1 / 1.4.1(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.4.1 / 1.4.1 |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.4.1 / 1.4.1 |
| README、README.en.md、CHANGELOG、`docs/releases/v1.4.1.md`、`docs/OVERVIEW.md`、`docs/spec/current-spec.md` | 1.4.1(1.4.0 の表記が残るのは、履歴と「v1.4.0 の変更」の節だけ) |

`main`(P95-03b のマージ後)を `release/v1.4.1` へマージ(`de706e9`。rebase・force push なし)しても、バージョンは 1.4.1 のまま。

## 3. v1.4.0 からの変更(Phase 9.5)

詳細は `docs/phase9.5/` の各報告。

| Stage | 内容 | 報告 |
| --- | --- | --- |
| P95-01(PR #133) | タイマーの開始・一時停止の通知をやめた。一時停止・再開の時計の巻き戻りを修正。上部メニューを記録画面でも同じ大きさにした。記録画面の見出しの右の余白。未入力の勝利条件のホバー。メインの4つの見出しの件数の位置をそろえた | `01-timer-toast-clock.md` |
| P95-02(PR #134) | 使っていない CSS を整理した(65クラス、変数1個)。見た目の変化なし(49画面・579,427 要素で計算後のスタイルが同一) | `02-unused-css.md` |
| P95-03(PR #135) | インストーラーの「アンインストールできません。」に原因と対処の案内を出す(日本語・英語の言語ファイル) | `03-installer-message.md` |
| P95-03b(PR #138) | インストーラーの「動作中です」などのメッセージに、アプリ名の代わりに「{{product_name}}」と出ていたのを「Life Launcher」と出るように直した(v1.4.0 でも出ていた表示。日本語・英語、3つの文字列) | `03b-installer-product-name.md` |
| P95-04(PR #136) | 設定画面を十字キーと Enter で操作できるようにした | `04-settings-keyboard.md` |

データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。公開文書(CHANGELOG、リリースノート、README 2種、OVERVIEW、仕様書)に反映した。P95-03b の内容は、CHANGELOG とリリースノート(`docs/releases/v1.4.1.md` と控え)のインストーラーの項目に足した。既知の制限に、スクリーンリーダーの件を書いた(10.)。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.4.1/`(`.gitignore` 済み。リポジトリには入れていない)。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.1-windows-x64-setup.exe` | 3,727,535 | `d70c268b2f07da90d504b598d55b0d93c107776064db3f630ddd027f7e5d827a` |
| `Life-Launcher-v1.4.1-windows-x64.exe` | 16,051,200 | `69afc8c16fb3b135bc40800f73a4032bbdcc2f8246a17cf3211ea5e09ead20c2` |
| `Life-Launcher-v1.4.1-windows-x64-portable.zip` | 5,070,272 | `4d43996adb109ed7fd415efba0865bdd9fdc14874475cc4e2bd81811ed34edcd` |
| `SHA256SUMS.txt` | 327 | (上の3行。大文字で書かれている) |
| `release-notes.md` | 6,677 | `docs/releases/v1.4.1.md`、`docs/release/v1.4.1/release-notes.md` と同一(SHA-256 `576e2267…94d7` で3つ一致) |

作り方: 既存の正式スクリプト `scripts/prepare-release-candidate.ps1`(終了コード 0)。上のコミットのソース、パスの置換つきの release ビルド。

4. の単体 EXE のハッシュの打ち間違い(1文字多かった)を直した。成果物は変わっていない。(P95-06。`SHA256SUMS.txt` と `Get-FileHash` の値と、全文が 64 文字で一致することを確かめた。)

**置き換えた前回の候補(P95-05 のビルド、コミット `8a71896`)のハッシュ**(参考。もう使わない。公開には使わない):

| ファイル | SHA-256(前回) |
| --- | --- |
| `Life-Launcher-v1.4.1-windows-x64-setup.exe` | `1f213cee501ccb422b7520d50d4a0c23fd3ffb3c83902f24fc9469cee0dcb04f`(3,726,810 バイト) |
| `Life-Launcher-v1.4.1-windows-x64.exe` | `2f45647a056c7ca787e7ac494bffcf368ee77caaee615ff621520489a3d1574c` |
| `Life-Launcher-v1.4.1-windows-x64-portable.zip` | `f3d7fc2a5e51070d5871c5095bbc2e21980d6e021264507cceeae184a6c8e668` |

前回から変わったファイル(`git diff --name-only 8a71896 afc608c`): `src-tauri/installer/languages/English.nsh`、`Japanese.nsh`(製品に入るのはこの2つ)、`CHANGELOG.md`、`docs/releases/v1.4.1.md`、`docs/phase9.5/03b-installer-product-name.md`、`docs/release/v1.4.1/` の文書。画面側のコード(`src/`)と Rust は変わっていない。ただし、単体 EXE とポータブル ZIP のハッシュも前回と違う(ビルドを作り直したため。単体 EXE のサイズは同じ)。したがって、**前回のハッシュでの確認は無効**で、オーナーの実機確認は、この判定書のハッシュのビルドで行う。

## 5. リリースゲートの証跡(前回の結果は流用していない。確かめた人: 実装担当〔Claude〕)

| # | ゲート | 結果 | 証跡 |
| --- | --- | --- | --- |
| 1 | 依存関係(npm) | **通過(オーナー判断で受け入れ、2026-10-31)** | `npm.cmd audit --audit-level=low`: 15 件(moderate)、終了コード 1。助言は **GHSA-g3hv-75wg-m249 の1件だけ**(minimatch の DoS〔globparts の増幅〕。`npm audit --json` の `via` を集計して確認)。開発用ツールの依存だけ(`eslint`、`@typescript-eslint/*`、`glob`、`rimraf` など)。**`npm audit --omit=dev`(配布物に入る依存)は 0 件**。GHSA-g3hv-75wg-m249(開発用の依存だけ。`--omit=dev` は 0 件)。オーナー判断で受け入れ(2026-10-31)。ほかの新しい助言はない。ESLint の更新は次の版で検討する |
| 2 | 依存関係(Rust) | **通過**(脆弱性 0 件、情報警告 11 件は据え置き) | `cargo audit` 終了コード 0、`allowed warnings` 11 件。ID は v1.4.0 と同じ 11 個(RUSTSEC-2024-0370 / 0429、2025-0075 / 0080 / 0081 / 0098 / 0100、2026-0370 / 0371 / 0372 / 0386)。`Cargo.lock` は version 以外変わっていない。内訳と据え置きの理由は `docs/release/v1.4.0/FINAL-RELEASE-DECISION.md` の 7. と同じ |
| 3 | 公開安全 | **通過** | `npm.cmd run public:check`: 3585 ファイル、blocker 0 |
| 4 | 公開文書の横断確認 | **通過** | README、README.en.md、CHANGELOG、`docs/releases/v1.4.1.md`、仕様書、OVERVIEW のバージョンが 1.4.1 で一致。P95-01〜04 と P95-03b の内容が CHANGELOG、リリースノート(2つの控えは同一)にある。配布ファイル名、config schema `3`、Web Demo が別公開工程であることは、すべての文書で同じ。`readme-contract` のテストも通っている |
| 5 | ポータブル ZIP | **通過** | 中身は `Life-Launcher-v1.4.1-windows-x64.exe` と `README.txt` の2つだけ。ZIP 内の EXE の SHA-256 が単体 EXE と一致(`69afc8c1…0c2`) |
| 6 | 秘密情報・パスの走査 | **通過** | 単体 EXE、ZIP 内 EXE(展開したもの)、インストーラー、ZIP を ASCII と UTF-16LE で走査。`C:\Users\`、`D:\dev\`、`D:/dev/`、`Life Launcher-dev`、開発者のユーザー名(2種類)、`Takuyakou\`、秘密鍵ヘッダー(RSA、OPENSSH、PRIVATE KEY、EC)、トークン接頭辞(`ghp_`、`github_pat_`、`gho_`、`AKIA`、`xoxb-`、`xoxp-`、`sk-ant-`)、`sourceMappingURL`、`.js.map` のいずれも 0 件。インストーラーは圧縮されているため、中身の走査には限りがある(EXE 本体は圧縮されていない) |
| 7 | SHA-256 | **通過** | PowerShell の `Get-FileHash`(ビルドのスクリプトとは別の手段)で3ファイルを再計算し、`SHA256SUMS.txt` と全件一致(大文字小文字を除く) |
| 8 | バージョン情報 | **通過** | 2. |
| 9 | Windows Defender | **通過(新しい検出 0 件)** | Defender は有効(AMService、Antivirus、リアルタイム保護とも有効。署名 1.463.66.0、2026-11-01 更新)。成果物のコピー(`.local-evaluation/v141-defender-copy-b/`)のフォルダー全体と各 EXE・ZIP に `Start-MpScan -ScanType CustomScan`。スキャンは完了し、`Get-MpThreatDetection` の件数は前後で 1 件のまま(この PC に以前からある 2024 年の別のフォルダーの検出で、今回の成果物とは無関係) |
| 10 | 必須ゲート | **通過** | 下の表 |
| 11 | 画面の資産の走査 | **通過** | ビルドに使ったコミットから作り直した `dist/`(6 ファイル、`.map` 0 件)を走査(上の 6. と同じパターン)。0 件。限界は v1.4.0 と同じ(作り直した出力の確認で、EXE の中から取り出した資産そのものの照合ではない) |
| 12 | インストーラー画像と言語ファイル(P95-03・P95-03b) | **通過(ビルドの出力で確認)** | `tauri.conf.json` に `installerIcon`、`sidebarImage`、`uninstallerIcon`、`customLanguageFiles`(English、Japanese)がある。ビルドの `installer.nsi` が `SIDEBARIMAGE`(`nsis-sidebar.bmp`)、`INSTALLERICON`、`UNINSTALLERICON` を参照し、`headerImage` は空。**ビルドの出力 `src-tauri/target/release/nsis/x64/Japanese.nsh`、`English.nsh`(BOM つき)は、リポジトリのファイルと BOM を除いて一致**(`diff`)。どちらも、`LangString` の行に `{{product_name}}` は 0 件(P95-03b)で、新しい `unableToUninstall` の文言(P95-03)が入っている。P95-03b の確認(小さな NSIS スクリプトで、3つの文字列が「Life Launcher」を含む文として出る)は `docs/phase9.5/03b-installer-product-name.md`。**インストーラーを実行しての画面の確認は、オーナー確認待ち**(9. C の 4・4b・5) |
| 13 | 公開スクリーンショット | **通過(変更なし)** | `npm.cmd run screenshot:public` を再実行。`main-dashboard.png`、`instruction-viewer.png` は画素単位で同一。`dictionary.png`(7 画素)と `contact-sheet.png`(2 画素)は、1回目に数画素だけ違ったが、**もう一度再生成すると 0 画素になった**(再生成のたびに、ごく小さな描画の揺れがある。製品の変更ではない)。見た目は変わらないので、コミット済みの画像のまま変えていない。合成データだけで、個人データ、パス、ノートは写っていない |
| 14 | CI(`windows-latest`) | この PR の CI の結果は、push 後に報告に書く(下の「CI」) | |

### 必須ゲート(`release/v1.4.1`、ビルドに使ったコミット)

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3585ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | **541件すべて通過**、140 秒。**落ちたテストはなかった** |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

## 6. 依存関係の情報警告(据え置き)

Rust の情報警告 11 件は、v1.4.0 と同じ ID・同じ内訳で、`Cargo.lock` の依存は変わっていない(`docs/release/v1.4.0/FINAL-RELEASE-DECISION.md` の 7.)。いずれも「脆弱性」ではなく「メンテナンス終了」「健全性の注意」の情報。Tauri の更新と一緒に見直す。

## 7. 完了条件の確認

| 条件 | 結果 |
| --- | --- |
| バージョン情報がすべて 1.4.1 で一致する | 一致(2.) |
| 成果物とハッシュがそろい、リリースゲートがすべて通る | そろった。ゲートはすべて通った(`npm audit` はオーナー判断で受け入れ、5. の #1) |
| ネイティブ確認の結果が項目ごとに記録されている | 記録した(9. C。2026-11-01 の確認結果) |
| `native-checklist.md` がある | `docs/release/v1.4.1/native-checklist.md`(4b、2f、2e の項目を足した。確認結果を 2026-11-01 付で記録した) |
| 公開手順が、承認後にそのまま実行できる形で書かれている | 8.(新しいハッシュ、ビルドコミット `afc608c`) |

## 8. 承認後の公開手順

オーナーの明示承認があるまで、次は**実行しない**(PowerShell で上から順に実行する)。各コマンドは、実行のたびに終了コードを確かめ、0 でなければそこで止める。次のコマンドは、公開に使う前に、その時点の状態で読み直す。

### 8.1 マージの前の確認

1. `release/v1.4.1` の HEAD が、オーナーが承認したコミットであること。PR #137 の CI(`verify`)がそのコミットで成功していること。
2. タグ `v1.4.1` と GitHub Release が無いこと。`gh release view` は、「release not found」以外の失敗(認証・通信など)を「無い」と判断しない。
3. `release-candidate/v1.4.1/` の3ファイルの SHA-256 が、4. と一致すること。**一致しなければ停止する**(作り直さない。オーナーに報告する)。
4. オーナーの実機確認(9. C)の結果が、`native-checklist.md` に書かれていること。

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$candidate = Join-Path $repo "release-candidate/v1.4.1"
git fetch origin
$head = (git rev-parse origin/release/v1.4.1).Trim()   # オーナーが承認したコミットと同じか確かめる
gh pr view 137 --json state,headRefOid,statusCheckRollup
git ls-remote --tags origin refs/tags/v1.4.1           # 何も出ないこと
gh release view v1.4.1                                  # "release not found" になること(ほかの失敗は停止)
Get-ChildItem "$candidate/*" -Include *.exe,*.zip | Get-FileHash -Algorithm SHA256   # 4. と照合
```

### 8.2 マージ

```powershell
gh pr merge 137 --merge --match-head-commit $head
```

### 8.3 マージの後の確認

1. マージ後の `main` と、ビルドに使ったコミット `afc608c` の差分が**文書だけ**であること。製品のファイル(`src/`、`src-tauri/`、`package.json`、ロックファイルなど)の差分が1つでもあれば停止する。
2. マージ後の `main` の CI が成功していること。

```powershell
git fetch origin
$unexpected = @(git diff --name-only afc608c origin/main |
  Where-Object { $_ -notmatch '^docs/|^README(?:\.en)?\.md$|^CHANGELOG\.md$' })
if ($unexpected.Count) { throw "main の製品差分を確認するまで停止: $unexpected" }
$releaseCommit = (git rev-parse origin/main).Trim()
gh run list --branch main --commit $releaseCommit --json status,conclusion,name   # 成功を確認
```

### 8.4 タグ

```powershell
git tag -a v1.4.1 $releaseCommit -m "Life Launcher v1.4.1"
git push origin refs/tags/v1.4.1
```

### 8.5 下書きの Release

アセットは次の4つだけ。

```powershell
$assets = @(
  "Life-Launcher-v1.4.1-windows-x64-setup.exe",
  "Life-Launcher-v1.4.1-windows-x64.exe",
  "Life-Launcher-v1.4.1-windows-x64-portable.zip",
  "SHA256SUMS.txt"
) | ForEach-Object { Join-Path $candidate $_ }
gh release create v1.4.1 @assets --verify-tag --draft --title "Life Launcher v1.4.1" --notes-file docs/releases/v1.4.1.md
```

### 8.6 下書きの確認

新しい空のフォルダーへダウンロードし、ハッシュを、公開した `SHA256SUMS.txt` と、この判定書の 4. の**両方**と照合する。アセットが4つだけであること。

```powershell
$download = Join-Path $repo ".local-evaluation/v141-redownload"
if (Test-Path $download) { throw "新しい空の検証先を用意する" }
gh release download v1.4.1 --dir $download
Get-ChildItem "$download/*" -Include *.exe,*.zip | Get-FileHash -Algorithm SHA256
```

### 8.7 公開

```powershell
gh release edit v1.4.1 --draft=false
gh release view v1.4.1 --json tagName,url,isDraft
```

### 8.8 公開後の確認(必須)

- もう一度、**新しい空のフォルダー**へダウンロードし、8.6 と同じ照合(公開した `SHA256SUMS.txt` と、4. の `d70c268b…27a`、`69afc8c1…0c2`、`4d43996a…dcd`)をする。
- ダウンロードした単体 EXE と、ポータブル ZIP を展開した EXE が起動し、メイン画面が出ること(オーナーの PC で起動してよい。起動中の Life Launcher があれば、先に完全に終了する。自動起動の登録・ウィンドウの位置・WebView2 のデータは普段の場所に触れる)。
- `releases/latest` が v1.4.1 を指すこと。README のダウンロードの説明と、実際のファイル名が合っていること。
- `gh release view` だけで、起動やリンクの確認を済ませたことにしない。

### 8.9 記録

`docs/release/v1.4.1/PUBLIC-RELEASE-REPORT.md` に、マージのコミット、タグ、Release の URL、照合したハッシュ、起動の確認を書く(v1.4.0 と同じ形式)。

### 8.10 失敗したとき

アップロード・照合・起動のどれかが失敗したら、**下書きのまま止めて**オーナーに報告する。成果物を作り直さない。別の空の取得先で再確認し、通信の問題と候補の問題を分ける。タグの付け直し(force)と、アセットの無条件の上書き(`--clobber`)をしない。公開した後に問題が分かった場合も、オーナーの判断なしにタグや配布物を差し替えない。

### 8.11 Web Demo

v1.4.0・v1.4.1 の変更の Web Demo への反映は、別の判断(この判定書の範囲外)。公開しない。

## 9. ネイティブ確認(Windows 実機)

### A. 前回(v1.4.0)の実機確認

v1.4.0 のオーナーの実機確認の結果は `docs/release/v1.4.0/FINAL-RELEASE-DECISION.md` の 9.。今回のビルドの確認ではないので、ここでは引き継がない。また、P95-05 のビルド(前回の候補)について、オーナーが確認した項目はない(確認結果は 1 件も記録されていない)ので、引き継ぐものもない。

### B. 実装担当が行うはずだった確認(未実施)

| # | 項目 | 結果 | 理由 |
| --- | --- | --- | --- |
| 1 | 単体 EXE の起動(自己終了用の環境変数で終了させる) | **未実施** | オーナーの実際のアプリ(v1.4.0)が起動中の可能性がある。手順書の「実際のアプリが起動中なら起動しない」に従った。`APPDATA` の切り替えでは、自動起動の登録・ウィンドウの位置・WebView2 のデータの隔離にならず、同じ識別子のアプリを2つ起動すると干渉するため |
| 2 | ポータブル(ZIP 展開後の EXE)の起動 | **未実施** | 同上 |
| 3 | コピーしたプロファイルでの起動とデータの保持 | **未実施** | 同上 |

起動中のアプリを終了させることはしていない(オーナーのデータ・作業に触れるため)。**未実施のまま。8.8 の起動確認で代える**(P95-06)。

### C. 実機確認の結果(2026-11-01)

手順と期待結果は `docs/release/v1.4.1/native-checklist.md`。確認したのは **4. のハッシュのビルド**(`release-candidate/v1.4.1/`)。確認日は 2026-11-01。

確認した人の書き方: 「Claude(画面操作)」= オーナーの PC で、`release-candidate/native-check/launch-v141-isolated.bat` から起動したテスト用のアプリを、Claude が画面を見ながら操作した(表示サイズは「大」)。「オーナー」= オーナーが自分で確認した。

| # | 結果 | 確認した人と内容 |
| --- | --- | --- |
| 1 | PASS(一部は自動テスト) | Claude(画面操作): Do Now からの開始、拡大タイマー・サイドバー・ミニでの一時停止と再開で、通知は出なかった。1分以上で終了したときの「記録しました」は実機では確かめていない。自動テスト `phase95-timer-toast-clock.spec.ts` の「the record result toast stays after finishing a 1+ minute timer」で確認済み |
| 2 | PASS | Claude(画面操作): 拡大タイマーで一時停止・再開を24回続けて押した。時計は巻き戻らず、一定の速さで減り続け、一時停止中は止まったままだった。サイドバーで7回続けて押した後も、サイドバーと Do Now のカードの時間が一致し、一時停止中は止まり、再開すると続きから減った。ミニでも、一時停止で止まり、時間は正しかった(下の「確認中に分かったこと」も参照) |
| 2b | PASS(「大」は実機、「標準」「特大」は自動テスト) | Claude(画面操作): 「大」で、メインと記録の上部メニューの大きさと位置が同じだった。「標準」「特大」は自動テスト「the top menu has the same size and place in Main and Records」で確認済み |
| 2c | PASS | Claude(画面操作): 「プロジェクト別(今週)」の日付と「すべての記録」の右端が、下の枠の中の「1分」の右端とそろっていた。「今週の重点」の「2/3」も内側に入っていた |
| 2d | PASS(起動直後は自動テスト) | Claude(画面操作): 空の勝利条件にマウスを乗せると、枠だけが金色に強まり、「今日はこれができれば勝ち」の文字は光らなかった。起動直後に光らないことは、自動テスト「no frame reaction or ring for the automatic focus」で確認済み |
| 2f | PASS(「大」は実機、「標準」「特大」は自動テスト) | Claude(画面操作): 「大」で、4つの見出し(今日の3件、次の一手、やりたいこと、今日の実行)の件数の始まりが縦にそろっていた。「今日の実行」と件数の間はやや狭いが、読みにくくはない。「標準」「特大」は自動テスト「the four section bars start their counts at the same x」で確認済み |
| 2e | PASS(日本語 IME オンでの操作は未確認) | Claude(画面操作): ↓で欄を順に移動し、数字は変わらなかった。黄色い輪は実画面ではっきり見えた。数字の欄で Enter を押すと入力が始まり、↑で 5 が 6 になった。Esc で 5 に戻って入力だけが終わり、設定画面は開いたままだった。続けて ↓ で次の欄へ移動できた。もう一度 Esc を押すと設定画面が閉じ(保存されない)、焦点は「設定」ボタンに戻った。表示サイズのボタンも ↓ で移動でき、移動しただけでは選択は変わらなかった。日本語 IME オンでの操作は実機で確かめていない。オーナー判断で、v1.4.1 の公開を止める理由にしない(2026-11-01) |
| 3 | PASS | Claude(画面操作): 上以外の見た目に、v1.4.0 からの変化は見当たらなかった |
| 4 | PASS | オーナー: インストーラーで v1.4.0 から更新でき、設定と記録が残った |
| 4b | PASS | オーナー: v1.4.0 を起動したまま v1.4.1 のインストーラーを動かすと、「Life Launcher は動作中です。…」と出て、`{{product_name}}` は出なかった。OK を押すとアプリが終了して更新が続いた |
| 5 | 未実施(任意) | 行っていない |

確認中に分かったこと(v1.4.1 の公開は止めない。オーナー判断 2026-11-01):

- ミニタイマーの一時停止・再開ボタンを素早く2回押すと、メイン画面に戻る。ミニタイマーの「ダブルクリックでメインに戻る」(`App.tsx` の `miniShell` の `onDoubleClick`、仕様 `current-spec.md` の「ダブルクリックまたは拡大操作でメインへ戻る」)が、ボタンの上のダブルクリックにも反応するため。時間はずれない。v1.4.0 からの動きで、v1.4.1 の変更によるものではない
- 次の版の候補: ボタンなど操作できる部品の上のダブルクリックでは、メインに戻らないようにする

## 10. 既知の制限

- UI は日本語中心で、英語対応は主に上部ツールバーなどの一部。
- URL は Windows の既定ブラウザで開く。
- ブックマーク名の取得は、ローカルのブラウザープロファイルを読める場合に限る。
- HTML 手順書は、静的な HTML/CSS と登録したフォルダー内の相対 asset だけを表示する。
- 配布バイナリは未署名で、Windows SmartScreen の警告が出ることがある。WebView2 Runtime が必要。自動アップデーターはない。
- 以前のインストールの登録情報だけが残っている PC では、「インストールする前にアンインストールする」が出る(Tauri 標準のインストーラーの動き)。v1.4.1 では、選んだときの案内を、原因と対処が分かる文言に変えた(P95-03)。メッセージボックスの実際の見た目は、確認していない(9. C の 5 は任意で、未実施)。
- **タイマーの開始・一時停止は、スクリーンリーダーでは自動で読み上げない(画面の表示で示す)**。通知をやめたため(P95-01)。オーナー判断(2026-10-31)で、このままにする。公開文書(リリースノート)の既知の制限にも書いた。
- 達成済みの勝利条件の枠は、Main で 0.72 ではなく 0.42 の濃さのまま(v1.4.0 から)。
- Rust の依存の情報警告 11 件(6.)。
- 開発用ツール(ESLint の依存)の minimatch の助言(5. の #1)。配布物には入らない。オーナー判断で受け入れ(2026-10-31)。
- Web Demo は v1.4.0 以降の変更を反映していない。
- 切り離した環境での、配布 EXE の独立した起動確認は行っていない(v1.4.0 の R1 と同じ。オーナーの実機確認で代える)。
- 日本語 IME をオンにしたままの設定画面の操作は、実機で確かめていない(9. C の 2e)。オーナー判断(2026-11-01)で、公開を止める理由にしない。
- ミニタイマーの一時停止・再開ボタンを素早く2回押すと、メイン画面に戻る(ミニタイマーの「ダブルクリックでメインに戻る」がボタンの上にも反応するため。時間はずれない。v1.4.0 からの動き。9. C の「確認中に分かったこと」)。

## 11. この Stage で、行わなかったこと

tag、GitHub Release、アセットのアップロード、Web Demo の deploy、`main` へのマージ(PR #137)。成果物の起動確認(9. B)。オーナーの実際のアプリの終了・操作。ESLint の更新。

## 12. 次の版で行うこと(v1.4.2 以降)

- 開発用ツール(ESLint、`@typescript-eslint/*`)を更新して、`npm audit` を 0 件に戻す(5. の #1)。
- 正式スクリプト(`scripts/prepare-release-candidate.ps1`)に、ビルドしたコミット、作業ツリーがきれいだったか、Node・Rust・Tauri CLI のバージョン、ビルド直後のハッシュを記録させる(v1.4.0 の R6)。
- テスト用の起動(`launch-v141-isolated.bat`)で、普段のアプリの自動起動の登録・ウィンドウの位置・WebView2 のデータに触れない方法を用意する(v1.4.0 の R1)。
- 「今日を組み立てる」の旧い JSX(`legacyTodayBuilderVisible()`)とその CSS を削除する(P95-02 の提案)。
- 設定画面の ↑ で、最初の項目から選択中のタブへ戻るようにする(P95-04 の提案)。
- 計算後のスタイルの比較スクリプト(P95-02)を、リポジトリに入れるか決める。
- `@tauri-apps/cli` を更新するときは、言語ファイル(`Japanese.nsh`、`English.nsh`)を新しい元のファイルから写し直し、`unableToUninstall`(P95-03)と、`{{product_name}}` の3か所(P95-03b)を再び直す。
- Rust の依存の情報警告 11 件を、Tauri の更新と一緒に見直す。
- ボタンなど操作できる部品の上のダブルクリックでは、ミニタイマーがメインに戻らないようにする(9. C の「確認中に分かったこと」)。
- 日本語 IME オンでの設定画面の操作を、実機で確かめる(9. C の 2e)。
- 公開スクリーンショットの再生成で出る、数画素の描画の揺れ(5. の #13)を、差分の判定が「画素単位で同一」を前提にしないようにする(許容の画素数を決める)。
