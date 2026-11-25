# Phase 8.1 / Stage 04 作業報告（内部ID: P81-04）

## 結果

Main上でProject追加とNextStep操作を分離する入口・context menu実装が、現在のPhase 8.1作業ツリーに存在することを確認した。

状態: `COMPLETE_AWAITING_REVIEW`

## 実装済みの内容

- 「次の一手」見出しの既存追加位置に、黄色の`＋ プロジェクト`を配置した。
- Project追加操作はaccordionの開閉と独立している。
- Project行をProject領域とNextStep領域へ分け、それぞれpointer、focus、右クリック、keyboard contextの対象にした。
- Project領域のmenuは「プロジェクトを編集」「やりたいことを追加」「プロジェクト管理」。
- NextStepありのmenuは「次の一手を編集」「今日へ」「次の一手を空にする」。
- NextStepなしのmenuは「次の一手を設定」。
- NextStep未設定は警告色を使わない中立表示。
- 「プロジェクト管理」は重複画面を作らず、既存のProjectセクションを開いて表示位置へ移動する。

## 操作契約

「今日へ」はToday Builderと同じ3件上限・source identity・snapshot保存を利用し、現在NextStepのgenerationをToday snapshotへcopyする。「次の一手を空にする」は確認後に現在NextStepだけを空にし、Project、採用済みToday3 snapshot、Session、source completionを維持する。

## 実装根拠

- `src/App.tsx`
- `src/styles.css`
- `tests/visual/phase8-entry-forms.spec.ts`
- `tests/visual/dashboard-disclosure-context.spec.ts`
- `tests/visual/phase6-main.spec.ts`

## 検証状態

Phase 8.1の最終full gateで、context menu、keyboard、focus復帰、各viewportの関連回帰がPASSした。
