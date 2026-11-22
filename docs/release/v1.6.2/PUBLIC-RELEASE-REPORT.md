Life Launcher v1.6.2 RELEASED

# v1.6.2 公開結果の報告

- 公開日: 2026-11-22(JST。GitHub の `publishedAt` は 2026-11-22T12:27:46Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.6.2
- ビルドしたコミット M(PR 2 のマージのコミット、`main`): `b7925eb1bb25e5acc30a7baff15eadb3dcf19ff6`
- タグ: `v1.6.2`(注釈つき)。タグのオブジェクト `d6c992c2338f7b11e87547806e08fbfdae259edf`、指すコミット `b7925eb1bb25e5acc30a7baff15eadb3dcf19ff6`(M)。判定書のマージのコミットには付けていない。
- M から公開までの `main` の差分は `docs/release/v1.6.2/` の 3 ファイル(`FINAL-RELEASE-DECISION.md`・`native-checklist.md`・`release-notes.md`)だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.6.2)。

## 3 つの PR

| PR | 中身 | マージのコミット | CI |
| --- | --- | --- | --- |
| #177 | PR 1:手順書ビューアーの直し(黒ずみ・「全体」・一覧の開け閉め)とテストの基盤(`test:fast`・時計の揺れ)。F1 の直しを含む | `72db57f5b093530b63f571e8d390c6f0448018ca` | X1 `379e75a`:run `45016397176`、success(1 回目 `45011859918` は V161-B2 で failure) |
| #178 | PR 2:`config.rs` と `DashboardApp` の整理、重なったテスト 2 本の整理、文書・版 1.6.2 | `b7925eb1bb25e5acc30a7baff15eadb3dcf19ff6`(= M) | X2 `a29b7b8`:run `45017262918`、success。M:run `45018318536`、success |
| #179 | 判定書(文書だけ) | `529b3050e16d93fa44cf1a97dc120e0ef314f996` | 実機の結果のコミット `a08cb38`:run `45021782338`、success(製品の確かめには数えない) |

## 手順ごとの結果

| 手順 | 結果 |
| --- | --- |
| PR 1 の 0〜B | 1 回目の CI(`b3dcf37`)で、`v161-book.spec.ts` の V161-B2 が落ちた(待たせた 44 ページを ZIP から 2 回読んでいた)。回し直さずに止まり、リードに回した。リードが、v1.6.1 からある先読みの隙間と確かめ、作業者が F1(`379e75a`)で直した。新しい X1 で CI 1 回(成功)、利用者の承認の後に `gh pr merge 177 --merge` |
| 0. 始める前の確かめ(PUBLISH-v1.6.2) | 成功。X1 は `origin/main` に入っている。`git diff --name-only 4f547ef a29b7b8` は 4 ファイルだけ。`git diff 379e75a a29b7b8 -- InstructionBook.tsx v161-book.spec.ts` は空。`git diff v1.6.1 a29b7b8 -- package-lock.json src-tauri/Cargo.lock` は版の番号の行(3 か所)だけ |
| A. PR 2 と CI | 成功。push の前に手元で `public:check`・`lint`・`build`・`test:fast`(26 passed)。X2 の CI(run `45017262918`、attempt 1、8 分 34 秒)で 5 つの job がすべて success。`test:visual` 923 件、`cargo test` 210 件。利用者の承認の後に `gh pr merge 178 --merge`。`git diff a29b7b8 origin/main` は空。M の上の `main` の CI(run `45018318536`)も success |
| B. 配布物 | 成功。M を `git checkout --detach` してビルド。ハッシュ・ZIP の中身・版 1.6.2・公開してよい字かの確認・Defender・権限(差分なし)・画面の許可(`version` の 1 行だけ)・環境変数なしの起動・テスト用の起動は判定書のとおり。`cargo audit` の脆弱性 1 件は下 |
| C. 判定書 | 成功。`docs/v1.6.2-release` で `docs/release/v1.6.2/` の 3 ファイル(`07bdd36`)。実機の結果のコミットは `a08cb38`。PR #179 |
| D. 実機の確認 | 成功。`native-checklist.md` の 1〜7 が、M から作った単体 EXE(SHA-256 `D08E1257…`)で通った(確かめたのは利用者)。8(インストーラーでの更新)は公開の後に利用者が行う |
| E. マージ・タグ・下書きの Release | 成功。タグも Release も無い事を確かめてから、PR #179 をマージ(利用者の承認の後)。M に注釈つきタグを付けて push。下書きの Release(本文 `docs/releases/v1.6.2.md`、アセット 4 つ)を作成。新しい空のフォルダー(`.local-evaluation/v162-redownload`)へダウンロードし、3 ファイルのハッシュが判定書 4. と `SHA256SUMS.txt` の両方に一致、アセットは 4 つだけ |
| E. 公開 | 成功。利用者の承認の後に `gh release edit v1.6.2 --draft=false` |
| E. 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v162-redownload-2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| F. 記録 | この報告書と、判定書の一番上の 1 行 |

