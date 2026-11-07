# P97-03 — 手順書ビューアーで mhtml を開く 報告

- 日付: 2026-11-07
- ブランチ: `feature/p97-03-mhtml`（`main` = `ab58fad` から）
- 判定: **DONE**

## 実装内容の要約

`.mhtml` / `.mht` を HTML と同じ「見るだけ」で開けるようにした。Rust がバイトのまま読み、画面側の Web Worker で MIME を読み解き、同じファイルの中の画像と CSS を埋め込んでから、今の HTML と同じ `renderSafeHtml` と `sandbox="allow-same-origin"` の iframe で表示する。上限・壊れたファイルの扱い・安全の決まりは HTML と同じで、緩めていない。

## mhtml の読み解き方

### 本文の選び方

- 一番外の `Content-Type` が `multipart/related`（または `multipart/mixed`）で、`boundary` があるものだけを読む。
- 入れ子の multipart は深さ 3 まで、部分は 1,000 まで。
- 各部分のヘッダーは折り返し（次の行が空白で始まる）を戻して読み、`Content-Type`・`Content-Transfer-Encoding`・`Content-ID`・`Content-Location` を使う。
- 本文は、入れ子の frame ではない最初の `text/html`。`Content-ID` が `frame-…`、または `Content-Location` が `cid:frame-…` の部分は frame とみなして飛ばす。
- 本文の基準 URL は `Snapshot-Content-Location`、無ければ本文の `Content-Location`、無ければ一番外の `Content-Location`。相対参照はこの URL を基準に解決する。
- 文字コードは各部分の `charset` を `TextDecoder` で読む（UTF-8・Shift_JIS・EUC-JP・ISO-2022-JP など）。`charset` が無い・読めないときは UTF-8。

### 参照の置き換え方

- 画像（`image/png`・`image/jpeg`・`image/gif`・`image/webp`）と CSS（`text/css`）を、`Content-ID`（`cid:`）と `Content-Location`（生の値と、基準 URL で絶対化した値の両方）で引ける表にする。
- `img[src]` は、`cid:…` → 表の画像、絶対 URL → 表の画像、相対 URL → 本文の基準 URL で解決して表の画像、の順に探し、見つかれば `data:<mime>;base64,…` にする。見つからなければ `src` を消す。
- `<link rel="stylesheet">` は、`href` を同じように解決し、見つかれば `<style>` に置き換える。CSS の中の `url()` は、CSS の `Content-Location` を基準に解決して画像なら `data:` にし、それ以外は今の HTML の決まり（`renderSafeHtml`）に任せて消す。`@import` は追わずに消す。
- 本文中の `<style>` と `style` 属性の `url()` も同じように置き換える。
- 見つからない `cid:` は、その参照だけ消す。外へ取りに行かない。フォントは埋め込まれていても使わない。
- 埋め込み後の HTML を今の `renderSafeHtml` に通し、スクリプト・イベント属性・`javascript:` リンク・フォーム・入れ子 frame・リモートの画像/CSS は今までどおり動かない。

### 上限の値

| 項目 | 値 | 場所 |
| --- | --- | --- |
| mhtml のファイルの大きさ | 20 MiB（ほかの形式の 2 MiB は変えない） | Rust（読む前と読んだ後の両方） |
| 部分の数 | 1,000 | Web Worker |
| 入れ子の multipart の深さ | 3 | Web Worker |
| 展開後の部分の合計 | 64 MiB | Web Worker |
| 画像を埋め込んだ後の HTML（安全化の前） | 64 MiB | 画面側 |
| 読み解きの時間 | 10 秒 | 画面側（超えたら Worker を止める） |

## 表示できないことが分かっている形

- **SVG などの画像**: `image/png`・`image/jpeg`・`image/gif`・`image/webp` 以外は埋め込まない（その画像だけ出ない）。
- **フォント**: 埋め込まれていても使わない。標準のフォントで表示する。
- **スクリプト・フォーム・入れ子の frame・リモートの画像/CSS/@import**: HTML と同じく動かない（`renderSafeHtml` と CSP）。
- **入れ子の frame の部分**: 本文として使わない。
- **multipart でない・境界が無い/途中で切れている・本文の HTML が無い・部分が 1,000 を超える・入れ子が 4 以上**: 「このMHTMLファイルは表示できません」と理由を出す。
- **20 MiB を超えるファイル**: 「このMHTMLファイルは大きすぎるため表示できません（上限は20 MiBです）」。
- **展開後・埋め込み後が 64 MiB を超える**: 「このMHTMLファイルは大きすぎるため表示できません」。
- **壊れた base64 の画像**: その画像だけ使わない。ほかは表示する。
- **`cid:` の参照先が無い**: その参照だけ消える。
- **7bit・8bit・binary・quoted-printable・base64 以外のエンコードの部分**: その部分を使わない。

