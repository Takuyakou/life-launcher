# P97-07 — README の整理 報告

- 日付: 2026-11-07
- ブランチ: `docs/p97-07-readme`（`main` = `cf447fc` から）
- 判定: **DONE**

## 実装内容の要約

日英の README から「v1.4.x の変更」の節（3つずつ）を消し、ダウンロードの節の近くに「各版の変更は GitHub Releases と CHANGELOG にあります」の1行を足した。版の数字を書いていた文（Web Demo・ダウンロードのファイル名・更新について・変更の詳細）を、版を上げても書き換えなくてよい形にした。`readme-contract.spec.ts` を、ファイル名の「形」と「版ごとの変更の節が無いこと」を確かめる形に直し、リンク・バージョン・リリースノートの確認は残した。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `README.md` | 版ごとの変更の節を削除、変更履歴の1行を追加、Web Demo・ダウンロード・更新・変更の詳細を版によらない形に変更 |
| `README.en.md` | 同上（英語） |
| `tests/visual/readme-contract.spec.ts` | ファイル名の形の確認に変更、版ごとの変更の節が無いことの確認を追加、リンク・バージョン・リリースノートの確認は維持 |
| `docs/phase9.7/07-readme.md` | この報告 |

アプリのコード、`styles.css`、`docs/spec/current-spec.md` は変えていない（振る舞い・表示ルールの変更ではないため）。

## 完了条件ごとの結果

- [x] README（日英）から版ごとの変更の節を消し、版の数字を書いた文を書き換え不要の形にした
  - 「v1.4.2の変更」「v1.4.1の変更」「v1.4.0の変更」（英語は `Changes In v1.4.2` など）を削除
  - ダウンロードの節の直後に「各版の変更は[GitHub Releases](…/releases)と[CHANGELOG](CHANGELOG.md)にあります。」を追加
  - Web Demo: 「v1.4.2の更新と同時には…」→「Windows版の更新と同時には…」
  - ダウンロード: `Life-Launcher-v<バージョン>-windows-x64-setup.exe` などの形に変更（英語は `<version>`）。`releases/latest` のリンクは残した
  - 更新について: 「v1.4.1からv1.4.2への更新では…」を、外部レビューの指摘（2026-11-07）を反映した版によらない段落に変更。v1.2→v1.3 の移行の説明は残した
  - 変更の詳細: `v1.4.2 Release notes` へのリンクを、GitHub Releases と CHANGELOG へのリンクに変更
- [x] `readme-contract.spec.ts` を合わせた（リンクとバージョンの確認は残した）
  - README の3つのファイル名を「`Life-Launcher-v<バージョン>`（英語は `<version>`）の形」で確認するように変更
  - ダウンロードの節に具体的な版のファイル名が無いことを確認
  - 「`## v1.2.3の変更` / `## Changes In v1.2.3`」のような版ごとの変更の節が無いことを確認（日英それぞれ）
  - `releases/latest` のリンク、ダウンロード先のリンク、手元の文書へのリンクの存在確認は維持
  - リリースノート（`docs/releases/vX.Y.Z.md`）に具体的なファイル名があることの確認は維持
  - バージョンがそろっていることの確認（package.json / Cargo.toml / Cargo.lock / tauri.conf.json）は維持
- [x] 必須ゲートがローカルで通る → 下の表

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS（3635ファイル、blocker 0） |
| `npm.cmd run lint` | PASS（警告0） |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **625/625 PASS**（2.5分 / 151.5秒） |
| `npx playwright test tests/visual/readme-contract.spec.ts` | **6/6 PASS**（2.4秒） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **146 PASS**（145 unit + 1 capability） |
| `git diff --check` | PASS |

`public:check`・`lint`・`build`・cargo の一式は 34.0秒。Rust のコードと npm の依存は変えていない。

## 更新した基準画像

**0枚**。README とテストだけの変更で、画面の見た目は変わらないため。`test:visual` は基準画像を更新せずに通った。

## 判断メモ

1. **テストの確認方法**: 旧テストは README に「公開した版の具体的なファイル名3つ」がそのまま書かれていることを確かめていた。新しい形では、README には `<バージョン>`（英語は `<version>`）の形だけを書き、具体的な名前はリリースノート側で確かめ続ける。ダウンロードの節に具体的な版が混ざっていないことも見るようにした（開発の節のテスト用パスの例は対象外）。
2. **`releases` の URL**: 新しい「各版の変更は…」のリンクは `…/releases`（`/latest` なし）なので、テストの許可するダウンロード先に `…/releases` を足した。`releases/latest` の確認はそのまま残している。
3. **更新についての段落**: 外部レビューの例文に合わせ、古い版に戻したときの注意とバックアップの案内を入れた。旧段落にあった「窓の位置と大きさも引き継ぎます」は、版によらない文として残した（標準のタイトルバーは戻らない、という説明は v1.4.2 の変更の節にあったため、ここでは繰り返さない）。
4. **開発の節**: `release-candidate/v1.4.3/Life-Launcher-v1.4.3-windows-x64.exe` という例が残っている。Stage の「それ以外の節（開発など）は変えない」に従い、今回は触っていない（§提案）。
5. **テストの件数**: `readme-contract.spec.ts` は 5件から 7件になった（日英それぞれに「版ごとの変更の節が無いこと」の確認を追加したため）。全体は 623件から 625件になった。

## 提案

- **開発の節の版の数字**: `release-candidate/v1.4.3/...` の例も、`release-candidate/v<バージョン>/...` の形にすれば、README から版の数字を完全に無くせる。今回は「開発の節は変えない」という指示に従って触っていないので、次の文書の Stage で行うとよい。
- **リリース時の README**: P97-11 以降、README に版ごとの変更の節を足さない。機能が増えたときは「主な機能」などを直す。今回のテストが、版ごとの変更の節が戻ったときに気づく見張りになる。
- **`SHA256SUMS.txt` の確認**: README には残っているが、テストでは必須にしていない。必要なら、ダウンロードの節に `SHA256SUMS.txt` があることの確認を足せる。
