# Life Launcher v1.4.2 Final Release Decision

**READY FOR USER APPROVAL**(自動で確かめられるゲートはすべて通った、の意味。画面の項目のネイティブ確認〔9.〕は**オーナー確認待ち**で、PASS とは書いていない。公開は、オーナーの明示承認があるまで行わない)

- 日付: 2026-11-06(JST)
- 候補のソース: ブランチ `release/v1.4.2`、コミット `eaaf2d8bad2e8b908a0d186ca788138aedce38eb`(`main` = `2025088`〔PR #143、P96-03 のマージ〕+ バージョン・公開文書・公開スクリーンショット)。**ビルドした時点の作業ツリーはきれい**(`git status --porcelain` は、無関係の未追跡ファイル `.commandcode/` と `voicing-loop-current-chord-panel-mock.html` だけ。ビルド直前に記録)。ビルドの途中で `tauri build` が `src-tauri/Cargo.toml` の改行だけを書き換えたため、ビルド後に `git checkout --` で戻した(内容は同一。`git diff --numstat --ignore-cr-at-eol` が空)。この後に足すコミットは、この判定書と `native-checklist.md` だけで、成果物には含まれない(`git diff --name-only eaaf2d8 HEAD` で確認する)。
- PR: #144(`release/v1.4.2` → `main`)。マージしていない。
- config schema: 3(v1.4.1 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26200(x64)、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1。Rust は `rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.4.2 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- 必須ゲートは通った(5. の必須ゲート)。`test:visual` は 589 件すべて通過(落ちたテストなし)。
- `npm audit` は、オーナーが v1.4.1 で受け入れた助言(GHSA-g3hv-75wg-m249)と同じ 1 件だけ。**新しい助言はない**。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 11 件(v1.4.1 と同じ ID)と、yanked の警告 1 件(`async-executor`、ID なし)。`Cargo.lock` の依存は version 以外変わっていない。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #9)。
- **画面のネイティブ確認は未実施**(9.)。実装担当がコマンドで確かめられる範囲(成果物の起動、既存プロファイルでのデータの保持)だけを行い、画面の項目はオーナー確認待ちとした。
- 公開スクリーンショットは3枚が変わった(一体型ヘッダーで窓のボタンが増えたため)。公開用の画像にタイマーの線は写っていない(5. #13)。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.4.2 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.4.2 |
| `src-tauri/tauri.conf.json` | 1.4.2 |
| 単体 EXE の FileVersion / ProductVersion | 1.4.2 / 1.4.2(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.4.2 / 1.4.2 |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.4.2 / 1.4.2(単体 EXE と SHA-256 も一致) |
| README、README.en.md、CHANGELOG、`docs/releases/v1.4.2.md`、`docs/OVERVIEW.md`、`docs/spec/current-spec.md` | 1.4.2(1.4.1 の表記が残るのは、履歴と「v1.4.1 の変更」の節、更新の説明だけ) |

## 3. v1.4.1 からの変更(Phase 9.6)

詳細は `docs/phase9.6/` の各報告。

| Stage | 内容 | 報告 |
| --- | --- | --- |
| P96-01(PR #141) | メイン画面と手順書ビューアーの標準のタイトルバーをやめ、上部メニューの右端に窓のボタン(最小化・最大化・閉じる)を置く一体型ヘッダーにした。ドラッグできる範囲、窓の状態の保存(`decorated` を復元しない)、上部メニューの文字を幅の実測で隠す段階、窓のボタンの色、窓を戻した直後の乗せた色の残留の修正。初期幅 1080 → 1200 | `01-integrated-titlebar.md` |
| P96-02(PR #142) | メイン画面の窓の上端(高さ 2px)に、タイマーの進み具合を示す線を出す。実行中は `--accent`、一時停止中は `--warn`。計測と待機中は出さない | `02-timer-line.md` |
| P96-03(PR #143) | 手順書ビューアーを十字キーで操作できるようにした(開いたときの一覧フォーカス、→で本文、本文のスクロール、←で一覧、検索欄との行き来、ヘッダーのボタン間の移動)。「使い方」の「閉じる」を赤にし、文章を差し替えた | `03-viewer-keyboard-guide.md` |

データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。公開文書(CHANGELOG、リリースノート、README 2種、OVERVIEW、仕様書)に反映した。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.4.2/`(`.gitignore` 済み。リポジトリには入れていない)。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.2-windows-x64-setup.exe` | 3,729,805 | `4F8098CAB0A3817668A17D0594F87A7BEF7FEBF072B36D2B529A87BA8EA70907` |
| `Life-Launcher-v1.4.2-windows-x64.exe` | 16,066,048 | `FCC14FA393BCD6075D0160B434A07FC7DE1E0052F172F15AB584FB6497CB2F18` |
| `Life-Launcher-v1.4.2-windows-x64-portable.zip` | 5,069,101 | `7671958CD5D1B9F90EC5A0A0BE77874F334CCE6F9865BB18F17D5350CA5ABCFE` |
| `SHA256SUMS.txt` | 327 | (上の3行。大文字で書かれている) |
| `release-notes.md` | 7,124 | `docs/releases/v1.4.2.md`、`docs/release/v1.4.2/release-notes.md` と同一(SHA-256 `d572f233…7cdfd` で3つ一致) |

作り方: 既存の正式スクリプト `scripts/prepare-release-candidate.ps1`(終了コード 0。`scripts/package-windows-installer.ps1` → `scripts/package-windows.ps1`、パスの置換つきの release ビルド)。ビルドのログ: インストーラー `Life Launcher_1.4.2_x64-setup.exe` を作成 → `release-candidate/v1.4.2/` へコピー、単体 EXE、ポータブル ZIP、`release-notes.md`、`SHA256SUMS.txt` の順。

## 5. リリースゲートの証跡(前回の結果は流用していない。確かめた人: 実装担当)

| # | ゲート | 結果 | 証跡 |
| --- | --- | --- | --- |
| 1 | 依存関係(npm) | **通過(オーナー判断で受け入れ、2026-10-31)** | `npm.cmd audit --audit-level=low`: 終了コード 1、6 件(moderate)。内訳は `minimatch`(GHSA-g3hv-75wg-m249、globparts の増幅による DoS)と、それを取り込む `@typescript-eslint/*` の 5 件。**開発用ツールの依存だけ**で、`npm.cmd audit --omit=dev --audit-level=low` は 0 件(終了コード 0)。**新しい助言はない**。ESLint の更新は次の版で検討する(12.) |
| 2 | 依存関係(Rust) | **通過**(脆弱性 0 件、情報警告 12 件は据え置き) | `cargo audit` 終了コード 0、`allowed warnings` 12 件。内訳は v1.4.1 と同じ ID 11 個(RUSTSEC-2024-0370 / 0429、2025-0075 / 0080 / 0081 / 0098 / 0100、2026-0370 / 0371 / 0372 / 0386)と、**ID のない `async-executor 1.14.0` の yanked の警告 1 件**。`Cargo.lock` の依存は `life-launcher` の version 以外変わっていないので、yanked は今回の依存更新によるものではなく、助言データベース側の追加 |
| 3 | 公開安全 | **通過** | `npm.cmd run public:check`: 3598 ファイル、blocker 0 |
| 4 | 公開文書の横断確認 | **通過** | README、README.en.md、CHANGELOG、`docs/releases/v1.4.2.md`、仕様書、OVERVIEW のバージョンが 1.4.2 で一致(残る 1.4.1 は履歴・更新の説明だけ)。P96-01〜03 の内容が CHANGELOG、リリースノート(2つの控えは同一)にある。配布ファイル名、config schema `3`、Web Demo が別公開工程であることは、すべての文書で同じ。`readme-contract` のテスト(4件)も通っている |
| 5 | ポータブル ZIP | **通過** | 中身は `Life-Launcher-v1.4.2-windows-x64.exe` と `README.txt` の2つだけ。ZIP 内の EXE の SHA-256 が単体 EXE と一致(`fcc14fa3…b2f18`)。`README.txt` の版表記も 1.4.2 |
| 6 | 秘密情報・パスの走査 | **通過** | 単体 EXE、ZIP 内 EXE(展開したもの)、インストーラー、ZIP を ASCII と UTF-16LE で走査。`C:\Users\`、`D:\dev\`、`D:/dev/`、`Life Launcher-dev`、開発者のユーザー名、`Takuyakou\`、秘密鍵ヘッダー(RSA、OPENSSH、PRIVATE KEY、EC)、トークン接頭辞(`ghp_`、`github_pat_`、`gho_`、`AKIA`、`xoxb-`、`xoxp-`、`sk-ant-`)、`sourceMappingURL`、`.js.map` のいずれも 0 件。単体 EXE には `password` と `secret` の語が出るが、**同梱の英単語の一覧(uniq 用のデータ)と `glib` のパニックメッセージ(`has_authority means set_password shouldn't fail`)の中だけ**で、認証情報ではない(前後の文字列を確認)。インストーラーは圧縮されているため、中身の走査には限りがある(EXE 本体は圧縮されていない) |
| 7 | SHA-256 | **通過** | PowerShell の `Get-FileHash`(ビルドのスクリプトとは別の手段)で3ファイルを再計算し、`SHA256SUMS.txt` と全件一致。全文が 64 文字であることも確認 |
| 8 | バージョン情報 | **通過** | 2.(実ファイルの FileVersion / ProductVersion を読んで確認) |
| 9 | Windows Defender | **通過(新しい検出 0 件)** | Defender は有効(リアルタイム保護・ウイルス対策とも有効。署名 1.463.153.0、2026-11-06 更新)。成果物のコピー(`%TEMP%\p96-04-defender\`)のフォルダーへ `Start-MpScan -ScanType CustomScan`。スキャンは完了し、`Get-MpThreatDetection` の件数は前後で 1 件のまま(この PC に以前からある別の検出で、今回の成果物とは無関係) |
| 10 | 必須ゲート | **通過** | 下の表 |
| 11 | 画面の資産の走査 | **通過** | ビルドに使ったコミットから作り直した `dist/` の製品ファイル(6ファイル、`.map` 0 件)を走査(6. と同じパターン)。0 件。限界は v1.4.0・v1.4.1 と同じ(作り直した出力の確認で、EXE の中から取り出した資産そのものの照合ではない) |
| 12 | 権限の確認 | **通過** | `git diff v1.4.1..HEAD -- src-tauri/capabilities src-tauri/gen/schemas`: `default.json` に `core:window:allow-minimize`・`allow-toggle-maximize`・`allow-start-dragging` の3行、`instruction.json` に `core:window:allow-close`・`allow-minimize`・`allow-toggle-maximize`・`allow-start-dragging` の4行、生成物 `gen/schemas/capabilities.json` が1行。**P96-01 で足した窓の操作の権限だけ**で、ほかの権限は変わっていない |
| 13 | 公開スクリーンショット | **通過(3枚が変化)** | `npm.cmd run screenshot:public`(4件通過)。`main-dashboard.png`、`instruction-viewer.png`、`contact-sheet.png` が変化(一体型ヘッダーで窓のボタンが増えたため)。`dictionary.png` は変化なし。**どの画像にもタイマーの線は写っていない**(画像の上端 2 行の色が、その下と同じであることを画素で確認。公開用の画像はタイマーが動いていない状態)。合成データだけで、個人データ、パス、ノートは写っていない |
| 14 | CI(`windows-latest`) | **通過**(下の「CI」) | ビルドに使ったコミット `eaaf2d8` の `CI` |

### 必須ゲート(`release/v1.4.2`、ビルドに使ったコミット `eaaf2d8`)

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3598 ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | **589 件すべて通過**、約 2.3 分。**落ちたテストはなかった** |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 通過 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 通過 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | 通過 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 通過(132 件 + capability 契約 1 件) |
| `git diff --check` | 通過 |

### CI

- ビルドに使ったコミット `eaaf2d8` の `CI`(PR #144): **成功**(下の「CI の結果」)。
- この後に足すコミット(この判定書と `native-checklist.md`)は文書だけなので、CI を待たない(規約どおり)。

**CI の結果**: 実行 ID `42215310405`、ブランチ `release/v1.4.2`、コミット `eaaf2d8`、`CI` = success(2026-11-06)。

## 6. 依存関係の情報警告(据え置き)

Rust の情報警告 12 件は、11 件が v1.4.0・v1.4.1 と同じ ID・同じ内訳で、`Cargo.lock` の依存は変わっていない(`docs/release/v1.4.1/FINAL-RELEASE-DECISION.md` の 5. #2)。いずれも「脆弱性」ではなく「メンテナンス終了」「健全性の注意」「yanked」の情報。Tauri の更新と一緒に見直す。

## 7. 完了条件の確認

| 条件 | 結果 |
| --- | --- |
| バージョン情報がすべて 1.4.2 で一致する | 一致(2.) |
| 成果物とハッシュがそろい、リリースゲートがすべて通る。ビルドしたコミットで CI が通った | そろった。ゲートはすべて通った(`npm audit` はオーナー判断で受け入れ、5. #1)。CI も `eaaf2d8` で成功(5.) |
| ネイティブ確認の結果が項目ごとに記録されている(画面の項目は「オーナー確認待ち」) | コマンドで確かめた範囲を 9. に記録。画面の項目は `native-checklist.md` に整理し、**オーナー確認待ち** |
| `native-checklist.md` がある | `docs/release/v1.4.2/native-checklist.md` |
| 公開手順が、承認後にそのまま実行できる形で書かれている | 8.(新しいハッシュ、ビルドコミット `eaaf2d8`、PR #144) |

## 8. 承認後の公開手順

オーナーの明示承認があるまで、次は**実行しない**(PowerShell で上から順に実行する)。各コマンドは、実行のたびに終了コードを確かめ、0 でなければそこで止める。次のコマンドは、公開に使う前に、その時点の状態で読み直す。

### 8.1 マージの前の確認

1. `release/v1.4.2` の HEAD が、オーナーが承認したコミットであること。PR #144 の CI がそのコミットで成功していること。
2. タグ `v1.4.2` と GitHub Release が無いこと。`gh release view` は、「release not found」以外の失敗(認証・通信など)を「無い」と判断しない。
3. `release-candidate/v1.4.2/` の3ファイルの SHA-256 が、4. と一致すること。**一致しなければ停止する**(作り直さない。オーナーに報告する)。
4. オーナーの実機確認の結果が、`native-checklist.md` に書かれていること。

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$candidate = Join-Path $repo "release-candidate/v1.4.2"
git fetch origin
$head = (git rev-parse origin/release/v1.4.2).Trim()   # オーナーが承認したコミットと同じか確かめる
gh pr view 144 --json state,headRefOid,statusCheckRollup
git ls-remote --tags origin refs/tags/v1.4.2           # 何も出ないこと
gh release view v1.4.2                                  # "release not found" になること(ほかの失敗は停止)
Get-ChildItem "$candidate/*" -Include *.exe,*.zip | Get-FileHash -Algorithm SHA256   # 4. と照合
```

### 8.2 マージ

```powershell
gh pr merge 144 --merge --match-head-commit $head
```

### 8.3 マージの後の確認

1. マージ後の `main` と、ビルドに使ったコミット `eaaf2d8` の差分が**文書だけ**であること(製品のファイルの差分が1つでもあれば停止する)。
2. **マージ後の `main` の CI は待たない**(オーナー判断 2026-11-02)。代わりに、マージ後の `main` の tree が、CI が通ったコミットの tree と同じであること、または差分が文書だけであることで代える。

```powershell
git fetch origin
$unexpected = @(git diff --name-only eaaf2d8 origin/main |
  Where-Object { $_ -notmatch '^docs/|^README(?:\.en)?\.md$|^CHANGELOG\.md$' })
if ($unexpected.Count) { throw "main の製品差分を確認するまで停止: $unexpected" }
$releaseCommit = (git rev-parse origin/main).Trim()
# 置き換えの確認: マージ後の main の tree が、CI の通ったコミットの tree と同じか
git rev-parse "$releaseCommit^{tree}"
git rev-parse "eaaf2d8^{tree}"   # 文書だけのコミットを挟んだ場合は一致しないので、上の差分が文書だけであることを根拠にする
```

### 8.4 タグ

```powershell
git tag -a v1.4.2 $releaseCommit -m "Life Launcher v1.4.2"
git push origin refs/tags/v1.4.2
```

### 8.5 下書きの Release

アセットは次の4つだけ。

```powershell
$assets = @(
  "Life-Launcher-v1.4.2-windows-x64-setup.exe",
  "Life-Launcher-v1.4.2-windows-x64.exe",
  "Life-Launcher-v1.4.2-windows-x64-portable.zip",
  "SHA256SUMS.txt"
) | ForEach-Object { Join-Path $candidate $_ }
gh release create v1.4.2 @assets --verify-tag --draft --title "Life Launcher v1.4.2" --notes-file docs/releases/v1.4.2.md
```

### 8.6 下書きの確認

新しい空のフォルダーへダウンロードし、ハッシュを、公開した `SHA256SUMS.txt` と、この判定書の 4. の**両方**と照合する。アセットが4つだけであること。

```powershell
$download = Join-Path $repo ".local-evaluation/v142-redownload"
if (Test-Path $download) { throw "新しい空の検証先を用意する" }
gh release download v1.4.2 --dir $download
Get-ChildItem "$download/*" -Include *.exe,*.zip | Get-FileHash -Algorithm SHA256
```

### 8.7 公開

```powershell
gh release edit v1.4.2 --draft=false
gh release view v1.4.2 --json tagName,url,isDraft
```

### 8.8 公開後の確認(必須)

- もう一度、**新しい空のフォルダー**へダウンロードし、8.6 と同じ照合(公開した `SHA256SUMS.txt` と、4. の `4f8098ca…a70907`、`fcc14fa3…97cb2f18`、`7671958c…ca5abcfe`)をする。
- ダウンロードした単体 EXE と、ポータブル ZIP を展開した EXE が起動し、メイン画面が出ること(オーナーの PC で起動してよい。起動中の Life Launcher があれば、先に完全に終了する。自動起動の登録・ウィンドウの位置・WebView2 のデータは普段の場所に触れる)。
- `releases/latest` が v1.4.2 を指すこと。README のダウンロードの説明と、実際のファイル名が合っていること。
- `gh release view` だけで、起動やリンクの確認を済ませたことにしない。

### 8.9 記録

`docs/release/v1.4.2/PUBLIC-RELEASE-REPORT.md` に、マージのコミット、タグ、Release の URL、照合したハッシュ、起動の確認を書く(v1.4.1 と同じ形式)。公開記録の PR は CI を待たずに報告して停止する。

### 8.10 失敗したとき

アップロード・照合・起動のどれかが失敗したら、**下書きのまま止めて**オーナーに報告する。成果物を作り直さない。別の空の取得先で再確認し、通信の問題と候補の問題を分ける。タグの付け直し(force)と、アセットの無条件の上書き(`--clobber`)をしない。公開した後に問題が分かった場合も、オーナーの判断なしにタグや配布物を差し替えない。

### 8.11 Web Demo

v1.4.2 の変更(一体型タイトルバー、窓の上端のタイマーの線、手順書ビューアーの十字キー操作)はブラウザ版に関係しない。Web Demo の更新は別の判断(この判定書の範囲外)。公開しない。

## 9. ネイティブ確認(Windows 実機)

### A. 実装担当がコマンドで確かめたこと(2026-11-06)

| # | 項目 | 結果 | 方法 |
| --- | --- | --- | --- |
| A-1 | 成果物が起動する | **通過** | `release-candidate/v1.4.2/Life-Launcher-v1.4.2-windows-x64.exe` を起動。プロセスが生きており、窓のタイトルが `Life Launcher`、クライアント領域 **1200×680**(保存された main 窓の状態が無いため既定の大きさ) |
| A-2 | 一体型ヘッダーが動く | **通過** | 起動直後に `.appShell` が描画され、窓のボタンが3つある。表示サイズは設定の「大」、上部メニューの文字は段階 0、待機中なのでタイマーの線は 0 本。コンソールエラーなし |
| A-3 | 既存プロファイルのデータを読む | **通過** | 起動したアプリが、オーナーの `%APPDATA%\life-launcher\config.json` を読んで、表示サイズ「大」でメイン画面(「今や一手」)を表示した。設定の読み込みに失敗していない |
| A-4 | 確認の後始末 | **通過** | アプリを終了し、`config.json`・`notes.json`・`sessions.jsonl`・`config.schema.json`・`.window-state.json` を控えたものへ戻して SHA-256 の一致を確認。`HKCU\...\Run` に Life Launcher の項目は無い(確認前と同じ)。プロセスは残っていない |

注: `APPDATA` の切り替えだけでは隔離にならない(自動起動の登録、窓の位置、WebView2 のデータは普段の場所に触れる)。確認の前に、`release-candidate/v1.4.2/native-backup/20261106-211020/` へ控え、確認の後に戻した。

### B. オーナー確認待ち(画面の項目)

`docs/release/v1.4.2/native-checklist.md` の 1〜7。**PASS とは書いていない**。オーナーの画面操作、または Claude(画面操作)で確認する。

- 1. インストーラーで v1.4.1 から更新でき、設定と記録が残る。更新後の初回の起動で標準のタイトルバーが出ない
- 2. 窓の操作(P96-01 の実機確認 1〜10 と同じ項目。移動・ドラッグの範囲・ダブルクリック・4辺4角のリサイズ・上端のリサイズ・最大化・最小化・閉じる(トレイ)・フォーカスで薄くなる・ダイアログを開いたまま窓のボタン)
- 3. タイマーの線(P96-02 の実機確認 1〜5。色・止まる・計測では出ない・操作を邪魔しない・記録画面でも出る)
- 4. 上部メニューの文字(1200 で6つ、狭めると段階が変わる、記録画面と一致、表示サイズを変えたとき)
- 5. 手順書ビューアーの十字キー(Markdown と HTML)
- 6. 「使い方」の文章と「閉じる」の色
- 7. ほかの画面の見た目の回帰(メイン・記録・拡大タイマー・ミニ・今日やるものを選ぶ・設定・辞書・ビューアー)

## 10. 既知の制限

`docs/releases/v1.4.2.md` の「既知の制限」と同じ。v1.4.1 から引き継いだものに、次を足した。

- Windows 11 で、最大化ボタンにマウスを乗せたときに出る配置の選択(スナップレイアウト)は出ない(アプリで作ったボタンのため)。画面の端へドラッグしたときのスナップと Win+Z は Windows の機能だが、**この版では動作を確かめていない**ため、使える前提にしていない。
- HTML の手順書は表示だけで、アプリ内では編集できない(読み込み時に読み取り専用として扱う)。

## 11. この Stage で、行わなかったこと

- `main` へのマージ、タグ、GitHub Release、アセットのアップロード、Web Demo の更新。
- 画面のネイティブ確認(オーナー確認待ち)。
- インストーラーを実行しての更新確認(オーナー確認待ち)。
- 成果物の作り直し(ハッシュの照合が合わない場合を除く)。

## 12. 次の版で行うこと(v1.4.3 以降)

v1.4.1 の判定書から残っているもの:

- ESLint の更新(GHSA-g3hv-75wg-m249 の助言を消す)。
- ビルドの来歴の記録(ビルドした環境を、判定書だけでなく成果物からも分かるようにする)。
- テスト起動の隔離(`APPDATA` の切り替えだけでは隔離にならない問題)。
- 旧い「今日を組み立てる」の削除。
- 設定画面の ↑ で選択中のタブへ戻る。
- ミニタイマーのボタンを素早く2回押すとメイン画面に戻る件。

v1.4.2 で気づいたもの:

- Rust の yanked の警告(`async-executor`)。Tauri の更新と一緒に見る。
- Windows 11 のスナップレイアウト(最大化ボタンに乗せたときの配置の選択)は、自作のボタンでは出ない。必要になったら、OS のヒットテストを窓に返す方法を検討する。
