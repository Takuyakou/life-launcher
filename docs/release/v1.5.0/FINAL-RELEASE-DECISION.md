# Life Launcher v1.5.0 Final Release Decision

**READY FOR USER APPROVAL**（自動で確かめられるゲートはすべて通った。ネイティブ確認・公開は、オーナーの判断で行う）

- 日付: 2026-11-19（JST）
- 候補のソース: ブランチ `p10/18-release`、ビルドしたコミット `87a89edd66440ddb9012fa274c146b48b1143b89`。成果物をビルドした時点の作業ツリーはきれい（`git status --porcelain` が空。ビルド中に `tauri build` が `src-tauri/Cargo.toml` の改行だけを書き換えたため、ビルド後に戻した。`git diff --ignore-all-space -- src-tauri/Cargo.toml` は空）。
- config schema: 3(v1.4.3 から変更なし)。省略できる項目を 2 つ足した(`settings.firstRunDoneAt`、`projects[].nextStep.resumeNote`)。v1.4.3 で開いても壊れず、v1.4.3 で保存するとこの 2 つは消える。
- 公開（tag・GitHub Release・アセットのアップロード）は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26200（x64）、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1、`rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.5.0 で一致している(2.)。
- 成果物 3 つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- 必須ゲートはローカルで通った(5.)。`test:visual` は 869 件を 1 回実行し、868 件成功。落ちた 1 件（`phase97-import` の半透明オーバーレイ背後の「外す」非表示差）は基準画像を撮り直し、該当 spec（11 件）を回し直して全件成功した。
- `npm audit` は GHSA-g3hv-75wg-m249（`minimatch`、開発用の依存だけ）の 9 件 moderate だけ。**新しい助言はない**。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 14 件（v1.4.3 の 12 件から、RustSec の助言の追加で `RUSTSEC-2026-0486` と `RUSTSEC-2026-0543` の 2 件が増えた。yanked の `async-executor 1.14.0` は同じ）。詳細は 5. #3 のとおり確認し、v1.5.0 では据え置く。新しい脆弱性はない。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #8)。
- 環境変数なしの起動では、`APPDATA` を一時フォルダへ向け、タイトルが「Life Launcher」で「テスト」が出ないことを確認した(5. #12)。
- テスト用の起動で、成果物の単体 EXE が起動し、タイトルが「Life Launcher (テスト)」になることを確認した(5. #13)。普段のアプリは終了させていない。
- 公開スクリーンショットを再生成し、`demo-start.gif` を追加した(5. #14)。

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

詳細は `docs/phase10/`(調べ・設計・段の表・決定)にある。各段の作業報告は、リポジトリの外の引き継ぎのフォルダにある。

| 段 | 内容 |
| --- | --- |
| P10-00b | 不具合の直し:やりたいことの `sourceWishlistId` が保存で消えることがある |
| P10-01 | 同梱フォント(Inter / Noto Sans JP)・字の太さ・動き(Motion)の土台・基準画像の撮り直し |
| P10-02 | 上の段とサイドバー(自動起動のアイコン、ミニと使い方を上の段から外す、見出しの開け閉めの動き) |
| P10-03 | 検索の欄と検索の窓(Ctrl+F)、候補の帯の動き |
| P10-04 | 今やる一手の並べ方(今日の3件の左からの順を先に見る。Rust) |
| P10-05 | メイン画面(今やる一手・今日の3件の札・次の一手の一覧・鮮度の知らせ) |
| P10-06 | やりたいこと(次の一手にする・未設定の知らせ・閉じた時のまとまり) |
| P10-07 | 左下のタイマー(待機中のミニのボタン・分数の桁の動き) |
| P10-08 | 拡大タイマーとミニの見た目 |
| P10-09 | 今日の3件に入れた次の一手を終えたときに、次はどこから始めるかを選ぶ画面 |
| P10-10 | 今日やるものを選ぶ画面・次の一手の編集 |
| P10-11 | はじめての起動の案内(`settings.firstRunDoneAt`) |
| P10-12 | 細部(行の Enter・F2・Delete、メニューのキーの札、トースト、落とす所とコピーの動き、記録の面) |
| P10-13 | 文書と版 1.5.0 |
| P10-14〜14g | リードの検査と直し(見本との食い違い、メイン画面の幅、待機中のタイマーを前の形に戻す、ロゴ・検索の字など) |
| P10-15〜15d | 記録の「今週を決める」の作り直し、取り込みのプロンプトの不具合の直し、動き 4 つと始めるボタンの浮き方、サイドバーの字 |
| P10-16 | リリースの準備(1 回目) |
| P10-17 | 足す物:札の字「今やる一手」・理由の言葉・次はここから(`resumeNote`)・見つからない物の知らせ(`load_missing_launch_targets`)・リリースページを開く・使い方の直し |
| P10-18 | 直し(予定時間のダイアログのフォーカスと見出しの間、「外す」を乗せた時だけ出す、勝利条件の候補のずれ)と、リリースの準備のやり直し |

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.5.0/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.5.0-windows-x64-setup.exe` | 9,667,338 | `6918F90B792A456CA1215C8C9D1C8DC4E1413DD4F5D612D97E5358C30835315F` |
| `Life-Launcher-v1.5.0-windows-x64.exe` | 22,234,624 | `141B9152A1DB6D8FD337C4F32478442CBBC7DA6005C13DF8D74234894B01E3B0` |
| `Life-Launcher-v1.5.0-windows-x64-portable.zip` | 10,995,803 | `92E88B4FA5B06C06B661414FD95520D309C21CB1C7F885A72626474B7608A259` |
| `release-notes.md` | 6,587 | `229D191C4E08D3D37AFE6FE6DA4670F95CB59F5969277605B7350C260131BE90`（`docs/releases/v1.5.0.md` と同じ） |
| `SHA256SUMS.txt` | 327 | 上の 3 つのハッシュを記録 |

