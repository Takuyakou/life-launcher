Life Launcher v1.6.1 RELEASED

# v1.6.1 公開結果の報告

- 公開日: 2026-11-22(JST。GitHub の `publishedAt` は 2026-11-22T07:06:49Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.6.1
- マージのコミット(PR #175、`--merge`): `1b5b0432ac0742976ed877ff88c8f2cf38b2ef6f`(`main`)
- タグ: `v1.6.1`(注釈つき)。タグのオブジェクト `adbf466c0ab99524d876739aa3b2459efdcbe15a`、指すコミット `1b5b0432ac0742976ed877ff88c8f2cf38b2ef6f`
- ビルドに使ったソース(X): `c18d1814aa87931ebc4e72f16a8c65106e48d0de`。`c18d181` から `1b5b043` までの差分は `docs/release/v1.6.1/` の 3 ファイル(`FINAL-RELEASE-DECISION.md`・`native-checklist.md`・`release-notes.md`)だけで、製品のファイルの差分は 0 件。
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.6.1)。

## 手順ごとの結果

| 手順 | 結果 |
| --- | --- |
| 0. 始める前の確かめ | 成功。`git diff --name-only 504b70b c18d181` が `PUBLISH-v1.6.1.md` の挙げた 6 ファイルだけ。`git diff v1.6.0 c18d181 -- package-lock.json src-tauri/Cargo.lock` が版の番号の行(3 か所)だけ |
| A. push と CI | 成功。X の CI(run `44994220760`、attempt 1、8 分 19 秒)の 5 つの job(`verify`・`visual-shard (1)`〜`(3)`・`visual`)がすべて通った。`test:visual` 946 件通過(316・315・315)、`cargo test` 210 件通過。CI は 1 回だけ回した。push の前に、`ci.yml` の手順(`test:visual` 以外)を手元で全部通した |
| A. 必須のチェック | `main` にブランチの保護が無く(`required_status_checks` は 404)、rulesets も無い。必須のチェックは無い。オーナーに聞き、設定は変えないと決まった(`visual` は足していない) |
| B. 配布物 | 成功。X をそのままビルド。ハッシュ・ZIP の中身・版・権限(差分なし)・画面の許可(`version` の 1 行だけ)・公開してよい字かの確認・Defender・`cargo audit`(脆弱性 0、情報警告 14、v1.6.0 と同じ)・`npm audit --omit=dev`(0 件)・環境変数なしの起動・テスト用の起動は判定書のとおり |
| C. 判定書 | 成功。`420c285` で `docs/release/v1.6.1/` の 3 ファイルを書いた。このコミットの CI(run `44996076012`)は success(製品の確かめには数えない) |
| D. 実機の確認 | 成功。`native-checklist.md` の 1〜9 が、X から作った単体 EXE(SHA-256 `02E1F4DB…B617A2`)で通った(確かめたのは利用者)。10(インストーラーでの更新)は公開の後に利用者が行う。結果は `d00ed25` |
| E. マージ | 成功。オーナーの承認の後に `gh pr merge 175 --merge`。`git diff --name-only c18d181 origin/main` は `docs/release/v1.6.1/` の中だけ |
| E. タグと下書きの Release | 成功。タグ `v1.6.1` も Release も無い事を確かめてから、マージのコミットに注釈つきタグを付けて push。下書きの Release(本文 `docs/releases/v1.6.1.md`、アセット 4 つ)を作成。新しい空のフォルダー(`.local-evaluation/v161-redownload`)へダウンロードし、3 ファイルのハッシュが判定書 4. と `SHA256SUMS.txt` の両方に一致、アセットは 4 つだけ |
| E. 公開 | 成功。オーナーの承認の後に `gh release edit v1.6.1 --draft=false` |
| E. 公開後の確認 | 成功。もう一度、新しい空のフォルダー(`.local-evaluation/v161-redownload-2`)へダウンロードして照合。`releases/latest` と README のリンクを確認。起動の確認は下記 |
| F. 記録 | この報告書と、判定書の一番上の 1 行 |

## CI の時間の変わり方

| 版 | 数えた run | 全体の時間 | 画面のテスト |
| --- | --- | --- | --- |
| v1.6.0 | `44907618261` | 25 分 6 秒 | 937 件を 1 つの job で 21.9 分 |
| v1.6.1 | `44994220760` | **8 分 19 秒** | 946 件を 3 つの組で並べて。一番長い組は 8 分 10 秒(テストは 6.6 分) |

v1.6.1 は、画面のテストをビルドした物に対して回し、1 つのファイルの中も並べて回し、CI では 3 つの組に分けたため、全体で約 16 分 47 秒(およそ 3 分の 1)短くなった。

## 手順から変えた事・記録しておく事

- 必須のチェックは、設定が無かったので変えていない(上)。
- 判定書の 3 ファイルは、`.gitignore` の `release/` に当たるため、名前を書いた `git add -f` で 1 つずつ足した(前の版と同じ。オーナーに確かめた)。
- マージの後の `main` の CI(run `44996639214`、`1b5b043`)と、実機の結果のコミットの CI(run `44996580979`、`d00ed25`)は、この報告を書いた時点でまだ終わっていなかった。製品の確かめには数えない。
- 上以外に、手順と違う操作はしていない。

## ダウンロードの照合(公開前の下書きと、公開後の 2 回)

2 回とも、新しい空のフォルダーへ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と判定書 4. の表の**両方**に一致した。2 回の `SHA256SUMS.txt` も、手元の `release-candidate/v1.6.1/SHA256SUMS.txt` と同一。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.1/Life-Launcher-v1.6.1-windows-x64-setup.exe) | 9,784,434 | `1A936FE7EC0A7CF77F87D3321263DDD58F9ADF0BC9E7FB6A3DA564C67B8BCDEE` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.1/Life-Launcher-v1.6.1-windows-x64.exe) | 22,540,800 | `02E1F4DB5083D0206841FBE7DD162ED008D98E812A9B724AD8407B96ABB617A2` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.1/Life-Launcher-v1.6.1-windows-x64-portable.zip) | 11,145,798 | `D34FA43CFB840C34B43BDBA964E84F44DF3F0403098C60D0B26AD77ED7A4F622` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.6.1/SHA256SUMS.txt) | 327 | `ABA152BCECA2D7B619592C878E3A7EB467FFD3AEAE7596DA4F5148931E264222` |

