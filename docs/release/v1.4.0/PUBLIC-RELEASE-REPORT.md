Life Launcher v1.4.0 RELEASED

# P9-12P 公開結果の報告

- 公開日: 2026-10-31(JST。GitHub の `publishedAt` は 2026-10-30T23:43:11Z)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.4.0
- マージのコミット(PR #129): `dffb0bb81c0ac7d11072f9823bcc335598d5c134`(`main`)
- タグ: `v1.4.0`(注釈つき)。タグのオブジェクト `8c672c147ebec439975ee40d73424060ca6f4b44`、指すコミット `dffb0bb81c0ac7d11072f9823bcc335598d5c134`
- 承認されたコミット: `release/v1.4.0` の `1bbd4b41a3f8ca58db71f50f4f279243e785fde5`(P9-12d)
- ビルドに使ったソース: `9a86f7a5cf6a5f71e69e7be80be3af3e1b0b5b3d`。`9a86f7a` から `dffb0bb` までの差分は `docs/release/v1.4.0/` の文書3つ(`FINAL-RELEASE-DECISION.md`、`native-checklist.md`、`RELEASE-REVIEW-codex.md`)だけ(製品のファイルの差分なし)
- GitHub Release は公開済み(下書きでも先行リリースでもない)で、最新の Release(`releases/latest` が v1.4.0)。

## 手順の結果(判定書 10.)

| 手順 | 結果 |
| --- | --- |
| 10.1 マージの前の確認 | 成功。`origin/release/v1.4.0` = `1bbd4b4`、PR #129 の CI(`verify`、run 41127582883)が `1bbd4b4` で成功、タグ `v1.4.0` なし(`git ls-remote` が空)、`gh release view v1.4.0` は「release not found」(認証・通信の失敗ではない)、候補の3ファイルのハッシュが判定書 4. と一致 |
| 10.2 マージ | 成功。`gh pr merge 129 --merge --match-head-commit 1bbd4b4…`。マージのコミット `dffb0bb` |
| 10.3 マージの後の確認 | 成功。`9a86f7a` と `origin/main` の差分は文書3つだけ(製品の差分 0 件)。`main` の CI(`verify`、run 41144771574)が `dffb0bb` で成功 |
| 10.4 タグ | 成功。`dffb0bb` に注釈つきタグ `v1.4.0` を付けて push |
| 10.5 下書きの Release | 成功。アセットは4つ、本文は `docs/releases/v1.4.0.md` |
| 10.6 下書きの確認 | 成功。新しい空のフォルダーへダウンロードし、3ファイルのハッシュが、公開した `SHA256SUMS.txt` と判定書 4. の両方に一致。アセットは4つだけ。全件一致を確かめてから公開に進んだ |
| 10.7 公開 | 成功。`gh release edit v1.4.0 --draft=false` |
| 10.8 公開後の確認 | 成功。ハッシュの照合、`releases/latest`、README のファイル名、ダウンロードした単体 EXE とポータブル ZIP の EXE の起動(下記)。起動は、別のインスタンスが起動中だったため、オーナーがそれを閉じた後に行った |
| 10.9 記録 | この報告書 |

判定書と違う操作はしていない。10.1 の `gh release view` が終了コード 1 になるのは、「release not found」が期待の結果のため(この1件だけを許容した)。

## ダウンロードの照合(公開前の下書きと、公開後の2回)

2回とも、新しい空のフォルダー(`.local-evaluation/v140-redownload`、`.local-evaluation/v140-redownload-2`)へ全アセットをダウンロードした。サイズとハッシュは、公開した `SHA256SUMS.txt` と、判定書 4. の両方に一致した。GitHub が持つアセットのダイジェストも、同じ値だった。

| アセット | バイト | SHA-256 |
| --- | ---: | --- |
| [インストーラー](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.0/Life-Launcher-v1.4.0-windows-x64-setup.exe) | 3,729,901 | `b6acfae2efd93860bad4b6b978801c1f9299d8b818aad590062ed23d45a21e4a` |
| [単体 EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.0/Life-Launcher-v1.4.0-windows-x64.exe) | 16,052,736 | `0f833c1775cfb2f3791ff3820c9867d0d9f8cef67e1a8ec38f3ffc2acb46ebb6` |
| [ポータブル ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.0/Life-Launcher-v1.4.0-windows-x64-portable.zip) | 5,072,020 | `5fdfe119a341d94491e43bec09d38be0c3d65c7d35f9c72ae6a2de749dfc05ee` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.4.0/SHA256SUMS.txt) | 327 | `0527403d61d4f571622452f6b71c48c9bc747bf0b39ee0e91cce83c9f619f05e` |