## 変更ファイル一覧

| ファイル | 変更 |
| --- | --- |
| `src-tauri/src/models.rs` | `INSTRUCTION_MHTML_MAX_BYTES`（20 MiB）と `InstructionFileInfo` |
| `src-tauri/src/commands/instructions.rs` | `.mhtml` / `.mht` を対応拡張子に追加。`read_instruction_info` と `read_instruction_bytes`（`tauri::ipc::Response` でバイトを返す）。20 MiB の前後チェック、読み取り専用、案内文。単体テスト3件 |
| `src-tauri/src/lib.rs` | 新しい2コマンドの登録 |
| `src/tauri.ts` | `readInstructionInfo` / `readInstructionBytes` / `instructionAssetBaseUrl` |
| `src/types.ts` | `InstructionDocument.mhtmlBytes`、`InstructionFileInfo` |
| `src/mhtml/limits.ts` | 新規。上限の値と、テスト用の上書き |
| `src/mhtml/parseMhtml.ts` | 新規。MIME・quoted-printable・base64・charset・境界・深さ・部分数・大きさの読み取り（DOM なし） |
| `src/mhtml/assembleMhtml.ts` | 新規。`cid:` / `Content-Location` の解決、画像の `data:` 埋め込み、CSS の `<style>` 化と `url()` の置き換え |
| `src/mhtml/mhtmlWorker.ts` | 新規。読み取りを Web Worker で行う |
| `src/mhtml/renderMhtml.ts` | 新規。Worker の起動・10 秒の打ち切り・`renderSafeHtml` の呼び出し |
| `src/components/InstructionViewer.tsx` | mhtml の読み込み・Worker の状態・エラー表示・iframe 表示・外部変更の確認 |
| `src/components/InstructionTree.tsx` | mhtml を HTML と同じアイコン・色・「ブラウザで開く」・名前の変更に。空の案内に MHTML を追加 |
| `src/content/helpGuide.ts` | 「使い方」の対応形式に MHTML を追加 |
| `tests/visual/phase97-mhtml.spec.ts` | 新規。19テスト |
| `tests/visual/tauriMock.ts` | `read_instruction_info` / `read_instruction_bytes` と、mhtml の一覧・検索・大きすぎる場合のモック |
| `tests/visual/fixtures.ts` | `instructionBytes` / `instructionExtraEntries` / `instructionTooLargePaths` |
| `tests/fixtures/mhtml/` | 新規。16ファイル（Chrome形式、Shift_JIS、`.mht`、大文字、壊れた境界、入れ子 frame、深さ3/4、外部参照、壊れた base64、参照先なし、部分が多い、画像の多参照、長い本文、multipart でない、本文なし） |
| `docs/spec/current-spec.md` | §17.2 の対応形式、§17.3 の読み取り専用、§17.4 のスクロール、§17.5「MHTML」を追加 |
| `docs/phase9.7/03-mhtml.md` | この報告 |

## 完了条件ごとの結果

- [x] `.mhtml` / `.mht` が上の決まりどおりに一覧に出て、見るだけで開ける → 一覧・検索・名前の変更・ごみ箱・プロジェクトとの紐づけは HTML と同じ経路。テストは「一覧に出る」「行から開く」「`.mht`」「大文字の `.MHTML`」「編集ボタンが出ない」を確認
- [x] 安全の決まりは HTML と同じで、緩めていない → 埋め込み後に同じ `renderSafeHtml` と `sandbox="allow-same-origin"` の iframe を使う。スクリプト・イベント属性・`javascript:`・外部画像・外部 CSS・`@import`・入れ子 frame のテストあり
- [x] 新しい依存を足していない → MIME・quoted-printable・base64 は自前。`package.json` と `Cargo.toml` は変更なし
- [x] 案内の文・使い方・仕様書を合わせた → 一覧の空の案内、`helpGuide.ts`、Rust の案内文、`docs/spec/current-spec.md` §17
- [x] 必須ゲートがローカルで通る → 下の表

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS（3629ファイル、blocker 0） |
| `npm.cmd run lint` | PASS（警告0） |
| `npm.cmd run build` | PASS（Worker の `mhtmlWorker-*.js` を含む） |
| `npm.cmd run test:visual` | **620/620 PASS**（新規19件を含む。2.9分 / 175.8秒） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS（5.7秒） |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **145 PASS**（144 unit + 1 capability、2.0秒） |
| `git diff --check` | PASS |

