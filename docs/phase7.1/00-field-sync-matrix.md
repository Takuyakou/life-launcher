# P71-00 Field Sync Matrix

根拠: src/types.ts:118 (TodayItemSchema)、src/App.tsx:630/655 (候補生成)、5820 (採用)。

| Field / data | 分類 | 正式な同期方針 |
| --- | --- | --- |
| text | resnapshot | Project.nextStep / Inbox.text のtrim値 |
| trigger | resnapshot | Project.nextStepTrigger。Wishlist schemaにはないので除去 |
| projectId | resnapshot | Project.id / Inbox.projectId。紐づけ解除ならfield除去 |
| buttonIds | resnapshot | source自身の選択ID配列をclone。空なら除去 |
| instructionPath | resnapshot | source自身の値。解除なら除去 |
| instructionOpenOnStart | resnapshot | pathあり時のboolean。pathなしなら除去 |
| defaultTimerMinutes | resnapshot | Project値→global、Wishlistは関連Project値→global |
| shortTimerMinutes | resnapshot | 同上。次の開始/早期完了基準へ適用。実行中は禁止 |
| sourceKey | Today固有・保持 | editor解決に使用し、通常保存で置換しない |
| done | Today固有・保持 | falseへ戻さず、trueへ勝手にしない |
| today.itemsの配列位置/個数 | Today固有・保持 | 並べ替え・追加・除去・max3変更なし |
| today.date / victory / 候補除外等 | Today固有・保持 | nextConfig構築時に既存値維持 |
| projectsのid / inboxのid | source identity保持 | 編集で作り直さず、indexではなくIDで保存 |
| Project.name / colorId | sourceのみ | Todayにsnapshot fieldなし。描画はprojectIdで現在Project参照 |
| Project.northStar/weeklyFocus/startNoteTemplate | sourceのみ | TodayItemに対応fieldなし。新fieldを追加しない |
| nextStepUpdatedAt/ReviewedAt | sourceのみ | nextStep変更時の既存timestamp契約を維持 |
| LauncherButton.actions | 別source・不変 | Todayには実actionsのコピーなし。buttonIdsから開始時に解決 |
| Session / 今日の実行 | history不変 | 記録の更新/削除/追加をしない |
| sourceCompletionHistory / notes | history不変 | source編集を完了・削除へ読み替えない |
| ActiveTimer全field | 実行中不変 | 対象source編集中saveを拒否して保持 |

Today3全保存fieldは先頭10行。独立Today ID / batch ID / projectName/color snapshot / action payload snapshotは現モデルに存在しない。
再snapshotを `{...old, ...candidate}` だけで済ませると、解除された任意fieldが残る。実行fieldを明示的に置換し、Today固有fieldだけ保持すること。
legacy/orphanを解決するためのschema変更・migrationはこの監査では行わない。
