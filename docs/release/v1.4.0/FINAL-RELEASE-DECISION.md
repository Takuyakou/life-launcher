# Life Launcher v1.4.0 Final Release Decision

**READY FOR USER APPROVAL**(「9. のネイティブ確認 C のオーナー確認が済めば公開できる」という意味です。C は確認待ちで、PASS とは書いていません)

- 日付: 2026-10-30(JST)
- 候補のソース: ブランチ `release/v1.4.0`、コミット `38ed2a8640f7a950b752a87635a470c626575515`(`main` = `8332b8f`〔PR #130、P9-13 のマージ〕+ バージョン・公開文書・公開スクリーンショット + P9-13 の公開文書の追記)。この後に足したコミットは、この判定書、`native-checklist.md` だけで、成果物には含まれない。
- config schema: 3(v1.3.4 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。`release/v1.4.0` の PR(#129)も `main` へマージしていない。
- この版は P9-12 の判定書を作り直したもの(P9-12b)。前回の候補(`731cb08` のビルド)は、実機確認で見つかった2件を P9-13 で直したため、置き換えた。

## 1. 判定の要約

- バージョン情報は、すべて 1.4.0 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` を作り直し、リリースゲートはすべてやり直して通った(5.、前回の結果は流用していない)。
- Windows Defender のスキャンは、候補フォルダと各成果物で検出 0 件(5.)。
- 実機確認(9.)は、A(前回のビルドでオーナーと実装担当が確認した結果)、B(作り直したビルドで実装担当が確認した結果)、C(作り直したビルドでオーナーに確認してもらう3項目)に分けて書いた。**C はオーナー確認待ち**。
- 実機確認で見つかった2件(今日の3件の見出し、勝利条件のホバー)は、P9-13 で直して `main` に入っている(3.)。

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

## 3. 前回からの変更(P9-13)

実機確認で見つかった2件を直した(PR #130、`main` = `8332b8f`、報告 `docs/phase9/13-native-fixes.md`、判定 FIXED)。

- 表示サイズ 大・特大 で、今日の3件の見出しの説明文が右端に寄っていた(v1.3.4 からの不具合)。件数のすぐ後ろから始まるようにした。
- 今日の勝利条件にマウスを乗せたとき(キーボードで選んだときも)、ほかのカードと同じ反応(枠が金色に強まる、背景が少し明るくなる、1px 浮く)をするようにした。

公開文書(CHANGELOG、`docs/releases/v1.4.0.md`、`docs/release/v1.4.0/release-notes.md`、README、README.en.md)に、使う人向けの言葉で足した。仕様書は P9-13 で更新済み。README、README.en.md、仕様書、OVERVIEW の間に食い違いはない。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.4.0/`(`.gitignore` 済み。リポジトリには入れていない)。ファイル名は前回と同じ。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.0-windows-x64-setup.exe` | 3,729,830 | `7f05aee400ad054cb5c1f30b62cd69cfcc519b8d5e06b1b78869d26aabfe7ce7` |
| `Life-Launcher-v1.4.0-windows-x64.exe` | 16,052,736 | `9f9ae7101acd3f67a31de50563d06951cf7d5211180d281fb5bba7a43fdf72f7` |
| `Life-Launcher-v1.4.0-windows-x64-portable.zip` | 5,072,000 | `260c853868243dd1b1fac5ce64e6e75cd60c8c04b7533abc44bd095d05cabcb9` |
| `SHA256SUMS.txt` | 327 | (上の3行) |
| `release-notes.md` | 7,753 | `2ebd9b758546c63ef2c8615d98e8424b1c34558016100be4edb2231627dfd7b6`(`docs/releases/v1.4.0.md`、`docs/release/v1.4.0/release-notes.md` と同一) |

作り方: 既存の正式スクリプト `scripts/prepare-release-candidate.ps1`(インストーラー、単体 EXE、ポータブル ZIP、`SHA256SUMS.txt`)。ビルドに使ったのは上のコミットのソース。パスの置換(`--remap-path-prefix`)つきの release ビルド。作り直す前に、前回の成果物のフォルダはスクリプトが削除した(前回の成果物は残っていない)。

### 置き換え前の候補(`731cb08` のビルド。公開には使わない)

| ファイル | SHA-256 |
| --- | --- |
| `Life-Launcher-v1.4.0-windows-x64-setup.exe` | `d99c1d5b54dc5a98d247008ba52b5a6e04bb1f7af9734311d07190b9d16d5659` |
| `Life-Launcher-v1.4.0-windows-x64.exe` | `9074e8c1af700d7df84a1c01fb3ff32596afb37b67bad0ea11ac8e0af60bb30d` |
| `Life-Launcher-v1.4.0-windows-x64-portable.zip` | `580172c0a8fb4855487cf617e9704c64ae908d1511e8ae6d2dbf71fe1689dbf7` |

## 5. リリースゲートの証跡(作り直したビルドで、すべてやり直した)

| # | ゲート | 結果 | 証跡 |
| --- | --- | --- | --- |
| 1 | 依存関係(npm) | **通過** | `npm.cmd audit --audit-level=low`: 脆弱性 0 件 |
| 2 | 依存関係(Rust) | **通過**(脆弱性 0 件、情報警告 11 件は据え置き) | `cargo audit`: 脆弱性 0 件、`allowed warnings` 11 件。内訳と据え置きの理由は 7. |
| 3 | 公開安全 | **通過** | `npm.cmd run public:check`: 3567 ファイル、blocker 0 |
| 4 | 公開文書の横断確認 | **通過** | README、README.en.md、CHANGELOG、`docs/releases/v1.4.0.md`、仕様書、OVERVIEW のバージョンが 1.4.0 で一致。P9-13 の2点が CHANGELOG、リリースノート(2つの控えは同一)、README、README.en.md、仕様書にある。配布ファイル名、config schema `3`、Web Demo が別公開工程であることは、すべての文書で同じ。`readme-contract` のテストも通っている |
| 5 | ポータブル ZIP | **通過** | 中身は `Life-Launcher-v1.4.0-windows-x64.exe` と `README.txt` の2つだけ。絶対パス、`..`、シンボリックリンクなし。EXE 以外の実行形式なし。ZIP 内の EXE と単体 EXE の SHA-256 が一致(`9f9ae710…2f7`) |
| 6 | 秘密情報・パスの走査 | **通過** | 単体 EXE、ZIP 内 EXE、インストーラー、ZIP を ASCII と UTF-16LE で走査。`C:\Users\`、`D:\dev\`、開発者のユーザー名(2種類)、`Takuyakou\`、秘密鍵ヘッダー(RSA、OPENSSH、PRIVATE KEY、EC)、トークン接頭辞(`ghp_`、`github_pat_`、`gho_`、`AKIA`、`xoxb-`、`xoxp-`、`sk-ant-`)、`sourceMappingURL`、`.js.map` のいずれも 0 件。インストーラーは圧縮されているため、中身の走査には限りがある(EXE 本体は圧縮されていない) |
| 7 | SHA-256 | **通過** | `Get-FileHash`(スクリプトとは別の手段)で3ファイルを再計算し、`SHA256SUMS.txt` と全件一致 |
| 8 | バージョン情報 | **通過** | 2. |
| 9 | Windows Defender | **通過(検出 0 件)** | Defender は有効(AMService、Antivirus、リアルタイム保護とも有効。署名 1.463.31.0、2026-10-30 更新)。`Start-MpScan -ScanType CustomScan` を、候補フォルダ全体、インストーラー、単体 EXE、ZIP、ZIP を展開したフォルダに実行し、スキャンは完了、`Get-MpThreatDetection` の新しい検出は 0 件 |
| 10 | 必須ゲート | **通過** | 下の表 |
| 11 | インストーラー画像(PR #111) | **通過** | PR #111 は `main` に入っている(`1b12994` が `HEAD` の祖先)。`tauri.conf.json` に `installerIcon`、`sidebarImage`(`installer/nsis-sidebar.bmp`、実寸 190×290)、`uninstallerIcon` があり、`headerImage` はない。作り直したインストーラーの最初の画面で、日本語、サイドバー画像(Life Launcher のロゴ、「今やる一手を、開始まで。」)の表示を確認(100%) |
| 12 | 公開スクリーンショット | **通過** | `npm.cmd run screenshot:public` を再実行し、`docs/screenshots/` の4枚に差はなかった(P9-13 は Main の大・特大の見出しと勝利条件のホバーだけで、公開画像の見た目は変わらない)。コミットしていない。合成データだけで、個人データ、パス、ノートは写っていない |
| 13 | CI(`windows-latest`) | **通過** | ビルドに使ったコミット `38ed2a8` の CI(PR #129、`verify`): success、11分8秒。この後に足すコミット(判定書など)の CI は、push 後に確認する |

### 必須ゲート(`release/v1.4.0`、作り直したビルドのソース)

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3567ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | **481件すべて通過**(P9-13 の新規14件を含む)、1.8分(116秒) |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

## 6. 変更の概要(v1.3.4 → v1.4.0)

Phase 9(UI/UX 整理)の P9-00〜P9-11、P9-10b、P9-13。機能の追加はなく、データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。詳細は `docs/phase9/` の各報告、統合回帰は `docs/phase9/11-integrated-regression.md`(判定 PASS)、実機確認で見つかった2件の修正は `docs/phase9/13-native-fixes.md`(判定 FIXED)。依存ライブラリの脆弱性修正(DOMPurify `3.4.17` など。#115)は、Phase 9 の前に `main` へ入っている。

## 7. 依存関係の情報警告(据え置き)

`cargo audit` は脆弱性 0 件で終了コード 0。次の情報警告 11 件は、v1.3.4 から Cargo.lock を変えていない(Rust の依存に変更なし)。警告のうち 2026-10 付けのものは、v1.3.4 公開(2026-10-02)の後に出された。いずれも「脆弱性」ではなく「メンテナンス終了」「健全性の注意」の情報。

| クレート | 区分 | ID | Windows 版のビルドに入るか | 据え置きの理由 |
| --- | --- | --- | --- | --- |
| `proc-macro-error` 1.0.4 | unmaintained | RUSTSEC-2024-0370 | 入らない(`cargo tree --target x86_64-pc-windows-msvc` で依存なし) | Linux 向けの依存。Windows のビルドに含まれない |
| `unic-char-property`、`unic-char-range`、`unic-common`、`unic-ucd-ident`、`unic-ucd-version` 0.9.0 | unmaintained | RUSTSEC-2025-0081 / 0075 / 0080 / 0100 / 0098 | 入る(`tauri-utils` → `urlpattern` → `unic-*`) | Tauri 本体の依存で、このアプリから直接は更新できない。メンテナンス終了の情報で、既知の脆弱性はない。Tauri の更新で解消するのを待つ |
| `zbus_names` 4.3.2、`zvariant` 5.12.0、`zvariant_derive` 5.12.0 | unmaintained | RUSTSEC-2026-0371 / 0370 / 0372 | 入らない | Linux(D-Bus)向けの依存 |
| `glib` 0.18.5 | unsound | RUSTSEC-2024-0429 | 入らない | Linux(GTK)向けの依存 |
| `tokio` 1.52.3 | unsound | RUSTSEC-2026-0386 | 入る(`hyper` 経由) | 警告の対象は `AsyncFd`(Unix のファイル記述子用の API)。Windows では使われない。Tauri の依存の更新を待つ |

次のリリース(v1.4.1 以降)で、Tauri の更新と一緒に見直す。

## 8. 完了条件の確認

| 条件 | 結果 |
| --- | --- |
| `release/v1.4.0` に P9-13 が入っていて、バージョンはすべて 1.4.0 | 入っている(`main` の `8332b8f` を取り込み済み)。バージョンは 2. のとおり、すべて 1.4.0 |
| 成果物を作り直し、リリースゲートをすべてやり直して通った | 通った(4.、5.。前回の結果は流用していない) |
| 判定書のネイティブ確認に A・B・C がある | 9. |
| `native-checklist.md` が C の一覧になっている | `docs/release/v1.4.0/native-checklist.md` |
| 公開手順が新しいハッシュで書かれている | 10. |

## 9. ネイティブ確認(Windows 実機)

### A. オーナーと Claude が実機で確認した結果(前回のビルド `731cb08`)

確認した環境: Windows 11、表示倍率 100% と 150%。隔離したテスト用プロファイル(`release-candidate/native-check/`、`createFullTodayFixture` から作った合成データ)。実際のデータには触れていない。

| # | 項目 | 結果 |
| --- | --- | --- |
| 5 | 100%・150% での表示(メイン 標準・大・特大、拡大タイマー、ミニ 待機中・実行中、今日やるものを選ぶ) | 確認済み。大・特大の今日の3件の見出しの並びだけ不具合があり、P9-13 で直した。ほかに重なり・切れはなかった。150% でもミニは画面右下に収まった。今日やるものを選ぶ画面(100%)では候補4件がすべて見えた |
| 6 | 実フォントでの折り返しと省略 | 確認済み(合成データの範囲)。行動文・名前の切れや重なりはなかった。長い文のサンプルでは見ていない |
| 7 | ドラッグ&ドロップ | 確認済み。今日の3件のカードの並べ替え、サイドバーのボタンのグループ間の移動(移動元が0件になると案内が出る) |
| 8 | 実行中表示の同期(実操作) | 確認済み。今やる一手から開始 → 今日の3件のカードも「実行中」。今日の3件のカードから開始 → 今やる一手も「実行中」。サイドバー Timer、拡大タイマー、ミニにも行動文が出た |
| 9 | 今日の3件の優先(P9-05、実データ) | 確認済み。今やる一手が今日の3件の項目を理由「今日の3件に入っている一手です」で出した。今日やるものを選ぶ画面で次の一手を今日の3件へ足すと、今やる一手がすぐそれに変わった。完了すると従来の候補(理由「今週の重点で、今日はまだ取り組んでいません」)に変わった |
| 10 | インストーラーの画面を 150% で確認 | オーナーが確認し、問題なし |
| — | 色(保存・決定=緑、キャンセル=赤)、待機中 Timer の中立色、「通常タイマー」が1回だけ | 確認済み |

仕様どおりで不具合ではないと判断したもの(記録):

- ミニから開始後すぐ(1分未満)に終了すると、「今日の分は完了にしますか？」が出ず、記録もされない(仕様書 §14.1 の早期完了のしきい値と、1分未満は記録しない決まりのとおり)。

A の確認は前回のビルドで行ったもので、P9-13 で変えたのは「大・特大の今日の3件の見出しの列」と「勝利条件のホバー・フォーカス」の CSS だけ(Rust、データ、タイマー、ドラッグ&ドロップの処理は変えていない)。この2点は C で、作り直したビルドを確認してもらう。

### B. 作り直したビルドで、実装担当が確かめたこと

確認した環境: Windows 11 Home 10.0.26200(x64)、表示倍率 100%(`GetDpiForWindow` = 96)。確認の方法: 成果物の EXE を起動し、アプリの自己終了用の既存の仕組み(環境変数 `LIFE_LAUNCHER_RELEASE_SMOKE_EXIT_AFTER_MS`)で終了させた。確認用の `%APPDATA%` は一時フォルダーに切り替え、**このマシンの実際のデータには触れていない**。終了後に一時フォルダーはすべて削除した(前回と同じ方法)。

| # | 項目 | 結果 | 内容 |
| --- | --- | --- | --- |
| 1 | 単体 EXE の起動 | **確認済み** | 空のプロファイルで起動。約0.3秒でウィンドウ「Life Launcher」が出た。20秒後に自己終了、終了コード 0。`config.json`(schema 3)を新規作成 |
| 2 | ポータブル(ZIP 展開後の EXE)の起動 | **確認済み** | 1. と同じ手順で、ウィンドウ表示、終了コード 0 |
| 3 | インストーラーの起動 | **一部確認済み** | 起動して「Life Launcher セットアップ」の最初の画面を表示した。日本語、サイドバー画像の表示を確認(100%)。確認後に閉じた。**実際のインストールとアンインストールは行っていない**(利用者の PC のインストール情報を書き換えるため。C の 3.) |
| 4 | コピーしたプロファイルでの起動とデータの保持 | **確認済み(コピーで)** | このマシンにある既存のデータ(config、sessions.jsonl、notes.json)を一時フォルダーへ**コピー**して、作り直した単体 EXE を起動。起動に成功、終了コード 0。`config.json` の version は 3 のまま。`sessions.jsonl` と `notes.json` はバイト単位で同一。`config.json` の書き換わった箇所は `today.date`(今日の日付への更新)の1か所だけ。**元のデータは変更していない** |

環境の注意(v1.3.2 の判定書にも記録されている種類のもの):

- このマシンでは、既定のグローバルホットキー(`Ctrl+Alt+Space`)が、すでに別のものに登録されていて、起動時に登録をスキップする(アプリは起動を続ける)。
- 終了時に、WebView2 が `Failed to unregister class Chrome_WidgetWin_0`(エラー 1412)を出すが、終了コードは 0。以前の版と同じ。

### C. 作り直したビルドで、オーナーに確認してもらうこと(**オーナー確認待ち**)

手順と期待結果は `docs/release/v1.4.0/native-checklist.md`。確認が済むまで PASS とは書かない。

| # | 項目 | 状態 |
| --- | --- | --- |
| 1 | `release-candidate/native-check/launch-v140-isolated.bat` で起動し、設定 > 表示 で 大・特大 にして、今日の3件の説明文が「n / n 完了」のすぐ後ろにあり、次の一手の見出しと並びがそろっている | オーナー確認待ち |
| 2 | 今日の勝利条件にマウスを乗せると、枠が金色に強まり、少し明るくなって 1px 浮く(達成済みでも同じ)。Tab で本文に移っても同じ反応と黄色い輪が出る。枠の空いている所をクリックしても編集は始まらない | オーナー確認待ち |
| 3 | `Life-Launcher-v1.4.0-windows-x64-setup.exe` で実際にインストールし、起動できる(**インストールした版は実際のデータで起動する**。確認の前に `%APPDATA%\life-launcher` のバックアップを推奨) | オーナー確認待ち |

## 10. 承認後の公開手順

オーナーの明示承認があるまで、次は**実行しない**。

1. **公開前の確認**: `origin/main` が想定どおりか(`release/v1.4.0` を `main` へマージした後のコミットか)、タグ `v1.4.0` と GitHub Release が、まだ存在しないことを確認する。成果物は、この判定書の 4. のハッシュと同じものを使う(`release-candidate/v1.4.0/` の3ファイルを `Get-FileHash` で計算し、4. と一致することを確かめる。一致しない、または作り直す場合は、ハッシュ、ZIP の中身、バージョン情報、Defender を、この判定書のとおりにやり直す)。
2. **マージ**: `release/v1.4.0` の PR(#129)を、CI の成功を確認して `main` へマージする(オーナーの指示で)。マージ後の `main` のソースが、ビルドしたソースと(ドキュメントを除いて)同じことを確認する。
3. **タグ**: マージ後の `main` に `v1.4.0` を作って push する。
4. **GitHub Release**: タイトル `Life Launcher v1.4.0`、本文は `docs/releases/v1.4.0.md`。アセットは `Life-Launcher-v1.4.0-windows-x64-setup.exe`、`Life-Launcher-v1.4.0-windows-x64.exe`、`Life-Launcher-v1.4.0-windows-x64-portable.zip`、`SHA256SUMS.txt` の4つだけ。
5. **公開後の確認(必須)**:
   - GitHub から全アセットを、新しい空のフォルダーへ**再ダウンロード**し、`Get-FileHash` で SHA-256 を計算して、公開した `SHA256SUMS.txt` と照合する。さらに、この判定書の 4. のハッシュ(`7f05aee4…7ce7`、`9f9ae710…2f7`、`260c8538…cb9`)とも一致することを確かめる。
   - ダウンロードした単体 EXE を起動して、メイン画面が出ることを確認する(ポータブル ZIP は展開して、同じように起動する)。
   - `releases/latest` のリンクが v1.4.0 を指すこと、README のダウンロードの説明と、実際のファイル名が合っていることを確認する。
6. **公開後の記録**: 公開結果(タグ、Release の URL、再ダウンロードのハッシュの照合結果、起動の確認)を `docs/release/v1.4.0/PUBLIC-RELEASE-REPORT.md` に書く(v1.3.2 と同じ形式)。
7. **Web Demo**: v1.4.0 の変更の Web Demo への反映は、別の判断(この判定書の範囲外)。差分の一覧は `docs/phase9/11-integrated-regression.md` の 16.

## 11. 既知の制限

- UI は日本語中心で、英語対応は主に上部ツールバーなどの一部。
- URL は Windows の既定ブラウザで開く。
- ブックマーク名の取得は、ローカルのブラウザープロファイルを読める場合に限る。
- HTML 手順書は、静的な HTML/CSS と登録したフォルダー内の相対 asset だけを表示する(JavaScript に依存する画面、フォーム、入れ子のフレーム、外部 asset は動作しない)。
- 配布バイナリは未署名で、Windows SmartScreen の警告が出ることがある。WebView2 Runtime が必要。自動アップデーターはない。
- 9. の C(オーナー確認待ち)の3項目。
- Rust の依存の情報警告 11 件(7.)。
- Web Demo は v1.4.0 の変更を反映していない(今日の3件の優先、件数の二重表示、「変更」というボタン名など)。

## 12. この Stage で、行わなかったこと

tag、GitHub Release、アセットのアップロード、Web Demo の deploy、`main` へのマージ(PR #129)。Windows のインストーラーの実インストール(9. の C の 3.)。
