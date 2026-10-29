# Life Launcher v1.4.0 Final Release Decision

**READY FOR USER APPROVAL**(ネイティブ確認に未確認の項目があります。8. を読んでから判断してください)

- 日付: 2026-10-29(JST)
- 候補のソース: ブランチ `release/v1.4.0`、コミット `731cb08d63656c4d55788458725e6d9a883dae3b`(`main` = `2a6222b`〔PR #128 マージ〕+ バージョン・公開文書・公開スクリーンショットの2コミット)。この後に足したコミットは、この判定書と報告だけで、成果物には含まれない。
- config schema: 3(v1.3.4 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。

## 1. 判定の要約

- バージョン情報は、すべて 1.4.0 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` がそろい、リリースゲートのうち自動でできる項目は、すべて通った(3.〜5.)。
- Windows Defender のスキャンは、候補フォルダと各成果物で検出 0 件(5.)。
- ネイティブ確認は、「起動」「既存データでの起動」「インストーラーの画面の表示」まで確認した。**表示倍率 150%、実際の操作(ドラッグ&ドロップ、実行中の同期、今日の3件との連動)、インストーラーの実インストールは未確認**(8.)。未確認の項目は、PASS とは書いていない。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.4.0 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.4.0 |
| `src-tauri/tauri.conf.json` | 1.4.0 |
| 単体 EXE の FileVersion / ProductVersion | 1.4.0 / 1.4.0(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.4.0 / 1.4.0 |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.4.0 / 1.4.0 |
| README、README.en.md、CHANGELOG、`docs/releases/v1.4.0.md`、`docs/OVERVIEW.md`、`docs/spec/current-spec.md` | 1.4.0(古い 1.3.x の表記が残るのは、履歴と「v1.3.4 から更新する方へ」の記述だけ) |

## 3. 成果物とハッシュ

置き場所: `release-candidate/v1.4.0/`(`.gitignore` 済み。リポジトリには入れていない)

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.0-windows-x64-setup.exe` | 3,727,091 | `d99c1d5b54dc5a98d247008ba52b5a6e04bb1f7af9734311d07190b9d16d5659` |
| `Life-Launcher-v1.4.0-windows-x64.exe` | 16,052,736 | `9074e8c1af700d7df84a1c01fb3ff32596afb37b67bad0ea11ac8e0af60bb30d` |
| `Life-Launcher-v1.4.0-windows-x64-portable.zip` | 5,071,986 | `580172c0a8fb4855487cf617e9704c64ae908d1511e8ae6d2dbf71fe1689dbf7` |
| `SHA256SUMS.txt` | 327 | (上の3行) |
| `release-notes.md` | 7,201 | `d27db4063b9e35f992568db44e371a903789544722311b4c59b1acf90acb5114`(`docs/releases/v1.4.0.md` と同一) |

作り方: 既存の正式スクリプト `scripts/prepare-release-candidate.ps1`(インストーラー、単体 EXE、ポータブル ZIP、`SHA256SUMS.txt`)。ビルドに使ったのはこのコミットのソースで、レビュー用の別ビルドは混ざっていない。パスの置換(`--remap-path-prefix`)つきの release ビルド。

## 4. 完了条件の確認

| 条件 | 結果 |
| --- | --- |
| バージョン情報がすべて 1.4.0 で一致する | 一致(2.) |
| 成果物とハッシュがそろい、リリースゲートがすべて通る | 通った(5.) |
| ネイティブ確認の結果が項目ごとに記録されている | 記録した。未確認の項目は未確認と書いた(8.) |
| 公開手順が承認後に実行できる形で書かれている | 9. |

## 5. リリースゲートの証跡

| # | ゲート | 結果 | 証跡 |
| --- | --- | --- | --- |
| 1 | 依存関係(npm) | **通過** | `npm.cmd audit --audit-level=low`: 脆弱性 0 件 |
| 2 | 依存関係(Rust) | **通過**(脆弱性 0 件、情報警告 11 件は据え置き) | `cargo audit`: 脆弱性 0 件、`allowed warnings` 11 件。内訳と据え置きの理由は 6. |
| 3 | 公開安全 | **通過** | `npm.cmd run public:check`: 3560 ファイル、blocker 0 |
| 4 | 公開文書の横断確認 | **通過** | README、README.en.md、CHANGELOG、`docs/releases/v1.4.0.md`、仕様書、OVERVIEW のバージョンが 1.4.0 で一致。「ミニモード」の旧表記が残るのは、改名を説明する文だけ。配布ファイル名、config schema `3`、Web Demo が別公開工程であることは、すべての文書で同じ。既知の制限は、リリースノートが仕様書 §26 の主要な項目を抜粋したもので、矛盾はない(§26 のすべてをリリースノートに載せてはいない) |
| 5 | ポータブル ZIP | **通過** | 中身は `Life-Launcher-v1.4.0-windows-x64.exe` と `README.txt` の2つだけ。絶対パス、`..`、シンボリックリンクなし。EXE 以外の実行形式なし。ZIP 内の EXE と単体 EXE の SHA-256 が一致(`9074e8c1…bb30d`) |
| 6 | 秘密情報・パスの走査 | **通過** | 単体 EXE、ZIP 内 EXE、インストーラー、ZIP を ASCII と UTF-16LE で走査。`C:\Users\`、`D:\dev\`、開発者のユーザー名(2種類)、`Takuyakou\`、秘密鍵ヘッダー(RSA、OPENSSH、PRIVATE KEY、EC)、トークン接頭辞(`ghp_`、`github_pat_`、`gho_`、`AKIA`、`xoxb-`、`xoxp-`、`sk-ant-`)、`sourceMappingURL`、`.js.map` のいずれも 0 件。走査の動作確認として、EXE に含まれる `life-launcher`(25件)と UTF-16 の `Life Launcher`(3件)は検出できた。インストーラーは圧縮されているため、中身の走査には限りがある(EXE 本体は圧縮されていない) |
| 7 | SHA-256 | **通過** | `Get-FileHash`(スクリプトとは別の手段)で3ファイルを再計算し、`SHA256SUMS.txt` と全件一致 |
| 8 | バージョン情報 | **通過** | 2. |
| 9 | Windows Defender | **通過(検出 0 件)** | Defender は有効(AMService、Antivirus、リアルタイム保護とも有効。署名 1.463.16.0、2026-10-29 更新)。`Start-MpScan -ScanType CustomScan` を、候補フォルダ全体、インストーラー、単体 EXE、ZIP、ZIP を展開したフォルダに実行し、スキャンは完了、`Get-MpThreatDetection` の新しい検出は 0 件 |
| 10 | 必須ゲート(通常) | **通過** | 下の表 |
| 11 | インストーラー画像(PR #111) | **通過** | PR #111 は `main` に入っている(`1b12994` が `HEAD` の祖先)。`tauri.conf.json` に `installerIcon`、`sidebarImage`(`installer/nsis-sidebar.bmp`、実寸 190×290)、`uninstallerIcon` があり、`headerImage` はない。インストーラーの画面でサイドバー画像を確認(8.) |
| 12 | 公開スクリーンショット | **通過** | `npm.cmd run screenshot:public` で `docs/screenshots/` の4枚を再生成。合成データだけ(「サンプル学習」など)で、個人データ、パス、ノートは写っていない(目視で確認) |

### 必須ゲート(`release/v1.4.0`、成果物のビルド後に実行)

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3560ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | 467件すべて通過、1.6分(99秒) |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

CI(`windows-latest`): この PR の CI は、PR を作ったあとに確認する(この時点では未確認)。

## 6. 依存関係の情報警告(据え置き)

`cargo audit` は脆弱性 0 件で終了コード 0。次の情報警告 11 件は、v1.3.4 から Cargo.lock を変えていない(Rust の依存に変更なし)。警告のうち 2026-10 付けのものは、v1.3.4 公開(2026-10-02)の後に出された。いずれも「脆弱性」ではなく「メンテナンス終了」「健全性の注意」の情報。

| クレート | 区分 | ID | Windows 版のビルドに入るか | 据え置きの理由 |
| --- | --- | --- | --- | --- |
| `proc-macro-error` 1.0.4 | unmaintained | RUSTSEC-2024-0370 | 入らない(`cargo tree --target x86_64-pc-windows-msvc` で依存なし) | Linux 向けの依存。Windows のビルドに含まれない |
| `unic-char-property`、`unic-char-range`、`unic-common`、`unic-ucd-ident`、`unic-ucd-version` 0.9.0 | unmaintained | RUSTSEC-2025-0081 / 0075 / 0080 / 0100 / 0098 | 入る(`tauri-utils` → `urlpattern` → `unic-*`) | Tauri 本体の依存で、このアプリから直接は更新できない。メンテナンス終了の情報で、既知の脆弱性はない。Tauri の更新で解消するのを待つ |
| `zbus_names` 4.3.2、`zvariant` 5.12.0、`zvariant_derive` 5.12.0 | unmaintained | RUSTSEC-2026-0371 / 0370 / 0372 | 入らない | Linux(D-Bus)向けの依存 |
| `glib` 0.18.5 | unsound | RUSTSEC-2024-0429 | 入らない | Linux(GTK)向けの依存 |
| `tokio` 1.52.3 | unsound | RUSTSEC-2026-0386 | 入る(`hyper` 経由) | 警告の対象は `AsyncFd`(Unix のファイル記述子用の API)。Windows では使われない。Tauri の依存の更新を待つ |

次のリリース(v1.4.1 以降)で、Tauri の更新と一緒に見直す。

## 7. 変更の概要(v1.3.4 → v1.4.0)

Phase 9(UI/UX 整理)の P9-00〜P9-11、P9-10b。機能の追加はなく、データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。詳細は `docs/phase9/` の各報告、統合回帰は `docs/phase9/11-integrated-regression.md`(判定 PASS)。依存ライブラリの脆弱性修正(DOMPurify `3.4.17` など。#115)は、Phase 9 の前に `main` へ入っている。

## 8. ネイティブ確認(Windows 実機、ビルド済みの成果物)

確認した環境: Windows 11 Home 10.0.26200(x64)、表示倍率 100%(`GetDpiForWindow` = 96)。確認の方法: 成果物の EXE を起動し、アプリの自己終了用の既存の仕組み(環境変数 `LIFE_LAUNCHER_RELEASE_SMOKE_EXIT_AFTER_MS`)で終了させた。確認用の `%APPDATA%` は一時フォルダーに切り替え、**このマシンの実際のデータには触れていない**。終了後に一時フォルダーはすべて削除した。

| # | 項目 | 結果 | 内容 |
| --- | --- | --- | --- |
| 1 | 単体 EXE の起動 | **確認済み** | 空のプロファイルで起動。約0.3秒でウィンドウ「Life Launcher」が出た。実際の Windows のフォントで、メイン画面、サイドバー、待機中の Timer(時計は中立色、「通常タイマー」の重複なし)が正しく表示された(目視)。20秒後に自己終了、終了コード 0。`config.json`(schema 3)を新規作成 |
| 2 | ポータブル(ZIP 展開後の EXE)の起動 | **確認済み** | 1. と同じ手順で、ウィンドウ表示、終了コード 0 |
| 3 | インストーラーの起動 | **一部確認済み** | 起動して「Life Launcher セットアップ」の最初の画面を表示した。日本語、サイドバー画像(Life Launcher のロゴ、「今やる一手を、開始まで。」)の表示を確認(100%)。ヘッダー画像はなし。**実際のインストールとアンインストールは行っていない**(利用者の PC のインストール情報を書き換えるため)。確認後に閉じた |
| 4 | v1.3.4 のプロファイルからのアップグレード | **確認済み(コピーで)** | このマシンにある既存のデータ(v1.3 系で作成。プロジェクト7、ボタン18、やりたいこと4)を一時フォルダーへ**コピー**し、v1.4.0 の単体 EXE を起動。起動に成功、終了コード 0。`config.json` の version は 3 のまま、項目数は変わらず。`sessions.jsonl` と `notes.json` はバイト単位で同一。`config.json` の書き換わった箇所は `today.date`(今日の日付への更新)の1か所だけ。**元のデータは変更していない**。ただし、v1.3.4 のビルドで作ったデータかどうかは、特定していない |
| 5 | 表示倍率 100% と 150% での表示(メイン〔標準・大・特大〕、拡大タイマー、ミニタイマー待機中・実行中、今日やるものを選ぶ) | **未確認** | 100% でメイン画面(空のプロファイル、標準)を見ただけ。150%、表示サイズ大・特大、拡大タイマー、ミニ、今日やるものを選ぶ画面は、ビルド済みアプリでは確認していない。Chromium の画像比較(Playwright)では確認済み |
| 6 | 実フォントでの折り返しと省略 | **未確認** | 長い行動文、長い名前のサンプルは見ていない。Playwright では、長い行動文が2行まで・1行までで省略されることを確認している(フォントは Windows 実機と異なる) |
| 7 | ドラッグ&ドロップ(今日の3件、サイドバーのボタン) | **未確認** | 実際のドラッグ操作は行っていない |
| 8 | 今やる一手と今日の3件の実行中表示の同期(実操作) | **未確認** | Playwright(モックの Tauri)で、両方向の同期を確認している。実アプリでの実操作はしていない |
| 9 | 今日の3件へ次の一手を採用すると今やる一手がそれに変わり、完了すると次の項目に変わる(P9-05、実データ) | **未確認** | 並び順は Rust のテストで確認。実アプリでの確認はしていない |
| 10 | インストーラーの画面を 150% で確認(サイドバー画像の比率、文字の切れ) | **未確認** | 100% の最初の画面だけ。150% では見ていない |

環境の注意(v1.3.2 の判定書にも記録されている種類のもの):

- このマシンでは、既定のグローバルホットキー(`Ctrl+Alt+Space`)が、すでに別のものに登録されていて、起動時に登録をスキップする(アプリは起動を続ける。「shortcut registration skipped during startup」のログ)。
- 終了時に、WebView2 が `Failed to unregister class Chrome_WidgetWin_0`(エラー 1412)を出すが、終了コードは 0。以前の版と同じ。

### オーナーにお願いしたい確認(5.〜10. の未確認の項目)

承認の前に、実機で次を確認してください。確認しない場合は、「未確認のまま承認する」とお知らせください。

1. 表示倍率 100% と 150% の両方で、メイン(標準・大・特大)、拡大タイマー、ミニタイマー(待機中・実行中)、今日やるものを選ぶ画面を見る(折り返し・省略、重なりがないか)。
2. 今日の3件のカードとサイドバーのボタンのドラッグ&ドロップ。
3. 今やる一手から開始 → 今日の3件も「実行中」になる。今日の3件から開始 → 今やる一手も「実行中」になる。
4. 次の一手を今日の3件へ採用 → 今やる一手がそれに変わる。完了 → 次の項目(なければ従来の候補)に変わる。
5. インストーラーを 150% で開き、サイドバー画像の比率と文字の切れを見る。実際にインストールして起動できること。
6. v1.3.4 を使っているプロファイルで、更新後に設定と記録が保たれること(今回は、コピーで起動だけ確認)。

## 9. 承認後の公開手順

オーナーの明示承認があるまで、次は**実行しない**。

1. **公開前の確認**: `origin/main` が想定どおりか(`release/v1.4.0` を `main` へマージした後のコミットか)、タグ `v1.4.0` と GitHub Release が、まだ存在しないことを確認する。成果物は、この判定書の 3. のハッシュと同じものを使う(作り直した場合は、ハッシュ、ZIP の中身、バージョン情報、Defender を、この判定書のとおりにやり直す)。
2. **マージ**: `release/v1.4.0` の PR を、CI の成功を確認して `main` へマージする(オーナーの指示で)。マージ後の `main` のソースが、ビルドしたソースと(ドキュメントを除いて)同じことを確認する。
3. **タグ**: マージ後の `main` に `v1.4.0` を作って push する。
4. **GitHub Release**: タイトル `Life Launcher v1.4.0`、本文は `docs/releases/v1.4.0.md`。アセットは `Life-Launcher-v1.4.0-windows-x64-setup.exe`、`Life-Launcher-v1.4.0-windows-x64.exe`、`Life-Launcher-v1.4.0-windows-x64-portable.zip`、`SHA256SUMS.txt` の4つだけ。
5. **公開後の確認(必須)**:
   - GitHub から全アセットを、新しい空のフォルダーへ**再ダウンロード**し、`Get-FileHash` で SHA-256 を計算して、公開した `SHA256SUMS.txt` と照合する。さらに、この判定書の 3. のハッシュとも一致することを確かめる。
   - ダウンロードした単体 EXE を起動して、メイン画面が出ることを確認する(ポータブル ZIP は展開して、同じように起動する)。
   - `releases/latest` のリンクが v1.4.0 を指すこと、README のダウンロードの説明と、実際のファイル名が合っていることを確認する。
6. **公開後の記録**: 公開結果(タグ、Release の URL、再ダウンロードのハッシュの照合結果、起動の確認)を `docs/release/v1.4.0/PUBLIC-RELEASE-REPORT.md` に書く(v1.3.2 と同じ形式)。
7. **Web Demo**: v1.4.0 の変更の Web Demo への反映は、別の判断(この判定書の範囲外)。差分の一覧は `docs/phase9/11-integrated-regression.md` の 16.

## 10. 既知の制限

- UI は日本語中心で、英語対応は主に上部ツールバーなどの一部。
- URL は Windows の既定ブラウザで開く。
- ブックマーク名の取得は、ローカルのブラウザープロファイルを読める場合に限る。
- HTML 手順書は、静的な HTML/CSS と登録したフォルダー内の相対 asset だけを表示する(JavaScript に依存する画面、フォーム、入れ子のフレーム、外部 asset は動作しない)。
- 配布バイナリは未署名で、Windows SmartScreen の警告が出ることがある。WebView2 Runtime が必要。自動アップデーターはない。
- 8. の未確認の項目(150% 表示、実操作など)。
- Rust の依存の情報警告 11 件(6.)。
- Web Demo は v1.4.0 の変更を反映していない(今日の3件の優先、件数の二重表示、「変更」というボタン名など)。

## 11. この Stage で、行わなかったこと

tag、GitHub Release、アセットのアップロード、Web Demo の deploy、`main` へのマージ。Windows のインストーラーの実インストール(8. の3.)。