## 手順から変えた事・記録しておく事

- **`cargo audit` の脆弱性 1 件**(判定書の 5. #3):`RUSTSEC-2026-0592`(`url` 2.5.8、2026-11-20 公開。入れ子の `blob:` URL に `Url::origin()` を呼ぶとスタックオーバーフロー)。v1.6.1 の時は 0 件で、`Cargo.lock` は版の番号の行しか変わっていないので、助言が後から公開された物。`tauri` 経由で Windows の依存の木に入っている。アプリのコードは `origin()` を呼んでいない(`tauri` の中は確かめていない)。ビルドするコミットの後に製品のファイルを変えない決まりと、設計書にない依存を上げない決まりのため、この版では直していない。ビルドの後に見つかったので、利用者に伝え、判定書に書いて進めると決まった。**次の版で `url` を上げる**。
- PR 1 の 1 回目の CI の失敗と F1(上)。
- 判定書の 3 ファイルは、`.gitignore` の `release/` に当たるため、名前を書いた `git add -f` で 1 つずつ足した(前の版と同じ)。
- 作業者のブランチと私の作業が同じリポジトリだったので、M のビルドの時は `git checkout --detach` で M に移り、終わってから別のブランチへ移した。
- 上以外に、手順と違う操作はしていない。

## ダウンロードの照合(公開前の下書きと、公開後の 2 回)

2 回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2 回の `SHA256SUMS.txt` も、手元の `release-candidate/v1.6.2/SHA256SUMS.txt` と同一。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.2/Life-Launcher-v1.6.2-windows-x64-setup.exe) | 9,781,219 | `A645A44A902FB919436343358267BF0C9065FA25A25058D05ABF50B7FAF2770D` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.2/Life-Launcher-v1.6.2-windows-x64.exe) | 22,514,688 | `D08E12577EA8222AE7414C7ECD6D1DBBA4F1BEC50DFE82AD70E2012AB2BFDAA8` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.2/Life-Launcher-v1.6.2-windows-x64-portable.zip) | 11,140,665 | `22AC885408EE33E37AB88C8D777C5CF12F7220E8F364931708B94F508475FFBE` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.2/SHA256SUMS.txt) | 327 | `46A75A67A4C9CC94DF6E495517F3AB4495DF7B7F17F31F057811F2185DADEEE2` |

- ダウンロードした単体 EXE の FileVersion / ProductVersion は 1.6.2。
- ポータブル ZIP の中身は `Life-Launcher-v1.6.2-windows-x64.exe` と `README.txt` の 2 つだけ(B の確認)で、ZIP 内の EXE の SHA-256 は単体 EXE と一致。

## 起動の確認

- 公開後にダウンロードした単体 EXE を `scripts/start-test-profile.ps1` で、新しいテスト用のプロファイルで起動した。窓のタイトルは `Life Launcher (テスト)` だった。
- 設定の「メンテナンス」に「バージョン 1.6.2」と出ている事を、オーナーが画面で確かめた。
- 確認の後に、その起動だけを終了した。
- インストーラーは実行していない。インストーラーでの更新は、オーナーが行う。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.6.2`。
- README.md のダウンロードのリンクは `releases/latest` で、開くと `releases/tag/v1.6.2` に移る。
- Release の本文は `docs/releases/v1.6.2.md`。

## 行わなかったこと

- インストーラーでの更新(オーナーが行う。Life Launcher を終了 → `%APPDATA%\life-launcher` をバックアップ → v1.6.2 のインストーラー)。
- `url` の更新(次の版)。
- オーナーの普段のアプリの終了。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.6.2/` は、公開したアセットとの照合用に残してある。テスト用のプロファイルのフォルダーは、オーナーの判断で後で消してよい。
