# Life Launcher v1.4.3 Final Release Decision

**BLOCKED**

- P97-03 と P97-09 の別レビューの結果が未受領です。P97-11 の手順 8 により、この状態では `READY FOR USER APPROVAL` にしません。
- 画面のネイティブ確認は「オーナー確認待ち」です。自動で確かめられるゲートと成果物は用意できています。

- 日付: 2026-11-08(JST)
- 候補のソース: ブランチ `release/v1.4.3`、ビルドしたコミット `51092f7`（`main` = `3a18308`〔PR #161〕+ バージョン・公開文書・公開スクリーンショット・リリースノート + CI で見つかった画像比較の許容とパス比較の修正）。**成果物をビルドした時点の作業ツリーはきれい**（`git status --porcelain` が空）。
- PR: #162(`release/v1.4.3` → `main`)。マージしていない。
- config schema: 3(v1.4.2 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26200(x64)、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1。Rust は `rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.4.3 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- 必須ゲートはローカルで通った(5.)。`test:visual` は 673 件すべて通過。
- `npm audit` は、P97-05 で理由を書いた GHSA-g3hv-75wg-m249 の 10 件 moderate だけ。**新しい助言はない**。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 12 件（v1.4.2 と同じ ID と、yanked の `async-executor`）。新しい脆弱性はない。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #9)。
- テスト用の起動で、成果物の単体 EXE が起動し、タイトルが「Life Launcher (テスト)」になることを確認した(9. A)。普段のアプリは終了させていない。
- 環境変数なしの起動確認は、普段の v1.4.2 が起動中で単一インスタンスに合流したため、**未実施**。PASS とは書かない。
- 公開スクリーンショットは3枚が変わった（窓の閉じるボタンの幅・アイコン位置）。理由を 5. #13 に書いた。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.4.3 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.4.3 |
| `src-tauri/tauri.conf.json` | 1.4.3 |
| 単体 EXE の FileVersion / ProductVersion | 1.4.3 / 1.4.3(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.4.3 / 1.4.3 |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.4.3 / 1.4.3(単体 EXE と SHA-256 も一致) |
| README、README.en.md、CHANGELOG、`docs/releases/v1.4.3.md`、`docs/OVERVIEW.md`、`docs/spec/current-spec.md` | 1.4.3（履歴と v1.4.2 の記述は残る） |

README は版ごとに書き換えていない。ただし「主な機能」の手順書ビューアーの説明に MHTML を足した。

## 3. v1.4.2 からの変更(Phase 9.7)

詳細は `docs/phase9.7/` の各報告。

| Stage | 内容 | 報告 |
| --- | --- | --- |
| P97-01 | テスト用の起動(`LIFE_LAUNCHER_TEST_PROFILE`、`scripts/start-test-profile.ps1`)を追加 | `01-test-profile.md` |
| P97-02 | 窓の内側の余白のドラッグ、記録画面の「今日」、ミニタイマーのダブルクリック、設定画面の↑、窓を戻した直後の乗せた色を修正 | `02-small-fixes.md` |
| P97-03 | 手順書ビューアーで MHTML(`.mhtml` / `.mht`)を表示。上限20 MB、HTMLと同じ読み取り専用 | `03-mhtml.md` |
| P97-04 | 設定の「メンテナンス」とタスクトレイにバージョンを表示 | `04-version-display.md` |
| P97-05 | ESLint を更新。残る `npm audit` の理由を記録 | `05-eslint.md` |
| P97-06 | 古い「今日を組み立てる」の削除 | `06-legacy-today-builder.md` |
| P97-07 | README の整理 | `07-readme.md` |
| P97-08 | プロジェクトの色を12色に。止める・外す・削除のトーストを灰色に | `08-colors.md` |
| P97-09 | JSONでまとめて取り込む。ファイルのドロップ・貼り付け・プレビュー・取り込み・元に戻す | `09-json-import.md` |
| P97-10 | 「やりたいこと」の節を、プロジェクトごとのまとまりと色の線で見やすくし、「未分類」を最後に | `10-wishlist-layout.md` |
| P97-10c | 閉じるボタンを44pxにし、右端・最大化時の上端まで押せる範囲を拡張。Ctrl+W を追加 | `10c-close-button.md` |
| P97-10d | 取り込みプロンプトを2つにし、使い方に全文を出す | `10d-import-guide-prompt.md` |
| secret-guard | AIツール設定と秘密情報の公開防止ガード | `docs/security/secret-guard.md` |

データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。公開文書(CHANGELOG、リリースノート、README 2種、OVERVIEW、仕様書)に反映した。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.4.3/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.3-windows-x64-setup.exe` | 3,770,865 | `C94C0E50416C60D06006CE2643E10AAA6BC51EC43FF26FBE1F776180130461C6` |
| `Life-Launcher-v1.4.3-windows-x64.exe` | 16,173,056 | `FDF86641880A92282E09FF461B1C037848C515E799FD7ECCBEF70C0F20C48D45` |
| `Life-Launcher-v1.4.3-windows-x64-portable.zip` | 5,142,958 | `85A7473F483D735111CD3C9200AEA9A7FA19C2BD5B11BC8944D6B6BC997B7AC4` |
| `release-notes.md` | 8,698 | `CE98C329BEC49AC11191FF85DF04EF6FF0564549632B1A8F2908396384A3D2F7`（`docs/releases/v1.4.3.md` と同じ） |
| `SHA256SUMS.txt` | 327 | 上の3つのハッシュを記載 |

`SHA256SUMS.txt` の3行を独立に再計算した値と照合し、一致した。ZIP を展開した中の EXE の SHA-256 は、単体 EXE と一致した。

## 5. リリースゲート

1. **必須ゲート**: `public:check`、`lint`、`build`、`test:visual` 673件、`cargo fmt --check`、`cargo check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 157 unit + 1 capability、`git diff --check` はすべてローカルで成功。
2. **npm audit**: 10件 moderate。すべて P97-05 で理由を書いた GHSA-g3hv-75wg-m249（`minimatch`、開発用の依存だけ）。`npm audit --omit=dev` は0件。新しい助言はない。
3. **cargo audit**: 脆弱性0件。情報警告12件（v1.4.2 と同じ ID と yanked の `async-executor`）。新しい脆弱性はない。
4. **公開安全**: `public:check` は 3,659ファイル、0 blockers。
5. **ポータブル ZIP**: 展開すると `Life-Launcher-v1.4.3-windows-x64.exe` と `README.txt`。ZIP 内 EXE のハッシュは単体 EXE と一致。
6. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/` を ASCII と UTF-16LE で走査し、0件（ユーザーパス、リポジトリ名、ローカルユーザー名、トークン接頭辞、秘密鍵、source map）。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。
7. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.4.3。ProductName は Life Launcher。
8. **Windows Defender**: 成果物のコピー3ファイルを CustomScan。スキャン前後で検出数は 1 のまま（新しい検出0）。署名 1.463.181.0。
9. **ビルドに使ったコミットの `dist/`**: 秘密情報の走査で0件。
10. **権限**: `src-tauri/capabilities/*.json` は v1.4.2 からの差分なし。`src-tauri/gen/schemas` の差分もなし。
11. **テスト用の起動**: 成果物の単体 EXE を `scripts/start-test-profile.ps1` と同じ方法（`LIFE_LAUNCHER_TEST_PROFILE` をプロセスにだけ渡す）で起動し、タイトルが「Life Launcher (テスト)」になることを確認した。プロファイルは `release-candidate/native-check/profiles/20261108-141335`。普段のアプリは終了させていない。
12. **環境変数なしの起動**: 普段の v1.4.2 が起動中で、単一インスタンスの仕組みにより新しいプロセスが既存のアプリへ合流して終了したため、**未実施**。PASS とは書かない。Windows Sandbox はこの環境では権限が足りず確認できなかった。
13. **公開スクリーンショット**: `npm run screenshot:public` で再生成。`main-dashboard.png`、`instruction-viewer.png`、`contact-sheet.png` の3枚が変わった。差分は右上の窓のボタン（閉じるボタンの幅44px・アイコン位置）だけで、意図した P97-10c の変更。`dictionary.png` と `web-demo.png` は変わっていない。
14. **CI**: ビルドしたコミット `51092f7` で CI（run `42449926185`、job `128636742497`）が **success**（17分9秒）。`test:visual` 673件、`cargo test` 157 unit + 1 capability、`npm audit`、`npm audit --omit=dev` を含む全ステップが成功した。この後に足すのはこの判定書と `native-checklist.md` だけの文書コミットにする。CI で見つかった 2 件（取り込みドロップの 7px の描画差、テスト用プロファイルの 8.3 短縮パス）は、画像比較の許容とパス比較の修正で直した。

## 6. ネイティブ確認

`docs/release/v1.4.3/native-checklist.md` に、確認する項目を手順と期待結果つきで書いた。画面の項目は「オーナー確認待ち」で、PASS とは書いていない。

- 実装担当がコマンドで確かめたこと: 成果物の起動、テスト用のタイトル、普段のアプリを終了させていないこと。
- オーナーが行うこと: インストーラーでの v1.4.2 → v1.4.3 更新（普段のアプリ）、および画面の確認（テスト用の起動）。
- 自動で行える範囲: Windows Sandbox は権限が足りず使えなかった。仮想マシンもこの環境では用意していない。

## 7. 別レビューの結果(P97-03 / P97-09)

| 対象 | レビュー日 | 指摘 | 直した内容 | 状態 |
| --- | --- | --- | --- | --- |
| P97-03 MHTML | 未受領 | 未受領 | 未受領 | 未受領 |
| P97-09 JSON取り込み | 未受領 | 未受領 | 未受領 | 未受領 |

オーナーから結果を受け取っていないため、判定を `READY FOR USER APPROVAL` にしない。

## 8. 既知の制限

v1.4.2 から引き継ぎ、直したもの（ミニタイマーのダブルクリックなど）は外す。

- UIは日本語中心で、英語対応は主に上部ツールバーなどの一部。
- Windows 11 のスナップレイアウト（最大化ボタンに乗せたときの配置の選択）は、アプリのボタンでは出ない。画面の端へのスナップと Win+Z は Windows の機能だが、この版では使える前提にしていない。
- HTML手順書は静的HTML/CSSと登録フォルダー内の相対assetだけ。JavaScript、フォーム、入れ子フレーム、外部assetは動かない。編集はできない。
- MHTMLはPNG・JPEG・GIF・WebPとCSSだけを埋め込む。SVGなどの画像、埋め込みフォント、スクリプトで動く部分、フォーム、入れ子フレーム、外部画像/CSSは表示されない。20 MBを超えるファイルは開けない。
- プロジェクトの新しい4色（lime・magenta・sand・coral）は、v1.4.2以前の版では自動の色で表示され、その版で保存すると色の指定が消える。戻す前にバックアップが必要。
- タイマーの開始・一時停止はスクリーンリーダーで自動読み上げしない。
- 画面の確認は、開発環境のWindows(Chromium)の画像比較と、ビルド済みアプリでの確認を組み合わせている。表示倍率やフォントが違う環境では折り返しが少し違う場合がある。

## 9. 承認後の公開手順

v1.4.2 と同じ形。次の点を反映する。

1. オーナーの明示承認を得る。
2. PR #162 を `main` へマージする。マージ後の `main` の CI は待たず、差分が文書だけであることで代える。
3. `main` で `v1.4.3` のタグを作る。
4. GitHub Release に、`release-candidate/v1.4.3/` の3ファイルと `SHA256SUMS.txt`、`release-notes.md` をアップロードする。
5. 起動の確認では、オーナーの普段のアプリを終了させない。ダウンロードした EXE は `scripts/start-test-profile.ps1` で起動して確かめる。
6. 公開記録の PR は CI を待たずに報告して停止する。
7. Web Demo は別公開工程。このリリースでは触れない。

## 10. 次の版で行うこと

- ビルドの来歴の記録（ビルドした環境を、判定書だけでなく成果物からも分かるようにする）。
- Web Demo のタイマーの通知（Web Demo の別パッケージ）。
- P97-05 の「提案」（React Compiler 向けの規則など）。
- P97-06 の「提案」（計算後のスタイルの比較のテストをリポジトリに入れるか）。
- Phase 9.7 の各報告の「提案」。
- P97-03 / P97-09 の別レビューの結果を受けた修正（未受領のため）。
