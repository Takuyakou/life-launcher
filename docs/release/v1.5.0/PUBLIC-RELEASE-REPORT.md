Life Launcher v1.5.0 RELEASED

# v1.5.0 公開結果の報告

- 公開日: 2026-11-20(JST。GitHub の `publishedAt` は 2026-11-20T06:30:51Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.5.0
- マージのコミット(PR #168、`--merge`、2026-11-20T06:28:59Z): `049bc5d6441cc910905276ecec7a49345a5c39b3`(`main`)
- タグ: `v1.5.0`(注釈つき)。タグのオブジェクト `0c9b6348ee0625cd4ca006662c6b17363d994269`、指すコミット `049bc5d6441cc910905276ecec7a49345a5c39b3`
- ビルドに使ったソース: `7d1b0a1d4b7239e4e7d4f8505ac4b03e8fdd0268`。`7d1b0a1` から `049bc5d` までの差分は `docs/release/v1.5.0/FINAL-RELEASE-DECISION.md` だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.5.0)。

## 手順ごとの結果

| 手順 | 結果 |
| --- | --- |
| 0. 始める前の条件 | 成功。`done` の報告とリードの確認あり、答えの無い質問なし。`git diff --name-only 7d1b0a1 origin/p10/18-release` は `docs/release/v1.5.0/` の中だけ。3 ファイルの SHA-256 は判定書 4. と `SHA256SUMS.txt` の両方に一致。実機確認の記録は `365606f` |
| 1. PR と CI | PR #168 を作成。PR の先頭の CI は CI の揺れで落ちた(下の「手順から変えた事」)。製品は `7d1b0a1` の CI(run `44679151121`、約 16 分、`test:visual` 874 件すべて通過)で確かめた |
| 2. マージ | 成功。オーナーの承認の後に `gh pr merge 168 --merge`。`git diff --name-only 7d1b0a1 origin/main` は `docs/release/v1.5.0/FINAL-RELEASE-DECISION.md` だけ |
| 3. タグと下書きの Release | 成功。タグ `v1.5.0` が無く、Release も無い事を確かめてから、`049bc5d` に注釈つきタグ `v1.5.0` を付けて push。下書きの Release(本文 `docs/releases/v1.5.0.md`、アセット 4 つ)を作成。新しい空のフォルダー(`.local-evaluation/v150-redownload`)へダウンロードし、3 ファイルのハッシュが判定書 4. と `SHA256SUMS.txt` の両方に一致、アセットは 4 つだけ |
| 4. 公開 | 成功。オーナーの承認の後に `gh release edit v1.5.0 --draft=false` |
| 4. 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v150-redownload-2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| 5. 記録 | この報告書と、判定書の一番上の 1 行 |

## 手順から変えた事

- **PR の先頭の CI が通らないままマージした**(リードの決め `RESUME-PUBLISH-v1.5.0` の C の 3)。製品のファイルが `7d1b0a1` と同じなら、PR の先頭の CI の失敗では止まらず、1 回だけ回し直してからマージの確認に進む、という決め。
  - PR の先頭が `5a31853` の時の run `44679591632`:870 件通過・4 件失敗(`phase10-weekly` の「P10-15b H2 the stale buttons use the main-screen button colours」、`phase87-followup-polish` の「Dictionary entry aligns with item rows and Guide footer stays inside its dialog」、`phase97-wishlist-layout` の「the 未分類 header cannot start a group drag」、`today3-remove` の「removes only Today adoption, preserves both sources, candidates and sessions on reload」)。
  - PR の先頭が `75dbdaa` の時の run `44683124057`:869 件通過・2 件失敗(`phase10-motion` の「K3 the Do Now copy enters from the side when the selection changes」、`phase62-quick-picker` の「Dictionary to Quick move rolls the display back when saving fails」)。どれも画像の比べではない(色・位置・動き・待ち・時間切れ)。
  - 回し直し:run `44683124057` を `gh run rerun --failed` で 1 回(attempt 2)。マージと公開の時点で、まだ終わっていなかった。
  - `5a31853` と `75dbdaa` は、どちらも `7d1b0a1` に判定書だけを足したコミット。落ちたテストは run ごとに違い、v1.5.1 で直す(リードの決め)。
- **4. の起動の確認の途中で、普段のプロファイルで v1.5.0 を 1 回起動してしまった**。ZIP の EXE の窓を画面の操作のツールで前に出そうとした時、ツールがダウンロードした単体 EXE をテスト用の起動の外で新しく起動した(15:34 JST ごろ、約 1 分)。窓のタイトルは `Life Launcher`(テストの札なし)で、オーナーの普段のデータが出ていた。気づいてすぐ、その起動だけを強制終了した。オーナーの普段の Life Launcher は、その時動いていなかった。その起動でデータが書き換わったかは確かめていない(利用者のデータは読まない決まりのため)。オーナーに伝えた。
- ZIP を展開した EXE は、テスト用の起動でタイトルまで確かめたが、設定の「メンテナンス」の版の表示は見ていない(上の事で画面の操作を止めたため)。代わりに、ZIP 内の EXE が単体 EXE とハッシュ一致で、FileVersion が 1.5.0 である事を確かめた。
- 上以外に、手順と違う操作はしていない。

## ダウンロードの照合(公開前の下書きと、公開後の 2 回)

2 回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2 回の `SHA256SUMS.txt` も同一。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.0/Life-Launcher-v1.5.0-windows-x64-setup.exe) | 9,668,799 | `8DE4144914281837ACE6FD9AF1B54F33030817E2ADC44A8778313C0CA15206F3` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.0/Life-Launcher-v1.5.0-windows-x64.exe) | 22,234,624 | `CF51460F921084EC9D0E95E1F4F4A1D03965164052ABE845985C7AFEFEE69141` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.0/Life-Launcher-v1.5.0-windows-x64-portable.zip) | 10,995,837 | `22E370D113D67DB4801654825F467F0527C1C4083BD47399A21C468AF81C9C08` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.5.0/SHA256SUMS.txt) | 327 | `E11CEDD17F045A94AB71DA1A72A5AA574B1A5EBD9C715B023062B9F4A4570DAB` |

- ダウンロードした単体 EXE と ZIP 内の EXE の FileVersion は 1.5.0。
- ポータブル ZIP の中身は `Life-Launcher-v1.5.0-windows-x64.exe` と `README.txt` の 2 つだけで、ZIP 内の EXE の SHA-256 は単体 EXE と一致。

## 起動の確認

- ダウンロードした単体 EXE を `scripts/start-test-profile.ps1` で起動した。窓のタイトルは `Life Launcher (テスト)` で、設定の「メンテナンス」に「バージョン 1.5.0」と出た。確認の後にテスト用の起動を終了した。
- ポータブル ZIP を展開した EXE を、同じく `scripts/start-test-profile.ps1` で起動した。窓のタイトルは `Life Launcher (テスト)`。確認の後にテスト用の起動を終了した(版の表示は「手順から変えた事」のとおり)。
- インストーラーは実行していない。インストーラーでの更新は、オーナーが行う。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.5.0`。
- README.md・README.en.md のダウンロードのリンクは `releases/latest`。
- Release の本文は `docs/releases/v1.5.0.md`。

## 行わなかったこと

- インストーラーでの更新(オーナーが行う)。
- オーナーの普段のアプリの終了。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.5.0/` は、公開したアセットとの照合用に残してある。テスト用のプロファイルのフォルダーは、オーナーの判断で後で消してよい。
