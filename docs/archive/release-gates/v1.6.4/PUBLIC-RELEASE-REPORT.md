Life Launcher v1.6.4 RELEASED

# v1.6.4 公開結果の報告

- 公開日: 2026-11-25(JST。GitHub の `publishedAt` は 2026-11-25T03:37:11Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.6.4
- ビルドしたコミット M(PR 5 のマージのコミット、`main`): `2a072579ae5a5d3e957599ce563c357830c61700`
- タグ: `v1.6.4`(注釈つき)。タグのオブジェクト `9f6a6d9a42e33e0777f4958eaaf7ed3342ea4e10`、指すコミット `2a072579ae5a5d3e957599ce563c357830c61700`(M)。判定書のマージのコミットには付けていない。
- M から公開までの `main` の差分は `docs/archive/release-gates/v1.6.4/` の 3 ファイル(`FINAL-RELEASE-DECISION.md`・`native-checklist.md`・`release-notes.md`)だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.6.4)。

## 6 つの PR

| PR | 中身 | マージのコミット | CI |
| --- | --- | --- | --- |
| #187 | PR 1:閉じる動きをそろえる | `29984fe` | 先頭 `8cd67e6`:run `45515135840`、success |
| #188 | PR 2:メイン画面のファイルを分ける | `a654d1f` | 先頭 `43afb6a`:run `45517759120`、success |
| #189 | PR 3:テストの見直し | `3719161` | 先頭 `988e5dd`:run `45519167909`、success |
| #190 | PR 4:文書の整理と 1.6.4 | `5fc3aa2` | 先頭 `d432697`:run `45522359029`、success |
| #191 | PR 5:小さい直し(元に戻すの通知の長さ・まとめて取り込むの位置・選ぶ欄の見た目) | `2a072579ae5a5d3e957599ce563c357830c61700`(= M) | 先頭 `f9cd8a1`:run `45523305590`、success。M:run `45527023717`、success |
| #192 | 判定書(文書だけ) | `40e90687d2efe6725e7966d6867ff3934b90a745` | 実機の結果のコミット `31b48c8`:run `45538478631`、success(製品の確かめには数えない) |

PR 1〜5 は、1 つずつ CI(5 つの job)が通った事を確かめ、利用者の承認の後に `gh pr merge --merge` でマージした。PR 1〜5 の時はタグ・Release を作っていない。

## 手順ごとの結果

| 手順 | 結果 |
| --- | --- |
| A. PR 1〜5 | 成功。上の表のとおり。PR 5 では、手元の FULL で `phase97-import.spec.ts` が 1 件、開く前に `ERR_ADDRESS_IN_USE` で落ちた。リードの指示でそのファイルだけ 1 回回し直し、14 件通った(基準画像の差 0) |
| B. 配布物 | 成功。M を `git checkout --detach` してビルド。ハッシュ・ZIP の中身・版 1.6.4・公開してよい字かの確認・Defender・権限(差分なし)・画面の許可(`version` の 1 行だけ)・環境変数なしの起動・テスト用の起動は判定書のとおり |
| C. 判定書 | 成功。`docs/v1.6.4-release` で 3 ファイル(`f830196`)。実機の結果のコミットは `31b48c8`。PR #192 |
| D. 実機の確認 | 成功。`native-checklist.md` の 1〜13 を、M から作った単体 EXE(SHA-256 `FB6EFD23…`)でオーナーが確かめ、「確認したok」。14(インストーラーでの更新)は公開の後に利用者が行う |
| E. マージ・タグ・下書きの Release | 成功。オーナーが `cargo audit` の警告 14 件を v1.6.3 と同じ監査例外として認めた後、PR #192 をマージ。M に注釈つきタグを付けて push。下書きの Release(本文 `docs/releases/v1.6.4.md`、アセット 4 つ)を作成。新しい空のフォルダー(`.local-evaluation/v164-redownload`)へダウンロードし、3 ファイルのハッシュが `SHA256SUMS.txt` に一致、`SHA256SUMS.txt` も手元と同一、アセットは 4 つだけ、本文は `docs/releases/v1.6.4.md` と同じ |
| E. 公開 | 成功。オーナーの承認の後に `gh release edit v1.6.4 --draft=false` |
| E. 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v164-redownload-2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| F. 記録 | この報告書 |

