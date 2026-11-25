# Phase 6.1 最終作業報告書

> この文書は、Phase 6.1の実装・段階PR・main統合・統合後検証をまとめた作業記録である。現在仕様は`docs/spec/current-spec.md`、Phase 6.1の追加仕様は`docs/phase6.1/SPECIFICATION.md`を参照する。

## 結論

- 最終判定: `MERGED AND VERIFIED`
- Phase 6.1開始時main: `66ff0923203deb6be63dce6600d435843182dfd0`
- Phase 6.1統合後main: `53d2919494a5198280feb19fb5090d9fb1ee1c1f`
- Product version: `1.0.0`（変更なし）
- version / tag / GitHub Release / 配布EXE: 変更なし
- 実ユーザーデータ: 変更なし。検証は公開可能な合成fixtureで実施

## 統合したPR

積み上げPRを依存順にmainへ統合し、各merge後に次PRのbaseをmainへ変更して差分とmergeabilityを再確認した。

| 順序 | PR | 内容 | main merge commit |
|---|---|---|---|
| 1 | [#10](https://github.com/Takuyakou/life-launcher/pull/10) | P61-00 差分監査・仕様固定 | `4234bcf` |
| 2 | [#11](https://github.com/Takuyakou/life-launcher/pull/11) | P61-01 選択フロー・互換データ | `9b2571b` |
| 3 | [#12](https://github.com/Takuyakou/life-launcher/pull/12) | P61-02 Wishlist追加modal | `104ee12` |
| 4 | [#13](https://github.com/Takuyakou/life-launcher/pull/13) | P61-03 アプリ内Guide同期 | `4786595` |
| 5 | [#14](https://github.com/Takuyakou/life-launcher/pull/14) | P61-04 総合QA・引渡し | `7caf346` |
| 6 | [#15](https://github.com/Takuyakou/life-launcher/pull/15) | Today3 D&D表示・右端余白 | `53d2919` |

PR #15を含む全PRは、統合前にGitHub Actions `verify`がPASSした。

## 実装内容

### 登録と選択

- Today Builderを、Projectの設定済みNextStepとWishlistだけから派生する候補ビューへ整理した。
- Builder内の独立追加form、送付先select、Session候補、勝利条件候補、dismiss UIを廃止した。
- NextStep、Wishlist、Builderの`今日へ`を共通の非破壊採用処理へ接続した。採用後も登録元は残る。
- Today3は3件上限を維持し、満了後に勝手に次の項目を補充しない。

### データ互換

- Wishlistへ後方互換なstable IDを追加した。旧データでIDがない項目はload時に一度だけ補完する。
- 同じ本文のWishlist項目も別identityとして扱い、片方の操作が他方へ波及しない。
- Today3へ採用した時点で本文、Project、起動action、手順書、通常時間、短時間をsnapshotする。
- 採用後にProject側のタイマー設定を変えても、採用済みToday3の分数は変わらない。
- 旧dismiss値や旧Today3を破壊せず、現在使わない値は保持したまま新UIのfilterへ適用しない。

### UI / UX

- Wishlist追加を本文専用のcompact modalへ変更し、二重送信防止、IME、Escape、backdrop、保存失敗時の再試行を整備した。
- アプリ内Guideを現在の登録、選択、開始、満了後の終了確定、次batchの流れへ同期した。
- Today3カードのD&Dへ、ポインタに追従するdrag preview、元位置のplaceholder、黄色のdrop位置表示を追加した。
- 同一行では縦線、1列配置では横線を使い、挿入位置を判別できるようにした。
- Today3グリッドの右端にもカード間と釣り合う余白を追加した。

## 保存契約とrollback

| 対象 | pointermove中 | drop時 | 保存失敗時 |
|---|---|---|---|
| Today Builder | 永続保存しない | 並び順を保存 | 表示順をrollback |
| Today3 | 永続保存しない | 並び順を保存 | 表示順をrollback |
| Wishlist採用 | 対象外 | 採用確定時に保存 | optimistic表示をrollback |

Today3については、PR #15でdrop-only保存と保存失敗rollbackをbrowser testに追加した。

## テスト追加・更新

- Phase 6基準55件を、P61-04までに69件へ拡張した。
- PR #15でToday3 D&Dのdrop-only保存と保存失敗rollbackを追加し、最終的に71件となった。
- Wishlist stable identity、旧同文selection、Today3採用時snapshot、Builder source-only/pagination、Guide focus、Wishlist modal各状態を自動化した。
- Rust側へWishlist ID migration、Today3 timer snapshot、旧config互換のunit testを追加した。

## merged main最終検証

検証対象は`53d2919494a5198280feb19fb5090d9fb1ee1c1f`。`HEAD == origin/main`かつworking tree cleanを確認してから実行した。

| コマンド / 検査 | 結果 | 件数 / 備考 |
|---|---|---|
| `npm.cmd ci` | PASS | 172 packages追加、173 packages監査、脆弱性0 |
| `npm.cmd run public:check` | PASS | 174 files、blocker 0 |
| `npm.cmd run lint` | PASS | warning 0 |
| `npm.cmd run build` | PASS | TypeScript + Vite production build |
| `npm.cmd run test:visual` | PASS | 71 / 71 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | formatting差分なし |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | dev profile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS | warning 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 95 unit + 2 capability contract |
| `npm.cmd audit --audit-level=low` | PASS | 脆弱性0 |
| `npm.cmd audit --omit=dev --audit-level=low` | PASS | production脆弱性0 |
| `git diff --check` | PASS | whitespace errorなし |

Visual QAが更新した既存の決定論的スクリーンショットは検証後にrestoreし、製品差分へ混入していない。

## 代表画像

- Builder source-only: `docs/phase6.1/screenshots/p61-01-builder-source-only.png`
- Wishlist modal 1440px: `docs/phase6.1/screenshots/p61-02-wishlist-modal-1440.png`
- Wishlist modal 860px: `docs/phase6.1/screenshots/p61-02-wishlist-modal-860.png`
- Guide 860px: `docs/phase6.1/screenshots/p61-03-guide-860.png`
- Today3 drag preview / drop位置 / 右端余白: `docs/phase6.1/screenshots/p61-05-today3-drag.png`

## 残存確認事項

- 実Tauri GUI smokeは未実行。実ユーザーデータと分離された既存smoke harnessがないため、使用中configを触らないことを優先した。
- 代替としてbrowser-level Tauri mock 71件、Rust unit 95件、capability contract 2件、GitHub Actionsを通過している。
- 配布EXE、Installer、Portable ZIPの再生成は今回のmerge・報告書作成の対象外である。

## 最終状態

Phase 6.1の実装、互換migration、UI調整、文書、テスト、main統合、統合後の全自動検証は完了した。

`PHASE 6.1 MERGED AND VERIFIED`
