# P61-01 登録経路とBuilder参照ビュー整理レポート

> この文書はP61-01の実装・検証記録であり、現在仕様は`docs/spec/current-spec.md`を参照する。
> Visual QAは合成public fixtureだけを使用し、実ユーザーデータは変更していない。

## 状態

- Stage: P61-01
- 判定: WAITING_HUMAN_APPROVAL
- Approved base SHA: `c2c3d9a142dfefe5b841f06dc0fe8880fcb068a8`
- Implementation / verification SHA: `c89accb0335142e49584112760acffbf94e64302`
- Branch: `feature/p61-01-selection-flow`
- PR: [#11](https://github.com/Takuyakou/life-launcher/pull/11)
- PR base: `docs/p61-00-delta-audit`（PR #10）
- Product version: `1.0.0`（変更なし）

## 結論

Today3とBuilderを新規登録の場所から「登録済み候補を今日へ採用する場所」へ整理した。
Builderの候補元はProject.nextStepとWishlistだけで、採用先はToday3だけである。

ユーザー承認に基づきWishlistへ後方互換なstable IDを追加し、Today3は採用時の本文、実行環境、手順書、短時間・通常タイマー分数をsnapshotとして保持する。

## 変更内容

### 削除した入口

- Today3 headerの`+ 追加`とinline追加form。
- Builder headerのProject追加button。
- Builderの送付先select（Today3 / 勝利条件 / やりたいこと）。
- Builder右クリックの削除/dismiss。
- 勝利条件とSession noteからのBuilder候補生成。

### 維持した入口

- NextStep headerの`次の一手を追加`詳細Project dialog。
- Wishlist headerの`やりたいことを追加`と既存inline form。modal化はP61-02へ分離した。
- NextStep/Wishlist行とBuilder候補行の`今日へ`。
- 勝利条件の独立した編集。
- Do Nowの推薦、タイマー、14日再開契約。

### Builder

- sourceは`次の一手`と`やりたいこと`の2種類だけ。
- 1行1つの`今日へ`でToday3へ非破壊採用する。source項目は削除しない。
- 採用済み行は`選択済み`、3件到達後の未採用行はdisabledにする。
- 5件pagination、page clamp、D&D、右クリック上下移動を維持した。
- Projectの安定keyは`project:${id}`、Wishlistは`wishlist:${id}`。
- 旧order keyも読み取り、本文編集後も新しいstable keyで順序を維持する。
- D&Dはpointermove中に保存せず、drop時だけlocalStorageへ保存して即時再描画する。
- 旧dismiss localStorageは削除せず、表示filterには使用しない。

### Today3と空状態

- Today3が0件なら`今日の候補を見る`でBuilderを展開し、disclosureへfocusする。
- Builderが0件なら`次の一手へ` / `やりたいことへ`で各sourceを展開し、既存追加buttonへfocusする。
- 全3件完了後の`次の3件を選ぶ`はToday3だけを空にし、Builderを展開・focusする。
- 3件上限、duplicate判定、source非破壊、保存失敗rollbackを共通の採用処理へ統一した。

## Stable IDと互換

- `InboxItem.id`をTypeScript/Rust/JSON Schemaへoptional fieldとして追加した。
- 旧Wishlist項目の欠損IDはload時sanitizeで一度だけ生成・保存する。
- 既存の有効IDを先に予約し、欠損IDや真の重複だけへsuffixを付ける。
- 新規Wishlist登録時はUUID、利用不可環境では時刻＋random fallbackを付与する。
- 同じ本文のWishlist項目も別IDとして別候補にできる。
- 旧Todayの本文由来source keyは、同文面候補の先頭へ決定的に対応付ける。2件目以降は別候補として採用できる。

## Today3 snapshot

採用時に次をToday itemへ複製する。

- 本文
- きっかけ
- Project ID
- button IDs
- 手順書pathと開始時表示設定
- 通常タイマー分数
- 短時間タイマー分数

既存Today itemで分数がない場合、load時に現在のProject設定、Projectなしならglobal設定から一度だけ補完する。1〜240分外の値も同じ安全なfallbackへ正規化する。補完後や新規採用後にProject設定を変更しても、Today itemの分数は変わらない。

## 保存失敗

`今日へ`は既存`persistConfig`のoptimistic updateを使い、Rust保存が失敗した場合は直前configへrollbackする。成功toastは保存成功後だけ表示する。自動試験では失敗後にToday3が0件へ戻ることを確認した。

## Before / After

- Before: `docs/phase6/screenshots/today-builder-8-items.png`（旧Phase 6履歴。変更していない）
- After: `docs/phase6.1/screenshots/p61-01-builder-source-only.png`
- After画像SHA256: `8982A78C6052495F0E7FE9C6B4C93166EAFAFB8AC65D2E00AC738E10F9B52885`

Afterは合成データで、source-only候補、5件pagination、単一`今日へ`を記録する。Codexの`view_image`はWindows sandbox ACL errorで表示できなかったため、目視判定はENV_BLOCKED。生成、可視性、操作、responsive、horizontal overflowはPlaywright assertionでPASSした。

## 自動テスト

追加・更新した主なcoverage:

- stable IDの欠損補完、既存ID予約、collision suffix、二回目sanitizeの無変更。
- Today timer snapshotのProject値採用、Project変更後の固定、無効値のglobal fallback。
- Project/Wishlist source限定、Session/勝利条件除外、select/add/dismiss非表示。
- 同文面別ID、旧source keyとの互換。
- 3件上限、duplicate、source非破壊、保存失敗rollback。
- 0/1/5/6/10/11/50件paginationとpage clamp。
- Builder D&Dのpointermove未保存、drop保存、即時再描画、reload維持。
- Today3空状態、Builder空状態、次batchのfocus遷移。

## 最終検証

| コマンド | 結果 | 件数/備考 |
|---|---|---|
| `npm.cmd ci` | PASS | 172 packages追加、173 packages監査、脆弱性0 |
| `npm.cmd run public:check` | PASS | 165 files、blocker 0 |
| `npm.cmd run lint` | PASS | warning 0 |
| `npm.cmd run build` | PASS | TypeScript + Vite production build |
| `npm.cmd run test:visual` | PASS | 59/59 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | 差分なし |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | dev profile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS | warning 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 95 unit + 2 capability contract |
| `git diff --check` | PASS | whitespace errorなし |

## Scope / 停止確認

- Wishlist modal（P61-02）とGuide全文更新（P61-03）は未実装。
- 旧Phase 6履歴画像はVisual QA後に元へ戻し、変更していない。
- main push/merge、PR merge、version/tag/Release、Web Demo/Cloudflare変更なし。
- 実ユーザーデータ変更なし。
- PR #10の後にPR #11を取り込むstackであり、順番を逆転しない。

`P61-01 COMPLETE — STOPPED FOR HUMAN REVIEW`
