Life Launcher v1.4.1 RELEASED

# P95-06 公開結果の報告

- 公開日: 2026-11-02(JST。GitHub の `publishedAt` は 2026-11-01T15:31:38Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.4.1
- マージのコミット(PR #137): `c680c6c4b3797761d029d7ea8ff36d569c370a7e`(`main`)
- タグ: `v1.4.1`(注釈つき)。タグのオブジェクト `5fed3ef6f8521744a318806e5d942cd854711231`、指すコミット `c680c6c4b3797761d029d7ea8ff36d569c370a7e`
- 承認されたコミット: `release/v1.4.1` の `cca2ea56d1ae6f2c49ec993e31c1327f330e03ff`(P95-06 第1部。`0c664cf` の上に1コミット、変更は文書2ファイルだけ)
- ビルドに使ったソース: `afc608ccdcac3e8fae3340da158b99d5afed6db8`。`afc608c` から `c680c6c` までの差分は `docs/release/v1.4.1/` の文書2つ(`FINAL-RELEASE-DECISION.md`、`native-checklist.md`)だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.4.1)。

## 手順の結果(判定書 8.)

| 手順 | 結果 |
| --- | --- |
| 8.1 マージの前の確認 | 成功。`origin/release/v1.4.1` = `cca2ea5`(`0c664cf` から1コミット、変更は文書2ファイル)、PR #137 は OPEN・mergeable で CI(`verify`)が `cca2ea5` で成功、タグ `v1.4.1` なし(`git ls-remote` が空、ローカルにもなし)、`gh release view v1.4.1` は「release not found」(終了コード 1 は期待の結果)、3ファイルの SHA-256 は判定書 4. と一致、実機確認の結果は `native-checklist.md` に記録済み |
| 8.2 マージ | 成功。`gh pr merge 137 --merge --match-head-commit cca2ea5…`(終了コード 0)。マージのコミット `c680c6c` |
| 8.3 マージの後の確認 | 成功(**判定書と違う操作あり。下記**)。`afc608c` と `origin/main` の差分は文書2つだけ(製品の差分 0 件) |
| 8.4 タグ | 成功。`c680c6c` に注釈つきタグ `v1.4.1` を付けて push |
| 8.5 下書きの Release | 成功。アップロード直前にも3ファイルのハッシュを確かめた。アセットは4つ、本文は `docs/releases/v1.4.1.md` |
| 8.6 下書きの確認 | 成功。新しい空のフォルダー(`.local-evaluation/v141-redownload`)へダウンロードし、3ファイルのハッシュが、公開した `SHA256SUMS.txt` と判定書 4. の両方に一致。アセットは4つだけ |
| 8.7 公開 | 成功。`gh release edit v1.4.1 --draft=false` |
| 8.8 公開後の確認 | 成功(起動の確認は下記のとおり行っていない)。もう一度、新しい空のフォルダー(`.local-evaluation/v141-redownload-public`)へダウンロードして照合。`releases/latest` と README のリンクを確認 |
| 8.9 記録 | この報告書 |

## 判定書から変えたこと

- **8.3 の「`main` の CI が成功していること」は待たなかった。オーナー判断(2026-11-02)で、`main` の tree の一致の確認に代えた。** 次の2つを確かめて満たしたので、8.4 に進んだ。
  1. `git rev-parse "origin/main^{tree}"` と `git rev-parse "cca2ea56d1ae6f2c49ec993e31c1327f330e03ff^{tree}"` が同じ。どちらも `8d9c427eb8a42cbe1cdbcaa6d7619bf261e49995`(期待値と一致)。つまり、`main` の中身は、CI が成功した `cca2ea5` と同じ。
  2. `git diff --name-only afc608c origin/main` が `docs/release/v1.4.1/` の2ファイルだけ。
- `main`(`c680c6c`)の CI(run 41321311683)は、この報告を書いた時点で実行中だった。結果はこの報告に含めていない。
- 上以外に、判定書と違う操作はしていない。8.1 の `gh release view` が終了コード 1 になるのは、「release not found」が期待の結果のため。

## ダウンロードの照合(公開前の下書きと、公開後の2回)

2回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。GitHub がアセットに付ける `digest` も同じ値。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.1/Life-Launcher-v1.4.1-windows-x64-setup.exe) | 3,727,535 | `d70c268b2f07da90d504b598d55b0d93c107776064db3f630ddd027f7e5d827a` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.1/Life-Launcher-v1.4.1-windows-x64.exe) | 16,051,200 | `69afc8c16fb3b135bc40800f73a4032bbdcc2f8246a17cf3211ea5e09ead20c2` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.1/Life-Launcher-v1.4.1-windows-x64-portable.zip) | 5,070,272 | `4d43996adb109ed7fd415efba0865bdd9fdc14874475cc4e2bd81811ed34edcd` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.1/SHA256SUMS.txt) | 327 | `579e63dd0430f7211dd5cce227049795682794d89bc6a747ab227452fbb309a3` |

- ダウンロードしたインストーラーと単体 EXE の FileVersion / ProductVersion は 1.4.1(ProductName: Life Launcher)。
- ポータブル ZIP の中身は `Life-Launcher-v1.4.1-windows-x64.exe` と `README.txt` の2つだけで、ZIP 内の EXE の SHA-256 は単体 EXE と一致し、FileVersion / ProductVersion は 1.4.1。
- 2回の `SHA256SUMS.txt` は同一(SHA-256 が一致)。

## 起動の確認(8.8)

**行っていない。** 作業中に、Life Launcher が起動中だった(pid 29972、`release-candidate/v1.4.1/Life-Launcher-v1.4.1-windows-x64.exe`。公開した単体 EXE と同じハッシュのビルド。オーナーの PC)。単一インスタンスのため、ダウンロードした EXE を起動しても起動中のアプリが前に出るだけになる。そのため、ダウンロードした単体 EXE と、ポータブル ZIP から展開した EXE は、起動していない。起動中のアプリを終了することもしていない。

代わりに確かめたこと:
- ダウンロードした EXE のハッシュが、オーナーが実機確認に使ったビルド(判定書 9. C)と同じ(判定書 4. のハッシュ)。
- バージョン情報が 1.4.1。

オーナーが起動を確認する場合は、起動中のアプリを完全に終了してから、ダウンロードした EXE を起動する。

## `releases/latest` と README のリンク

- `https://github.com/Takuyakou/life-launcher/releases/latest` は `releases/tag/v1.4.1` に転送される(HTTP 200)。`gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.4.1`、アセットは4つ。
- README.md・README.en.md のダウンロードのリンクは `releases/latest`。本文に書いたファイル名(インストーラー、単体実行版、ZIP 版の3つ)が、公開したアセットの名前と一致する。インストーラーのダウンロード URL(`releases/download/v1.4.1/Life-Launcher-v1.4.1-windows-x64-setup.exe`)は HTTP 200 で取得できる。
- Release の本文は `docs/releases/v1.4.1.md`。

## 行わなかったこと

- Web Demo の更新(別のパッケージ W14 で行う)。
- 起動中のアプリの終了・操作。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.4.1/` は、公開したアセットとの照合用に残してある。`release-candidate/native-check/` は、オーナーの判断で後で消してよい。