v1.4.3 と比べると、インストーラーは 3,771,887 → 9,667,338 バイト（+5,895,451 バイト、約 +5.90 MB）、単体 EXE は 16,179,712 → 22,234,624 バイト（+6,054,912 バイト、約 +6.05 MB）、ポータブル ZIP は 5,143,775 → 10,995,803 バイト（+5,852,028 バイト、約 +5.85 MB）増えている。主な理由は P10-01 で同梱した Inter / Noto Sans JP の `.woff2` フォント（`dist/assets/*.woff2` 131 ファイル、合計 5,692,164 バイト、約 5.69 MB）であり、すでに圧縮された形式のためインストーラーと ZIP にもそのまま乗る。残りの約 0.16〜0.36 MB は Motion と Phase 10 の UI・Rust の追加分である。

`SHA256SUMS.txt` の 3 行を独立に再計算した値と照合し、一致した。ZIP を一時フォルダに展開した中身は `Life-Launcher-v1.5.0-windows-x64.exe` と `README.txt` の 2 つで、ZIP 内 EXE の SHA-256 は単体 EXE と一致した。

## 5. リリースゲート

1. **必須ゲート**: `public:check`、`lint`、`build`、`test:visual`（下の #11）、`cargo fmt --check`、`cargo check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 184 unit + 1 capability、`git diff --check` はすべてローカルで成功。
2. **npm audit**: 9 件 moderate。すべて P97-05 で理由を書いた GHSA-g3hv-75wg-m249（`minimatch`、開発用の依存だけ）。`npm audit --omit=dev` は 0 件。新しい助言はない。
3. **cargo audit**: 脆弱性 0 件。情報警告 14 件（v1.4.3 の 12 件から、`src-tauri/Cargo.lock` の依存版は変えていないが、RustSec の助言の追加で 2 件増えた。yanked の `async-executor 1.14.0` は同じ）。新しい脆弱性はない。増えた 2 件は次のとおりで、v1.5.0 では据え置く:
   - `RUSTSEC-2026-0486`（`rustix 1.1.4` / 種類: `unsound`）: Unix の `xattr` 関数に長さ 0 のバッファを渡したときに未初期化領域を初期化済み扱いする問題。Windows の依存木に入らず配布物に含まれない（`cargo tree --manifest-path src-tauri/Cargo.toml -i rustix --edges normal --target x86_64-pc-windows-msvc` の結果: `warning: nothing to print.`）。既存の `glib`（`RUSTSEC-2024-0429`）と同じ扱いにする。
   - `RUSTSEC-2026-0543`（`chrono 0.4.45` / 種類: `unmaintained`）: `chrono` が保守されていないという助言。Windows の直接の実行時依存に入る（`cargo tree --manifest-path src-tauri/Cargo.toml -i chrono --edges normal` の結果: `life-launcher v1.5.0` から直接到達）が、知られている脆弱性は無い。
