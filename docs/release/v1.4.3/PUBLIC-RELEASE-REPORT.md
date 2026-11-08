Life Launcher v1.4.3 RELEASED

# P97-12 公開結果の報告

- 公開日: 2026-11-08(JST。GitHub の `publishedAt` は 2026-11-08T14:24:44Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.4.3
- マージのコミット(PR #164): `8e83be3fc001aebdb6d3549e35fb56f6eee0b411`(`main`)
- タグ: `v1.4.3`(注釈つき)。タグのオブジェクト `b8c1662d187325d183ca3824586526fd9977418e`、指すコミット `8e83be3fc001aebdb6d3549e35fb56f6eee0b411`
- ビルドに使ったソース: `95675289619a92901d59dbf9a185b5fd9a46e15d`。`9567528` から `8e83be3` までの差分は `docs/release/v1.4.3/FINAL-RELEASE-DECISION.md` だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.4.3)。

## 手順の結果(判定書 8.)

| 手順 | 結果 |
| --- | --- |
| 8.1 マージの前の確認 | 成功。`origin/main` = `8e83be3`、タグ `v1.4.3` なし(`git ls-remote` が空)、`gh release view v1.4.3` は「release not found」、3ファイルの SHA-256 は判定書 4. と一致、`git diff --name-only 9567528 8e83be3` は `docs/release/v1.4.3/FINAL-RELEASE-DECISION.md` だけ |
| 8.2 マージ | 行わない。PR #164 はオーナーがマージ済み |
| 8.3 マージの後の確認 | 成功。`git diff --name-only 9567528 origin/main` は `docs/` の下の1ファイルだけ。製品の差分 0 件。`main` の CI は待たない |
| 8.4 タグ | 成功。`8e83be3` に注釈つきタグ `v1.4.3` を付けて push |
| 8.5 下書きの Release | 成功。アセットは4つ、本文は `docs/releases/v1.4.3.md` |
| 8.6 下書きの確認 | 成功。新しい空のフォルダー(`.local-evaluation/v143-redownload`)へダウンロードし、3ファイルのハッシュが、公開した `SHA256SUMS.txt` と判定書 4. の両方に一致。アセットは4つだけ |
| 8.7 公開 | 成功。`gh release edit v1.4.3 --draft=false` |
| 8.8 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v143-redownload-2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| 8.9 記録 | この報告書 |

## 判定書から変えたこと

- **8.2 のマージは行わなかった**。PR #164 はオーナーがマージ済みで、`origin/main` は `8e83be3` だった。
- **8.3 の「`main` の CI が成功していること」は待たなかった**。代わりに、`9567528` と `origin/main` の差分が `docs/` の下だけであることを確かめた。
- **8.8 の起動の確認は、ダウンロードした単体 EXE と、ポータブル ZIP を展開した EXE を、`scripts/start-test-profile.ps1` のテスト用の起動で行った**。オーナーの普段の Life Launcher は終了していない。確認に使ったテスト用の起動は、確認の後に終了した。
- 上以外に、判定書と違う操作はしていない。8.1 の `gh release view` が終了コード 1 になるのは、「release not found」が期待の結果のため。

## ダウンロードの照合(公開前の下書きと、公開後の2回)

2回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2回の `SHA256SUMS.txt` も同一(SHA-256 `324F5912…FDF8CBB3`)。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.3/Life-Launcher-v1.4.3-windows-x64-setup.exe) | 3,771,887 | `511CBB397E1D13B69B16EAEA55F893651162BED6EB93C330253980241F1CC4B7` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.3/Life-Launcher-v1.4.3-windows-x64.exe) | 16,179,712 | `EEB261909FE0ED84957A574335F5B300A0CFE5C4EF308A43F026C2F0F0BD947B` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.3/Life-Launcher-v1.4.3-windows-x64-portable.zip) | 5,143,775 | `6ACBE6D6D1A8E73936BD7CCC14D40B5561954B0E82DE4D5A606B14ABBE594784` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.3/SHA256SUMS.txt) | 327 | `324F5912071356C7A94FBD291D16E8751D89E7F6EA641F6B4326B96F7DF8CBB3` |

- ダウンロードしたインストーラーと単体 EXE の FileVersion / ProductVersion は 1.4.3(ProductName: Life Launcher)。
- ポータブル ZIP の中身は `Life-Launcher-v1.4.3-windows-x64.exe` と `README.txt` の2つだけで、ZIP 内の EXE の SHA-256 は単体 EXE と一致。

## 起動の確認(8.8)

- ダウンロードした単体 EXE(`.local-evaluation/v143-redownload-2/Life-Launcher-v1.4.3-windows-x64.exe`、SHA-256 `EEB2619…BD947B`)を、`scripts/start-test-profile.ps1` で起動した。窓のタイトルは `Life Launcher (テスト)` で、メイン画面が出た(プロファイル `release-candidate/native-check/profiles/20261108-232510`、プロセス ID 69844)。確認の後にテスト用の起動を終了した。
- ポータブル ZIP を `.local-evaluation/v143-zip-extract` に展開し、中の EXE を同じく `scripts/start-test-profile.ps1` で起動した。窓のタイトルは `Life Launcher (テスト)` で、メイン画面が出た(プロファイル `release-candidate/native-check/profiles/20261108-232532`、プロセス ID 71428)。確認の後にテスト用の起動を終了した。
- オーナーの普段の Life Launcher(プロセス ID 18492、`release-candidate/v1.4.3/Life-Launcher-v1.4.3-windows-x64.exe`、タイトル `Life Launcher`)は終了していない。
- インストーラーは実行していない。オーナーが v1.4.2 から v1.4.3 へ更新済みで、実機確認で更新を確認しているため。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.4.3`。
- README.md・README.en.md のダウンロードのリンクは `releases/latest`。本文に書いたファイル名(インストーラー、単体実行版、ZIP 版の3つ)が、公開したアセットの名前と一致する。
- Release の本文は `docs/releases/v1.4.3.md`。

## 行わなかったこと

- Web Demo の更新(P97-12 の指示。v1.4.3 の変更はブラウザ版に関係しない)。
- オーナーの普段のアプリの終了・操作。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.4.3/` は、公開したアセットとの照合用に残してある。テスト用のプロファイルのフォルダーは、オーナーの判断で後で消してよい。
