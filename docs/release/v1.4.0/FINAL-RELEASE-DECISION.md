# Life Launcher v1.4.0 Final Release Decision

**READY FOR USER APPROVAL**(オーナーの実機確認 C の5項目が済んだので、オーナーが公開を承認すれば公開できる、という意味です)

- 独立精査(P9-12R、Codex)の判定は **INCONCLUSIVE**。理由は1つで、配布用の EXE を、実際の PC から切り離した環境で起動して確かめていないこと(R1)。ほかの確認(ソース、ハッシュ、バージョン、ZIP、秘密情報、Defender、必須ゲート3回、データ形式)はすべて一致し、公開を止める不具合は見つかっていない。R1 は、オーナーが自分の PC で行った実機確認(9. C)で代えた(9. D)。
- 日付: 2026-10-30(JST)に作成。2026-10-31 に、P9-12R の指摘の反映とオーナーの実機確認の記録を足した(P9-12d)。
- 候補のソース: ブランチ `release/v1.4.0`、コミット `9a86f7a5cf6a5f71e69e7be80be3af3e1b0b5b3d`(`main` = `a4a94e7`〔PR #131、P9-14 のマージ〕+ バージョン・公開文書・公開スクリーンショット + P9-13・P9-14 の公開文書の追記)。この後に足したコミットは、この判定書、`native-checklist.md`、`RELEASE-REVIEW-codex.md` だけで、成果物には含まれない(`git diff --name-only 9a86f7a..HEAD` は `docs/release/v1.4.0/` の下の文書だけ)。
- config schema: 3(v1.3.4 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。`release/v1.4.0` の PR(#129)も `main` へマージしていない。
- この版は P9-12 の判定書を、P9-12b に続いてもう一度作り直したもの(P9-12c)。前回の候補(P9-12b のビルド)は、P9-13 のビルドをオーナーが実機で確認して見つかった5点を P9-14 で直したため、置き換えた。

## 1. 判定の要約

- バージョン情報は、すべて 1.4.0 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` を作り直し、リリースゲートはすべてやり直して通った(5.、前回の結果は流用していない)。
- Windows Defender のスキャンは、候補フォルダと各成果物で検出 0 件(5.)。
- 実機確認(9.)は、A(前回までのビルドでオーナーと実装担当が確認した結果)、B(作り直したビルドで実装担当が確認した結果)、C(作り直したビルドでオーナーが確認した5項目)に分けて書いた。**C の5項目は、オーナーが 2026-10-31 に確認した**(1〜4 は「確認しました」とのチャットでの報告、5 はインストールと起動ができたとの報告。5 の注意は 9. C と 11. にある)。
- P9-12R の判定は `INCONCLUSIVE`(理由 R1)。R1 は、切り離した環境での起動確認を行わず、オーナーの実機確認(9. C)で代えることを、オーナーが 2026-10-30 に判断した(9. D)。
- 実機確認で見つかった点は、P9-13(2件)と P9-14(5点)で直して `main` に入っている(3.)。

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

## 3. 前回からの変更(P9-14)

P9-13 のビルドをオーナーが実機で確認して見つかった5点を直した(PR #131、`main` = `a4a94e7`、報告 `docs/phase9/14-heading-victory-polish.md`、判定 FIXED)。

- 今日の3件・次の一手・やりたいこと・今日の実行の見出しで、名前のすぐ後ろに件数を置いた(名前と件数の間を詰めた)。
- 4つの見出しの説明の文字(大きさ・色・太さ)と、名前の太さをそろえた。
- 4つの見出しバーの枠を、v1.3.4 と同じ枠に戻した。
- 十字キーや Tab で見出し・勝利条件を選んだとき、黄色い四角が二重に出ないようにした。
- 勝利条件が未入力のときは、マウスを乗せても、起動直後も光らないようにした(キーボード操作では黄色い輪が出る)。

その前の P9-13(PR #130)の2点(大・特大の今日の3件の見出しの並び、勝利条件のホバー)も含む。P9-13 の「勝利条件にキーボードで選んだときも反応する」は、P9-14 で「枠は変えず、内側の黄色い輪だけを出す」に変わった。公開文書(CHANGELOG、`docs/releases/v1.4.0.md`、`docs/release/v1.4.0/release-notes.md`、README、README.en.md)は、この内容に直した。仕様書は P9-14 で更新済み。README、README.en.md、仕様書、OVERVIEW の間に食い違いはない。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.4.0/`(`.gitignore` 済み。リポジトリには入れていない)。ファイル名は前回と同じ(`release-candidate/native-check/launch-v140-isolated.bat` がそのまま使える)。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.0-windows-x64-setup.exe` | 3,729,901 | `b6acfae2efd93860bad4b6b978801c1f9299d8b818aad590062ed23d45a21e4a` |
| `Life-Launcher-v1.4.0-windows-x64.exe` | 16,052,736 | `0f833c1775cfb2f3791ff3820c9867d0d9f8cef67e1a8ec38f3ffc2acb46ebb6` |
| `Life-Launcher-v1.4.0-windows-x64-portable.zip` | 5,072,020 | `5fdfe119a341d94491e43bec09d38be0c3d65c7d35f9c72ae6a2de749dfc05ee` |
| `SHA256SUMS.txt` | 327 | (上の3行) |
| `release-notes.md` | 8,297 | `6fbe05bed7bf79a6fd83df2d9662abe088b1e3d38ac5394e2c2092841a2a0c78`(`docs/releases/v1.4.0.md`、`docs/release/v1.4.0/release-notes.md` と同一) |

作り方: 既存の正式スクリプト `scripts/prepare-release-candidate.ps1`(インストーラー、単体 EXE、ポータブル ZIP、`SHA256SUMS.txt`)。ビルドに使ったのは上のコミットのソース。パスの置換(`--remap-path-prefix`)つきの release ビルド。作り直す前に、前回の成果物のフォルダはスクリプトが削除した(前回の成果物は残っていない)。

### 置き換え前の候補(公開には使わない)

P9-12b のビルド(ソース `38ed2a8`、P9-13 まで):

| ファイル | SHA-256 |
| --- | --- |
| `Life-Launcher-v1.4.0-windows-x64-setup.exe` | `7f05aee400ad054cb5c1f30b62cd69cfcc519b8d5e06b1b78869d26aabfe7ce7` |
| `Life-Launcher-v1.4.0-windows-x64.exe` | `9f9ae7101acd3f67a31de50563d06951cf7d5211180d281fb5bba7a43fdf72f7` |
| `Life-Launcher-v1.4.0-windows-x64-portable.zip` | `260c853868243dd1b1fac5ce64e6e75cd60c8c04b7533abc44bd095d05cabcb9` |

P9-12 のビルド(ソース `731cb08`、P9-13 の前):

| ファイル | SHA-256 |
| --- | --- |
| `Life-Launcher-v1.4.0-windows-x64-setup.exe` | `d99c1d5b54dc5a98d247008ba52b5a6e04bb1f7af9734311d07190b9d16d5659` |
| `Life-Launcher-v1.4.0-windows-x64.exe` | `9074e8c1af700d7df84a1c01fb3ff32596afb37b67bad0ea11ac8e0af60bb30d` |
| `Life-Launcher-v1.4.0-windows-x64-portable.zip` | `580172c0a8fb4855487cf617e9704c64ae908d1511e8ae6d2dbf71fe1689dbf7` |

## 5. リリースゲートの証跡(作り直したビルドで、すべてやり直した)

| # | ゲート | 結果 | 証跡 |
| --- | --- | --- | --- |
| 1 | 依存関係(npm) | **通過** | `npm.cmd audit`: 脆弱性 0 件 |
| 2 | 依存関係(Rust) | **通過**(脆弱性 0 件、情報警告 11 件は据え置き) | `cargo audit`: 脆弱性 0 件、`allowed warnings` 11 件(前回と同じ内訳)。内訳と据え置きの理由は 7. |
| 3 | 公開安全 | **通過** | `npm.cmd run public:check`: 3575 ファイル、blocker 0 |
| 4 | 公開文書の横断確認 | **通過** | README、README.en.md、CHANGELOG、`docs/releases/v1.4.0.md`、仕様書、OVERVIEW のバージョンが 1.4.0 で一致。P9-13・P9-14 の内容が CHANGELOG、リリースノート(2つの控えは同一)、README、README.en.md、仕様書にある。配布ファイル名、config schema `3`、Web Demo が別公開工程であることは、すべての文書で同じ。`readme-contract` のテストも通っている |
| 5 | ポータブル ZIP | **通過** | 中身は `Life-Launcher-v1.4.0-windows-x64.exe` と `README.txt` の2つだけ。絶対パス、`..`、シンボリックリンクなし。EXE 以外の実行形式なし。ZIP 内の EXE と単体 EXE の SHA-256 が一致(`0f833c17…bb6`) |
| 6 | 秘密情報・パスの走査 | **通過** | 単体 EXE、ZIP 内 EXE、インストーラー、ZIP を ASCII と UTF-16LE で走査。`C:\Users\`、`D:\dev\`、開発者のユーザー名(2種類)、`Takuyakou\`、秘密鍵ヘッダー(RSA、OPENSSH、PRIVATE KEY、EC)、トークン接頭辞(`ghp_`、`github_pat_`、`gho_`、`AKIA`、`xoxb-`、`xoxp-`、`sk-ant-`)、`sourceMappingURL`、`.js.map` のいずれも 0 件。インストーラーは圧縮されているため、中身の走査には限りがある(EXE 本体は圧縮されていない) |
| 7 | SHA-256 | **通過** | `Get-FileHash`(ビルドのスクリプトとは別の手段)で3ファイルを再計算し、`SHA256SUMS.txt` と全件一致 |
| 8 | バージョン情報 | **通過** | 2. |
| 9 | Windows Defender | **通過(検出 0 件)** | Defender は有効(AMService、Antivirus、リアルタイム保護とも有効。署名 1.463.31.0、2026-10-30 更新)。`Start-MpScan -ScanType CustomScan` を、候補フォルダ全体、インストーラー、単体 EXE、ZIP、ZIP を展開したフォルダに実行し、スキャンは完了、`Get-MpThreatDetection` の新しい検出は 0 件 |
| 10 | 必須ゲート | **通過** | 下の表 |
| 11 | インストーラー画像(PR #111) | **通過** | PR #111 は `main` に入っている。`tauri.conf.json` に `installerIcon`、`sidebarImage`(`installer/nsis-sidebar.bmp`、実寸 190×290)、`uninstallerIcon` があり、`headerImage` はない。作り直したインストーラーの最初の画面で、日本語、サイドバー画像(Life Launcher のロゴ、「今やる一手を、開始まで。」)の表示を確認(100%) |
| 12 | 公開スクリーンショット | **通過** | `npm.cmd run screenshot:public` を再実行。見出しの見た目が変わったので、`main-dashboard.png`(9,919 画素、x 268〜1341、y 331〜767)と `contact-sheet.png`(13,300 画素)が変わり、コミットした。`dictionary.png` は 7 画素(x 12〜13、y 132〜157)だけ違ったが、見出しと無関係な描画の揺れなので、コミットせず元に戻した。`instruction-viewer.png` と `web-demo.png` は変わっていない。合成データだけで、個人データ、パス、ノートは写っていない |
| 13 | CI(`windows-latest`) | 最新の HEAD は成功(下記)。`9a86f7a` 単体は走っていない | **最新の HEAD の CI**: PR #129 の `verify` は、P9-12c のコミット `135d9db` で成功した(run 41029806652、`windows-latest`、499 件、Rust 130+1、監査)。この Stage(P9-12d)のコミットの push 後の結果は、報告(チャット)に書く。**ビルドに使ったコミット `9a86f7a` 単体の CI は走っていない**。`9a86f7a` は PR #129 の途中のコミットで、CI はその後の HEAD で走った。`9a86f7a` と `135d9db` の差分は文書 2 ファイルだけ(P9-12R で確認) |

### 必須ゲート(`release/v1.4.0`、作り直したビルドのソース)

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | 通過(3575ファイル、blocker 0) |
| `npm.cmd run lint` | 通過 |
| `npm.cmd run build` | 通過 |
| `npm.cmd run test:visual` | **499件すべて通過**(P9-13 の14件、P9-14 の18件を含む)、1.8分(110秒)。※1回目の実行で、1件(`post-v133b-followup`「mouse … toolbar Settings and menu」の `toBeFocused`)が落ちた。**1回目の失敗の原因は不明**。直後に、そのテストだけを10回繰り返して全件通り、全体の再実行は 499 件通った。P9-12R(独立精査)でも、全体 3 回(499 件すべて成功)とそのテスト単独 10 回(10/10 成功)を実行し、**再現しなかった**。コードの読み取りで、確定的な製品の競合は見つからなかった。原因が分からないままなので、再発した場合は、`document.activeElement`、イベントの時刻、前面ウィンドウを同時に記録する |
| `cargo fmt -- --check` / `cargo check` / `cargo clippy --all-targets -- -D warnings` | 通過 |
| `cargo test` | 通過(130件 + 1件) |
| `git diff --check` | 通過 |

### 独立の追加確認(2026-10-31)

6. の走査は EXE の生バイトが対象で、画面の資産(JS・CSS)は EXE の中で圧縮されていて中まで見られない。そこで、次を追加で確かめた。

- `9a86f7a` と同じソース(`9a86f7a..HEAD` は文書だけ)から `npm.cmd run build` で作り直した `dist/` を走査した。`C:\Users`、`D:\dev`、開発者のユーザー名、`Takuyakou`、秘密鍵ヘッダー、トークン接頭辞(`ghp_`、`github_pat_`、`gho_`、`AKIA`、`xoxb-`、`xoxp-`、`sk-ant-`)、`sourceMappingURL` は 0 件、`.map` ファイルも 0 件。URL は、仕様の名前空間(w3.org、json-schema.org)、ライブラリのエラー説明(`reactjs.org`、`markedjs/marked`)、入力欄のプレースホルダー例(`https://example.com/`)、CSP とローカルの資産の `asset.localhost` だけで、外部へ通信する URL はない。P9-14 のクラス名(`victoryBar--empty`)が含まれる。
- `v1.3.4..9a86f7a` で、Tauri の権限(`src-tauri/capabilities`)は変わらず、`tauri.conf.json`(CSP を含む)はバージョン番号以外変わっていない。Rust に、新しいコマンド・外部プロセスの実行・`unsafe` の追加はない。画面のコードに `dangerouslySetInnerHTML`・`innerHTML`・`eval(`・`fetch(` の追加はない。コミットの作者のメールアドレスは GitHub の noreply だけ。
- 限界: 上は、ビルドの出力を作り直したものの確認で、候補の EXE の中から取り出した資産そのものの照合ではない(ビルドの来歴 R6 と同じ限界。13. に次の版の課題として書いた)。

## 6. 変更の概要(v1.3.4 → v1.4.0)

Phase 9(UI/UX 整理)の P9-00〜P9-11、P9-10b、P9-13、P9-14。機能の追加はなく、データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。詳細は `docs/phase9/` の各報告、統合回帰は `docs/phase9/11-integrated-regression.md`(判定 PASS)、実機確認で見つかった点の修正は `docs/phase9/13-native-fixes.md`(判定 FIXED)と `docs/phase9/14-heading-victory-polish.md`(判定 FIXED)。依存ライブラリの脆弱性修正(DOMPurify `3.4.17` など。#115)は、Phase 9 の前に `main` へ入っている。

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
| `release/v1.4.0` に P9-14 が入っていて、バージョンはすべて 1.4.0 | 入っている(`main` の `a4a94e7` を取り込み済み)。バージョンは 2. のとおり、すべて 1.4.0 |
| 公開文書と公開スクリーンショットに P9-14 の変更を反映した | 反映した(3.、5. の 4・12) |
| 成果物を作り直し、リリースゲートをすべてやり直して通った | 通った(4.、5.。前回の結果は流用していない) |
| 判定書のネイティブ確認に A・B・C がある | 9. |
| `native-checklist.md` が C の一覧になっている | `docs/release/v1.4.0/native-checklist.md` |
| 公開手順が新しいハッシュで書かれている | 10. |

## 9. ネイティブ確認(Windows 実機)

### A. オーナーと Claude が実機で確認した結果(前回までのビルド)

確認した環境: Windows 11、表示倍率 100% と 150%。隔離したテスト用プロファイル(`release-candidate/native-check/`、`createFullTodayFixture` から作った合成データ)。`%APPDATA%\life-launcher` には触れていない(自動起動の登録、ウィンドウの位置、WebView2 のデータは普段の場所に触れる。B と D を参照)。

| # | 項目 | 結果 |
| --- | --- | --- |
| 5 | 100%・150% での表示(メイン 標準・大・特大、拡大タイマー、ミニ 待機中・実行中、今日やるものを選ぶ) | 確認済み(P9-12 のビルド `731cb08`)。大・特大の今日の3件の見出しの並びだけ不具合があり、P9-13 で直した。ほかに重なり・切れはなかった。150% でもミニは画面右下に収まった。今日やるものを選ぶ画面(100%)では候補4件がすべて見えた |
| 6 | 実フォントでの折り返しと省略 | 確認済み(合成データの範囲)。行動文・名前の切れや重なりはなかった。長い文のサンプルでは見ていない |
| 7 | ドラッグ&ドロップ | 確認済み。今日の3件のカードの並べ替え、サイドバーのボタンのグループ間の移動(移動元が0件になると案内が出る) |
| 8 | 実行中表示の同期(実操作) | 確認済み。今やる一手から開始 → 今日の3件のカードも「実行中」。今日の3件のカードから開始 → 今やる一手も「実行中」。サイドバー Timer、拡大タイマー、ミニにも行動文が出た |
| 9 | 今日の3件の優先(P9-05、実データ) | 確認済み。今やる一手が今日の3件の項目を理由「今日の3件に入っている一手です」で出した。今日やるものを選ぶ画面で次の一手を今日の3件へ足すと、今やる一手がすぐそれに変わった。完了すると従来の候補(理由「今週の重点で、今日はまだ取り組んでいません」)に変わった |
| 10 | インストーラーの画面を 150% で確認 | オーナーが確認し、問題なし |
| — | 色(保存・決定=緑、キャンセル=赤)、待機中 Timer の中立色、「通常タイマー」が1回だけ | 確認済み |
| 11 | P9-13 のビルド(P9-12b、ソース `38ed2a8`)での確認 | オーナーが確認し、見出しの間隔、説明の文字、勝利条件の未入力時の光り方、十字キーでの二重の四角、見出しの枠を直すことにした(P9-14)。この5点は C で、作り直したビルドを確認してもらう |

仕様どおりで不具合ではないと判断したもの(記録):

- ミニから開始後すぐ(1分未満)に終了すると、「今日の分は完了にしますか？」が出ず、記録もされない(仕様書 §14.1 の早期完了のしきい値と、1分未満は記録しない決まりのとおり)。

A の確認は前回までのビルドで行ったもので、P9-13・P9-14 で変えたのは、見出しの列・枠・文字、勝利条件の反応、フォーカスの輪、の CSS と、勝利条件の未入力のクラスと自動フォーカスの輪の印だけ(Rust、データ、タイマー、ドラッグ&ドロップの処理は変えていない)。この変更は C で、作り直したビルドを確認してもらう。

### B. 作り直したビルドで、実装担当が確かめたこと

確認した環境: Windows 11 Home 10.0.26200(x64)、表示倍率 100%(`GetDpiForWindow` = 96)。確認の方法: 成果物の EXE を起動し、アプリの自己終了用の既存の仕組み(環境変数 `LIFE_LAUNCHER_RELEASE_SMOKE_EXIT_AFTER_MS`)で終了させた。確認用の `%APPDATA%` は一時フォルダーに切り替えた(P9-12b と同じ方法)。**`%APPDATA%\life-launcher` には触れていない。ただし、自動起動の登録(`HKCU\...\Run` と `StartupApproved\Run`)、ウィンドウの位置(`app_config_dir` の `.window-state.json`)、WebView2 のデータ(Local AppData の識別子のフォルダー)は、`APPDATA` を切り替えても普段の場所に触れる**(P9-12R の R1)。

| # | 項目 | 結果 | 内容 |
| --- | --- | --- | --- |
| 1 | 単体 EXE の起動 | **確認済み** | 空のプロファイルで起動。約0.3秒でウィンドウ「Life Launcher」が出た。20秒後に自己終了、終了コード 0。`config.json`(schema 3)を新規作成 |
| 2 | ポータブル(ZIP 展開後の EXE)の起動 | **確認済み** | 1. と同じ手順で、ウィンドウ表示、終了コード 0 |
| 3 | インストーラーの起動 | **一部確認済み** | 起動して「Life Launcher セットアップ」の最初の画面を表示した。日本語、サイドバー画像の表示を確認(100%)。確認後に閉じた。**実際のインストールとアンインストールは行っていない**(利用者の PC のインストール情報を書き換えるため。C の 5.) |
| 4 | コピーしたプロファイルでの起動とデータの保持 | **確認済み(コピーで)** | このマシンにある既存のデータ(config、sessions.jsonl、notes.json)を一時フォルダーへ**コピー**して、作り直した単体 EXE を起動。起動に成功、終了コード 0。3つのファイルとも、起動の前後でバイト単位で同一(今回は書き換えなし)。**元のデータは変更していない** |

環境の注意(v1.3.2 の判定書にも記録されている種類のもの):

- このマシンでは、既定のグローバルホットキー(`Ctrl+Alt+Space`)が、すでに別のものに登録されていて、起動時に登録をスキップする(アプリは起動を続ける)。
- 終了時に、WebView2 が `Failed to unregister class Chrome_WidgetWin_0`(エラー 1412)を出すが、終了コードは 0。以前の版と同じ。

### C. 作り直したビルドで、オーナーが確認したこと(2026-10-31)

手順と期待結果、確認の記録は `docs/release/v1.4.0/native-checklist.md`。確認したビルドは 4. のハッシュのもの。オーナーが言った結果だけを書く。

| # | 項目 | 状態 |
| --- | --- | --- |
| 1 | 標準・大・特大で、4つの見出しに枠があり、名前と件数の間が詰まってそろい、説明の文字の大きさがそろっている | 確認済み(オーナーが「確認しました」と報告。項目ごとの返答はなし) |
| 2 | 十字キーで見出しへ移ると、黄色い四角が1つだけ出る | 確認済み(同上) |
| 3 | 勝利条件を空にしてアプリを起動し直すと、勝利条件が光っていない。マウスを乗せても光らない。そのまま Enter で入力を始められる | 確認済み(同上) |
| 4 | 勝利条件が入っているとき、マウスを乗せると枠が金色に強まり、少し明るくなって 1px 浮く。Tab で本文に移ると、内側の黄色い輪だけが出る | 確認済み(同上) |
| 5 | `Life-Launcher-v1.4.0-windows-x64-setup.exe` で実際にインストールし、起動できる(**インストールした版は実際のデータで起動する**) | 確認済み。インストールと起動はできた。注意あり(下) |

**5. の注意**: 何もインストールされていないはずの PC で、インストーラーに「インストールする前にアンインストールする」の選択肢が出た。それを選ぶと「アンインストールできません。」と出て、選択画面に戻った(「アンインストールしない」を選べばインストールできる)。以前のインストールの登録情報(`Software\Microsoft\Windows\CurrentVersion\Uninstall\Life Launcher`)だけが残っていたと考えられる。Tauri 標準の NSIS インストーラーの動きで、v1.4.0 の変更とは関係ない。期待どおりの結果として扱う(停止の条件には当たらない)。11. に既知の制限として、13. に次の版で行うことを書いた。

### D. 独立精査(P9-12R)の判定と、R1 の扱い

- P9-12R(Codex、報告 `docs/release/v1.4.0/RELEASE-REVIEW-codex.md`、2026-10-30、対象 HEAD `135d9db`)の判定は **INCONCLUSIVE**。ソース、ハッシュ、バージョン、ZIP、秘密情報の生バイト走査、Defender、必須ゲート、データ形式の不変は一致し、公開を止める不具合は見つからなかった。理由は1つで、配布用の EXE を、実際の PC から切り離した環境で起動して確かめていないこと(R1)。
- R1 についてのオーナーの判断(2026-10-30): オーナーの PC は Windows 11 Home で、Windows サンドボックスは使えない。切り離した環境での起動確認は行わず、**オーナーが自分の PC で行う実機確認(C の5項目。配布 EXE の起動と、インストーラーでの実際のインストールを含む)で代える**。
- テスト用の起動(`launch-v140-isolated.bat`)で、自動起動の登録・ウィンドウの位置・WebView2 のデータ(辞書・手順書の表示設定)が普段の場所に触れることは、オーナーの PC で同じアプリを使うので受け入れる。自動起動の登録は、普段のアプリ(インストールした v1.4.0)を起動すると、設定どおりに登録し直される。
- C の5項目は 2026-10-31 に確認済み。したがって R1 は、オーナーの判断どおり、オーナーの実機確認で代えた。これは、切り離した環境での独立した起動確認が行われたという意味ではない。
- R2〜R5 は、この判定書の 5.(R2、R5、追加確認)、10.(R4)、11.(R3)に反映した。R6・R7 は次の版の課題(13.)。

## 10. 承認後の公開手順

オーナーの明示承認があるまで、次は**実行しない**(PowerShell で上から順に実行する)。各コマンド(`git`、`gh` など)は、実行のたびに終了コードを確かめ、0 でなければそこで止める(`if ($LASTEXITCODE -ne 0) { throw "失敗" }`)。次のコマンドは、公開に使う前に、その時点の状態で読み直す。

### 10.1 マージの前の確認

1. `release/v1.4.0` の HEAD が、オーナーが承認したコミット(P9-12d の最後のコミット)であること。PR #129 の CI(`verify`)がそのコミットで成功していること。
2. タグ `v1.4.0` と GitHub Release が無いこと。`gh release view` は、「release not found」以外の失敗(認証・通信など)を「無い」と判断しない。
3. `release-candidate/v1.4.0/` の3ファイルの SHA-256 が、4. と一致すること。**一致しなければ停止する**(作り直さない。オーナーに報告する)。

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$candidate = Join-Path $repo "release-candidate/v1.4.0"
git fetch origin
$head = (git rev-parse origin/release/v1.4.0).Trim()   # オーナーが承認したコミットと同じか確かめる
gh pr view 129 --json state,headRefOid,statusCheckRollup
git ls-remote --tags origin refs/tags/v1.4.0           # 何も出ないこと
gh release view v1.4.0                                  # "release not found" になること(ほかの失敗は停止)
Get-ChildItem $candidate -File -Include *.exe,*.zip | Get-FileHash -Algorithm SHA256   # 4. と照合
```

### 10.2 マージ

オーナーの指示で、承認したコミットを指定してマージする(その間に PR の HEAD が動いていたら失敗する)。

```powershell
gh pr merge 129 --merge --match-head-commit $head
```

### 10.3 マージの後の確認

1. マージ後の `main` と、ビルドに使ったコミット `9a86f7a` の差分が**文書だけ**であること。製品のファイル(`src/`、`src-tauri/`、`package.json`、ロックファイルなど)の差分が1つでもあれば停止する。
2. マージ後の `main` の CI が成功していること。

```powershell
git fetch origin
$unexpected = @(git diff --name-only 9a86f7a origin/main |
  Where-Object { $_ -notmatch '^docs/|^README(?:\.en)?\.md$|^CHANGELOG\.md$' })
if ($unexpected.Count) { throw "main の製品差分を確認するまで停止: $unexpected" }
$releaseCommit = (git rev-parse origin/main).Trim()
gh run list --branch main --commit $releaseCommit --json status,conclusion,name   # 成功を確認
```

### 10.4 タグ

マージ後の `main` のコミット(`$releaseCommit`)に、注釈つきのタグ `v1.4.0` を付けて push する。違うコミットに付けない。

```powershell
git tag -a v1.4.0 $releaseCommit -m "Life Launcher v1.4.0"
git push origin refs/tags/v1.4.0
```

### 10.5 下書きの Release

アセットは次の4つだけ。

```powershell
$assets = @(
  "Life-Launcher-v1.4.0-windows-x64-setup.exe",
  "Life-Launcher-v1.4.0-windows-x64.exe",
  "Life-Launcher-v1.4.0-windows-x64-portable.zip",
  "SHA256SUMS.txt"
) | ForEach-Object { Join-Path $candidate $_ }
gh release create v1.4.0 @assets --verify-tag --draft --title "Life Launcher v1.4.0" --notes-file docs/releases/v1.4.0.md
```

### 10.6 下書きの確認

新しい空のフォルダーへダウンロードし、ハッシュを、公開した `SHA256SUMS.txt` と、この判定書の 4. の**両方**と照合する。アセットが4つだけであること。

```powershell
$download = Join-Path $repo ".local-evaluation/v140-redownload"
if (Test-Path $download) { throw "新しい空の検証先を用意する" }
gh release download v1.4.0 --dir $download
Get-ChildItem $download -File | Get-FileHash -Algorithm SHA256
```

### 10.7 公開

```powershell
gh release edit v1.4.0 --draft=false
gh release view v1.4.0 --json tagName,url,isDraft
```

### 10.8 公開後の確認(必須)

- もう一度、**新しい空のフォルダー**へダウンロードし、10.6 と同じ照合(公開した `SHA256SUMS.txt` と、4. の `b6acfae2…1e4a`、`0f833c17…bb6`、`5fdfe119…5ee`)をする。
- ダウンロードした単体 EXE と、ポータブル ZIP を展開した EXE が起動し、メイン画面が出ること(オーナーの PC で起動してよい。R1 と同じ扱いで、自動起動の登録・ウィンドウの位置・WebView2 のデータは普段の場所に触れる)。
- `releases/latest` が v1.4.0 を指すこと。README のダウンロードの説明と、実際のファイル名が合っていること。
- `gh release view` だけで、起動やリンクの確認を済ませたことにしない。

### 10.9 記録

`docs/release/v1.4.0/PUBLIC-RELEASE-REPORT.md` に、マージのコミット、タグ、Release の URL、照合したハッシュ、起動の確認を書く(v1.3.2 と同じ形式)。

### 10.10 失敗したとき

アップロード・照合・起動のどれかが失敗したら、**下書きのまま止めて**オーナーに報告する。成果物を作り直さない。別の空の取得先で再確認し、通信の問題と候補の問題を分ける。タグの付け直し(force)と、アセットの無条件の上書き(`--clobber`)をしない。公開した後に問題が分かった場合も、オーナーの判断なしにタグや配布物を差し替えない(最新版としての案内を止めるかどうかは、原因を確かめてからオーナーが決める)。

### 10.11 Web Demo

v1.4.0 の変更の Web Demo への反映は、別の判断(この判定書の範囲外)。差分の一覧は `docs/phase9/11-integrated-regression.md` の 16.

## 11. 既知の制限

- UI は日本語中心で、英語対応は主に上部ツールバーなどの一部。
- URL は Windows の既定ブラウザで開く。
- ブックマーク名の取得は、ローカルのブラウザープロファイルを読める場合に限る。
- HTML 手順書は、静的な HTML/CSS と登録したフォルダー内の相対 asset だけを表示する(JavaScript に依存する画面、フォーム、入れ子のフレーム、外部 asset は動作しない)。
- 配布バイナリは未署名で、Windows SmartScreen の警告が出ることがある。WebView2 Runtime が必要。自動アップデーターはない。
- 以前のインストールの登録情報だけが残っている PC(本体のフォルダーを手で消した場合など)では、インストーラーに「インストールする前にアンインストールする」が出て、選ぶと「アンインストールできません。」で戻る。「アンインストールしない」を選べばインストールできる(Tauri 標準のインストーラーの動き。9. C の 5.)。
- 達成済みの勝利条件の枠は、Main で 0.72 ではなく 0.42 の濃さのまま。v1.4.0 では変えない(オーナー判断 2026-10-30)。
- Rust の依存の情報警告 11 件(7.)。
- Web Demo は v1.4.0 の変更を反映していない(今日の3件の優先、件数の二重表示、「変更」というボタン名など)。
- 切り離した環境(別の Windows ユーザー、仮想マシンなど)での、配布 EXE の独立した起動確認は行っていない(R1。オーナーの実機確認で代えた。9. D)。

### 保守のメモ

- 「今日やるものを選ぶ」画面の旧い見出し(`.todayBuilderHeader`)は、`legacyTodayBuilderVisible()`(`src/App.tsx`)が常に `false` を返すため、通常は表示されない(P9-12R で確認、この Stage でも確認)。ここの見出しの二重の四角は、画面では確かめていないが、通常は到達しない。この見出しを再び表示するときは、先に確かめる(`docs/phase9/14-heading-victory-polish.md` 3.5)。

## 12. この Stage で、行わなかったこと

tag、GitHub Release、アセットのアップロード、Web Demo の deploy、`main` へのマージ(PR #129)。成果物(`release-candidate/v1.4.0/`)の作り直しと変更(3ファイルのハッシュは 4. のまま)。製品コード、テスト、`package.json`、Cargo のファイル、公開文書(CHANGELOG、リリースノート、README)の変更。

## 13. 次の版で行うこと(v1.4.1 以降)

- 正式スクリプト(`scripts/prepare-release-candidate.ps1`)に、ビルドしたコミット、作業ツリーがきれいだったか、Node・Rust・Tauri CLI のバージョン、ビルド直後のハッシュを記録させる(R6)。
- テスト用の起動(`launch-v140-isolated.bat`)で、普段のアプリの自動起動の登録・ウィンドウの位置・WebView2 のデータに触れない方法を用意する(R1)。
- 未使用の CSS の削除、スタイルの確認の待ち方(単発の読み取りをやめる)、画像比較の閾値を見直す(R7)。
- 以前のインストールの登録情報だけが残っているときに、インストーラーが出す「インストールする前にアンインストールする」の案内を分かりやすくする方法(インストーラーの文言、README の困ったときの説明など)を検討する(9. C の 5.)。
- 1回だけ落ちた `post-v133b-followup` のフォーカスのテストは、再発した場合に `document.activeElement`、イベントの時刻、前面ウィンドウを同時に記録する(5.)。
