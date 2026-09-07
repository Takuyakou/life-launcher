# P62-00 Data Lifecycle Specification

## 用語とidentity

ユーザー向けUIでは「source」「派生」「昇格」という内部語を表示しない。内部契約だけを次で固定する。

| 種類 | active条件 | stable identity |
|---|---|---|
| NextStep | Projectが存在し、`nextStep.trim()`が空でない | `project:{projectId}` |
| Wishlist | `inbox`にstable ID付き項目が存在する | `wishlist:{wishlistId}` |

旧Wishlist同文keyは読み込み互換のaliasに限定し、新しい除外・履歴にはstable identityだけを書く。

## 追加する後方互換model

```ts
type SourceType = "nextStep" | "wishlist";

type SourceCompletion = {
  id: string;
  sourceType: SourceType;
  sourceIdentity: string;
  textSnapshot: string;
  projectId?: string;
  projectNameSnapshot?: string;
  completedAt: string;
};

type Today = {
  date: string;
  victory: TodayVictory;
  items: TodayItem[];
  candidateExcludedSourceKeys?: string[];
};

type AppConfig = {
  // existing fields...
  sourceCompletions?: SourceCompletion[];
};
```

- Rustは`serde(default)`、TypeScriptはdefault empty arrayとして旧configを受け入れる。
- config versionとProduct versionは変更しない。
- exclusionはtrim、重複除去、active sourceとの照合を行う。日付切替でclearする。
- completion snapshotは作成後にsource編集や削除で書き換えない。
- completion historyはPhase 6.2で任意件数を保持し、表示時に`completedAt`降順とする。

## 状態表

| 状態 | source active | candidate | Today3 | 今日完了 | source completed | source deleted |
|---|---:|---|---|---:|---:|---:|
| 登録直後 | Yes | included | なし | No | No | No |
| `今日へ`後 | Yes | included / 選択済み | active snapshot | No | No | No |
| Timer満了後に終了確定 | Yes | included / 選択済み | completed snapshot | Yes | No | No |
| `今日の候補から外す` | Yes | excluded（当日のみ） | 同sourceを除去 | No | No | No |
| 翌日 | Yes | includedへ復帰 | 前日Today3は日次reset | No | No | No |
| `完了にする` | No | 対象外 | 同sourceを除去 | 既存Sessionは保持 | Yes | No |
| `削除` | No | 対象外 | 同sourceを除去 | 既存Sessionは保持 | No | Yes |

Today3の`done`とsource完了は別状態である。Today3完了からsource完了を自動実行しない。

## 操作契約

### 今日へ

- sourceを残したままToday3へsnapshotを追加する。
- stable identityの重複と3件上限を拒否する。
- 本文、Project、trigger、button IDs、手順書、短時間/通常分数を採用時に固定する。
- 保存失敗時はToday3表示をrollbackする。

### 今日の候補から外す

- `candidateExcludedSourceKeys`へstable identityを追加する。
- 同じidentityまたはlegacy aliasのToday3 itemを同じconfig saveで除去する。
- NextStep/Wishlist登録と既存Sessionは変更しない。
- 同日reload/restartで維持し、`dayStartHour`基準の次の日に自動復帰する。
- confirm dialogは不要。保存失敗時は候補とToday3を両方rollbackする。

### 完了にする

- confirm必須。default focusはキャンセル、Escapeはキャンセル、多重submitを防ぐ。
- NextStep: Projectは保持し、`nextStep`と`nextStepTrigger`を空にする。Project共通の開始環境、手順書、timer、色、北極星、重点は保持する。
- Wishlist: 対象stable IDの項目を`inbox`から除去する。
- 同sourceのToday3と日次除外keyを除去する。
- source変更と`sourceCompletions`へのsnapshot追加を1回のconfig saveで行う。
- 保存失敗時はsource、Builder、Today3、履歴表示をすべてrollbackする。

### 削除

- confirm必須。完了とは文言とdanger stylingを分ける。
- NextStep行の削除は既存どおりProject登録そのものを削除する。
- Wishlistは対象stable IDの登録を削除する。
- 同sourceのToday3と日次除外keyを除去する。
- `sourceCompletions`へ追加しない。過去のcompletion historyも削除しない。
- SessionはProjectが消えても既存label snapshotで表示できるため保持する。

## active timer guard

source比較用に、現在の`ActiveTimer.sourceId`を次のように正規化する。

- Do NowのProject timer: `projectId` → `project:{projectId}`
- Today3 timer: `today:{todayItem.sourceKey}` → `todayItem.sourceKey`

除外・完了・削除は、対象stable identityまたは有効なlegacy aliasがactive timer identityと一致した場合に無効化する。buttonのdisabledだけでなくhandlerでも再検査し、短いfeedbackとして「タイマーを停止してから操作してください」を表示する。

## 履歴とSessionの境界

| データ | 意味 | 保存先 |
|---|---|---|
| Session | 実際にタイマーまたは手動登録で実行した記録 | 既存Session JSONL |
| Today3 done | その日の実行枠で完了確定した状態 | `today.items[].done` |
| Source completion | 今後の候補から明示的に外した完了項目 | `config.sourceCompletions` |
| Delete | 登録誤り等の除去 | 履歴を新規作成しない |

source completionはSessionの存在を要求しない。Session編集・削除でもcompletion snapshotを変更しない。

## migration / integrity tests

- 旧configに追加fieldがなくても空配列で読み込める。
- 旧dismiss値をcandidate exclusionへ変換しない。
- 同文Wishlistをstable IDで別々に完了・除外できる。
- completed snapshotはsource編集/削除後も不変。
- complete/delete後も既存Sessionが残る。
- active timer中は3操作をhandlerでも拒否する。
- 日付切替、同日reload、保存失敗rollbackを自動testで固定する。
