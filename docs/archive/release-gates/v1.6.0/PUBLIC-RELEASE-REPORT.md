Life Launcher v1.6.0 RELEASED

# v1.6.0 公開結果の報告

- 公開日: 2026-11-22(JST。GitHub の `publishedAt` は 2026-11-21T17:18:19Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.6.0
- マージのコミット(PR #173、`--merge`、2026-11-21T17:17:00Z): `dc7d81ea873d21d074b7049365e18f2b0fa90339`(`main`)
- タグ: `v1.6.0`(注釈つき)。タグのオブジェクト `6119b892bfc96f60b471d91ef69f11f733bb5fac`、指すコミット `dc7d81ea873d21d074b7049365e18f2b0fa90339`
- ビルドに使ったソース(X): `e616d66ec08bc7143746e4350a2e19be990d6eab`。`e616d66` から `dc7d81e` までの差分は `docs/release/v1.6.0/` の 3 ファイル(`FINAL-RELEASE-DECISION.md`・`native-checklist.md`・`release-notes.md`)だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.6.0)。

## 手順ごとの結果

| 手順 | 結果 |
| --- | --- |
| A. push と CI | 成功。X の CI(run `44907618261`、attempt 1、約 25 分)がすべて通った。`test:visual` 937 件通過、`cargo test` 205 件通過。CI は 1 回だけ回した。前の X(`aa19a40`)の run `44879987037` は数えない(S9 の直しを足すため X にしなかった)。push の前に、`ci.yml` の手順(`test:visual` 以外)を手元で全部通した |
| B. 配布物 | 成功。X をそのままビルド。ハッシュ・ZIP の中身・版・権限・画面の許可・公開してよい字かの確認・Defender・`cargo audit`・`npm audit --omit=dev`(0 件)・テスト用の起動は判定書のとおり |
| C. 判定書 | 成功。`2a1e3cb` で `docs/release/v1.6.0/` の 3 ファイルを書き直した |
| D. 実機の確認 | 成功。`native-checklist.md` の 1〜9 が、新しい EXE(X から作った単体 EXE、SHA-256 `BBD37C5B…EDC1C`)で通った(確かめたのは利用者)。10(インストーラーでの更新)は公開の後に利用者が行う。結果は `44b9584` |
| E. マージ | 成功。オーナーの承認の後に `gh pr merge 173 --merge`。`git diff --name-only e616d66 origin/main` は `docs/release/v1.6.0/` の中だけ |
| E. タグと下書きの Release | 成功。タグ `v1.6.0` も Release も無い事を確かめてから、マージのコミットに注釈つきタグを付けて push。下書きの Release(本文 `docs/releases/v1.6.0.md`、アセット 4 つ)を作成。新しい空のフォルダー(`.local-evaluation/v160-redownload`)へダウンロードし、3 ファイルのハッシュが判定書 4. と `SHA256SUMS.txt` の両方に一致、アセットは 4 つだけ |
| E. 公開 | 成功。オーナーの承認の後に `gh release edit v1.6.0 --draft=false` |
| E. 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v160-redownload-2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| F. 記録 | この報告書と、判定書の一番上の 1 行 |

## 手順から変えた事・記録しておく事

- **docs のコミットの CI が 1 件落ちた**(製品の確かめに数えない。PUBLISH の C の 6)。
  - run `44883191629`(`6f412f9`、前の X の後の判定書のコミット):924 件通過・1 件失敗。`phase82-countup-ui.spec.ts:164` の「P82-03 Measure layout stays bounded in 3 column mode at 1440」で、測定の経過の時計が `00:05` になる前に `00:04`〜`00:09` と進み、`toHaveText("00:05")` が合わなかった。製品のファイルの問題ではなく、X の run と手元の FULL では通っている。リードが v1.6.0 の後で直す。
  - X の後の docs のコミット(`2a1e3cb`・`44b9584`)の CI(run `44928081781`・`44929125944`)は、この報告を書いた時点でまだ終わっていなかった。製品の確かめには数えない。
- 途中で、リードの実機の確かめで 3 件(記録のタブの下のスクロールバー・ZIP を開いたまま出る英語の赤い帯・空の説明に ZIP が無い)が見つかり、利用者の頼みの「手順書の一覧のフォルダの開け閉め」とあわせて S9(4 コミット)で直した。さらに、繰り返しの実行で揺れたテスト 2 本(`v160-book` と `phase10-motion` の K3)の待ち方を S9b(テストだけ)で直した。そのため X が `aa19a40` から `e616d66` に変わり、A・B・C をやり直した。
- 上以外に、手順と違う操作はしていない。

## ダウンロードの照合(公開前の下書きと、公開後の 2 回)

2 回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2 回の `SHA256SUMS.txt` も同一。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.0/Life-Launcher-v1.6.0-windows-x64-setup.exe) | 9,771,478 | `8561B7348C7CCA43CDB57E3CFF5C3284DFC5DB72E4D3DC7D44E2206A7F35FA9C` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.0/Life-Launcher-v1.6.0-windows-x64.exe) | 22,486,016 | `BBD37C5B1A19C7B4CCB8BD6EB8C18F2AE4BBD85570B145D07E41CF683A6EDC1C` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.0/Life-Launcher-v1.6.0-windows-x64-portable.zip) | 11,130,318 | `4B634EE3B522DFC554D827166F08F589E7517EDD464768A6D4F23C27CF140399` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.0/SHA256SUMS.txt) | 327 | `A0E6A8EA9A9E757724B76DB294F9DF2E42BFE8846D775178ECF99EA01ED88DB3` |

- ダウンロードした単体 EXE の FileVersion / ProductVersion は 1.6.0。
- ポータブル ZIP の中身は `Life-Launcher-v1.6.0-windows-x64.exe` と `README.txt` の 2 つだけ(公開前の確認、B の確認)で、ZIP 内の EXE の SHA-256 は単体 EXE と一致。

## 起動の確認

- 公開後にダウンロードした単体 EXE を `scripts/start-test-profile.ps1` で、新しいテスト用のプロファイルで起動した。窓のタイトルは `Life Launcher (テスト)` だった。確認の後に、その起動だけを終了した。
- **設定の「メンテナンス」の「バージョン 1.6.0」の表示は、画面では確かめていない**(EXE の ProductVersion が 1.6.0 である事と、ハッシュが `native-checklist.md` の 1〜9 を確かめた EXE と同じである事で代える)。
- インストーラーは実行していない。インストーラーでの更新は、オーナーが行う。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.6.0`。
- README.md のダウンロードのリンクは `releases/latest` で、開くと `releases/tag/v1.6.0` に移る。
- Release の本文は `docs/releases/v1.6.0.md`。

## 行わなかったこと

- インストーラーでの更新(オーナーが行う。Life Launcher を終了 → `%APPDATA%\life-launcher` をバックアップ → v1.6.0 のインストーラー)。
- オーナーの普段のアプリの終了。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.6.0/` は、公開したアセットとの照合用に残してある。テスト用のプロファイルのフォルダーは、オーナーの判断で後で消してよい。