`public:check`・`lint`・`build` の3つは続けて実行し、合計 58.6秒。visual は `PLAYWRIGHT_BROWSERS_PATH` にローカルの Playwright ブラウザーの置き場所を設定して実行した。

## 更新した基準画像

**0枚**。mhtml は HTML と同じ iframe の表示で、既存の画面の見た目を変えない。既存の画像比較は更新なしで通った。

## 判断メモ

- **バイトの渡し方**: 20 MiB を JSON の数値の配列にしないため、Rust は `tauri::ipc::Response::new(bytes)` でバイトをそのまま返し、画面は `ArrayBuffer` で受ける。メタ情報（名前・更新日時・大きさ・読み取り専用）は別の `read_instruction_info` で取る。既存の `read_instruction` は mhtml では断る（誤って UTF-8 として読まないため）。
- **読み取りの検証**: `read_instruction_bytes` も `read_instruction_info` も、今の `validate_instruction_file()`（登録ルートの中・`validate_existing_target()` と同じ判定・リパースポイントの拒否）を通す。新しい経路だけ検証が弱くならないよう、同じ関数を使っている。
- **読み解きの場所**: MIME・quoted-printable・base64・charset は Web Worker。`DOMParser` での参照の置き換えと `renderSafeHtml` は今までどおり画面側。10 秒を超えたら Worker を止める。
- **安全化**: 埋め込み後の HTML を今の `renderSafeHtml` に通すので、CSP・スクリプト除去・URL の制限は HTML と共通。mhtml 用に緩い設定は作っていない。
- **テスト用の上限**: `globalThis.__LIFE_LAUNCHER_MHTML_LIMITS__` があるときだけ上限を上書きする。実運用では設定しない。64 MiB の展開後上限と 10 秒の打ち切りを、小さいテストデータで確かめるために使っている。
- **一覧の扱い**: `instruction_extension()` に mhtml/mht を足したので、一覧・検索・フォルダー集計・名前の変更・ごみ箱・プロジェクトとの紐づけは HTML と同じ経路になる。編集の可否は今までどおり `md`/`txt` だけ。
- **外部変更**: mhtml は本文を比べられないため、`read_instruction_info` の更新日時で検出し、「再読み込み」でバイトを読み直す。

## 実機で確かめること（P97-08 の実機確認の一覧に入れる）

指示書の1〜4を、P97-01 のテスト用の起動で行う。

1. Chrome か Edge で適当なページを「ウェブページ、1 つのファイル」で保存し、手順書フォルダに入れる。一覧に HTML と同じアイコンで出る
2. 開くと、文字・画像・レイアウトが出る（スクリプトで動く部分は動かなくてよい）。編集ボタンが出ない
3. →で本文へ移り、↓・PageDown・End でスクロールできる
4. 2 MB を超える mhtml（画像の多いページ）も開ける

## 提案

- **CI の既知の失敗**: `cargo test` の `app_paths::tests::with_the_variable_every_location_moves_into_the_profile` が、P97-01 の頃から CI でだけ、長いユーザー名（`runneradmin`）と 8.3 の短縮名（`RUNNER~1`）の違いで失敗している（ローカルでは通る）。P97-08 のリリース判定の前に、`std::env::temp_dir()` の短縮名を正規化するか、比較を `canonicalize` にそろえる別 Stage で直すのがよい。P97-03 の範囲外なので、この Stage では触っていない。
- **mhtml の実機確認**: 実機では、Chrome の「ウェブページ、1 つのファイル」のほかに、Edge で保存したもの（境界や `Content-Location` の書き方が少し違う）も1つ試すと、読み取りの取りこぼしを見つけやすい。
- **大きい mhtml**: 20 MiB に近いファイルは、実機のメモリと表示時間を一度見ておくとよい。Worker の 10 秒は、画像の多いページで足りるかを含めて確認する。