4. **公開安全**: `public:check` は 3,710 ファイル、0 blockers。
5. **ポータブル ZIP**: 展開すると `Life-Launcher-v1.5.0-windows-x64.exe` と `README.txt`（v1.5.0 表記）。ZIP 内 EXE のハッシュは単体 EXE と一致。
6. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/`（計 142 ファイル、`.map` 0 件）を ASCII と UTF-16LE で走査し、0 件（ユーザーパス、リポジトリ名、ローカルユーザー名、トークン接頭辞、秘密鍵、source map）。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。
7. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.5.0。ProductName は Life Launcher。
8. **Windows Defender**: 成果物のコピー 3 ファイルを CustomScan。スキャン前後で検出数は 1 のまま（新しい検出 0）。署名 `1.463.364.0`。
9. **ビルドに使ったコミットの `dist/`**: 秘密情報の走査で 0 件（`.map` 0 件）。
10. **権限**: `git diff v1.4.3 -- src-tauri/capabilities src-tauri/gen/schemas` は差分なし。新しい Rust の命令 `load_missing_launch_targets` は、設定に入っている次の一手のアプリ・フォルダ・ファイル・手順書の場所があるかを確かめるだけで、ファイルの中は読まず、ネットワークの場所(`\\`・`//`)と URL は確かめない。権限の追加はない。
11. **FULL**: `npm.cmd run test:visual -- --reporter=line --workers=1` は 869 件、15.4 分。869 件中 868 件が通り、落ちた 1 件（`phase97-import` の半透明オーバーレイ背後に透ける「外す」非表示による差分）は基準画像 2 枚を撮り直し、該当 spec（11 件）を回し直して全件通った。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA`（および `LOCALAPPDATA`）を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった。確認の後にその起動だけを閉じた。
13. **テスト用の起動**: `scripts/start-test-profile.ps1 -Exe <単体 EXE>` で起動し、タイトルが「Life Launcher (テスト)」になることを確認した。確認の後にその起動だけを閉じた。
14. **公開スクリーンショット**: `npm.cmd run screenshot:public` で再生成し、`demo-start.gif` を更新した。`main-dashboard.png`（今日の3件の札「今やる一手」・理由の文言変更・通常時の「外す」非表示）、`contact-sheet.png`、`weekly-planning.png`（タブ下線位置の微小差のみ）、`dictionary.png`（P10-18 で 1000×640 中 12 ピクセル・最大 1 階調の描画差のみ）が更新された。`instruction-viewer.png` は変わっていない。

## 6. ネイティブ確認

`native-checklist.md` に書いた(優先の 19 件とほか)。オーナー確認待ち。

## 7. レビュー

各段の後に、リード(Claude)が Phase 10 の前・見本・後の画面を見比べ、実際の要素を測ってレビューし、直しの指示書(P10-14a〜g・P10-15b〜d・P10-18 の 1)で直した。公開の前の確認と公開は Claude Code が行う。

## 8. 既知の制限

v1.4.2 から引き継ぎ、直したもの（ミニタイマーのダブルクリックなど）は外す。

- UIは日本語中心で、英語対応は主に上部ツールバーなどの一部。
- Windows 11 のスナップレイアウト（最大化ボタンに乗せたときの配置の選択）は、アプリのボタンでは出ない。画面の端へのスナップと Win+Z は Windows の機能だが、この版では使える前提にしていない。
- HTML手順書は静的HTML/CSSと登録フォルダー内の相対assetだけ。JavaScript、フォーム、入れ子フレーム、外部assetは動かない。編集はできない。
- MHTMLはPNG・JPEG・GIF・WebPとCSSだけを埋め込む。SVGなどの画像、埋め込みフォント、スクリプトで動く部分、フォーム、入れ子フレーム、外部画像/CSSは表示されない。20 MBを超えるファイルは開けない。
- プロジェクトの新しい4色（lime・magenta・sand・coral）は、v1.4.2以前の版では自動の色で表示され、その版で保存すると色の指定が消える。戻す前にバックアップが必要。
- タイマーの開始・一時停止はスクリーンリーダーで自動読み上げしない。
- 画面の確認は、開発環境のWindows(Chromium)の画像比較と、ビルド済みアプリでの確認を組み合わせている。表示倍率やフォントが違う環境では折り返しが少し違う場合がある。
- 「次はここから」は、予定時間になったときの画面(今日の3件に入っていない次の一手のとき)と、次の一手の編集で書ける。途中でタイマーを終了したときは画面が出ないので、編集で書く。
- 見つからない物の知らせは、ネットワークの場所(\\server\… や //…)と URL を確かめない。割り当てたネットワークドライブ(Z:\ など)がつながっていないと、知らせが出るまで時間がかかることがある。
- Rust の依存の chrono は、RustSec で「保守されていない」(RUSTSEC-2026-0543)とされている。知られている脆弱性は無い。次の版で jiff か time への置き換えを考える。

## 9. 公開の手順

`inbox\P10-16\PUBLISH-v1.5.0.md` の手順で、Claude Code が利用者と話しながら行う。