- ダウンロードした単体 EXE の FileVersion / ProductVersion は 1.6.1。
- ポータブル ZIP の中身は `Life-Launcher-v1.6.1-windows-x64.exe` と `README.txt` の 2 つだけ(公開前の確認、B の確認)で、ZIP 内の EXE の SHA-256 は単体 EXE と一致。

## 起動の確認

- 公開後にダウンロードした単体 EXE を `scripts/start-test-profile.ps1` で、新しいテスト用のプロファイルで起動した。窓のタイトルは `Life Launcher (テスト)` だった。
- 設定の「メンテナンス」に「バージョン 1.6.1」と出ている事を、オーナーが画面で確かめた。
- 確認の後に、その起動だけを終了した。
- インストーラーは実行していない。インストーラーでの更新は、オーナーが行う。

## `releases/latest` と README のリンク

- `gh api repos/Takuyakou/life-launcher/releases/latest` の `tag_name` は `v1.6.1`。
- README.md のダウンロードのリンクは `releases/latest` で、開くと `releases/tag/v1.6.1` に移る。
- Release の本文は `docs/releases/v1.6.1.md`。

## 行わなかったこと

- インストーラーでの更新(オーナーが行う。Life Launcher を終了 → `%APPDATA%\life-launcher` をバックアップ → v1.6.1 のインストーラー)。
- オーナーの普段のアプリの終了。
- 成果物の作り直し、タグの付け直し、アセットの上書き。

`release-candidate/v1.6.1/` は、公開したアセットとの照合用に残してある。テスト用のプロファイルのフォルダーは、オーナーの判断で後で消してよい。
