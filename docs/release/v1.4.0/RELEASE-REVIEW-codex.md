# P9-12R v1.4.0 独立リリースレビュー

## 1. 判定

**INCONCLUSIVE**

- ソース、ハッシュ・バージョン・ZIP、秘密情報の生バイト走査、Defender、必須9ゲート、データ形式の不変を独立確認し、公開を止める不一致は見つからなかった。
- 全体499件を3回、重点フォーカステストを単独10回実行し、失敗0件。ただし過去の失敗原因は未確定で、「環境の揺れだった」とは追認しない。
- 候補EXEの隔離起動は未実施。APPDATAだけでは実レジストリ・ウィンドウ状態・WebView2を隔離できず、既存のCドライブ書込禁止を守れる実行環境を用意できていない。
- 重要な独立起動確認を残してAPPROVEとはしない。候補が危険・改ざんされているという判定ではない。
- 判定書9.Cの5項目は全て**オーナー確認待ち**。本レビューでは合否を判定しない。

確認日: 2026-10-30 JST。対象HEAD: 135d9db718d193f0fe7dac6e9539d42e469d28aa。ビルド元申告: 9a86f7a5cf6a5f71e69e7be80be3af3e1b0b5b3d。

必須2文書は、配置済みPhase 9 ZIP内の life-launcher-phase9/00-README.md と P9-12-release-v1.4.0.md を直接読んだ。指定HEADから監査専用作業ツリーを作成。元作業ツリーのCargo.toml未コミット状態・未追跡HTMLを保持し、本報告1ファイルだけを提出する。

候補生成スクリプト・候補EXE・インストーラーは実行していない。製品コード・テスト・元文書・候補は変更しない。実際の利用者プロファイルは読み書きしていない。PR #129はCIの読み取りだけで、コメント・編集・マージなし。tag、Release、アップロード、deployもなし。

## 2. 指摘一覧

| ID | 重さ | 場所 | 内容・根拠 | 対応案 |
| --- | --- | --- | --- | --- |
| R1 | 公開前に確認 | 判定書9.B、隔離起動BAT | APPDATA変更だけで「実際のデータには触れていない」と断定できない。プラグインに別の永続化先がある。本監査では実EXE起動を未実施 | 別Windowsユーザー・VM等で候補2版を起動しschema 3生成と正常終了を確認。実PCなら指示書の前後記録・復元と、書込許可を先に得る |
| R2 | 公開前に直す | 判定書5のフォーカス失敗説明 | 別ウィンドウへのフォーカス移動が原因だった証拠はない | 「当時の原因は不明、再検証で非再現」に改め、3+10回の結果を併記 |
| R3 | 公開前に直す | 判定書11 | 勝利条件0.42の「オーナー判断待ち」は10/30判断と不一致。旧Builder見出しは通常到達しない | 0.42据え置き承認済みと記載。旧Builderは通常の既知制限から保守メモへ |
| R4 | 公開前に直す | 判定書10の1→2 | 手順1で「マージ後main」を確認するのに、マージ自体は手順2 | マージ前後の検証を分割。6節参照 |
| R5 | 公開前に追記 | 判定書5のCI欄 | 「push後確認」のまま。最新HEADは成功、9a86f7a単体のCI検索は0件 | 最新runと、ビルド元コミット単体では走っていない事実を区別 |
| R6 | 公開後でよい | ビルド来歴 | 候補と残存出力は一致するが、build時HEAD・dirty状態・環境・直後ハッシュを結ぶmanifestがない | 次版から機械記録。今回は来歴「一部」。時刻だけで証明しない |
| R7 | 公開後でよい | Stageの保守提案 | 未使用CSS、単発スタイル読取、画像閾値が持越し | 次版課題に整理し、今回の機能修正に混ぜない |

確定した製品不具合を理由とするBLOCKERは見つかっていない。文書を直すだけでR1の未確認が解消するわけではない。

## 3. 独立検証の結果

### 3.1 ソース・保存形式

ローカルとリモートrelease/v1.4.0は135d9db、リモートmainはa4a94e715f8d3e82aea25153337090d954d562d0。git diff --name-status 9a86f7a..135d9db は判定書とnative-checklist.mdの2文書だけ。

git diff --name-status a4a94e7..9a86f7a の全18ファイル:

| ファイル | 分類 |
| --- | --- |
| CHANGELOG.md | 公開文書 |
| README.en.md | 公開文書 |
| README.md | 公開文書 |
| docs/OVERVIEW.md | 公開文書 |
| docs/release/v1.4.0/FINAL-RELEASE-DECISION.md | 判定文書 |
| docs/release/v1.4.0/native-checklist.md | 実機確認文書 |
| docs/release/v1.4.0/release-notes.md | 公開本文の控え |
| docs/releases/v1.4.0.md | 公開本文 |
| docs/screenshots/contact-sheet.png | 公開画像 |
| docs/screenshots/dictionary.png | 公開画像 |
| docs/screenshots/instruction-viewer.png | 公開画像 |
| docs/screenshots/main-dashboard.png | 公開画像 |
| docs/spec/current-spec.md | 公開仕様書 |
| package-lock.json | root/packagesのアプリ版のみ |
| package.json | アプリ版のみ |
| src-tauri/Cargo.lock | life-launcher版のみ |
| src-tauri/Cargo.toml | アプリ版のみ |
| src-tauri/tauri.conf.json | アプリ版のみ |

mainへのStage取り込みはgit log --mergesと祖先関係で確認:

| Stage | PR | mainのマージコミット |
| --- | --- | --- |
| 00 | #116 | 69cca4a |
| 01 | #117 | a83aace |
| 02 | #118 | 5413127 |
| 03 | #119 | c3bfd7a |
| 04 | #120 | 3efd52c |
| 05 | #121 | a42eac7 |
| 06 | #122 | f950cb5 |
| 07 | #123 | 47978a6 |
| 08 | #124 | 0184850 |
| 09 | #125 | ac0de66 |
| 10 | #126 | 6bbee2d |
| 10b | #127 | 6d3bfe8 |
| 11 | #128 | 2a6222b |
| 13 | #130 | 8332b8f |
| 14 | #131 | a4a94e7 |

v1.3.4..9a86f7aの194ファイルは末尾に全列挙した。Rust実装の変更はcommands/sessions.rsだけ。Today読取を候補順序に加える処理とテストで、セッション追加/書換関数の変更なし。models.rs、config/notesの保存・移行、スキーマファイルに差分なし。src/types.tsは候補理由today3の型だけで、保存設定はliteral 3のまま。sessions.jsonl / notes.json / config.jsonの書込形式と移行処理は不変。候補理由は応答であって永続化形式ではない。

Cargo.toml/lockは自アプリの版番号だけで依存追加なし。npmの直接依存名・lockパッケージキーの追加削除は0。#115によるDOMPurify 3.4.17、Zod 4.6.7、Vite 8.1.6等への既存依存更新はある。「依存の版も不変」とはしていない。

### 3.2 成果物

元候補は読取のみ。以下5ファイルだけで余分なディレクトリーなし。

| ファイル | バイト | 独立計算SHA-256 |
| --- | ---: | --- |
| Life-Launcher-v1.4.0-windows-x64-setup.exe | 3729901 | b6acfae2efd93860bad4b6b978801c1f9299d8b818aad590062ed23d45a21e4a |
| Life-Launcher-v1.4.0-windows-x64.exe | 16052736 | 0f833c1775cfb2f3791ff3820c9867d0d9f8cef67e1a8ec38f3ffc2acb46ebb6 |
| Life-Launcher-v1.4.0-windows-x64-portable.zip | 5072020 | 5fdfe119a341d94491e43bec09d38be0c3d65c7d35f9c72ae6a2de749dfc05ee |
| SHA256SUMS.txt | 327 | 0527403d61d4f571622452f6b71c48c9bc747bf0b39ee0e91cce83c9f619f05e |
| release-notes.md | 8297 | 6fbe05bed7bf79a6fd83df2d9662abe088b1e3d38ac5394e2c2092841a2a0c78 |

Get-FileHashとcertutil -hashfile ... SHA256で全件一致。配布3ファイルはSHA256SUMSと判定書4の両方に一致。SUMSはCRLF/終端改行あり、非空行3つ、64桁16進数・空白2個・正しいファイル名。追加行や重複なし。

単体/setup/ZIP内EXEのFileVersionとProductVersionは全て1.4.0、ProductNameはLife Launcher。ZIPは単体EXEとREADME.txt（283バイト）だけ。絶対パス・親参照・symlink・余計な実行形式なし。展開EXEと単体のSHA一致。

release-notesは両コミットのGit blobと改行正規化後に完全一致。Git blobはLFの8221バイト、候補とチェックアウト本文2部はCRLFの8297バイト。Git blobのSHAは48c9b07f819becb79b404a0b4d7e673d0e2f1f3257c5d5e50b6489cfd673784f。内容差でなく76個のCR差であり、「Git blobともバイト同一」とはしない。

#### 秘密情報、P9-14、Defender

コピーした単体/setup/ZIP/展開EXEをASCII相当のLatin-1とUTF-16LE（偶数/奇数オフセット両方）で走査。指示書の個人パス・開発者名・秘密鍵ヘッダー・全トークン接頭辞・source map記述は検出0。陽性対照Life Launcher/life-launcherは単体ASCII34件/UTF-16LE3件、setup UTF-16LE2件、ZIP ASCII3件で走査動作を確認。

