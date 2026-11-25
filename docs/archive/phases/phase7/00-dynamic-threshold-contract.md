# P7.0 Dynamic Threshold Contract

Status: audit complete; P7.1 implementation requires human approval.
Baseline: `978474564b0ab2b9002b387057e6eaa684027301` (v1.1.0, schema 2).
This document distinguishes current behavior from the approved-for-review design.

## 現行データ

| 項目                 | 現行契約                                                       | 根拠                                              |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Project短時間設定    | `shortTimerMinutes`: optional integer, 1..240分                | `src/types.ts` ProjectSchema                      |
| Today3採用時snapshot | `today.items[].shortTimerMinutes`: 同じ範囲、optional          | TodayItemSchema                                   |
| 全体設定             | 整数1..240分、既定5分                                          | SettingsSchema / Rust Settings                    |
| Rust保存モデル       | Project/Todayは `Option<u32>`、全体は `u16`                    | `src-tauri/src/models.rs`                         |
| 採用時コピー         | candidateのshort/default分数をTodayItemへコピー                | `src/App.tsx` candidate生成 / addCandidateToToday |
| 起動時補完           | 欠落・0・241以上は関連Project、なければ全体設定から補完        | `config.rs::normalize_today_item_timer_snapshots` |
| 記録最小時間         | frontend実効経過60秒、分数はfloor、60秒未満は記録しない        | `App.tsx::sessionMinutes / finishTimer`           |
| backend記録          | `record_session` はminutes > 0のみ追加。実測秒の再検証ではない | `commands/sessions.rs::record_session`            |

JSONのnullはRustのOptionではNoneになり得るが、frontendのZod optionalはnullを拒否する。
負数・文字列・小数などu32に変換できない値は数値範囲補完とは別のdeserialize/validationエラー。
`missing/invalid -> 5分`は**既存migrationを変更する指示ではない**。
例えば旧データのsnapshot欠落 + Project短時間3分は起動時に3分へ補完済みになる。
有効なsnapshotはProject変更後も保持する。既存RustテストとP7追加テストで確認。

## P7.1へ渡す判定式（本PRでは未実装）

```ts
const snapshot = item.shortTimerMinutes;
const shortMinutes =
  typeof snapshot === "number" && Number.isInteger(snapshot) && snapshot >= 1 && snapshot <= 240
    ? snapshot
    : 5;
const thresholdSeconds = Math.min(5, shortMinutes) * 60;
```

最小設定1分とSession最小1分が一致するため追加のmax下限は不要。
Projectの現在値をこの式のfallbackに使用しない。normal snapshotも閾値には使わない。
有効な1/2/3/5/10分の閾値は60/120/180/300/300秒。
生の欠落・null・0・負数・小数・範囲外・非数値は防御的に300秒。ただし通常は読込検証/補完を経由する。

表示条件はmanual stop AND incomplete Today3へ一意に対応 AND
`elapsedSeconds >= thresholdSeconds && elapsedSeconds < activeTimer.targetMinutes * 60`。
予定時間以上は既存planned flowを優先する。閾値到達だけでは何もしない。
短時間3分で開始して3分到達ならearlyではなくplanned。延長後は延長済みtargetMinutesを使う。

## 経過時間

`App.tsx::timerMetrics` は既存Date.nowベースの計算。
`floor(max(0, now - startedAtMs - pausedTotalMs - currentPauseMs) / 1000)`。
現在のpauseと過去のpauseは除外。Sessionはこの秒をさらに60で割ってfloorする。
判定にSessionの丸め済みminutesや新しいclockを使わない。
非pause中のOS suspend/壁時計の前進は経過に含まれる。これは操作時間/アイドル時間の検知ではない。
次段階の「wall clock禁止」はpauseを無視した別時計を導入しない趣旨として扱う必要がある。
OS suspend自体の除外までを意味するなら現行契約と異なるため、実装前の追加確認が必要。
後退は負値を0に抑える。今回の自動確認はclock jumpであり実OS suspendの実測ではない。

