# Life Launcher v1.5.0 Final Release Decision

**READY FOR USER APPROVAL**（自動で確かめられるゲートはすべて通った。ネイティブ確認・公開は、オーナーの判断で行う）

- 日付: 2026-11-19（JST）
- 候補のソース: ブランチ `p10/16-release`、ビルドしたコミット `094a749c57d7029d065a92b9d153d12701092b05`。成果物をビルドした時点の作業ツリーはきれい（`git status --porcelain` が空。ビルド中に `tauri build` が `src-tauri/Cargo.toml` の改行だけを書き換えたため、ビルド後に戻した。`git diff --ignore-all-space` は空）。
- config schema: 3（v1.4.3 から変更なし）。`settings.firstRunDoneAt` を 1 つ足した。
- 公開（tag・GitHub Release・アセットのアップロード）は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26200（25H2、x64）、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1、`rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.5.0 で一致している(2.)。
- 成果物 3 つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- 必須ゲートはローカルで通った(5.)。`test:visual` は 848 件を 1 回実行し、845 件成功。残り 3 件は、アニメーションの待ち・古い期待・基準画像の差で、直したうえで該当 spec を再実行して成功した。
- `npm audit` は GHSA-g3hv-75wg-m249（`minimatch`、開発用の依存だけ）の 9 件 moderate だけ。**新しい助言はない**。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 14 件（v1.4.3 の 12 件から、RustSec の助言の追加で 2 件増えた。yanked の `async-executor` は同じ）。新しい脆弱性はない。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #8)。
- テスト用の起動で、成果物の単体 EXE が起動し、タイトルが「Life Launcher (テスト)」になることを確認した(5. #13)。普段のアプリは終了させていない。
- 環境変数なしの起動では、`APPDATA` を一時フォルダへ向け、テスト用の表示（「テスト」）が出ないことを確認した(5. #12)。
- 公開スクリーンショットを再生成した。`weekly-planning.png` を足し、`main-dashboard.png` と `contact-sheet.png` を撮り直した(5. #14)。

## 2. バージョン情報

| 場所 | 値 |
| --- | --- |
| `package.json` / `package-lock.json`(2か所) | 1.5.0 |
| `src-tauri/Cargo.toml` / `Cargo.lock`(`life-launcher`) | 1.5.0 |
| `src-tauri/tauri.conf.json` | 1.5.0 |
| 単体 EXE の FileVersion / ProductVersion | 1.5.0 / 1.5.0(ProductName: Life Launcher) |
| インストーラーの FileVersion / ProductVersion | 1.5.0 / 1.5.0(ProductName: Life Launcher) |
| ZIP 内 EXE の FileVersion / ProductVersion | 1.5.0 / 1.5.0(単体 EXE と SHA-256 も一致) |
| README、README.en.md、CHANGELOG、`docs/releases/v1.5.0.md`、`docs/OVERVIEW.md`、`docs/spec/current-spec.md` | 1.5.0（履歴と前の版の記述は残る） |

## 3. v1.4.3 からの変更（Phase 10）

詳細は `docs/phase10/` の各報告と、`done/P10-*.md` にある。

| 段 | 内容 | 報告 |
| --- | --- | --- |
| P10-00b | Phase 10 の下準備。ブランチの鎖と共通の決まりを整えた | `done/P10-00b.md` |
| P10-01 | 同梱フォント（Inter / Noto Sans JP）と字の重さの整理 | `done/P10-01.md` |
| P10-02 | 上の段の整理、自動起動のアイコン化、サイドバーの開け閉め | `done/P10-02.md` |
| P10-03 | 検索（Ctrl+F）の入口・候補・キー操作 | `done/P10-03.md` |
| P10-04 | Rust 側の整理（画面と分離） | `done/P10-04.md` |
| P10-05 | メイン画面（今やる一手・今日の3件・次の一手の行・鮮度） | `done/P10-05.md` |
| P10-06 | やりたいことのまとまり・色の線・未設定の見た目 | `done/P10-06.md` |
| P10-07 | 左下のタイマー・分数の桁・待機中のミニ | `done/P10-07.md` |
| P10-08 | 拡大タイマーとミニの 2 段 | `done/P10-08.md` |
| P10-09 | 終わりの確認（5 つの選択肢） | `done/P10-09.md` |
| P10-10 | 今日やるものを選ぶ画面と次の一手の編集 | `done/P10-10.md` |
| P10-11 | はじめての起動の案内・コピーのボタン | `done/P10-11.md` |
| P10-12 | 行のキー・メニューの札・トースト・取り込み | `done/P10-12.md` |
| P10-13 | 版を 1.5.0 にし、文書を更新 | `done/P10-13.md` |
| P10-14 / 14a〜14g | リードの検査と直し（見本との食い違い、G1〜G11、F15） | `done/P10-14.md` |
| P10-15 / 15b〜15d | 記録の「今週を決める」の作り直し、直し（H0〜H5・L1・L2）、動き（J1・J2・K1〜K4） | `done/P10-15.md` |
| P10-16 | リリースの準備（文書・画面の写し・FULL・配布物・判定書） | `done/P10-16.md` |

データの形は v1.4.3 から変わらない（config schema 3）。`settings.firstRunDoneAt` を 1 つ足しただけで、前の版で開いても壊れない。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.5.0/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.5.0-windows-x64-setup.exe` | 9,648,450 | `CD83C0F30250533152BAF4F32FA1B14B78E1E3279396D74A4CD9771043052A06` |
| `Life-Launcher-v1.5.0-windows-x64.exe` | 22,131,712 | `30187A5E83248722EA53EDDCF1460482B7BACFCBD5D16485551C27EB5EC43833` |
| `Life-Launcher-v1.5.0-windows-x64-portable.zip` | 10,966,378 | `39A970F53CA872A1B16CDBE370A45122641276BA5BF48E4C73945F4FDFA37F36` |
| `release-notes.md` | 5,428 | `docs/releases/v1.5.0.md` と同じ |
| `SHA256SUMS.txt` | 327 | 上の 3 つのハッシュを記録 |

