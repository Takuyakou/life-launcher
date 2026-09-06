# P61-00 実装差分監査レポート

> この文書は `66ff0923203deb6be63dce6600d435843182dfd0` 時点の監査記録であり、現在仕様の代わりには使わない。
> 実ユーザーデータ、個人パス、token、設定内容は含めていない。

## 状態

- Stage: P61-00
- 判定: WAITING_HUMAN_APPROVAL
- Base branch / SHA: `main` / `66ff0923203deb6be63dce6600d435843182dfd0`
- Implementation / verification SHA: `6a4440113e4ccbb594723cedd520973e7f23e189`
- Branch: `docs/p61-00-delta-audit`
- PR: [#10](https://github.com/Takuyakou/life-launcher/pull/10)
- PR base: `main`
- Phase 6 PR #9: MERGED（merge commit `66ff0923203deb6be63dce6600d435843182dfd0`）
- Phase 6最終実装 `74f4a9608f3b5e2ef857f580db45dd0abbe270bf` は `origin/main` に含まれる。
- Product version: `1.0.0`（変更なし）

## 結論

P61-01以降の方針は概ね現行モデルの上に実装できる。ただし、Wishlistに安定IDがなく、今日の3件のタイマー分数が採用時snapshotではなく現在のProject設定を参照するため、仕様どおりのstable identity / snapshotを保証するには明示的な判断が必要である。

このStageでは製品UI、model、runtime、testを変更していない。Phase 6.1パッケージの安全な文書だけを導入し、実装差分を固定した。

## 事実／追加変更／判断

| 項目 | 種別 | 根拠/監査結果 |
|---|---|---|
| Phase 6統合状態 | SOURCE_FACT | PR #9はmerge済み。報告書記載の最終SHAはmainの祖先。P61の正しいbaseは現在の`origin/main`。 |
| Builder候補 | SOURCE_FACT | `src/App.tsx`の候補生成は勝利条件、Project.nextStep、Wishlist、Session noteを集約し、textで重複排除している。5件paginationはあるが8件打切りはない。 |
| Builder送付先 | SOURCE_FACT | rowのselectはsource選択ではなく送付先で、`今日の3件`、`勝利条件`、`やりたいこと`を選ぶ。独立した勝利条件編集は残っている。 |
| Builder追加 | SOURCE_FACT | headerの`+`はProject作成dialogを開く。rowの`追加`は選択した送付先へ反映する。 |
| Builder削除 | SOURCE_FACT | sourceを削除せず、candidate keyをlocalStorageの`life-launcher-today-builder-dismissed`へ保存して全日でfilterする。日付境界はない。 |
| Builder並び順 | SOURCE_FACT | localStorageの`life-launcher-today-builder-order`で保持。pointermoveは表示previewのみ、pointerup/dropで順番を保存する。localStorage保存失敗のrollback契約はない。 |
| Today3追加 | SOURCE_FACT | headerの`+追加`はinline入力を開き、manual source keyで最大3件・同一text重複を防ぐ。context menuは上/下/削除のみ。 |
| Today3空状態 | SOURCE_FACT | 説明文だけで、Builderへ移動・focusする操作はない。全件完了後の`次の3件を選ぶ`はToday3を空にしてBuilderを開きfocusする。Session/historyは保持する。 |
| Today3完了 | SOURCE_FACT | countdown満了だけでは未確定。終了確認で確定すると対応Today項目を完了にする。手動終了やtimer切替は完了にしない。 |
| Today3 identity | SOURCE_FACT | source keyを持つ。legacy欠落時はRust sanitizeでProject由来またはdate/index由来keyへ正規化される。Project採用はProject IDベースで重複判定する。 |
| Today3 snapshot | SOURCE_FACT | text、buttonIds、instructionを項目に保持する一方、短時間/通常分数は表示・開始時に現在のProject設定を参照する。仕様の全面snapshot記述とは不一致。 |
| NextStep追加 | SOURCE_FACT | `次の一手を追加`dialogはProject全体を新規作成する。名前だけがcode上の必須条件で、次の一手・ボタン・timer・手順書等を設定できる。 |
| Wishlist追加 | SOURCE_FACT | headerの`+`はリスト先頭のinline formを開く。120文字。IME composition guardなし。保存失敗時はconfigをrollbackするが、form/inputは先に閉じて失われる。 |
| Wishlist model | SOURCE_FACT | TypeScript/Rustとも`text`と任意のproject/button/instructionのみでstable IDがない。candidate keyはProject IDとtextから派生し、編集でidentityが変わる。 |
| Wishlist操作 | SOURCE_FACT | context menuに上/下/編集/削除。編集dialogではProject、buttons、手順書を設定できる。`今日へ`はsourceを消さない。 |
| Do Now | SOURCE_FACT | weekly focusかつnextStep非空のProjectのみ候補。今日未実行を優先し、実行済みは古いもの順、14日以上空いたProjectだけ短時間再開対象。Today3とは独立。 |
| Guide | SOURCE_FACT | Main上部の`使い方`から`HelpGuideDialog`を開き、内容は`src/content/helpGuide.ts`の静的日本語。翻訳層はない。 |

## P61-01以降に固定する提案

1. Builder sourceはProject.nextStepとWishlistだけに限定する。勝利条件・Session noteは候補生成から外す。
2. 旧dismiss localStorageは削除・migrationせず残すが、新Builderのfilterには適用しない。旧候補は再表示される。
3. per-rowの`今日へ`だけを維持する。multi-selectと新しいcandidate DBは作らない。
4. Builderの既存5件paginationとD&D順序保持は維持する。存在しない候補keyだけを表示時に無視する。
5. Today3 header追加、Builder header追加、Builder送付先select、Builder削除/dismissを除去する。
6. Today3とBuilderの空状態に、相互へ移動してfocusする明示的なbutton/linkを置く。次batchは現行どおりBuilderへ移動する。
7. Wishlist追加は本文だけの小modalへ変更する。rich edit dialogは維持し、保存失敗時はmodalと入力値を保持する。
8. NextStep追加dialogは能力を変えず、Project作成であることが分かるtitleへ変更する。
9. Do Nowの候補条件・順序・14日再開契約は変更しない。
10. Guideは新しい「Wishlist/NextStep -> Builder -> Today3 -> timer確定 -> 次batch」の流れへ更新する。

## データと互換

- Projectは既存IDをstable identityとして使える。Builder keyは`project:${id}`へ寄せ、nextStep本文編集で順序identityが変わらないようにする案が最小。
- WishlistはIDを持たないため、同じtextでも別項目を区別する要件を現状では満たせない。P61-01で後方互換な`id`追加とload時補完を行い、保存後はそのIDを使う案を推奨する。
- 既存Today3 `sourceKey`は書き換えない。既採用項目、legacy/manual/Session由来項目、Session履歴を保持する。
- 旧dismiss/order keyは削除しない。dismissは新filterへ適用せず、orderは有効なstable keyだけへ適用する。
- `persistConfig`にはoptimistic updateとsave失敗時config rollbackがある。Wishlist新規modalでは入力UIも閉じないことを追加testで保証する。

## UI入口と置換範囲

| 領域 | 現行入口 | P61案 |
|---|---|---|
| Today3 | header `+追加`、inline form、空説明 | header追加を除去。空状態からBuilderへ移動。 |
| Builder | header `+`、row送付先select + `追加`、右クリック削除 | header追加/select/削除を除去。Project/Wishlist候補ごとの`今日へ`に限定。 |
| NextStep | header `+` -> 詳細Project dialog | 能力を保持し、Project作成と分かるlabel/titleへ変更。 |
| Wishlist | header `+` -> inline form | 本文のみ小modal。右クリックrich editは維持。 |

## Guide / current-spec監査

- `src/content/helpGuide.ts`は「通常の次の一手カードからも開始」と説明するが、現行NextStep cardにはtimer開始buttonがない。
- GuideはProjectの最低入力を名前・次の一手・起動ボタンとしているが、code上の必須は名前だけ。
- GuideはWishlist追加欄をリスト末尾としているが、実装は先頭。
- Builder source、送付先、dismissの現行説明はP61変更後に置換が必要。
- `docs/spec/current-spec.md`も現行Builderの追加/select/dismissとToday3/Wishlist inline追加を記載しており、P61-04で実装後の契約へ更新する。
- Guideの入口、dialog focus、目次、responsive構造は維持する。Do NowをToday3専用に説明しない。

## テスト置換計画

- `tests/visual/phase6-main.spec.ts`の「Builder saves above five, paginates, deletes...」は、Project/Wishlist source限定、5件pagination、stable order、source非破壊、dismiss非適用のtestへ置換する。
- `tests/visual/phase6-readiness.spec.ts`のsection add flowは、Today3/Builderにaddがないこと、NextStepはProject dialog、Wishlistは小modalであることへ置換する。
- 既存のToday3 inline add、Builder Project add、Builder row `追加`、dismiss永続化を期待するlocator/testを削除または契約変更する。
- 維持するcoverage: Today3最大3件・完了確定・次batch、timer switch/pause、Project/Wishlistの非破壊`今日へ`、D&D、responsive、Quick/Dictionary。
- 追加するcoverage: 同名別ID、Project本文編集後もidentity維持、旧dismissを無視、Session候補除外、空状態focus移動、Wishlist IME/Enter/Escape/外側click/保存失敗、Guide文言。
- generic `test` / `test:e2e` scriptはなく、既知の前提として`test:visual`を使う。

## 判断が必要なこと

1. **Wishlist stable ID:** P61-01で任意`id` fieldを追加し、既存項目はload時に補完・保存する案を承認するか。これがない場合「同文別項目」と編集後のstable identityは保証できない。
2. **Today3 timer snapshot:** 現行どおり採用後もProjectの現在timer分数を参照するか、採用時分数をToday項目へ保存するか。後者はmodel migrationと既存挙動変更を伴うため、P61-01で無断変更しない。

## 検証

| コマンド | 結果 | 件数/備考 |
|---|---|---|
| `npm.cmd ci` | PASS | 172 packages追加、173 packages監査、脆弱性0 |
| `npm.cmd run public:check` | PASS | 162 files、blocker 0 |
| `npm.cmd run lint` | PASS | warning 0 |
| `npm.cmd run build` | PASS | TypeScript + Vite production build |
| `npm.cmd run test:visual` | PASS | 55/55 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | 差分なし |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | dev profile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS | warning 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 92 unit + 2 capability contract、失敗0 |
| `git diff --check` | PASS | whitespace errorなし |

- Visual QAが再生成したtracked screenshot差分は、製品変更がないため検証前の内容へ戻し、PR対象から除外した。
- 代表Before画像の目視表示はCodex `view_image`がWindows sandbox ACL errorとなり環境BLOCKED。Playwrightの描画・操作・overflow assertion 55件はPASSしている。
- 実Tauri GUI smokeはP61-00で製品変更がなく、実ユーザーデータを触らない制約から未実行。Rust runtime契約は上記testで確認した。

## 停止確認

- P61-01へ進んでいない。
- main merge/pushなし。
- version/tag/Releaseなし。
- Web Demo/Cloudflare/Zenn変更なし。
- 実ユーザーデータ変更なし。
- 次Stageは人間の明示承認までblockedのまま。

`P61-00 COMPLETE — STOPPED FOR HUMAN REVIEW`
