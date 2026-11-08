# Life Launcher v1.4.3 Final Release Decision

**READY FOR USER APPROVAL**（自動で確かめられるゲートはすべて通った、の意味。公開は、オーナーの明示承認があるまで行わない）

- 日付: 2026-11-08(JST)
- 候補のソース: ブランチ `release/v1.4.3`、ビルドしたコミット `9567528`（`main` = `f004791` + E の残り・F・G）。**成果物をビルドした時点の作業ツリーはきれい**（`git status --porcelain` が空。ビルド中に `tauri build` が `src-tauri/Cargo.toml` の改行だけを書き換えたため、ビルド後に戻した。内容は同一）。
- PR: #164(`release/v1.4.3` → `main`)。マージしていない。
- PR #156 と #162 はオーナーが `main` にマージ済み（main = `5dbed53`）。#163 の内容も `main` にマージ済み（`f004791`）。この候補はその main から作った。
- config schema: 3(v1.4.2 から変更なし)
- 公開(tag、GitHub Release、アセットのアップロード、Web Demo の deploy)は**行っていない**。オーナーの明示承認を待つ。
- ビルドの環境: Node v24.14.1、npm 11.11.0、Windows 11 Home 10.0.26200(x64)、`@tauri-apps/cli` 2.11.4、`@tauri-apps/api` 2.11.1。Rust は `rustc 1.96.1 (31fca3adb 2026-06-26)`、`cargo 1.96.1 (356927216 2026-06-26)`。

## 1. 判定の要約

