# 秘密情報の公開防止ガード 報告

- 日付: 2026-11-08
- ブランチ: `fix/secret-guard`（`main` = `497b37e` から）
- 判定: **DONE**

## 実装内容の要約

AIツールの設定ファイルを `.gitignore` で除外し、公開前の監査 `scripts/check-public-safety.mjs` に「AIツールの設定ファイル」と「秘密情報の形」の検出を足した。監査は、追跡されているAI設定ファイルは `.gitignore` の対象でも止め、追跡されていない ignored ファイルだけを監査範囲から外す。アプリのコードは変えていない。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `.gitignore` | `.claude/settings.local.json`、`.claude/settings*.json`、`.claude/*.local.*`、`.commandcode/`、`.cursor/`、`.codex/`、`.tmp/` を追加 |
| `scripts/check-public-safety.mjs` | AIツール設定ファイルの検出、Git追跡／ignoredの判定、秘密情報パターンの適用 |
| `scripts/public-safety-rules.mjs` | 秘密情報パターン、AIツール設定パスの判定、追跡／ignoredの判定（テスト可能な純粋関数） |
| `scripts/check-public-safety.test.mjs` | 追加した形ごとの検出・非検出テスト（11件） |
| `package.json` | `test:public-safety` を追加 |
| `SECURITY.md` | 開発時の秘密情報の扱いを1行追加 |
| `tests/visual/phase72-public-safety.spec.ts` | 監査の複製先に `public-safety-rules.mjs` もコピーするよう更新 |
| `docs/security/secret-guard.md` | この報告 |

## .gitignore に足したもの

```text
.claude/settings.local.json
.claude/settings*.json
.claude/*.local.*
.commandcode/
.cursor/
.codex/
.tmp/
```

`.claude/settings*.json` は、依頼の `settings.local.json` に加えて、`settings.json` などの設定ファイルも入れないために足した。`.tmp/` は既存の `*.tmp` でも除外されていたが、ディレクトリとして明示した。

## 監査に足したもの

### 置いてはいけないAIツールの設定ファイル

- `.claude/settings*.json`
- `.commandcode/` の中のファイル
- `.cursor/` の中のファイル
- `.codex/` の中のファイル

判定は次の順にした。

1. そのパスが `git ls-files` に入っている（追跡されている）なら、`.gitignore` で無視されていても **止める**。
2. 追跡されておらず、`git ls-files --others --ignored --exclude-standard` に含まれる（ignored）なら、**監査の範囲から外す**。開発フォルダに設定ファイルを置いたままでも監査が通る。
3. 追跡されておらず、ignored でもないなら、**止める**。

追跡／ignoredの確認は `git` の出力を `node:child_process.execFileSync` で読み、`-z` でパスを区切って行う。ignoredの一覧が大きいため `maxBuffer` を64 MBにした。`git` を実行できないときは、安全側に倒して追跡・ignoredの情報を空として扱う。

### 見つける秘密情報の形

- URLに埋めた認証: `https?://ユーザー:パスワード@...`
- GitHubトークン: `gho_` / `ghu_` / `ghs_` / `ghr_`（既存の `ghp_` / `github_pat_` は `token-like value` のまま）
- Anthropicのキー: `sk-ant-`（既存の `sk-` の検査でも見つかることを確認）
- `Authorization: token ...` / `Authorization: Basic ...` の値
- `--password` / `--token` / `--api-key` のあとの値
- 既存の秘密情報の形（Bearer、Google API key、AWS access key、秘密鍵、credential assignmentなど）

追加した形は `scripts/public-safety-rules.mjs` にまとめ、監査本体とテストの両方から使う。

## テスト

`npm run test:public-safety`（`node --test scripts/check-public-safety.test.mjs`）で11件。

- URLの認証が検出され、認証のないURLは検出されない。
- `gho_` / `ghu_` / `ghs_` / `ghr_` のトークンが検出され、短いものは検出されない。
- `sk-ant-` のキーが検出され、短いものは検出されない。
- `Authorization: token` と `Authorization: Basic` が検出され、短いBearerは検出されない。
- `--password` / `--token` / `--api-key` の値が検出され、フラグだけでは検出されない。
- `.claude/settings*.json`、`.commandcode/`、`.cursor/`、`.codex/` が禁止パスになる。
- 追跡されているAI設定ファイルはignoredでも `tracked` として止め、追跡されていないignoredファイルは除外し、追跡されていないignoredでないファイルは `prohibited` として止める。

