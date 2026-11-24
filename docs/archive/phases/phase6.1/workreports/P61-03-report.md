# P61-03 Guide / 使い方同期レポート

> この文書はP61-03の実装・検証記録であり、現在仕様は`docs/spec/current-spec.md`を参照する。
> Visual QAは合成public fixtureだけを使用し、実ユーザーデータは変更していない。

## 状態

- Stage: P61-03
- 判定: WAITING_HUMAN_APPROVAL
- Approved base SHA: `bf0e742eaec1ea5c265021a2e7323a7c6b423280`
- Implementation / verification SHA: `68c218f5e957c98d8bb677f0d0b9acd077d66245`
- Branch: `docs/p61-03-in-app-guide`
- PR: [#13](https://github.com/Takuyakou/life-launcher/pull/13)
- PR base: `feature/p61-02-wishlist-modal`（PR #12）
- Product version: `1.0.0`（変更なし）

## 結論

アプリ内「使い方」の毎日の導線を、登録元から候補を選び、今日の3件または今やる一手から開始する現行フローへ同期した。Guideの入口、16節構成、目次、コピー機能、週次コーチ、Quick、辞書、手順書、記録、設定の正しい説明は維持した。

README、Release、Web Demoは未公開v1.1の説明へ先行変更していない。

## 変更したGuide節

- Lead: 迷った場合の「今やる一手」と、自分で選ぶBuilder経路を併記。
- 初回セットアップ: 「プロジェクトを追加」、任意field、Today採用後の開始へ修正。
- 30秒で分かる毎日の使い方: 登録済み候補→今日へ→短時間/通常→満了後「終わる」の5手順へ修正。
- Life Launcherの用語: やりたいこと、今日を組み立てる、今日の3件を追加。
- 今日の画面: source、5件pagination、source保持、旧dismiss互換、Wishlist modal、完了、次の3件を反映。
- プロジェクト: Project作成とNextStep更新を区別し、NextStep一覧にtimer開始がないことを明記。
- 手順書ビューア: Markdown / TextにHTMLを追加。
- タイマーとミニモード: Today分数snapshot、1分条件、manual stop、満了dialogのbutton名を反映。
- このアプリの設計思想: 「1日3件」ではなく「一度に3件」へ修正。

## 除去した旧手順

- NextStep一覧から通常timerを直接開始できるという説明。
- Project作成に名前、次の一手、起動buttonがすべて必須という説明。
- Builderが昨日の勝利条件や最近のnoteを候補にするという説明。
- Wishlistの入力欄が一覧末尾へ表示されるという説明。
- Today3が1日合計3件までと読める表現。
- Timerが満了しただけでToday項目が完了するように読める表現。

## 実装照合

| Guide claim | Source | Automated test |
|---|---|---|
| Wishlist追加は本文専用modal | `inboxAddOpen` / `addInboxItem` | `phase61-wishlist-modal.spec.ts` |
| Project追加はProjectと最初のNextStepを登録 | `openProjectAddDialog` / `saveProjectEdit` | `phase61-wishlist-modal.spec.ts` |
| Builder sourceはProject.nextStepとWishlistだけ | `rawTodayBuilderCandidates` | `phase6-main.spec.ts` source-only test |
| Builderは5件/pageで旧dismissをfilterしない | `visibleTodayBuilderCandidates` / legacy key読取 | `phase6-main.spec.ts`, `phase6-readiness.spec.ts` |
| 「今日へ」はsourceを残しToday3へ採用 | `addCandidateToToday` | `phase6-main.spec.ts` non-destructive test |
| Today3は一度に3件まで | `TODAY_ITEM_LIMIT` / `limitToday` | `phase6-readiness.spec.ts` 0〜3件 test |
| 採用時にtimer分数を固定 | `todayItemFromCandidate` | `phase6-main.spec.ts` snapshot test, Rust config tests |
| 満了後「終わる」で完了 | `completionPrompt` / `finishCompletedTimer` | `phase6-main.spec.ts` planned/manual completion tests |
| 3件完了後だけ次の3件を選ぶ | `allTodayItemsCompleted` | `phase6-main.spec.ts`, `phase6-readiness.spec.ts` |
| 今やる一手は説明可能な固定rule | `loadDoNowCandidates` | Rust session candidate tests |
| Guide目次は見出しへfocusし狭幅で開閉 | `HelpGuideDialog.jumpTo` / `tocOpen` | `phase61-guide.spec.ts` |

## Guide専用QA

追加した`tests/visual/phase61-guide.spec.ts`は次を確認する。

- 確定した登録・選択・完了文言が表示される。
- 旧NextStep直接開始、昨日の勝利条件、Wishlist末尾入力の文言が存在しない。
- 目次の「今日の画面」で対象見出しへfocusし、`aria-current=location`になる。
- 「目次へ戻る」で先頭目次itemへfocusする。
- Tab / Shift+TabがGuide内で循環する。
- Escapeと背景clickで閉じ、起点の「使い方」へfocusを戻す。
- 860pxでdialogがviewport内に収まり、horizontal overflowがない。
- 760px未満で目次が閉じた状態から開ける。

## 代表画像

- After 860px: `docs/phase6.1/screenshots/p61-03-guide-860.png`
- SHA256: `734F1148E21303A63F58A26109F3E5F7FDD13D3455575E22AFA80205FEE6C9AD`

860pxのGuide全体を目視確認した。目次、Lead、本文、footerに重なりや横見切れはなく、長い日本語手順は本文幅内で折り返される。本文は独立scroll領域のため、下部の続きは通常scrollで読む。

## 最終検証

| コマンド | 結果 | 件数/備考 |
|---|---|---|
| `npm.cmd ci` | PASS | 172 packages追加、173 packages監査、脆弱性0 |
| `npm.cmd run public:check` | PASS | 172 files、blocker 0 |
| `npm.cmd run lint` | PASS | warning 0 |
| `npm.cmd run build` | PASS | TypeScript + Vite production build |
| Guide専用Visual QA | PASS | 4/4 |
| `npm.cmd run test:visual` | PASS | 69/69 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | 差分なし |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | dev profile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS | warning 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 95 unit + 2 capability contract |
| `git diff --check` | PASS | whitespace errorなし |

## 未確認事項

- P61-03内のGuide claimはすべてsourceと自動testへ対応付けた。未確認のGuide操作はない。
- Stack全体をmain基点で再実行する統合回帰と最終判定はP61-04へ分離する。

## Scope / 停止確認

- Guide専用の新機能、強制tutorial、FAQ、翻訳基盤は追加していない。
- 業務用タスク管理や昇格モデルの教程は追加していない。
- 旧Phase 6履歴画像はVisual QA後に元へ戻し、変更していない。
- main push/merge、PR merge、version/tag/Release、Web Demo/Cloudflare変更なし。
- 実ユーザーデータ変更なし。
- PR #10、#11、#12、#13のstack順を維持する。

`P61-03 COMPLETE — STOPPED FOR HUMAN REVIEW`
