# P61-02 Wishlist登録モーダルと作成対象明確化レポート

> この文書はP61-02の実装・検証記録であり、現在仕様は`docs/spec/current-spec.md`を参照する。
> Visual QAは合成public fixtureだけを使用し、実ユーザーデータは変更していない。

## 状態

- Stage: P61-02
- 判定: WAITING_HUMAN_APPROVAL
- Approved base SHA: `3022e77b6ef90dbc2e6217545cc3fb06533ec510`
- Implementation / verification SHA: `602c2622c51f5f87b54c761a4cb2004a4569bab2`
- Branch: `feature/p61-02-wishlist-modal`
- PR: [#12](https://github.com/Takuyakou/life-launcher/pull/12)
- PR base: `feature/p61-01-selection-flow`（PR #11）
- Product version: `1.0.0`（変更なし）

## 結論

Wishlistの見出し内追加ボタンから、本文だけを扱う小型モーダルを開く形へ変更した。
展開本文の旧インライン登録UIは撤去し、既存の詳細編集、D&D、右クリック操作、Today採用は維持した。

Project追加導線は実際にはProjectを作成するため、表示名を「プロジェクトを追加」、名前fieldを「プロジェクト名」へ変更した。次の一手、北極星、重点、手順書、起動action、タイマーを含む登録能力は削っていない。

## Wishlistモーダル

- 入力項目は既存の本文1項目だけ。新しい永続fieldは追加していない。
- `modalBackdrop`、`dropDialog`、`fieldStack`、`dialogActions`、既存button tokenと全体focus trapを再利用した。
- 開いた直後は本文へfocusし、Tab / Shift+Tabはダイアログ内を循環する。
- Enterで保存するが、日本語IME変換確定中のEnterではsubmitしない。
- 空入力は保存不可、本文は`maxlength=120`と保存直前validatorの両方で制限する。
- 保存中は同一tickの二重clickをrefで遮断し、保存要求を1回だけ送る。
- キャンセル、Escape、外側clickはdraftを破棄し、見出し内の起点ボタンへfocusを戻す。
- 保存成功時だけ閉じる。失敗時はdraftを残し、ダイアログ内alertからそのまま再試行できる。
- 新規項目のstable ID生成と`persistConfig`による保存は既存契約を継続する。

## 作成先と確定ラベル

| 導線 | 実際の作成先 | 確定ラベル |
|---|---|---|
| Wishlist見出しの追加 | Wishlist item | `やりたいことを追加` / `やりたいこと` |
| Project見出しの追加 | Project + Project.nextStep | `プロジェクトを追加` / `プロジェクト名` / `次の一手` |

Project追加ダイアログには「取り組みと、次にやることを登録します。」を補足表示し、登録対象を明確にした。既存Project編集ではID、button IDs、手順書を保持したまま次の一手を更新できることを確認した。

## 保存失敗

Wishlist保存失敗時はモーダルを閉じず、入力本文と既存configを維持する。エラーは「保存できませんでした。内容を残したまま、もう一度お試しください」とダイアログ内に表示する。失敗設定を解除した後、同じ入力のまま再保存できることを自動確認した。

## Guideへの申し送り

P61-03では次を実画面に合わせて更新する。

- Wishlist追加は展開本文のインライン入力ではなく、見出しから開く本文専用モーダル。
- Project新規登録の入口名は「次の一手を追加」ではなく「プロジェクトを追加」。
- Project追加はProjectと最初の次の一手を同時に登録し、詳細設定能力を維持する。
- Wishlistの保存失敗時は入力が消えず、同じモーダルで再試行できる。

Guide本文の変更はP61-03へ分離し、このPRでは行っていない。

## Before / After

- Before: `docs/phase6/screenshots/p6-01-main-wishlist-expanded.png`（旧Phase 6履歴。変更していない）
- After 860px: `docs/phase6.1/screenshots/p61-02-wishlist-modal-860.png`
- After 1440px: `docs/phase6.1/screenshots/p61-02-wishlist-modal-1440.png`
- 860px SHA256: `E97F05C4DB0E8BCBFAC75A35271484B03BBCDB05B4EA0518FF629DAA1959324E`
- 1440px SHA256: `0BF2739AAB50D7A55C06E6EA39BC32C1D58214D6C4AD46888826EC6F7BAAF41E`

代表画像はモーダル要素だけをcaptureし、860pxと1440pxで目視確認した。重なり、見切れ、過剰な高さはない。1366pxと1920pxを含む4幅ではbounding boxとhorizontal overflowも自動確認した。

## 自動テスト

追加・更新した主なcoverage:

- autofocus、空入力、120文字上限、Tab循環、キャンセル、Escape、外側click、focus return。
- 日本語IME変換確定中Enterと、その後の通常Enter保存。
- 同一tickの二重clickで`save_config`が1回だけ呼ばれること。
- 保存失敗時のconfig rollback、draft保持、alert、再試行成功。
- stable ID付きWishlist登録からBuilderへの反映。
- script-like本文をHTMLとして実行せず文字列として表示。
- Project追加ラベルと全詳細fieldの維持、既存Project編集の関連値保持。
- 860 / 1366 / 1440 / 1920pxでダイアログ境界とhorizontal overflow 0。

## 最終検証

| コマンド | 結果 | 件数/備考 |
|---|---|---|
| `npm.cmd ci` | PASS | 172 packages追加、173 packages監査、脆弱性0 |
| `npm.cmd run public:check` | PASS | 169 files、blocker 0 |
| `npm.cmd run lint` | PASS | warning 0 |
| `npm.cmd run build` | PASS | TypeScript + Vite production build |
| P61-02関連Visual QA | PASS | 43/43 |
| `npm.cmd run test:visual` | PASS | 65/65 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | 差分なし |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | dev profile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS | warning 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 95 unit + 2 capability contract |
| `git diff --check` | PASS | whitespace errorなし |

`ui-ux-pro-skill`は現在の実行環境に存在しないため未使用。自動取得やUI framework追加は行っていない。

## Scope / 停止確認

- Guide全文更新（P61-03）は未実装。
- Project追加以外のmodal契約は変更していない。
- 旧Phase 6履歴画像はVisual QA後に元へ戻し、変更していない。
- main push/merge、PR merge、version/tag/Release、Web Demo/Cloudflare変更なし。
- 実ユーザーデータ変更なし。
- PR #10、#11、#12のstack順を維持する。

`P61-02 COMPLETE — STOPPED FOR HUMAN REVIEW`
