# Life Launcher テスト実行時間最適化報告

測定日: 2026-10-26（日本時間）
対象: Windowsローカル / Playwright 1.55.1 / アプリ 1.3.4
基準ソース: `cc8b16ba3a7c393f641404d467ec03bc13e7d48d`
作業ブランチ: `fix/test-runtime-optimization`

## 結果

**通常373件を維持し、245.738秒から74.913秒へ短縮した。削減は170.826秒、69.5%。**

主比較は、準備完了の同期修正も含めた同一最終ソースでの1ワーカー測定と、4ワーカー2回の中央値である。初回の低温キャッシュや失敗した試行を短縮率に混ぜていない。過去の250.8秒は参考資料としてのみ読み、新しい実測の代用にはしていない。

| 指標 | 最適化前・同一ソース1ワーカー | 最適化後・4ワーカー |
| --- | ---: | ---: |
| 通常テスト数 | 373 | 373 |
| 通常対象ファイル数 | 58 | 58 |
| 壁時計時間 | 245.738秒 | 74.498 / 75.327秒、中央値74.913秒 |
| Playwright内部の全体時間 | 245.089秒 | 73.833 / 74.745秒、中央値74.289秒 |
| Workers | 1 | 4 |
| ブラウザー起動回数 | 1 | 各4 |
| Viteサーバー起動回数 | 1 | 各1 |
| Failed / Skipped / Flaky | 0 / 0 / 0 | 各回0 / 0 / 0 |
| Rustテスト実行部分・合計 | 125成功、1.28秒 | 125成功、1.31秒 |
| CI全体時間 | 同じ基準ソースの既存実績943秒 | 未計測。今回CI起動なし |

ワーカー指定なしの実際の `npm.cmd run test:visual` でも373成功、失敗・skip・flaky各0、4ワーカー、壁時計76.553秒を確認した。上表の中央値は、npmラッパーや観測条件を混ぜず、同じ計測ハーネスの2回だけから求めている。

## 環境と測定方法

- Windows 11 Home 26200、Core i7-13700F、24論理CPU、約64GiB RAM。
- Node 24.14.1、Chromium headless shell 140.0.7339.186（revision 1193）、Rust/Cargo 1.96.1。
- 同じPC・依存lock・fixture・viewport・locale・timezone・reducedMotion・全通常テストを使用。再試行0、通常skip追加なし。
- 全件測定同士、およびコンパイルと全件測定は並行させていない。各回Viteを新しく起動し、既存サーバーの再利用は無効のまま。
- 初回258.284秒はコールド寄りの参考値として分離。温まった旧準備処理でも243.720 / 244.203秒だった。
- 最終比較の既存Git管理438ファイルをSHA256集合で照合し、一致した。集合hashは `eb05cde63be3736c832deedbc7f6ed4ef02baa9b74130cb146885df6e8fae131`。基準回の採取は実行中で、全ファイルの更新時刻が実行開始前であることも確認した。後続2回は開始時に採取した。
- 比較対象の373個のテストID・タイトル・期待状態を機械照合し、標準コマンドでも同一だった。全59 specのうち手動撮影用4件を含む1ファイルは、従来どおり `@manual` として通常対象外。
- 壁時計はPlaywright子プロセス開始から終了まで。内部時間はJSONの `stats.duration`。各testのduration、各ファイルのduration和、上位20件、Before/After Hooks、初期起動、資源観測もJSON保存した。
- ブラウザー回数は `pw:browser` の実起動PIDを重複排除。設定値を起動回数と見なしていない。
- CPU・メモリは約2秒間隔で対象プロセスツリーをCIM観測。観測処理自身は除外した。短命プロセスのCPUを取り逃し得て、Working Set和には共有ページの重複がある。厳密なCPUプロファイル・物理RAM専有量ではない。

## 採用した変更

### 安全なファイル単位の並列化

`fullyParallel: false` と各ファイルのserial指定は維持。テスト単位を一括並列化せず、独立したファイル間だけを並行実行する。

ローカル標準は「利用可能論理CPUの半分を切り捨て、最小1・最大4」。このPCでは4となる。少コアPCの実機速度は未計測なので、数式の抑制を性能保証とは扱わない。CIは独立した実測ができていないため、従来の1を維持した。

### CLI指定に隠れていたプロジェクト上限

使用中バージョンでは、`projects` 未指定時にルート設定そのものが暗黙のprojectになる。そのため既存の `workers: 1` がproject上限にもなり、CLIで2を指定しても、実際は1プロセス・1ブラウザーのままだった。ライブラリの設定生成とdispatcher、および実ログで確認した。