## 手順から変えた事・記録しておく事

- **`cargo audit` の脆弱性 2 件**(判定書の 5. #3):`RUSTSEC-2026-0592`(`url` 2.5.8)と `RUSTSEC-2026-0594`(`cookie` 0.18.1)。直った版が公開から 14 日たっていないため、この版では直していない。**v1.6.5 で直す**。情報警告の 14 件は、オーナーの承認で v1.6.3 と同じ監査例外とした。
- **公開後の起動の確認での誤り**:設定の画面を見るために、画面を操作する道具でダウンロードした単体 EXE を前に出そうとしたところ、その道具がテスト用ではない起動(普段の保存先を使う起動)を 1 つ立ち上げた。気づいてすぐ、そのプロセスだけを終了した(動いていたのは約 1 分)。普段の保存先の中身は見ていない。次からは、テスト用に起動した窓を前に出す時に、EXE を起動する命令を使わない。
- PR 5 の手元の FULL の 1 件の回し直し(上)。
- 上以外に、手順と違う操作はしていない。

## ダウンロードの照合(公開前の下書きと、公開後の 2 回)

2 回とも、新しい空のフォルダーへ全アセットをダウンロードした。ハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2 回の `SHA256SUMS.txt` も、手元の `release-candidate/v1.6.4/SHA256SUMS.txt` と同一。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.4/Life-Launcher-v1.6.4-windows-x64-setup.exe) | 9,805,197 | `D17015C11EA198B337F6F2C1614A4D7CA4FEE0A99270C70A49911EC268E0E6D7` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.4/Life-Launcher-v1.6.4-windows-x64.exe) | 22,562,816 | `FB6EFD237D3FCBF4DD74D941311C5A68D96FD276C3F1A290CD1CDED5DD408ED7` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.4/Life-Launcher-v1.6.4-windows-x64-portable.zip) | 11,160,974 | `CCE5B88039BE90A80DA6D8438DB8D96998C2E237DDEF3574D1F5D2BBDC5E87FA` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.4/SHA256SUMS.txt) | 327 | `B3031FFAD877539AF42F26F0676138E66CB25FF59B478A46611522AC78362792` |

- ダウンロードした単体 EXE の ProductVersion は 1.6.4。

## 起動の確認

- 公開後にダウンロードした単体 EXE を `scripts/start-test-profile.ps1` で、新しいテスト用のプロファイルで起動した。窓のタイトルは `Life Launcher (テスト)` だった。
- 設定の「メンテナンス」に「バージョン 1.6.4」と出ている事を、オーナーが画面で確かめた。
- 確認の後に、その起動だけを終了した。
- インストーラーは実行していない。インストーラーでの更新は、オーナーが行う。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.6.4`。
- README.md のダウンロードのリンクは `releases/latest` で、開くと `releases/tag/v1.6.4` に移る。
- Release の本文は `docs/releases/v1.6.4.md`。

## 次の版(v1.6.5)へ回す事

- `url` と `cookie` の更新(上の `cargo audit`)。
- `src/styles/01-base.css` の、角の丸い枠の片側だけに付いた色の線(`border-left: 3px solid var(--project-color)`)の見直し。オーナーの判断で v1.6.5 で対応する。

## 行わなかったこと

- インストーラーでの更新(オーナーが行う。Life Launcher を終了 → `%APPDATA%\life-launcher` をバックアップ → v1.6.4 のインストーラー)。
- `url` と `cookie` の更新(次の版)。
- オーナーの普段のアプリの終了。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.6.4/` は、公開したアセットとの照合用に残してある。テスト用のプロファイルのフォルダーは、オーナーの判断で後で消してよい。