- ダウンロードしたインストーラーと単体 EXE の FileVersion / ProductVersion は 1.4.0(ProductName: Life Launcher)。
- ポータブル ZIP の中身は `Life-Launcher-v1.4.0-windows-x64.exe` と `README.txt` の2つだけ。ZIP を展開した EXE の SHA-256 は、単体 EXE と同じ(`0f833c17…bb6`)。
- Release の本文は `docs/releases/v1.4.0.md` と完全に一致(行末の違いを除く)。
- `releases/latest`(GitHub の API)は `v1.4.0` を返す。
- README、README.en.md のダウンロードのリンクは `releases/latest`、記載のファイル名(`Life-Launcher-v1.4.0-windows-x64-setup.exe`、`…-windows-x64.exe`、`…-windows-x64-portable.zip`)は実際のアセット名と一致。

## 起動の確認

公開作業の時点で、別の Life Launcher が起動中だった(PID 33656、2026-10-31 0:06 起動、`D:\dev\life-launcher-installer-smoke-v1.0.0-merged-main\installed\life-launcher.exe`)。このアプリは単一インスタンスのため(`tauri-plugin-single-instance`)、ダウンロードした EXE を起動しても確認にならないので、その時は起動しなかった。オーナーが起動中のアプリを閉じた後、Life Launcher のプロセスが無いことを確認して、2回目の再ダウンロード(公開後)の EXE を起動して確かめた。

| 対象 | 結果 |
| --- | --- |
| ダウンロードした単体 EXE(`Life-Launcher-v1.4.0-windows-x64.exe`) | 起動して約0.3秒でウィンドウ「Life Launcher」が出た。自己終了(`LIFE_LAUNCHER_RELEASE_SMOKE_EXIT_AFTER_MS` = 20秒)で終了コード 0。`config.json`(`version` 3)を新規作成 |
| ポータブル ZIP を展開した EXE | 同じ手順で、ウィンドウが出て(約0.3秒)、終了コード 0。`config.json`(`version` 3)を新規作成。`config.json` は単体 EXE と同じ内容(668 バイト、SHA-256 の先頭 `7015705A23D4FA1F`) |

- 起動は、`%APPDATA%` を一時フォルダーに切り替えた空のプロファイルで行った(`%APPDATA%\life-launcher` には触れていない。自動起動の登録・ウィンドウの位置・WebView2 のデータは普段の場所に触れる。判定書 9. D のとおり)。
- 環境の注意(以前の版と同じ): このマシンでは既定のグローバルホットキー(`Ctrl+Alt+Space`)がすでに登録されていて、起動時に登録をスキップする(アプリは起動を続ける)。終了時に WebView2 が `Failed to unregister class Chrome_WidgetWin_0`(エラー 1412)を出すが、終了コードは 0。
- 公開前に、同じバイト列の候補で、オーナーが C の5項目(インストーラーでの実インストールと起動を含む)を確認済み(`FINAL-RELEASE-DECISION.md` の 9. C)。

## 公開に関するその他の事実

- Web Demo は変更していない(別の公開工程)。
- 公開済みの過去の Release(v1.3.4 ほか)は変更していない。
- `release-candidate/v1.4.0/` は消さずに残してある(公開したアセットとの照合用)。
- 判定書は `docs/release/v1.4.0/FINAL-RELEASE-DECISION.md`、独立精査は `RELEASE-REVIEW-codex.md`、実機確認の記録は `native-checklist.md`。