`projects: [{}]` で同じ単一projectを明示し、ルート設定は継承しつつproject固有上限を持たせない。テスト・project名・use設定は変えず、CLIの `--workers` が意図どおり機能する。CI相当の設定読み込みでも、既定1、明示上書き2を確認した。

### 準備完了の同期2点

- Do Nowの子ボタン位置を測る前に、親カードのホバー遷移終了を実アニメーション状態で待つ。親の意図された移動と、子ボタン自身の位置変化を混同しない。元のboundingBox厳密一致、文字・glyphの不重複、キーボード実行はすべて維持。
- 辞書のタブキー操作は、初期タイルへのフォーカス完了を確認してから開始する。既存の別テストと同じ初期状態確認を追加した。矢印・Enter・Space・選択状態とフォーカス独立性の全検証は維持。

固定sleep・許容誤差拡大・タイムアウト延長・再試行・アニメーション無効化を新しく追加して解消したものではない。

## 探索と失敗履歴

以下には異なる準備処理段階も含まれる。厳密な短縮率は最終凍結行だけで算出した。

| 試行 | 実Workers | 壁時計秒 | PASS / FAIL / SKIP | 扱い |
| --- | ---: | ---: | --- | --- |
| 初回旧設定 | 1 | 258.284 | 373 / 0 / 0 | 初回キャッシュ参考 |
| 温まった旧設定2回 | 1 | 243.720 / 244.203 | 各373 / 0 / 0 | 参考 |
| CLIで2、暗黙上限あり | 1 | 244.059 | 373 / 0 / 0 | 2並列の比較には不使用 |
| CLIで3、暗黙上限あり | 1 | 未完了 | 未完了 | 無効な条件と判明し、自分の測定プロセスだけ中止。4の試行も開始せず |
| 実2並列 | 2 | 127.417 | 373 / 0 / 0 | 探索 |
| 実3並列 | 3 | 92.276 | 373 / 0 / 0 | 探索 |
| 実4並列・同期前 | 4 | 75.461 | 372 / 1 / 0 | 親hover途中の位置比較に失敗。不採用 |
| 親hover同期後・基準 | 1 | 246.312 | 373 / 0 / 0 | 中間参考 |
| 親hover同期後・4並列 | 4 | 74.886 / 75.546 | 各373 / 0 / 0 | 中間参考 |
| 標準コマンド・辞書同期前 | 4 | 未記録 | 365 / 1 / 7 | 辞書の初期focus待ち不足。serial後続7件中断、採用せず |
| 最終ソース・標準コマンド | 4 | 76.553 | 373 / 0 / 0 | PASS |
| 最終凍結・主比較基準 | 1 | 245.738 | 373 / 0 / 0 | PASS |
| 最終凍結・比較1 | 4 | 74.498 | 373 / 0 / 0 | PASS |
| 最終凍結・比較2 | 4 | 75.327 | 373 / 0 / 0 | PASS |

初回の4並列失敗では、同時Workersは4だが、失敗後のworker再起動によりブラウザー起動PIDは累計5だった。設定上の同時数と累計数は区別している。標準失敗回はPlaywright内部76.169秒を記録しているが、壁時計結果は保存前に中断したため推測で埋めない。

修正後は2テストを4並列で各24回（計48回）反復し成功。別途、実テストの一時コピーに幅変更・left位置ずれ・glyph重複をCSS注入し、元の対応assertが3種類とも失敗することを確認した。これは通常suite外の検出力監査であり、通常件数や成功数には合算していない。

Flaky分類はretry 0だけでは安定性を証明しない。採用判定は、最終全件3回の成功、追加反復、準備処理の原因調査、失敗履歴の開示に基づく。有限回の実行で将来の全フレークを否定するものではない。

## 並列化の安全性

- 59 specを調査。通常suiteのpublic safety一時ツリーは `test.info().outputPath` と `mkdtemp` を使い、Playwrightの各test出力とともに固有の出力先へ分離される。HTML・README・fixtureの外部参照は読取専用。手動撮影4件は通常実行に含めない。
- Tauri Mockのconfig、呼出履歴、遅延Promise、callback等は各 `page.addInitScript` のclosure内。Nodeの共有可変業務状態ではない。
- 標準のtestごとのBrowserContext/pageを維持し、sessionStorage/localStorageと時刻モックを分離。ブラウザーやcontextをテスト間で新しく共有していない。
- 複数ウィンドウ・イベントMockは各testのcontextに属し、Viteの1437番サーバーは読み取り配信の1つだけ。各全件回で起動1回を実測し、ポート競合はなかった。
- ファイル内順序・serial指定を維持し、ファイル間の並び・割当が異なる複数回で状態漏れを観測しなかった。順序依存が永久に存在しないという形式的証明ではない。
- 373件の入力・重要assert・失敗回復・大量項目・長文・日付境界・世代競合・D&D・reset/restoreを削減していない。本番アプリ・Mock応答・fixture・依存lock・CI YAMLを変更していない。

