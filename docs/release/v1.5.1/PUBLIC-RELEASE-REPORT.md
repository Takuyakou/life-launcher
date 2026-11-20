Life Launcher v1.5.1 RELEASED

# v1.5.1 公開結果の報告

- 公開日: 2026-11-21(JST。GitHub の `publishedAt` は 2026-11-20T18:39:07Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.5.1
- マージのコミット(PR #171、`--merge`、2026-11-20T18:36:52Z): `d4c101e5ceb3aecc638e406c71f1c38317ee06b0`(`main`)
- タグ: `v1.5.1`(注釈つき)。タグのオブジェクト `ce1801b30523a6c3da1af45670257dfc7679d9ef`、指すコミット `d4c101e5ceb3aecc638e406c71f1c38317ee06b0`
- ビルドに使ったソース(X): `712f4957f8b210a01fe6dab9f12de8c9f5b7dce9`。`712f495` から `d4c101e` までの差分は `docs/release/v1.5.1/` の 3 ファイル(`FINAL-RELEASE-DECISION.md`・`native-checklist.md`・`release-notes.md`)だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.5.1)。

## 手順ごとの結果

| 手順 | 結果 |
| --- | --- |
| A. push と CI | 成功。X の CI(run `44766836898`、attempt 1、約 23 分)がすべて通った。`test:visual` 898 件通過、`cargo test` 192 件通過。CI は 1 回だけ回した(オーナーの決め)。前の X(`5318028`・`82199b9`・`5ac469f`)の run は数えない |
| B. 配布物 | 成功。X をそのままビルド。ハッシュ・ZIP の中身・版・権限・公開してよい字かの確認・Defender・`cargo audit`・`npm audit --omit=dev`(0 件)・テスト用の起動は判定書のとおり |
| C. 判定書 | 成功。`6529f0b` で `docs/release/v1.5.1/` の 3 ファイルをコミット |
| D. 実機の確認 | 成功。`native-checklist.md` の 1〜6・8・9 が通った(2 は利用者、ほかはリード)。7 と 10 は未実施(理由は表に書いた)。結果は `beea76e` |
| E. マージ | 成功。オーナーの承認の後に `gh pr merge 171 --merge`。`git diff --name-only 712f495 origin/main` は `docs/release/v1.5.1/` の中だけ |
| E. タグと下書きの Release | 成功。タグ `v1.5.1` も Release も無い事を確かめてから、`d4c101e` に注釈つきタグを付けて push。下書きの Release(本文 `docs/releases/v1.5.1.md`、アセット 4 つ)を作成。新しい空のフォルダー(`.local-evaluation/v151-redownload`)へダウンロードし、3 ファイルのハッシュが判定書 4. と `SHA256SUMS.txt` の両方に一致、アセットは 4 つだけ |
| E. 公開 | 成功。オーナーの承認の後に `gh release edit v1.5.1 --draft=false` |
| E. 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v151-redownload-2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| F. 記録 | この報告書と、判定書の一番上の 1 行 |

## 手順から変えた事・記録しておく事

- **X の後の文書のコミットの CI が 1 件落ちた**(製品の確かめに数えない。PUBLISH の C の 6)。
  - run `44774818848`(`6529f0b`、`docs/release/v1.5.1/` の 3 ファイルだけを足したコミット):897 件通過・1 件失敗。`post-v133b-followup` の「mouse-free arrows traverse Sidebar, Dictionary, Main, toolbar, Settings and menu」で、キーで移った先(`.dictionaryWindowLock`)にフォーカスが来なかった。X の run と手元の FULL では通っている。製品のファイルは X と同じなので、直していない。
  - PR の先頭(`beea76e`)の CI(run `44794295998`)は、マージの時点でまだ終わっていなかった。PUBLISH の E の 3 のとおり、PR の先頭の CI では止まらなかった。
- **実機の確認(D)の途中で、v1.5.1 の EXE が普段のデータで 1 回起動した**(リードの画面の操作の誤り。`native-checklist.md` を書いた元のリードの記録にある)。何も操作せずに閉じ、オーナーが終了した。起動しただけでは普段のデータを書き換える処理は走らない(v1.5.1 と v1.5.0 のデータの形は同じ)。
- 上以外に、手順と違う操作はしていない。

## ダウンロードの照合(公開前の下書きと、公開後の 2 回)

2 回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2 回の `SHA256SUMS.txt` も同一。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.1/Life-Launcher-v1.5.1-windows-x64-setup.exe) | 9,645,895 | `BAA8D12F30A42CB1C338DDA0DECE6560D9FA425D4335FA27D56C0A5DC824767E` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.1/Life-Launcher-v1.5.1-windows-x64.exe) | 22,164,480 | `6AA7AC3A8AEDFA58F4D60432F516A301B7771049BCC4A10E406C8EFDB5182CAD` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.1/Life-Launcher-v1.5.1-windows-x64-portable.zip) | 10,972,084 | `4BA13BC172BC090C7014839015293EC5DADAD114D9BE7C2D56461662A1096E45` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.1/SHA256SUMS.txt) | 327 | `33DFDA2B464A4C8D2C04D0086CDCAB92B78A48B528651A817423526D10E42D34` |

- ダウンロードした単体 EXE の FileVersion は 1.5.1。
- ポータブル ZIP の中身は `Life-Launcher-v1.5.1-windows-x64.exe` と `README.txt` の 2 つだけで、ZIP 内の EXE の SHA-256 は単体 EXE と一致。

## 起動の確認

- 公開後にダウンロードした単体 EXE を `scripts/start-test-profile.ps1` で、新しいテスト用のプロファイルで起動した。窓のタイトルは `Life Launcher (テスト)` で、設定の「メンテナンス」に「バージョン 1.5.1」と出た。確認の後に、そのテスト用の起動だけを終了した。
- インストーラーは実行していない。インストーラーでの更新は、オーナーが行う。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.5.1`。
- README.md・README.en.md のダウンロードのリンクは `releases/latest` で、開くと `releases/tag/v1.5.1` に移る。
- Release の本文は `docs/releases/v1.5.1.md`。

## 行わなかったこと

- インストーラーでの更新(オーナーが行う。Life Launcher を終了 → データのフォルダーをバックアップ → v1.5.1 のインストーラー)。
- オーナーの普段のアプリの終了。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.5.1/` は、公開したアセットとの照合用に残してある。テスト用のプロファイルのフォルダーは、オーナーの判断で後で消してよい。
