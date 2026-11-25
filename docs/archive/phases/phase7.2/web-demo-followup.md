# Web Demo Phase 7.2 Follow-up

確認日: 2026-09-10。Web repository: `Takuyakou/life-launcher-web`。確認SHA: `9212c0c6e126e9dba4d268543f6d248b559bf8bf`。

この文書はWindows本体Phase 7.2との差分記録である。Web repositoryの変更、merge、deployはこのPhaseでは行わない。

## 現在Webへ反映済み

- NextStep / WishlistをToday Builderの「今日へ」でToday3へ採用する中心フロー。
- stable source ID、同文Wishlistの別項目扱い、localStorage保存。
- Today3の「今日の3件から外す」。元source、候補、Sessionを保持し、対象Timer中は拒否する。
- 採用済み短時間snapshotを使う動的早期完了。肯定だけToday3を完了し、否定でもSessionを残す。
- 初期状態でToday Builderを展開する。

## Phase 7.2未同期

| 本体 | Webの現状 | Follow-up |
| --- | --- | --- |
| P72-01 除外済みsourceの「今日の候補に戻す」 | 登録元の共通context menuなし | stable identityで候補だけ復帰し、Today3へ自動採用しない |
| P72-01 Builder / Today3 / 登録元の共通source編集 | Builder編集menuと本体同等editorなし | Webの簡略Project/Wishlist modelに合わせ、同期対象を先に定義する |
| P72-01 右クリック・…・keyboardの同一menu | 本体同等menuなし | pointer/keyboard双方の到達性を実装する |
| P72-02 右下Toast、8秒Undo、pause、最大3件queue | 短い通知のみ。Today解除Undoなし | localStorageの最新stateへ対象差分だけ戻すUndoを追加する |
| P72-03 6〜19件展開、20件以上10件page | Demoは小さい固定seed向けの全件表示 | 0/1/5/6/19/20/21/30/100境界とfocus clampを追加する |
| P72-03 Today3 Timer B2幅 | Web独自のレスポンシブ寸法 | 本体のlabel/色を保ちつつWeb viewportで比較する |
| P72-04 Builder→Today3 / 除外source→Builder D&D | READMEでD&D非対応を明記 | dropだけ保存、失敗rollback、preview、500ms展開をWeb用に実装する |
| P72-05 勝利・Today個別・3/3・Do Now完了演出 | 静的完了表示のみ | 保存成功イベントだけで短い演出を出し、reload/Undoでは再発火しない |
| reduced-motion / event重複抑止 | P72演出自体なし | 本体と同じ優先順位と非操作overlay契約を適用する |

## Web固有差分を維持するもの

- Explorer、実アプリ/ファイル/URL起動、Tauri window/capability、手順書、バックアップは再実装しない。
- Webのタイマーはデモ用時間短縮を持ち、Session丸めもWindows本体と異なる。この差はUIで明示する。
- backend、認証、analytics、外部APIを追加せず、合成データとlocalStorageだけを使う。

## 同期時の最低Gate

- reducer/storage migrationのunit test。
- Today解除・候補復帰・Undo・D&Dのsource保持、保存回数、rollback test。
- 1440 / 860 / 390px、長文、keyboard、reduced-motion、horizontal overflow 0のVisual QA。
- 本体のexact labelを維持しつつ、Windows専用機能を実行できるようには見せない。