## 初期化と資源

| 実測指標 | 最終1ワーカー | 最終4ワーカー2回 |
| --- | ---: | ---: |
| CLI開始→reporter onBegin | 2.498秒 | 2.494 / 2.433秒 |
| Before Hooksの合計 | 11.191秒 | 13.951 / 14.191秒 |
| After Hooksの合計 | 24.620秒 | 26.819 / 26.891秒 |
| npm/Vite起動→HTTP利用可能 | 0.989秒 | 0.954 / 0.948秒 |
| 対象プロセスWorking Set和・観測最大 | 約1.30GiB | 約3.14 / 3.05GiB |
| 累積CPU・観測値 | 135.516 CPU秒 | 166.688 / 172.125 CPU秒 |

ブラウザーは最初からworker内で再利用されており、373回起動していたわけではない。重複したブラウザー起動を省いた効果とは主張しない。各指標には包含関係・並列の重なりがあるため、足して総時間にしてはいけない。Vite自身の内部ready時間、fixture生成単独のCPUプロファイルは未計測。

壁時計の短縮と引き換えに、観測CPU・メモリは増える。メモリ増加とCPU余力を考慮して、最大数を実測済みの4に制限した。CIのリソース費用削減とは主張しない。

## 遅いテスト上位20件

最終1ワーカーでの上位。秒数はtest result.duration。後は同じテストの4並列2回の中央値で、並列時に各テスト自体が速くなることを意味しない。

| ファイル・内容 | 前秒 | 後秒 |
| --- | ---: | ---: |
| `phase810-expanded-timer` 満了→継続→終了 | 15.303 | 15.978 |
| `phase87-drop-register` 保存失敗のdraft保持と取消 | 8.745 | 8.897 |
| `phase83-settings-maintenance` 狭幅の保守操作 | 5.819 | 5.860 |
| `phase6-readiness` 登録後の再読込・保持 | 4.826 | 5.219 |
| `phase83-clean-start` リセット後のセッション記録 | 2.274 | 2.388 |
| `phase72-completion-feedback` reload・日付境界の完了保持 | 2.212 | 2.298 |
| `phase81-entry-contracts` 保存禁止状態からの復旧 | 1.788 | 1.891 |
| `phase71-edit-sync` 実行中・一時停止中の編集制限 | 1.709 | 1.626 |
| `phase72-completion-feedback` Do Now完了snapshot保持 | 1.392 | 1.510 |
| `phase87-followup-polish` 辞書shortcut登録表示 | 1.364 | 1.450 |
| `phase8-guide-sync` Guide移動とfocus復帰 | 1.333 | 1.407 |
| `phase82-countup-ui` 3列1440幅 | 1.245 | 1.302 |
| `phase82-countup-ui` 1列860幅 | 1.240 | 1.311 |
| `phase82-countup-ui` 2列1000幅 | 1.221 | 1.293 |
| `phase81-layout-qa` ダイアログ終了時のfocus復帰 | 1.200 | 1.282 |
| `phase72-completion-feedback` 完了候補の再提案防止 | 1.180 | 1.267 |
| `phase81-source-followup` 確認中の後続処理待ち | 1.163 | 1.292 |
| `phase84-source-lock-ui` project色のhover | 1.159 | 1.276 |
| `phase84-wishlist-nextstep-hover` 昇格・表示・keyboard | 1.157 | 1.321 |
| `post-v133c-followup` 継続・一時停止後のsnapshot | 1.147 | 1.188 |

全58ファイルの集計と全373件の個別durationは各回のJSONへ保存してある。最大の改善対象は直列スケジューリングであり、長時間の時計tickや通知を含む旅程は今もボトルネックとして残る。

## 採用しなかった改善

| 候補 | 理由 |
| --- | --- |
| fullyParallel一括有効化 | 禁止条件。ファイル内の独立性まで広げる必要がない |
| runForのfastForward一括置換 | 前者は各intervalを実行し、後者は飛ばす。継続tick・寿命・競合の検出意味が変わる |
| 固定waitの大量削除 | 9箇所を確認。色/動作の遷移や非同期副作用の観測を、主な時間要因と誤認して削らない |
| context/pageの共有 | ストレージ・clock・event・focusの独立性を壊す危険がある |
| fixture縮小・reload除去 | 120件の辞書、長文、破損、保存失敗、再起動後保持など固有の検出力を維持する |
| CI分割・browser cache追加 | 新しいCI実測を行えず、壁時計と総runner資源の両方を評価できない |
| cargo check/clippy/test削除 | 異なる検証を維持。実行省略や失敗無視での短縮はしない |
| 専用の高速コマンド追加 | 既存の標準全件コマンド自体が短縮できた。部分実行をFull Testの代わりにしない |