`SHA256SUMS.txt` の 3 行を独立に再計算した値と照合し、一致した。ZIP を一時フォルダに展開した中身は `Life-Launcher-v1.5.0-windows-x64.exe` と `README.txt` の 2 つで、ZIP 内 EXE の SHA-256 は単体 EXE と一致した。

## 5. リリースゲート

1. **必須ゲート**: `public:check`、`lint`、`build`、`test:visual` 848 件、`cargo fmt --check`、`cargo check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 179 unit + 1 capability、`git diff --check` はすべてローカルで成功。
2. **npm audit**: 9 件 moderate。すべて P97-05 で理由を書いた GHSA-g3hv-75wg-m249（`minimatch`、開発用の依存だけ）。`npm audit --omit=dev` は 0 件。新しい助言はない。
3. **cargo audit**: 脆弱性 0 件。情報警告 14 件（v1.4.3 の 12 件から、RustSec の助言の追加で 2 件増えた。yanked の `async-executor` は同じ）。新しい脆弱性はない。
4. **公開安全**: `public:check` は 3,700 ファイル、0 blockers。
5. **ポータブル ZIP**: 展開すると `Life-Launcher-v1.5.0-windows-x64.exe` と `README.txt`。ZIP 内 EXE のハッシュは単体 EXE と一致。
6. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/` を ASCII と UTF-16LE で走査し、0 件（ユーザーパス、リポジトリ名、ローカルユーザー名、トークン接頭辞、秘密鍵、source map）。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。
7. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.5.0。ProductName は Life Launcher。
8. **Windows Defender**: 成果物のコピー 3 ファイルを CustomScan。スキャン前後で検出数は 1 のまま（新しい検出 0）。
9. **ビルドに使ったコミットの `dist/`**: 秘密情報の走査で 0 件。
10. **権限**: `git diff v1.4.3 -- src-tauri/capabilities src-tauri/gen/schemas` は差分なし。
11. **FULL**: `npm run test:visual -- --reporter=line --workers=1` は 848 件、14.2 分。初回は 845 件成功、3 件失敗（`phase87-dictionary-ux` のアニメーション待ち、`phase9-picker-space` の古い進み具合の期待、`phase97-import` の基準画像）。テストを直し、該当 spec を再実行して成功した。製品の不具合は見つかっていない。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA` を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった。確認の後にその起動だけを閉じた。
13. **テスト用の起動**: `scripts/start-test-profile.ps1 -Exe <単体 EXE>` で起動し、タイトルが「Life Launcher (テスト)」になることを確認した。確認の後にその起動だけを閉じた。
14. **公開スクリーンショット**: `npm run screenshot:public` で再生成。`weekly-planning.png` を追加し、`main-dashboard.png` と `contact-sheet.png` を撮り直した。`dictionary.png` と `instruction-viewer.png` は変わっていない。`contact-sheet.png` の中身は今の 3 枚のまま。

## 6. ネイティブ確認

`docs/release/v1.5.0/native-checklist.md` に、確認する項目を手順と期待結果つきで書いた。結果の欄は「オーナー確認待ち」のまま（実装担当は PASS と書かない）。

## 7. レビュー

各段の後に、リード（Claude）が Phase 10 の前・見本・後の画面を見比べ、実際の要素を測ってレビューし、直しの指示書 P10-14a〜g・P10-15b〜d で直した。

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

1. `docs/release/v1.5.0/native-checklist.md` の確認を、テスト用の起動で行う(最後の「インストーラーでの更新」だけは、ほかが済んでから普段のアプリで)。
2. GitHub で `p10/16-release` → `main` の PR を作る。CI が成功するのを 1 回だけ待つ。
3. PR をマージする。
4. マージのコミットに注釈つきタグ `v1.5.0` を付けて push する。
5. GitHub Release を下書きで作る。本文は `docs/releases/v1.5.0.md`、アセットは `release-candidate/v1.5.0/` の 4 つ(インストーラー・単体 EXE・ZIP・`SHA256SUMS.txt`)。
6. 下書きのアセットを新しい空のフォルダにダウンロードし、SHA-256 が判定書 4. と一致することを確かめてから公開する。
