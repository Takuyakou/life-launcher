# Life Launcher v1.4.1 Final Release Decision

**BLOCKED**(オーナーの判断待ち。理由は1つで、`npm audit` が新しい脆弱性の助言を報告したこと〔5. の #1〕。ほかのゲートはすべて通っている。オーナーが下の「選択肢」で承認すれば、`READY FOR USER APPROVAL` に変える)

- 日付: 2026-10-31(JST)に作成。
- 候補のソース: ブランチ `release/v1.4.1`、コミット `8a7189677a90cb136f963e71896a4dec98d4df53`(`main` = `bd9b90a`〔PR #136、P95-04 のマージ〕+ バージョン・公開文書・公開スクリーンショット)。**ビルドした時点の作業ツリーはきれい**(`git status --porcelain` は、無関係の未追跡ファイル `voicing-loop-current-chord-panel-mock.html` だけ)。この後に足すコミットは、この判定書と `native-checklist.md` だけで、成果物には含まれない(`git diff --name-only 8a71896 HEAD` で確認する)。
- PR: #137(`release/v1.4.1` → `main`)。マージしていない。
- config schema: 3(v1.4.0 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、Windows 11 Home 10.0.26200(x64)、`@tauri-apps/cli` 2.11.4(`tauri-bundler` 2.9.4)。Rust は `rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 選択肢(オーナーの判断)

`npm audit` の助言(GHSA-g3hv-75wg-m249、minimatch の DoS、moderate)は、**配布物に入らない開発用ツール(ESLint とその依存)にだけ**ある。`npm audit --omit=dev` は 0 件。Rust 側の脆弱性も 0 件。手順書の「新しい脆弱性があれば停止」に従って止めたが、次のどちらかで進められる。

1. **開発用ツールの助言として受け入れて公開する(推奨)**: 配布物に入らず、利用者に影響しない。修正版の minimatch 11 は ESLint 8 の依存と合わない(「No fix available」)。ESLint の更新は、ツールの大きな変更になるので v1.4.1 では行わない。この判定書の 5. #1 に「受け入れ(オーナー判断)」と書き、次の版で ESLint の更新を検討する。
2. **ESLint 一式を更新してから公開する**: v1.4.1 の範囲を超える(ツールの設定、ルール、テストへの影響を見る必要がある)。成果物は作り直すことになる。

## 1. 判定の要約

- バージョン情報は、すべて 1.4.1 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` を、正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- 必須ゲートは通った(5.)。`test:visual` は 541 件すべて通過(落ちたテストなし)。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #9)。
- 画面の項目のネイティブ確認(9.)は、**まだ行っていない**(オーナー確認待ち)。実装担当による成果物の起動確認も、オーナーの実際のアプリ(v1.4.0)が起動中だったため行っていない(9. B)。
- 唯一の停止の理由は、`npm audit` の新しい助言(開発用ツールだけ。5. の #1)。

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

## 3. v1.4.0 からの変更(Phase 9.5)

詳細は `docs/phase9.5/` の各報告。

| Stage | 内容 | 報告 |
| --- | --- | --- |
| P95-01(PR #133) | タイマーの開始・一時停止の通知をやめた。一時停止・再開の時計の巻き戻りを修正。上部メニューを記録画面でも同じ大きさにした。記録画面の見出しの右の余白。未入力の勝利条件のホバー。メインの4つの見出しの件数の位置をそろえた | `01-timer-toast-clock.md` |
| P95-02(PR #134) | 使っていない CSS を整理した(65クラス、変数1個)。見た目の変化なし(49画面・579,427 要素で計算後のスタイルが同一) | `02-unused-css.md` |
| P95-03(PR #135) | インストーラーの「アンインストールできません。」に原因と対処の案内を出す(日本語・英語の言語ファイル) | `03-installer-message.md` |
| P95-04(PR #136) | 設定画面を十字キーと Enter で操作できるようにした | `04-settings-keyboard.md` |

データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。公開文書(CHANGELOG、リリースノート、README 2種、OVERVIEW、仕様書)に反映した。P95-02 は「内部の整理。見た目の変化なし」と1行で書いた。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.4.1/`(`.gitignore` 済み。リポジトリには入れていない)。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.1-windows-x64-setup.exe` | 3,726,810 | `1f213cee501ccb422b7520d50d4a0c23fd3ffb3c83902f24fc9469cee0dcb04f` |
| `Life-Launcher-v1.4.1-windows-x64.exe` | 16,051,200 | `2f45647a056c7ca787e7ac494bffcf368ee77caaee615ff621520489a3d1574c` |
| `Life-Launcher-v1.4.1-windows-x64-portable.zip` | 5,070,272 | `f3d7fc2a5e51070d5871c5095bbc2e21980d6e021264507cceeae184a6c8e668` |
| `SHA256SUMS.txt` | 327 | (上の3行。大文字で書かれている) |
| `release-notes.md` | 6,273 | `docs/releases/v1.4.1.md`、`docs/release/v1.4.1/release-notes.md` と同一(`diff` で確認) |

作り方: 既存の正式スクリプト `scripts/prepare-release-candidate.ps1`(終了コード 0)。上のコミットのソース、パスの置換つきの release ビルド。

## 5. リリースゲートの証跡(前回の結果は流用していない。確かめた人: 実装担当〔Claude〕)

| # | ゲート | 結果 | 証跡 |
| --- | --- | --- | --- |
| 1 | 依存関係(npm) | **停止(オーナー判断待ち)** | `npm.cmd audit --audit-level=low`: 15 件(moderate)、終了コード 1。すべて同じ助言 GHSA-g3hv-75wg-m249(minimatch の DoS〔globparts の増幅〕、CVE-2026-118764)から連なる開発用ツールの依存(`eslint`、`@typescript-eslint/*`、`glob`、`rimraf` など)。**`npm audit --omit=dev`(配布物に入る依存)は 0 件**。修正は minimatch 11 以降だが、ESLint 8 の依存とは合わず、「No fix available」。v1.4.0 のときは 0 件だった(助言が新しく出た)。minimatch はビルドに使う道具で、配布物の EXE・ZIP・インストーラーには入らない |
| 2 | 依存関係(Rust) | **通過**(脆弱性 0 件、情報警告 11 件は据え置き) | `cargo audit` 終了コード 0、`allowed warnings` 11 件。ID は v1.4.0 と同じ 11 個(RUSTSEC-2024-0370 / 0429、2025-0075 / 0080 / 0081 / 0098 / 0100、2026-0370 / 0371 / 0372 / 0386)。`Cargo.lock` は version 以外変わっていない。内訳と据え置きの理由は `docs/release/v1.4.0/FINAL-RELEASE-DECISION.md` の 7. と同じ |
| 3 | 公開安全 | **通過** | `npm.cmd run public:check`: 3584 ファイル、blocker 0 |
| 4 | 公開文書の横断確認 | **通過** | README、README.en.md、CHANGELOG、`docs/releases/v1.4.1.md`、仕様書、OVERVIEW のバージョンが 1.4.1 で一致。P95-01〜04 の内容が CHANGELOG、リリースノート(2つの控えは同一)、README、README.en.md にある。配布ファイル名、config schema `3`、Web Demo が別公開工程であることは、すべての文書で同じ。`readme-contract` のテストも通っている |
| 5 | ポータブル ZIP | **通過** | 中身は `Life-Launcher-v1.4.1-windows-x64.exe` と `README.txt` の2つだけ。ZIP 内の EXE の SHA-256 が単体 EXE と一致(`2f45647a…74c`) |
| 6 | 秘密情報・パスの走査 | **通過** | 単体 EXE、ZIP 内 EXE、インストーラー、ZIP を ASCII と UTF-16LE で走査。`C:\Users\`、`D:\dev\`、`D:/dev/`、`Life Launcher-dev`、開発者のユーザー名(2種類)、`Takuyakou\`、秘密鍵ヘッダー(RSA、OPENSSH、PRIVATE KEY、EC)、トークン接頭辞(`ghp_`、`github_pat_`、`gho_`、`AKIA`、`xoxb-`、`xoxp-`、`sk-ant-`)、`sourceMappingURL`、`.js.map` のいずれも 0 件。インストーラーは圧縮されているため、中身の走査には限りがある(EXE 本体は圧縮されていない) |
| 7 | SHA-256 | **通過** | PowerShell の `Get-FileHash`(ビルドのスクリプトとは別の手段)で3ファイルを再計算し、`SHA256SUMS.txt` と全件一致(大文字小文字を除く) |
| 8 | バージョン情報 | **通過** | 2. |
| 9 | Windows Defender | **通過(新しい検出 0 件)** | Defender は有効(AMService、Antivirus、リアルタイム保護とも有効。署名 1.463.52.0、2026-10-31 更新)。成果物のコピー(`.local-evaluation/v141-defender-copy/`)のフォルダー全体と各 EXE・ZIP に `Start-MpScan -ScanType CustomScan`。スキャンは完了し、`Get-MpThreatDetection` の件数は前後で 1 件のまま(この PC に以前からある 2024 年の別のフォルダーの検出で、今回の成果物とは無関係) |
| 10 | 必須ゲート | **通過** | 下の表 |
| 11 | 画面の資産の走査 | **通過** | ビルドに使ったコミットから作った `dist/` を走査(上の 6. と同じパターン)。0 件、`.map` ファイル 0 件。限界は v1.4.0 と同じ(作り直した出力の確認で、EXE の中から取り出した資産そのものの照合ではない) |
| 12 | インストーラー画像と言語ファイル(P95-03) | **通過(ビルドの出力で確認)** | `tauri.conf.json` に `installerIcon`、`sidebarImage`、`uninstallerIcon`、`customLanguageFiles`(English、Japanese)がある。ビルドの `installer.nsi` が `SIDEBARIMAGE`(`nsis-sidebar.bmp`)、`INSTALLERICON`、`UNINSTALLERICON` を参照し、`headerImage` は空。ビルドで使われた `Japanese.nsh`、`English.nsh` は、リポジトリのファイルと BOM を除いて一致(`cmp`)で、新しい `unableToUninstall` の文言が入っている。**インストーラーを実行しての画面の確認は、オーナー確認待ち**(9. C の 4・5) |
| 13 | 公開スクリーンショット | **通過** | `npm.cmd run screenshot:public` を再実行。変わったのは `main-dashboard.png`(3,944 画素、x 379〜670、y 351〜597)と `contact-sheet.png`(4,150 画素、x 45〜629、y 395〜929)だけで、どちらも4つの見出しの件数の位置の変化(P95-01)の範囲。`dictionary.png`、`instruction-viewer.png` は画素単位で同一。`web-demo.png` は再生成の対象外。合成データだけで、個人データ、パス、ノートは写っていない。変わった2枚をコミットした |
| 14 | CI(`windows-latest`) | この PR の CI の結果は、push 後に報告に書く(下の「CI」) | |

### 必須ゲート(`release/v1.4.1`、ビルドに使ったコミット)

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3584ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | **541件すべて通過**(P95-01 の 32 件、P95-04 の 10 件を含む)、131 秒。**落ちたテストはなかった** |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

## 6. 依存関係の情報警告(据え置き)

Rust の情報警告 11 件は、v1.4.0 と同じ ID・同じ内訳で、`Cargo.lock` の依存は変わっていない(`docs/release/v1.4.0/FINAL-RELEASE-DECISION.md` の 7.)。いずれも「脆弱性」ではなく「メンテナンス終了」「健全性の注意」の情報。Tauri の更新と一緒に見直す。

## 7. 完了条件の確認

| 条件 | 結果 |
| --- | --- |
| バージョン情報がすべて 1.4.1 で一致する | 一致(2.) |
| 成果物とハッシュがそろい、リリースゲートがすべて通る | 成果物とハッシュはそろった。ゲートは、**#1(npm audit)を除いて通った**。#1 はオーナー判断待ち |
| ネイティブ確認の結果が項目ごとに記録されている(画面の項目は「オーナー確認待ち」) | 記録した(9.) |
| `native-checklist.md` がある | `docs/release/v1.4.1/native-checklist.md` |
| 公開手順が、承認後にそのまま実行できる形で書かれている | 8. |

## 8. 承認後の公開手順

オーナーの明示承認があるまで、次は**実行しない**(PowerShell で上から順に実行する)。各コマンドは、実行のたびに終了コードを確かめ、0 でなければそこで止める。次のコマンドは、公開に使う前に、その時点の状態で読み直す。承認する前に、5. の #1 についての判断を、この判定書に書き足す。

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
Get-ChildItem $candidate -File -Include *.exe,*.zip | Get-FileHash -Algorithm SHA256   # 4. と照合
```

### 8.2 マージ

```powershell
gh pr merge 137 --merge --match-head-commit $head
```

### 8.3 マージの後の確認

1. マージ後の `main` と、ビルドに使ったコミット `8a71896` の差分が**文書だけ**であること。製品のファイル(`src/`、`src-tauri/`、`package.json`、ロックファイルなど)の差分が1つでもあれば停止する。
2. マージ後の `main` の CI が成功していること。

```powershell
git fetch origin
$unexpected = @(git diff --name-only 8a71896 origin/main |
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
Get-ChildItem $download -File | Get-FileHash -Algorithm SHA256
```

### 8.7 公開

```powershell
gh release edit v1.4.1 --draft=false
gh release view v1.4.1 --json tagName,url,isDraft
```

### 8.8 公開後の確認(必須)

- もう一度、**新しい空のフォルダー**へダウンロードし、8.6 と同じ照合(公開した `SHA256SUMS.txt` と、4. の `1f213cee…4c`、`2f45647a…74c`、`f3d7fc2a…668`)をする。
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

v1.4.0 のオーナーの実機確認の結果は `docs/release/v1.4.0/FINAL-RELEASE-DECISION.md` の 9.。今回のビルドの確認ではないので、ここでは引き継がない。

### B. 実装担当が行うはずだった確認(未実施)

| # | 項目 | 結果 | 理由 |
| --- | --- | --- | --- |
| 1 | 単体 EXE の起動(自己終了用の環境変数で終了させる) | **未実施** | オーナーの実際のアプリ(v1.4.0、`D:\アプリケーション\Life-Launcher-v1.4.0-windows-x64.exe`)が**起動中**だった。手順書の「実際のアプリが起動中なら起動しない」に従った。`APPDATA` の切り替えでは、自動起動の登録・ウィンドウの位置・WebView2 のデータの隔離にならず、同じ識別子のアプリを2つ起動すると干渉するため |
| 2 | ポータブル(ZIP 展開後の EXE)の起動 | **未実施** | 同上 |
| 3 | コピーしたプロファイルでの起動とデータの保持 | **未実施** | 同上 |

起動中のアプリを終了させることはしていない(オーナーのデータ・作業に触れるため)。オーナーが v1.4.0 を完全に終了したら、実装担当が上の3つを行える(自動起動の登録は、手順書のとおり、一時プロファイルの `settings.autoStart` を今の登録の状態に合わせる。現在、`HKCU\...\Run` に `Life Launcher` の登録があり、`StartupApproved\Run` は有効〔0x02〕で、実際の `config.json` の `autoStart` は `false`)。

### C. オーナーが確認すること(オーナー確認待ち)

手順と期待結果は `docs/release/v1.4.1/native-checklist.md`。確認の状態は全項目が **オーナー確認待ち**(PASS とは書かない)。

| # | 項目 | 状態 |
| --- | --- | --- |
| 1 | タイマーの開始・一時停止で通知が出ない。1分以上で終了すると「記録しました」が出る | オーナー確認待ち |
| 2 | 拡大タイマーで一時停止・再開を連打しても時計が巻き戻らない(サイドバー Timer、ミニも) | オーナー確認待ち |
| 2b | 大・特大で、メインと記録を行き来しても上部メニューの大きさが変わらない | オーナー確認待ち |
| 2c | 記録画面の見出しの右の文字が、下の枠の中の文字とそろっている | オーナー確認待ち |
| 2d | 空の勝利条件に、マウスを乗せると枠だけが反応する。起動直後は光らない | オーナー確認待ち |
| 2f | メインの4つの見出しで、件数の始まりが縦にそろっている | オーナー確認待ち |
| 2e | 設定画面を十字キーと Enter で操作できる | オーナー確認待ち |
| 3 | 上以外の見た目が v1.4.0 と変わっていない | オーナー確認待ち |
| 4 | インストーラーで v1.4.0 から更新でき、設定と記録が残る | オーナー確認待ち |
| 5 | (任意)以前のインストールの情報だけが残っている状態で、新しい案内が出る | オーナー確認待ち(任意) |

実機での確認が必要な理由(自動テストで確かめられていないこと): 本物の WebView2 での見た目(黄色い輪とカーソルの見分け、フォント〔Yu Gothic UI〕での件数の位置)、スクリーンリーダー、実際のインストーラーのメッセージボックス(幅、折り返し)。

## 10. 既知の制限

- UI は日本語中心で、英語対応は主に上部ツールバーなどの一部。
- URL は Windows の既定ブラウザで開く。
- ブックマーク名の取得は、ローカルのブラウザープロファイルを読める場合に限る。
- HTML 手順書は、静的な HTML/CSS と登録したフォルダー内の相対 asset だけを表示する。
- 配布バイナリは未署名で、Windows SmartScreen の警告が出ることがある。WebView2 Runtime が必要。自動アップデーターはない。
- 以前のインストールの登録情報だけが残っている PC では、「インストールする前にアンインストールする」が出る(Tauri 標準のインストーラーの動き)。v1.4.1 では、選んだときの案内を、原因と対処が分かる文言に変えた(P95-03)。メッセージボックスの実際の見た目は、オーナー確認待ち(9. C の 5)。
- タイマーの開始・一時停止の通知をやめたため、スクリーンリーダーはそれを自動では読み上げない(ボタンの表示は変わらない。P95-01)。
- 達成済みの勝利条件の枠は、Main で 0.72 ではなく 0.42 の濃さのまま(v1.4.0 から)。
- Rust の依存の情報警告 11 件(6.)。
- 開発用ツール(ESLint の依存)の minimatch の助言(5. の #1)。配布物には入らない。
- Web Demo は v1.4.0 以降の変更を反映していない。
- 切り離した環境での、配布 EXE の独立した起動確認は行っていない(v1.4.0 の R1 と同じ。オーナーの実機確認で代える)。

## 11. この Stage で、行わなかったこと

tag、GitHub Release、アセットのアップロード、Web Demo の deploy、`main` へのマージ(PR #137)。成果物の起動確認(9. B)。オーナーの実際のアプリの終了・操作。

## 12. 次の版で行うこと(v1.4.2 以降)

- 開発用ツール(ESLint、`@typescript-eslint/*`)を更新して、`npm audit` を 0 件に戻す(5. の #1)。
- 正式スクリプト(`scripts/prepare-release-candidate.ps1`)に、ビルドしたコミット、作業ツリーがきれいだったか、Node・Rust・Tauri CLI のバージョン、ビルド直後のハッシュを記録させる(v1.4.0 の R6)。
- テスト用の起動(`launch-v141-isolated.bat`)で、普段のアプリの自動起動の登録・ウィンドウの位置・WebView2 のデータに触れない方法を用意する(v1.4.0 の R1)。
- 「今日を組み立てる」の旧い JSX(`legacyTodayBuilderVisible()`)とその CSS を削除する(P95-02 の提案)。
- 設定画面の ↑ で、最初の項目から選択中のタブへ戻るようにする(P95-04 の提案)。
- 計算後のスタイルの比較スクリプト(P95-02)を、リポジトリに入れるか決める。
- `{{product_name}}` がそのまま表示されるインストーラーの文字列(`appRunning` など)を確かめる(P95-03 の提案)。
- `@tauri-apps/cli` を更新するときは、言語ファイル(`Japanese.nsh`、`English.nsh`)を新しい元のファイルから写し直す(P95-03)。
- Rust の依存の情報警告 11 件を、Tauri の更新と一緒に見直す。