## CI調査

[同一基準mainの既存CI](https://github.com/Takuyakou/life-launcher/actions/runs/36977138611)は全体943秒、単一verify job939秒。工程はPlaywright424秒、cargo check151秒、cargo test190秒、clippy9秒、npm ci12秒、Chromium導入15秒だった。ローカル値との直接比較は、PC・キャッシュが異なるので行わない。

setup-nodeのnpm cacheとSwatinemのRust cacheは既存設定にある。今回はcache key・incremental・job構成・チェック省略を変更していない。新しいCI実行とcache miss/hitの比較をせずに、追加キャッシュやjob分割の改善率・費用を推測していない。Windows runnerを別途実測できる時に、明示的な `--workers=2`、キャッシュ復元/保存時間、総runner秒も含めて検討する。

## 実行モード

```powershell
# 標準・通常CI: 全通常テスト
npm.cmd run test:visual

# 開発中に変更箇所だけ確認する例。全件の代用ではない
npm.cmd run test:visual -- tests/visual/phase84-today-picker.spec.ts
npm.cmd run test:visual -- --grep "Today"
npm.cmd run test:visual -- --workers=1
```

正式リリースでは、全回帰・Rust・public safety・native確認等の従来ゲートを維持する。並列化はテストファイル間だけであり、パッケージングとPlaywrightを同時実行する変更ではない。

## 最終検証

| 項目 | 結果 |
| --- | --- |
| 最終標準全件 | 373 PASS、FAIL/SKIP/Flaky 0、既定4ワーカー |
| 同一最終ソースの計測 | 基準1回・改善2回すべて373 PASS、全ID・期待状態一致 |
| 準備同期の反復 | 2件×24回、48 PASS |
| CSS変異監査 | 幅・位置・glyph重複を全3種類検出。通常suite外 |
| Rust unit / capability | 124 + 1 PASS、failed/ignored 0 |
| cargo fmt / check / clippy | PASS。clippyはall-targets・-D warningsを維持 |
| ESLint | PASS |
| TypeScript / Vite build | PASS。既存の大きいchunk警告は抑制せず維持 |
| CI相当の設定読み込み | 既定1、明示上書き2、fullyParallel false |
| 公開安全性 | Git対象+本報告439ファイルをexportし、未変更scannerで420ファイル・blocker 0 |
| 後片付け | 今回生成したRust target 2,066,479,479 bytesを削除。既存共有cacheとユーザーHTMLを保持 |

Rustソース・profile条件は変更していない。harnessが報告した純テスト合計は1.28→1.31秒で、Rust高速化の成果とは主張しない。初回compileのみ51.536秒。Cargo testコマンド全体は9.128→4.207秒だが、前者にはアプリ再compile6.93秒を含み、同じキャッシュ状態の改善率として比較しない。ローカル設定はCARGO_INCREMENTAL=0、dev/test debug=0で両方共通。

実EXE GUI、別PC・少コア実機、Linux/macOS、新しいGitHub Actionsは未実施。本番アプリ機能・release・Web Demoの変更なし。有限の反復で全競合を排除した保証ではない。

## 記録と提出範囲

機械記録は既存開発フォルダー内の無視対象 `.local-evaluation/test-runtime/` に保管した。

- 各回の `playwright.json`: 全test結果・個別時間・エラー・実ブラウザーlog。
- 各回の `summary.json` / `hooks.json` / `resources.json`: ファイル別和・上位20・setup・資源。
- `comparison.json`: 全探索条件、最終同条件の削減秒・率・一覧一致。
- `source-snapshot.json` / `final-inventory-and-source.json`: ソース・373 ID照合。
- `standard-command-fixed-result.json`、`focus-and-hover-stress.json`、`mutations/result.json`: 標準コマンドと安定性・検出力。
- `rust-*.json` / `ci-history.json`: コンパイルとテストの分離、既存CIの実時間。

ビルド成果物・測定記録・一時ファイルはDドライブの既存開発フォルダー配下へ保管し、依存cacheは既存のD共有cacheを使用した。既存Cドライブのブラウザー実行ファイルは読取・起動だけに使用し、新規worktreeやCビルドを作成していない。ユーザー所有の未追跡HTMLを変更・コミットしていない。push・PR作成・mainへのマージ・リリースは行わず、専用ブランチのローカルコミットまでを提出範囲とする。
