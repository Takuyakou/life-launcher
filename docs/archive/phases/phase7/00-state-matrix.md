# P7.0 State Matrix

現行: planned未満の手動停止はToday3を完了にしない。
P7予定: 未完了Today3へ一意に対応するmanual stopだけがearly確認の対象。
earlyは本段階未実装。以下の予定列を現行動作のPASSと混同しない。

| short / planned (分) | 実効経過 | 閾値秒 | 現行停止         | P7予定      |
| -------------------- | -------- | ------ | ---------------- | ----------- |
| 3 / 25               | 2:59     | 180    | 未完了・2分記録  | 未完了終了  |
| 3 / 25               | 3:00     | 180    | 未完了・3分記録  | early確認   |
| 3 / 25               | 24:59    | 180    | 未完了・24分記録 | early確認   |
| 3 / 25               | 25:00    | 180    | planned確認      | planned優先 |
| 5 / 25               | 4:59     | 300    | 未完了・4分記録  | 未完了終了  |
| 5 / 25               | 5:00     | 300    | 未完了・5分記録  | early確認   |
| 5 / 25               | 24:59    | 300    | 未完了・24分記録 | early確認   |
| 5 / 25               | 25:00    | 300    | planned確認      | planned優先 |
| 10 / 25              | 4:59     | 300    | 未完了・4分記録  | 未完了終了  |
| 10 / 25              | 5:00     | 300    | 未完了・5分記録  | early確認   |
| 10 / 25              | 24:59    | 300    | 未完了・24分記録 | early確認   |
| 10 / 25              | 25:00    | 300    | planned確認      | planned優先 |
| 3 / 3                | 2:59     | 180    | 未完了・2分記録  | 未完了終了  |
| 3 / 3                | 3:00     | 180    | planned確認      | planned優先 |

上記14ケースは `tests/visual/phase7-audit.spec.ts` で現行UI/API呼出しを検証する。
plannedは時間到達だけで記録/完了せず、既存「終わる」を選んだ後に完了/記録する。

| その他の状態            | 現行 / P7契約                                |
| ----------------------- | -------------------------------------------- |
| 59秒停止                | Sessionなし、Today3未完了                    |
| 60秒停止                | Session1分。short1ならP7 early対象になり得る |
| pause中に10分待つ       | pauseは実効経過に加算しない                  |
| resume                  | 停止期間を除外し継続、時計は作り直さない     |
| suspend相当の壁時計前進 | pause以外は経過へ加算（OS実機試験は別）      |
| 閾値通過だけ            | P7でも自動完了/質問なし                      |
| switch                  | early質問なし、前TimerのSession確定          |
| stale/二重callback      | 現行保証は不十分、P7 handler guard必須       |
| 同source採用済みDo Now  | P7でそのToday3だけ候補、未採用なら対象なし   |
| 既に完了Today3          | early対象なし                                |
| short1/2/3/5/10         | 閾値60/120/180/300/300秒                     |
| runtime missing/invalid | 閾値300秒。起動時補完との区別は契約書参照    |
| Project変更             | snapshotと閾値は変わらない                   |
| 3/3完了                 | 「次の3件を選ぶ」を人間が押す。自動補充なし  |
| 2/3完了                 | 次batch CTAなし。自動補充なし                |
| 空きslot                | 自動補充なし。候補を人間が採用               |

batch基準は既存 `phase6-readiness.spec.ts` のactiveCount/completedCount/manual next batchで検証。
D&D/採用解除の永続化とidentityは既存 `today3-remove.spec.ts` 等も全実行する。