テスト内の値はすべて実在しない作りもので、`"gho_" + "A".repeat(24)` のように実行時に組み立てている。監査がテスト自身の文字列で止まらないことも、`npm run public:check` の成功で確認した。

## 今のリポジトリと開発フォルダの監査

- `git ls-files`: 680ファイル。`.claude/`、`.commandcode/`、`.cursor/`、`.codex/` の追跡ファイルは無い。
- `npm run public:check`: 3,659ファイルを監査し、**0 blockers**。
- 監査は開発フォルダ全体を見る。ignoredのAI設定ファイルは上記の方法で監査範囲から外している。

### Git に入っていない／入れるべきでないファイル

`git status --ignored` と `git ls-files --others` で確認した。**削除はしていない。**

| パス | 状態 | 報告 |
| --- | --- | --- |
| `.commandcode/settings.local.json` | 追跡なし・ignored（今回追加） | AIツールの設定。Gitに入れない |
| `.commandcode/taste/taste.md` | 追跡なし・ignored（今回追加） | AIツールの設定。Gitに入れない |
| `voicing-loop-current-chord-panel-mock.html` | 追跡なし・ignoredでない | 開発用のモックHTML。Gitに入れるべきではないと判断。今回は削除もignore追加もしていない |
| `.tmp/` | ignored | 一時ファイル／キャッシュ。Gitに入れない |
| `.local-evaluation/` | ignored | 評価用の成果物。Gitに入れない |

`.claude/`、`.cursor/`、`.codex/` は今の開発フォルダには無かった。

## 開発時のルール

`SECURITY.md` の「Development Secrets」に次を1行で追加した。

> AIツールの設定ファイルは Git に入れない。秘密の情報を含むコマンドは、常に許可しない。

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm run test:public-safety` | 11件成功 |
| `npm run public:check` | 成功（3,659ファイル、0 blockers） |
| `npm run lint` | 成功（0エラー、0警告） |
| `npm run build` | 成功 |
| `npm run test:visual` | 673件成功（2.6分） |
| `cargo fmt --check` | 成功 |
| `cargo check` | 成功 |
| `cargo clippy --all-targets -- -D warnings` | 成功 |
| `cargo test` | 157 unit + 1 capability = 158件成功 |
| `git diff --check` | 成功 |

## 判断メモ

- AI設定ファイルの監査は「追跡されていれば必ず止める」「追跡されておらずignoredなら除外」にした。`.gitignore` にあるだけで追跡されているファイルを見逃さない。
- ignoredの判定は `git ls-files --others --ignored --exclude-standard` を使った。ファイルシステムの `.gitignore` の独自解釈をせず、Gitの判定に合わせるため。
- ignoredの一覧が大きい開発フォルダでも動くよう、`maxBuffer` を64 MBにした。
- 秘密情報のパターンは既存の検査を残し、新しい形を追加した。`ghp_` / `github_pat_` の既存のラベル `token-like value` は変えず、`gho_` などの新しいGitHubトークンは `GitHub token` として区別した。
- テストの文字列は実行時に組み立て、監査自身がテストの例で止まらないようにした。
- アプリのコードは変えていない。変更は開発時の監査、ignore、ドキュメント、テストだけ。

## 提案

- 今後、AIツールの設定ファイルを新しく使うときは、`.gitignore` と監査の禁止パスを同時に足す。
- `voicing-loop-current-chord-panel-mock.html` は開発用のモックなので、残すなら `.gitignore` に足すか、別の作業フォルダへ移すかをオーナーが決める。今回は指示どおり一覧に出すだけで、削除・ignore追加はしていない。
- 監査の秘密情報パターンは、新しいサービスのトークン形式が増えたときに `scripts/public-safety-rules.mjs` とテストへ追加する。