これは生バイト走査で、圧縮内部を全展開した秘密情報検査ではない。P9-14のvictoryBar--empty / data-auto-focus / autoFocusは候補内で見つからなかった。埋込資産を抽出していないため、非搭載とも搭載済みとも断定しない。

コピー先にStart-MpScan -ScanType CustomScanを実行。サービス/Antivirus/リアルタイム保護有効、署名1.463.31.0。開始/完了イベント1000/1001の同一scan IDとコピー先スコープを確認した。既存検出履歴1件のまま増加なし、新規検出0。元候補はスキャン対象にしなかった。

#### 来歴: 一部

残存target/release/life-launcher.exeとNSIS出力は候補の単体/setupとそれぞれSHA一致。更新時刻2026-10-30 08:47:18 UTCは申告コミット08:09:28 UTCより後、HEAD文書変更より前。

ただしbuild時HEAD・clean/dirty・Node/Rust/CLI版・コマンド・直後SHAを一体に記録したmanifestは確認できていない。正式スクリプトもHEADを記録しない。出力・時刻・申告による部分追跡で、9a86f7aから作られた証明ではない。別出力先の再現releaseビルドは未実施。既存候補は作り直していない。

### 3.3 EXE隔離

EXE未起動なので実環境の前後比較・復元は発生していない。実データ・既知フォルダーを読む作業もしていない。開始時の照会でlife-launcher.exeは稼働していなかったが、それだけでは隔離にならない。

| 対象 | 読んだ実装から確認したこと |
| --- | --- |
| startup.rs sync_autostart | 起動時に設定と登録状態を比較し、有効化/解除する |
| auto-launch 0.5.0 | HKCUのRunに加えてenable時はStartupApproved/Runも書く。指示書の表への追加注意点 |
| window-state 2.4.1 | app_config_dirへ保存。Tauri 2.11.5はdirs::config_dirへ識別子を結合 |
| Tauri WebView | data_directory未指定時はLocalData/識別子で決定。APPDATAだけで隔離不能 |
| single-instance | 既存アプリがいればそちらを前面化する |

既存BATはAPPDATAだけを変えるので、安全な独立確認用には使わない。本監査でBATは変更していない。

### 3.4 必須ゲート・重点テスト

元のソース/lockを使用し、生成物とTEMP・npm/Cargoキャッシュ書込先はD。既存node_modulesを共有し新依存なし。

今回の検証環境はNode.js v24.14.1、rustc 1.96.1。これは今回のゲート環境であり、候補のビルド当時の環境を復元できたという意味ではない。

| コマンド | 結果 | 秒 |
| --- | --- | ---: |
| npm.cmd run public:check | 570ファイル、blocker0 | 0.566 |
| npm.cmd run lint | PASS | 3.168 |
| npm.cmd run build | PASS。既存の大きいchunk警告あり | 3.661 |
| npm.cmd run test:visual（全体1） | 499成功、失敗/skip0 | 107.977 |
| 同（全体2） | 499成功、失敗/skip0 | 106.866 |
| 同（全体3） | 499成功、失敗/skip0 | 105.671 |
| cargo fmt --manifest-path src-tauri/Cargo.toml -- --check | PASS | 2.922 |
| cargo check --locked --manifest-path src-tauri/Cargo.toml | PASS | 49.310 |
| cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings | PASS | 5.358 |
| cargo test --locked --manifest-path src-tauri/Cargo.toml | 130 unit + 1 capability成功 | 37.037 |
| git diff --check | PASS | 0.272 |
| npm.cmd audit --audit-level=low --json | 脆弱性0、終了0 | 0.891 |
| cargo audit --file src-tauri/Cargo.lock --json | 脆弱性0、情報警告11、終了0 | 4.600 |
| cargo tree --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc | 成功 | 0.268 |

public:checkの570はcleanな監査ツリーの実測。判定書3575と生成物等の走査母集団が違い、同件数を再現したとはしない。

post-v133b-followupのmouse-free arrows traverse Sidebar, Dictionary, Main, toolbar, Settings and menuを、--grep "mouse-free arrows" --repeat-each=10で単独実行し10/10成功、7.487秒。全体内でも3/3成功。他の8テストを含めて90件とは数えていない。

全体の途中から単独反復完了までWindows前面HWND/プロセスを250ms間隔で監視し、9回の変化を観測。別アプリを閉じず、本文/タイトルも取得せず、この期間に失敗なし。これは過去の失敗原因の証明ではない。