- バージョン情報は、すべて 1.4.3 で一致している(2.)。
- 成果物3つと `SHA256SUMS.txt` を正式スクリプトで作り、ハッシュは独立した再計算と一致した(4.、5.)。
- 必須ゲートはローカルで通った(5.)。`test:visual` は 682 件すべて通過。CI もビルドしたコミットで成功した。
- `npm audit` は、P97-05 で理由を書いた GHSA-g3hv-75wg-m249 の 10 件 moderate だけ。**新しい助言はない**。`--omit=dev` は 0 件。
- Rust は脆弱性 0 件。情報警告は 12 件（v1.4.2 と同じ ID と yanked の `async-executor`）。新しい脆弱性はない。
- Windows Defender のスキャンは、成果物のコピーで新しい検出 0 件(5. #9)。
- テスト用の起動で、成果物の単体 EXE が起動し、タイトルが「Life Launcher (テスト)」になることを確認した(6.)。普段のアプリは終了させていない。
- 環境変数なしの起動では、テスト用の表示（「テスト」）が出ないことを確認した(5. #12)。
- 公開スクリーンショットを再生成した。メインとコンタクトシートに 14px の描画差が出たが、意図した変更ではないため基準画像は更新していない。拡大タイマーの基準画像は D の変更に合わせて更新した(5. #13)。

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
| PR #156 | P97 リリース前修正。取り込みの保存の安全装置、MHTML の組み立て中の上限、JSON の取り出し、元に戻すの読み直し抑止、今日の3件のテスト | `09b-pre-release-fixes.md` |
| secret-guard | AIツール設定と秘密情報の公開防止ガード | `docs/security/secret-guard.md` |

データ形式、config schema、`sessions.jsonl` の書き込み内容は変わらない。公開文書(CHANGELOG、リリースノート、README 2種、OVERVIEW、仕様書)に反映した。

A〜E のリリース前修正を入れた。

- A: MHTML の本文を、Content-Location が Snapshot-Content-Location と一致する text/html から選ぶ。Chrome が本文に付ける frame- の Content-ID では本文を外さない。
- B: MHTML の一覧アイコンを fileWeb（ファイル + 地球）にし、色をプロジェクトの cyan（#56c9d8）にした。HTML は fileCode のまま。
- C: 取り込みのフッターの「キャンセル」を赤、「取り込む」を緑にし、設定画面のキャンセル・保存と同じ見た目にそろえた。新しい色は作っていない。
- D: 拡大タイマーの閉じるボタンを、✖ から「縮小」の印 + 「戻る」に変えた。位置・枠・押したときの動き・Esc はそのまま。
- E: 使い方の「私の状況」の例を、一般的な文（英語・運動・片付け）に置き換えた。取り込みプロンプトの「(例: 英語、ベース、部屋の片付け)」も「(例: 英語、運動、部屋の片付け)」にそろえた。
- F: `sanitizeHtmlDocument()` だけ `ALLOW_DATA_ATTR: true` にし、HTML・MHTML の `data-` 属性を残す。`sanitizeMarkdown()` は false のまま。スクリプト・イベント属性・フォーム・入れ子 frame・リモート読み込みの禁止、CSP、sandbox は変えない。data-v の CSS が効くことと、onclick・script・javascript: が消えることを HTML と MHTML の両方で確認した。
- G: 取り込み画面の一番下を、左が「取り込む」（緑）、右が「キャンセル」（赤）に並べ替えた。Tab の順も見た目に合わせた。

## 4. 成果物とハッシュ

置き場所: `release-candidate/v1.4.3/`（`.gitignore` 済み。リポジトリには入れていない）。

| ファイル | サイズ(バイト) | SHA-256 |
| --- | --- | --- |
| `Life-Launcher-v1.4.3-windows-x64-setup.exe` | 3,771,887 | `511CBB397E1D13B69B16EAEA55F893651162BED6EB93C330253980241F1CC4B7` |
| `Life-Launcher-v1.4.3-windows-x64.exe` | 16,179,712 | `EEB261909FE0ED84957A574335F5B300A0CFE5C4EF308A43F026C2F0F0BD947B` |
| `Life-Launcher-v1.4.3-windows-x64-portable.zip` | 5,143,775 | `6ACBE6D6D1A8E73936BD7CCC14D40B5561954B0E82DE4D5A606B14ABBE594784` |
| `release-notes.md` | 8,790 | `9D6D4BFC5344EC79B907222C8FC5511336AFC05DF5576C8EF698C8372601BDB4`（`docs/releases/v1.4.3.md` と同じ） |
| `SHA256SUMS.txt` | 327 | 上の3つのハッシュを記載 |

`SHA256SUMS.txt` の3行を独立に再計算した値と照合し、一致した。ZIP を展開した中の EXE の SHA-256 は、単体 EXE と一致した。

## 5. リリースゲート

1. **必須ゲート**: `public:check`、`lint`、`build`、`test:visual` 680件、`cargo fmt --check`、`cargo check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 160 unit + 1 capability、`git diff --check` はすべてローカルで成功。
2. **npm audit**: 10件 moderate。すべて P97-05 で理由を書いた GHSA-g3hv-75wg-m249（`minimatch`、開発用の依存だけ）。`npm audit --omit=dev` は0件。新しい助言はない。
3. **cargo audit**: 脆弱性0件。情報警告12件（v1.4.2 と同じ ID と yanked の `async-executor`）。新しい脆弱性はない。
4. **公開安全**: `public:check` は 3,663ファイル、0 blockers。
5. **ポータブル ZIP**: 展開すると `Life-Launcher-v1.4.3-windows-x64.exe` と `README.txt`。ZIP 内 EXE のハッシュは単体 EXE と一致。
6. **秘密情報の走査**: 単体 EXE、インストーラー、ZIP、ZIP 内 EXE、`dist/` を ASCII と UTF-16LE で走査し、0件（ユーザーパス、リポジトリ名、ローカルユーザー名、トークン接頭辞、秘密鍵、source map）。インストーラーと ZIP は圧縮されているため、生のバイト列の走査である。
7. **バージョン情報**: 単体 EXE・インストーラー・ZIP 内 EXE の FileVersion / ProductVersion は 1.4.3。ProductName は Life Launcher。
8. **Windows Defender**: 成果物のコピー3ファイルを CustomScan。スキャン前後で検出数は 1 のまま（新しい検出0）。署名 1.463.181.0。
9. **ビルドに使ったコミットの `dist/`**: 秘密情報の走査で0件。
10. **権限**: `src-tauri/capabilities/*.json` は v1.4.2 からの差分なし。`src-tauri/gen/schemas` の差分もなし。
11. **PR #156 の修正が入っていること**:
    - `src-tauri/src/commands/import.rs` に `ensure_import_write_allowed` と `suppress_reload_for_own_write` がある。
    - `src/mhtml/assembleMhtml.ts` に `addAssembledBytes` があり、画像の差し込みと CSS の `url()` の書き換えの途中で上限を確かめる。
    - `tests/visual/phase97-import.spec.ts` に、取り込んだ次の一手を Today3 で完了するテストと、JSON より前の `"` を取り出すテストがある。
12. **環境変数なしの起動**: 成果物の単体 EXE を、`APPDATA` を一時フォルダへ向け、`LIFE_LAUNCHER_TEST_PROFILE` を渡さずに起動した。窓のタイトルは「Life Launcher」で、「テスト」は出なかった。
13. **公開スクリーンショット**: `npm run screenshot:public` で再生成。`main-dashboard.png` と `contact-sheet.png` に 14px の描画差が出たが、意図した変更ではなく、文字の描画のわずかな差だったため、基準画像は更新していない。`instruction-viewer.png` と `dictionary.png` は変わっていない。D の拡大タイマーの基準画像は更新した。B の MHTML 一覧と E の使い方には基準画像が無い（MHTML の既存画像はドロップ表示、使い方は文章のテストのみ）。
14. **CI**: ビルドしたコミット `9567528` で CI（run `42485158604`、job `128745331003`）が **success**（15分55秒）。`test:visual` 682件、`cargo test` 160 unit + 1 capability、`npm audit`、`npm audit --omit=dev` を含む全ステップが成功した。この後に足すのは判定書などの文書だけのコミットにする。

## 6. ネイティブ確認

`docs/release/v1.4.3/native-checklist.md` に、確認する項目を手順と期待結果つきで書いた。画面の項目は「オーナー確認待ち」で、PASS とは書いていない。

- 実装担当がコマンドで確かめたこと: 成果物の起動、テスト用のタイトル、環境変数なしのタイトル、普段のアプリを終了させていないこと。
- テスト用の起動: 成果物の単体 EXE を `LIFE_LAUNCHER_TEST_PROFILE` 付きで起動し、タイトル「Life Launcher (テスト)」を確認した（PID 35092、プロファイル `release-candidate/native-check/profiles/20261108-224549`）。起動したまま、オーナーの確認を待つ。
- オーナーが行うこと: インストーラーでの v1.4.2 → v1.4.3 更新（普段のアプリ）、および画面の確認（テスト用の起動）。
- 自動で行える範囲: Windows Sandbox は権限が足りず使えなかった。仮想マシンもこの環境では用意していない。

## 7. 別レビューの結果(P97-03 / P97-09)

| 対象 | レビュー日 | 指摘 | 直した内容 | 状態 |
| --- | --- | --- | --- | --- |
| P97-03 MHTML | 2026-11-07 | 組み立ての途中で上限を確かめず、画像の差し込みと CSS の url() の書き換えで巨大な文字列を作るおそれ | PR #156 の E・E2(addAssembledBytes で途中で止める) | 済み |
| P97-09 JSON取り込み | 2026-11-07 | 取り込みと元に戻すが保存の安全装置(save_blocked・既存の設定の検証・直前の控え)を通っていない / JSON の取り出しが説明の文の " に引っかかる / 元に戻すで設定の読み直しを止めていない / 取り込んだ次の一手の今日の3件のテストが無い | PR #156 の B・F・C | 済み |

レビューした人: Claude(実装していない立場で、コードとテストを確認)

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
2. PR #164 を `main` へマージする。マージ後の `main` の CI は待たず、差分が文書だけであることで代える。
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