## TimerとToday3の対応

| 起動経路                 | 現行source                   | P7 early判定に必要な契約                                                           |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------- |
| Todayカード              | `today:${sourceKey}`         | sourceKeyで対象1件へ直接一致                                                       |
| Do Now / stale短時間開始 | Project.id                   | `project:${id}` の採用済み未完了1件へ一致                                          |
| 未採用ProjectのDo Now    | Project.id                   | early対象なし、Sessionのみ                                                         |
| Project紐づけWishlist    | `today:wishlist:${stableId}` | Wishlist直接一致を優先、同じProjectの別採用を巻き込まない                          |
| D&D後                    | sourceKeyを保持              | 配列indexでなくsourceKey。legacy fallbackはindex依存のため正規化済みidentityを使用 |

現行 `finishCompletedTimer` は直接一致 **OR** Project一致で全一致itemを完了にする。
同じProjectのWishlistとProject採用が併存すると複数を完了にし得る。
P7.1でこのplanned挙動を無断変更しない。early側は対象1件への対応を明確にし、共通化で挙動差が出るなら報告する。

## 終了処理・リスク

現行manual/switchは `finishTimer`、予定時間で「終わる」は `finishCompletedTimer` 経由。
sidebar、Do Now、Todayカード、mini終了イベントはmanualへ入る。
switchは明示的にreason="switch"。P7ではearly質問を出さない。

| 観点           | 現行確認                                                   | P7.1の必要事項                                        |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| 保存失敗       | Timerを先に消しSession失敗はToastのみ                      | pending/失敗時の復旧を設計し、成功完了と誤表示しない  |
| planned保存    | persistConfigのfalseでもthenでSession記録/停止             | booleanを成功扱いしない。既存仕様を変更する範囲を明示 |
| stale callback | sourceIdだけで終了対象照合。再開始した同sourceを区別しない | Timer instance/start identityで古い要求を拒否         |
| 連続開始       | timerStartRequestRefで古いstartの反映を抑止                | finish/recordの一度だけ実行も別途保証                 |
| 二重終了       | finishTimerに終了済みclaim/idempotencyなし                 | handler側同期guard、二重Session防止                   |
| 延長           | React stateだけtarget+15、activeTimerRefは更新していない   | 判定時に最新state/refの一貫性を確認                   |
| ダイアログ待機 | planned表示中も経過時計は進む                              | early要求時の実効秒を固定する案を実装レビューで確定   |

これらはP7.0でのコード監査指摘。競合や保存失敗の全組合せを再現済みとは主張しない。
P7.1の自動テストと実Tauri確認が必要。今回timer/sessionの製品処理は変更しない。

## 確認UI

共通 `src/components/ConfirmDialog.tsx` は左affirmative・右cancel、初期focus cancel、
Tab trap、Escapeでcancel、openerへfocus復元、処理中disable、失敗表示を備える。
React stateのprocessing guardなので同一tickのhandler多重呼出しまでの保証はない。
planned timerはこの共通Dialogとは別実装で左「続ける(+15分)」右「終わる」。

P7ではタイトル「今日の分は完了にしますか？」、左「今日の分は完了」、右「未完了のまま終了」。
右初期focus。cancelは単なるdismissではなく未完了終了の処理が必要なので、ラベル交換だけで流用しない。
P7.1指示はEscape=current confirm convention。現在はcancelへ送るため、右操作との対応と
pending stateの寿命を実装前に明記する。backdropは既定では閉じない。

## 非目標

80%判定、自動完了、source-level完了、Session削除、2/3補充、auto-refill、batch変更、
Web変更、version/tag/Release/EXE作成は行わない。現行Guide/current-specもこの監査では変更しない。

関連: [状態表](00-state-matrix.md) / [データ影響](00-data-impact.md) / [報告](workreports/p7-00-report.md)