テストは固定clockと合成設定でキー移動・設定・メニュー復帰を検証。製品の矢印処理は同期focusだが、ダイアログ初期focus/復帰にrequestAnimationFrameがある。テストは可視化待ちとtoBeFocusedを使う。読取で確定的な製品競合は見つからないが、過去失敗時のDOM/前面記録がないので原因は**不明・今回非再現**。失敗の隠蔽、retry/timeout/期待値の変更なし。今回落ちたテストは0件。

#### CI

最新135d9dbの[run 41029806652](https://github.com/Takuyakou/life-launcher/actions/runs/41029806652)はwindows-latestで成功。499件、Rust130+1と監査を確認。9a86f7aのheadSha指定検索は0件で、当該コミット単体の実行とはしない。

過去run 41005449238（dab4d99）、40977791671（38ed2a8）の成功ログも取得。対象テストを含む全体は成功。ただしdot出力なので個別成功時刻は得られず、歴史全体の失敗0とは主張しない。

#### Rust情報警告

判定書の11件とクレート名・版・ID一致。新しい脆弱性なし。Windows tree実測:

| crate / RUSTSEC ID | Windows依存 |
| --- | --- |
| proc-macro-error 1.0.4 / 2024-0370 | なし |
| unic-char-property 0.9.0 / 2025-0081 | あり |
| unic-char-range 0.9.0 / 2025-0075 | あり |
| unic-common 0.9.0 / 2025-0080 | あり |
| unic-ucd-ident 0.9.0 / 2025-0100 | あり |
| unic-ucd-version 0.9.0 / 2025-0098 | あり |
| zbus_names 4.3.2 / 2026-0371 | なし |
| zvariant 5.12.0 / 2026-0370 | なし |
| zvariant_derive 5.12.0 / 2026-0372 | なし |
| glib 0.18.5 / 2024-0429 | なし |
| tokio 1.52.3 / 2026-0386 | あり |

tokioの警告はaudit本文でunix::AsyncFdを対象としていることを確認。tokio自体がWindows依存に入らないとはしない。unic群はTauri配下の保守終了、他の対象外群はLinux向け。既存Cargo.lockと同じ版で、次版のTauri更新と合わせた見直しは妥当。

### 3.5 文書・画像・公開差分

日英README、CHANGELOG、公開本文2部、仕様書、OVERVIEWを、版・配布名・schema・WebView2/未署名/SmartScreen・Web Demo別工程の観点で照合し、重大な不一致なし。一般機能欄の推薦説明は旧来ルールの要約だが、両言語のv1.4欄に今日の3件優先がある。

| リリース本文の変更 | 対応Stage/実装 |
| --- | --- |
| 今日の3件優先・理由・選択保持 | 05、sessions.rsとApp |
| 両カード同期・解除拒否 | 04、timerSource/earlyCompletion/App |
| 行動文・満了見出し・待機ミニ・Timer重複 | 02/03/09/10、TimerPanel/App/styles |
| 大/特大の勝利条件・見出し・hover・空時・二重focus | 01/13/14、App/styles/回帰テスト |
| 色・枠・Picker領域 | 06/07/08。見出し枠は14で一部復帰 |
| 件数・編集/入替・空グループ | 09 |
| ダイアログ名・設定・記録 | 10、RecordsView/helpGuide/App |
| 依存修正・13画面画像比較・流れテスト | #115、00以降 |

サイドバーBMPを実読取して190x290。NSIS設定はinstallerIcon/sidebarImage/uninstallerIconあり、headerImage/uninstallerHeaderImage/templateなし。#111反映を確認。setupの実画面は今回未起動なので未確認。

main-dashboard、dictionary、instruction-viewer、web-demo、contact-sheetの5 PNGを開いて目視。サンプルエディター/資料/学習、架空guideで、私的氏名/実ユーザーパス/実ノートなし。Web Demo画像は別工程の版。

v1.3.4..135d9dbの追加行をpublic:checkと別に走査し、検出1行は判定書自身の走査対象文字列の列挙だった。実トークン/個人の完全パスではない。release-candidateの追跡差分なし。Phase 9全比較画像を個々に開く再鑑定まではしていない。

## 4. 判定書の主張の照合

| 主張 | 独立確認 | 一致/不一致/未確認 |
| --- | --- | --- |
| 候補元9a86f7a、後続は文書 | HEAD差は判定書とchecklistのみ | 一致 |
| 全版1.4.0、schema3 | 定義/lock/3EXE version、型 | 一致 |
| 保存形式不変 | Rust唯一の変更・型・保存/移行差分読取 | 一致 |
| 候補5つ、サイズ/SHA | 二方式で再計算、3.2 | 一致 |
| 本文SHAと内容同一 | 作業ファイル一致。Git blobは改行のみ違う | 内容一致、生バイトは限定 |
| ZIP安全・2エントリー | 属性/パス/EXE SHA | 一致 |
| 秘密情報0 | 生バイト走査と陽性対照 | 範囲内一致、圧縮内部は限定 |
| Defender有効、検出0 | コピー検査と完了イベント | 一致 |
| public:check3575 | clean監査ツリー570、blocker0 | 母集団不一致、合格結果一致 |
| lint/build/fmt/check/clippy成功 | 独立再実行 | 一致 |
| 全体499成功 | 3回、1497件実行で成功 | 一致 |
| Rust130+1 | 独立再実行 | 一致 |
| フォーカス失敗は別ウィンドウが原因 | 3+10回非再現、当時の記録なし | 原因未確認、断定不可 |
| Cargo情報警告11・対象外区分 | audit JSON/Windows tree | 一致 |
| CIはpush後確認 | 最新HEAD成功、ビルド元単体0run | 記載が古い/未実行を区別 |
| 公開画像は合成データ | 5画像目視/fixture | 確認範囲で一致 |
| 差分9919/13300画素、dictionary7画素 | 画素差の独立再計算は未実施 | 未確認 |
| Bの0.3秒起動、20秒終了、exit0 | 今回未起動 | 未確認 |
| Bの実データ非接触、コピー3ファイル不変 | 元データを読まず、隔離実装だけ調査 | バイト不変は未確認、隔離説明不十分 |
| Aの100/150%、実フォント、D&D、native同期等 | 前担当/オーナーの履歴としてだけ扱う | 独立再実施なし |
| Cの5項目 | 今回の判定対象外 | オーナー確認待ち |
| 0.42の判断待ち | 10/30据え置き決定済み | 古い |
| 旧Builder見出しの実機確認 | legacyTodayBuilderVisibleは常時false、描画条件内 | 通常の制限ではない |
| tag/Releaseなし、PR未マージ | remoteタグなし、release not found、#129 OPEN | 一致 |
| READY FOR USER APPROVAL | 独立起動/断定修正が残る | 本監査はINCONCLUSIVE |

P9-14はソースにあるが、候補内部の画面資産との直接照合は未確認。来歴は一部で、その不足だけで改ざんとはしない。

## 5. 未確認の解消条件

別Windowsユーザー/VMで同じSHAの単体/ZIP EXEを起動し、schema3生成・表示・正常終了を記録する。Windows Sandbox機能の有効化などPC設定は変更していない。

実PCを使うならRunに加えStartupApproved、window-state、WebView2の前後状態を扱う。autoStart=trueだけでは別実行パス/未承認override等を同じ状態に保てるとは限らず、C書込禁止の例外を先に承認してもらう。現在の機械状態への変更/復元を安易に試さない。

過去のフォーカス失敗は原因不明のまま。再発時はactiveElement、イベント時刻、前面HWNDを同時記録する。3+10回成功とコード調査では確定的製品欠陥がないため、この過去の非再現失敗だけをBLOCKとはしない。9.Cのオーナー確認と独立監査を混同しない。

## 6. 公開手順の机上確認とコマンド案

以下は**実行していない**。R1等の確認とオーナー承認後にだけ使用。nativeコマンドは毎回終了コードを確認し、非0で停止する。

    $repo = (git rev-parse --show-toplevel).Trim()
    $candidate = Join-Path $repo "release-candidate/v1.4.0"
    git fetch origin
    gh pr view 129 --json state,headRefOid,statusCheckRollup
    git ls-remote --tags origin refs/tags/v1.4.0
    gh release view v1.4.0

HEAD=135d9db、最新CI成功、タグ/Release不在を確認。release not found以外の認証/通信失敗を「不在」と解釈しない。3成果物のGet-FileHashを3.2と照合し、不一致なら停止する。

    gh pr merge 129 --merge --match-head-commit 135d9db718d193f0fe7dac6e9539d42e469d28aa
    git fetch origin
    $unexpected = @(git diff --name-only 135d9db..origin/main |
      Where-Object { $_ -notmatch '^docs/|^README(?:\.en)?\.md$|^CHANGELOG\.md$' })
    if ($unexpected.Count) { throw "mainの製品差分を確認するまで停止" }
    $releaseCommit = (git rev-parse origin/main).Trim()

マージ後mainのCIも成功を確認してから次へ。候補と製品差分のないコミットを固定し、違うmainにタグを付けない。

    git tag -a v1.4.0 $releaseCommit -m "Life Launcher v1.4.0"
    git push origin refs/tags/v1.4.0
    $assets = @(
      "Life-Launcher-v1.4.0-windows-x64-setup.exe",
      "Life-Launcher-v1.4.0-windows-x64.exe",
      "Life-Launcher-v1.4.0-windows-x64-portable.zip",
      "SHA256SUMS.txt"
    ) | ForEach-Object { Join-Path $candidate $_ }
    gh release create v1.4.0 @assets --verify-tag --draft --title "Life Launcher v1.4.0" --notes-file docs/releases/v1.4.0.md
    $download = Join-Path $repo ".local-evaluation/v140-redownload"
    if (Test-Path $download) { throw "新しい空の検証先を用意する" }
    gh release download v1.4.0 --dir $download
    Get-ChildItem $download -File | Get-FileHash -Algorithm SHA256

アセット4つだけ、3ファイルのSHAが公開SUMSと3.2に一致することを照合。再取得した単体/ZIPを安全な隔離環境で起動する。その後:

    gh release edit v1.4.0 --draft=false
    gh release view --json tagName,url

公開後にも新しいダウンロード先へ再取得し、同じ全SHA照合と単体/ZIPの起動確認を行う。releases/latestがv1.4.0を指し、READMEリンク先のファイル名と実アセットが一致することを確認。上のgh release viewだけで起動やリンク確認を済ませたとはしない。

アップロード/ハッシュ/起動が失敗したらdraftのまま停止。候補を作り直さず別の空の取得先で再確認し、通信問題と候補問題を分ける。既存タグのforce更新・無条件--clobberはしない。公開後に問題なら最新版としての案内を止め、原因と正しい候補の検証を先に行う。タグ/配布物の差替はオーナー判断なしで行わない。正常公開後はPUBLIC-RELEASE-REPORTにコミット・URL・全SHA・起動結果を残す。

## 7. Phase 9取りこぼし

| Stage | 報告の最終語 | 提案/後続確認と分類 |
| --- | --- | --- |
| 00 | BASELINE READY | Windows CI画像一致は確認済み |
| 01 | FIXED | 開始ボタン文字サイズ/変数化はv1.5候補、非ブロッカー |
| 02 | FIXED | 満了見出しは10で対応。長名ミニ一時停止の実機は本監査未確認 |
| 03 | FIXED | 100/150%はAで確認済みとの主張。本監査再実施なし。重複語削除案は未決/非ブロッカー |
| 04 | DONE | 優先順は05で対応。旧Builder削除は保守持越し |
| 05 | DONE | Aで推薦接続確認の主張。今回Rust/UIテスト成功、native独立再確認なし |
| 06 | DONE | 未使用settingsButton--warning削除は保守持越し |
| 07 | DONE | 画像閾値改善は未決/非ブロッカー。DOM回帰は成功 |
| 08 | DONE | 空き枠下14pxの変更案は操作変更を伴うため未決/非ブロッカー |
| 09 | DONE | timerHint/未使用CSS削除は保守持越し |
| 10 | DONE | オーナー指摘の追加対応あり。無効ボタン経由トースト等の全経路実証はなし |
| 10b | FIXED | border-rolesのpoll追加は対応済み。他のfocus依存は保守課題 |
| 11 | PASS | 仕様書の版更新済み。画像閾値は保守。Demoは別判断の合意済み |
| 12/12b/12c | READY FOR USER APPROVAL | 独立ゲート成功。R1等とオーナー9.Cを残す |
| 13 | FIXED | 公開文書追記済み。0.42据え置きは10/30承認済み |
| 14 | FIXED | 0.42判断待ちの記載は古い。旧Builderは常時false内 |

これらの低リスク保守提案に重大な製品欠陥は見つかっていない。ただし独立native確認の不足まで「問題なし」で片付けない。

### 後片付けと提出

独立ゲートで新規作成したRust出力2,066,652,669バイトを、実パスと再解析ポイントがないことを確認して削除した。元のrelease出力・候補・共有キャッシュは削除していない。報告1ファイルを監査ブランチにコミットし、監査用node_modulesのジャンクションと一時作業ツリーを撤去してから、そのブランチだけをpushする。PRは作成しない。元作業ツリーのブランチ/未コミット状態を切り替えない。

## 付録: v1.3.4から申告ビルド元までの全変更ファイル

git diff --name-only v1.3.4..9a86f7aの194件。画像やテストも省略せず機械的転記。

- CHANGELOG.md
- README.en.md
- README.md
- docs/OVERVIEW.md
- docs/performance/test-runtime-optimization-report.md
- docs/phase9/00-baseline.md
- docs/phase9/01-victory-font-size.md
- docs/phase9/02-timer-action-text.md
- docs/phase9/03-mini-idle-layout.md
- docs/phase9/04-running-state-sync.md
- docs/phase9/05-do-now-prefer-today3.md
- docs/phase9/06-color-roles.md
- docs/phase9/06-screens/main-sources-new.png
- docs/phase9/06-screens/main-sources-old.png
- docs/phase9/06-screens/main-top-new.png
- docs/phase9/06-screens/main-top-old.png
- docs/phase9/06-screens/settings-backup-new.png
- docs/phase9/06-screens/settings-backup-old.png
- docs/phase9/06-screens/settings-instructions-new.png
- docs/phase9/06-screens/settings-instructions-old.png
- docs/phase9/06-screens/settings-maintenance-hover-new.png
- docs/phase9/06-screens/settings-maintenance-hover-old.png
- docs/phase9/06-screens/settings-maintenance-new.png
- docs/phase9/06-screens/settings-maintenance-old.png
- docs/phase9/07-border-roles.md
- docs/phase9/07-screens/keyboard-focus-other-step-new.png
- docs/phase9/07-screens/keyboard-focus-other-step-old.png
- docs/phase9/07-screens/keyboard-focus-today-instruction-new.png
- docs/phase9/07-screens/keyboard-focus-today-instruction-old.png
- docs/phase9/07-screens/main-860x560-new.png
- docs/phase9/07-screens/main-860x560-old.png
- docs/phase9/07-screens/main-large-new.png
- docs/phase9/07-screens/main-large-old.png
- docs/phase9/07-screens/main-running-new.png
- docs/phase9/07-screens/main-running-old.png
- docs/phase9/07-screens/main-sources-new.png
- docs/phase9/07-screens/main-sources-old.png
- docs/phase9/07-screens/main-standard-new.png
- docs/phase9/07-screens/main-standard-old.png
- docs/phase9/07-screens/main-xlarge-new.png
- docs/phase9/07-screens/main-xlarge-old.png
- docs/phase9/07-screens/today-picker-entry-new.png
- docs/phase9/07-screens/today-picker-entry-old.png
- docs/phase9/07-screens/today-picker-new.png
- docs/phase9/07-screens/today-picker-old.png
- docs/phase9/08-screens/before-picker-1080x680.png
- docs/phase9/08-screens/before-picker-860x560-bottom.png
- docs/phase9/08-screens/before-picker-860x560.png
- docs/phase9/08-screens/picker-1080x680.png
- docs/phase9/08-screens/picker-860x560-bottom.png
- docs/phase9/08-screens/picker-860x560.png
- docs/phase9/08-today-picker-space.md
- docs/phase9/09-main-details.md
- docs/phase9/09-screens/after-next-step-card-and-menu.png
- docs/phase9/09-screens/after-sidebar-groups.png
- docs/phase9/09-screens/after-sidebar-timer-waiting.png
- docs/phase9/09-screens/after-swap-dialog.png
- docs/phase9/09-screens/after-timer-complete-dialog.png
- docs/phase9/09-screens/after-today-heading-empty.png
- docs/phase9/09-screens/after-today-heading-with-items.png
- docs/phase9/09-screens/before-next-step-card-and-menu.png
- docs/phase9/09-screens/before-sidebar-groups.png
- docs/phase9/09-screens/before-sidebar-timer-waiting.png
- docs/phase9/09-screens/before-timer-complete-dialog.png
- docs/phase9/09-screens/before-today-heading-empty.png
- docs/phase9/09-screens/before-today-heading-with-items.png
- docs/phase9/10-dialog-details.md
- docs/phase9/10-screens/after-dictionary-settings.png
- docs/phase9/10-screens/after-next-step-edit-dialog.png
- docs/phase9/10-screens/after-records-all-older-notes-closed.png
- docs/phase9/10-screens/after-records-all-older-notes-open.png
- docs/phase9/10-screens/after-records-review.png
- docs/phase9/10-screens/after-settings-basic.png
- docs/phase9/10-screens/after-settings-maintenance.png
- docs/phase9/10-screens/after-settings-shortcuts.png
- docs/phase9/10-screens/after-wishlist-edit-dialog.png
- docs/phase9/10-screens/before-dictionary-settings.png
- docs/phase9/10-screens/before-next-step-edit-dialog.png
- docs/phase9/10-screens/before-records-all-older-notes-closed.png
- docs/phase9/10-screens/before-records-all-older-notes-open.png
- docs/phase9/10-screens/before-records-review.png
- docs/phase9/10-screens/before-settings-basic.png
- docs/phase9/10-screens/before-settings-maintenance.png
- docs/phase9/10-screens/before-settings-shortcuts.png
- docs/phase9/10-screens/before-wishlist-edit-dialog.png
- docs/phase9/10b-flaky-registration.md
- docs/phase9/11-integrated-regression.md
- docs/phase9/11-screens/main-large.png
- docs/phase9/11-screens/main-min.png
- docs/phase9/11-screens/main-running.png
- docs/phase9/11-screens/main-standard.png
- docs/phase9/11-screens/main-xlarge.png
- docs/phase9/11-screens/mini-idle.png
- docs/phase9/11-screens/mini-running.png
- docs/phase9/11-screens/records-all.png
- docs/phase9/11-screens/records-review.png
- docs/phase9/11-screens/records-week.png
- docs/phase9/11-screens/settings-basic.png
- docs/phase9/11-screens/timer-expanded.png
- docs/phase9/11-screens/today-picker.png
- docs/phase9/13-native-fixes.md
- docs/phase9/13-screens/heading-large.png
- docs/phase9/13-screens/heading-standard.png
- docs/phase9/13-screens/heading-xlarge.png
- docs/phase9/13-screens/victory-done.png
- docs/phase9/13-screens/victory-open.png
- docs/phase9/14-heading-victory-polish.md
- docs/phase9/14-screens/heading-keyboard-focus.png
- docs/phase9/14-screens/heading-large.png
- docs/phase9/14-screens/heading-standard.png
- docs/phase9/14-screens/heading-xlarge.png
- docs/phase9/14-screens/victory-empty.png
- docs/phase9/14-screens/victory-filled.png
- docs/phase9/baseline-v1.3.4/main-large.png
- docs/phase9/baseline-v1.3.4/main-min.png
- docs/phase9/baseline-v1.3.4/main-running.png
- docs/phase9/baseline-v1.3.4/main-standard.png
- docs/phase9/baseline-v1.3.4/main-xlarge.png
- docs/phase9/baseline-v1.3.4/mini-idle.png
- docs/phase9/baseline-v1.3.4/mini-running.png
- docs/phase9/baseline-v1.3.4/records-all.png
- docs/phase9/baseline-v1.3.4/records-review.png
- docs/phase9/baseline-v1.3.4/records-week.png
- docs/phase9/baseline-v1.3.4/settings-basic.png
- docs/phase9/baseline-v1.3.4/timer-expanded.png
- docs/phase9/baseline-v1.3.4/today-picker.png
- docs/release/v1.4.0/FINAL-RELEASE-DECISION.md
- docs/release/v1.4.0/native-checklist.md
- docs/release/v1.4.0/release-notes.md
- docs/releases/v1.4.0.md
- docs/screenshots/contact-sheet.png
- docs/screenshots/dictionary.png
- docs/screenshots/instruction-viewer.png
- docs/screenshots/main-dashboard.png
- docs/spec/current-spec.md
- package-lock.json
- package.json
- playwright.config.ts
- scripts/check-public-safety.mjs
- src-tauri/Cargo.lock
- src-tauri/Cargo.toml
- src-tauri/src/commands/sessions.rs
- src-tauri/tauri.conf.json
- src/App.tsx
- src/RecordsView.tsx
- src/components/TimerPanel.tsx
- src/content/helpGuide.ts
- src/earlyCompletion.ts
- src/styles.css
- src/timerSource.ts
- src/types.ts
- tests/visual/config-validation.spec.ts
- tests/visual/dashboard-disclosure-context.spec.ts
- tests/visual/fixtures.ts
- tests/visual/phase6-dictionary.spec.ts
- tests/visual/phase6-readiness.spec.ts
- tests/visual/phase72-selection-edit-menus.spec.ts
- tests/visual/phase8-records.spec.ts
- tests/visual/phase81-entry-contracts.spec.ts
- tests/visual/phase81-layout-qa.spec.ts
- tests/visual/phase82-nextstep-wishlist.spec.ts
- tests/visual/phase83-main-action-hover.spec.ts
- tests/visual/phase84-nextstep-create-pick.spec.ts
- tests/visual/phase84-source-lock-ui.spec.ts
- tests/visual/phase84-wishlist-nextstep-hover.spec.ts
- tests/visual/phase87-followup-polish.spec.ts
- tests/visual/phase9-border-roles.spec.ts
- tests/visual/phase9-color-roles.spec.ts
- tests/visual/phase9-dialog-details.spec.ts
- tests/visual/phase9-display-size.spec.ts
- tests/visual/phase9-do-now-today3.spec.ts
- tests/visual/phase9-flow.spec.ts
- tests/visual/phase9-heading-victory-polish.spec.ts
- tests/visual/phase9-main-details.spec.ts
- tests/visual/phase9-mini-idle.spec.ts
- tests/visual/phase9-native-fixes.spec.ts
- tests/visual/phase9-picker-space.spec.ts
- tests/visual/phase9-timer-action-text.spec.ts
- tests/visual/phase9-visual.spec.ts
- tests/visual/phase9-visual.spec.ts-snapshots/main-large-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/main-min-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/main-running-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/main-standard-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/main-xlarge-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/mini-idle-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/mini-running-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/records-all-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/records-review-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/records-week-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/settings-basic-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/timer-expanded-win32.png
- tests/visual/phase9-visual.spec.ts-snapshots/today-picker-win32.png
- tests/visual/post-v133b-followup.spec.ts
- tests/visual/post-v133c-followup.spec.ts
