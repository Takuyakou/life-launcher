Life Launcher v1.4.2 RELEASED

# P96-05 公開結果の報告

- 公開日: 2026-11-06(JST。GitHub の `publishedAt` は 2026-11-06T13:39:16Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.4.2
- マージのコミット(PR #144): `d1192d8ba4ff11f339dbce2443ff22db0f5a558a`(`main`)
- タグ: `v1.4.2`(注釈つき)。タグのオブジェクト `6ca1c5e70d55842a47e7d2336ecead7191389dae`、指すコミット `d1192d8ba4ff11f339dbce2443ff22db0f5a558a`
- 承認されたコミット: `release/v1.4.2` の `5d5c99b13a08c17330669f2b7804bb6b7a43705d`(P96-05 第1部。`fadc2bb` の上に1コミット、変更は文書2ファイルだけ)
- ビルドに使ったソース: `282a67e95d801ae403711bc3b5c46703dc3e94e5`。`282a67e` から `d1192d8` までの差分は `docs/` の下の4ファイル(`docs/release/v1.4.2/FINAL-RELEASE-DECISION.md`、`native-checklist.md`、`release-notes.md`、`docs/releases/v1.4.2.md`)だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.4.2)。

## 手順の結果(判定書 8.)

| 手順 | 結果 |
| --- | --- |
| 8.1 マージの前の確認 | 成功。`origin/release/v1.4.2` = `5d5c99b`(第1部。`fadc2bb` から1コミット、変更は文書2ファイル)、PR #144 は OPEN・mergeable、CI(`CI`)は `282a67e` で成功(run 42219639302)、タグ `v1.4.2` なし(`git ls-remote` が空)、`gh release view v1.4.2` は「release not found」(終了コード 1 は期待の結果)、3ファイルの SHA-256 は判定書 4. と一致、実機確認の結果は `native-checklist.md` に記録済み |
| 8.2 マージ | 成功。`gh pr merge 144 --merge --match-head-commit 5d5c99b…`(終了コード 0)。マージのコミット `d1192d8` |
| 8.3 マージの後の確認 | 成功(判定書と違う操作あり。下記)。`282a67e` と `origin/main` の差分は `docs/` の4ファイルだけで、製品の差分 0 件 |
| 8.4 タグ | 成功。`d1192d8` に注釈つきタグ `v1.4.2` を付けて push |
| 8.5 下書きの Release | 成功。アップロード直前にも3ファイルのハッシュを確かめた。アセットは4つ、本文は `docs/releases/v1.4.2.md` |
| 8.6 下書きの確認 | 成功。新しい空のフォルダー(`.local-evaluation/v142-redownload`)へダウンロードし、3ファイルのハッシュが、公開した `SHA256SUMS.txt` と判定書 4. の両方に一致。アセットは4つだけ |
| 8.7 公開 | 成功。`gh release edit v1.4.2 --draft=false` |
| 8.8 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v142-redownload2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| 8.9 記録 | この報告書 |

## 判定書から変えたこと

- **8.1 の1番目は、指示書の読み替えどおり**にした。`$head` は第1部のコミット `5d5c99b` で、PR #144 の CI はビルドしたコミット `282a67e` で成功していることを確かめた(第1部のコミットの CI は待っていない)。
- **8.3 の「`main` の CI が成功していること」は待たなかった**(オーナー判断 2026-11-02)。代わりに、`282a67e` と `origin/main` の差分が `docs/` の下だけであることを確かめた(下記)。
- **8.8 の起動の確認は、ダウンロードした単体 EXE で行った**。確認の時点で Life Launcher は起動していなかった(プロセス 0 件)ため、オーナーの指示(起動中なら起動しない)に当たらない。起動してメイン画面(窓のタイトル `Life Launcher`、クライアント領域 1200×680)が出ることを確かめ、確認の後に強制終了した(窓の状態を書き換えないため)。起動中だったアプリは無く、終了させたアプリも無い。
- 上以外に、判定書と違う操作はしていない。8.1 の `gh release view` が終了コード 1 になるのは、「release not found」が期待の結果のため。

## ダウンロードの照合(公開前の下書きと、公開後の2回)

2回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2回の `SHA256SUMS.txt` も同一(SHA-256 `226d632a…af76b3f`)。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.2/Life-Launcher-v1.4.2-windows-x64-setup.exe) | 3,732,777 | `1DDB3A037BCACBA0DA6EB9F1F3AA522C48D779A0C719E3D9E2A8B36760268518` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.2/Life-Launcher-v1.4.2-windows-x64.exe) | 16,066,048 | `6938852FEDF36EBB23092B73AEAE83FE989A373D043E491A62136524F5F44AD7` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.2/Life-Launcher-v1.4.2-windows-x64-portable.zip) | 5,069,117 | `D180A97EDF59E22757E9C685D9E06E7E9A63C49E7BE7936AC7B3467C3B880407` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.2/SHA256SUMS.txt) | 327 | `226D632A4A87E82F7974729051A0597E2BF76471D8C89822931ED7B53AF76B3F` |

- ダウンロードしたインストーラーと単体 EXE の FileVersion / ProductVersion は 1.4.2(ProductName: Life Launcher)。
- ポータブル ZIP の中身は `Life-Launcher-v1.4.2-windows-x64.exe` と `README.txt` の2つだけで、ZIP 内の EXE の SHA-256 は単体 EXE と一致(公開前の確認で確認済み)。

## 起動の確認(8.8)

- ダウンロードした単体 EXE(`.local-evaluation/v142-redownload2/Life-Launcher-v1.4.2-windows-x64.exe`、SHA-256 `6938852F…5F44AD7`)を起動した。窓のタイトルは `Life Launcher`、クライアント領域は **1200×680** で、メイン画面が出た。確認の後に強制終了し、プロセスが残っていないことを確かめた。
- インストーラーは実行していない。オーナーが v1.4.1 から v1.4.2 へ更新済みで、実機確認(判定書 9. B の 1)で更新を確認しているため。
- ポータブル ZIP から展開した EXE も起動していない(ZIP 内の EXE は単体 EXE と同じハッシュ)。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.4.2`。
- README.md・README.en.md のダウンロードのリンクは `releases/latest`。本文に書いたファイル名(インストーラー、単体実行版、ZIP 版の3つ)が、公開したアセットの名前と一致する。インストーラーのダウンロード URL(`releases/download/v1.4.2/Life-Launcher-v1.4.2-windows-x64-setup.exe`)は HTTP 200(3,732,777 バイト)。
- Release の本文は `docs/releases/v1.4.2.md`。

## 行わなかったこと

- Web Demo の更新(判定書 8.11。v1.4.2 の変更はブラウザ版に関係しない)。
- 起動中のアプリの終了・操作(起動中のアプリは無かった)。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.4.2/` は、公開したアセットとの照合用に残してある。`release-candidate/v1.4.2/native-backup/` は、オーナーの判断で後で消してよい。
