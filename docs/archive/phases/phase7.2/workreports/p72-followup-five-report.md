# Phase 7.2 実装後 追加5点修正 作業報告

日付: 2026-09-10。作業branch: fix/p72-followup-five。基準main: 06aee5f8c34657acbf2e6cfdcc3db5d4ed3d222a。

## 1. 実装結果

1. Today3本文クリックによるinline editを撤去した。本文はcard D&Dの掴み面として扱い、編集経路は右クリックとhover / focus時の「…」から開くPhase 7.1共通source editorへ限定した。長文のtitleは維持した。
2. Toast下端indicatorを左から右へ0% -> 100%で進む表示へ変更した。通常4秒、Undo付き8秒、error 8秒、hover / focus / document hidden時のpause/resume処理は変更していない。
3. sidebar Timerの大きい待機分数を上下dragで変更可能にした。上で増加、下で減少し、下段入力と同じdraft、1〜240分clamp、drop時saveを共有する。clickだけでは変更せず、running / paused中はhandler、title、ns-resizeを付与しない。
4. 右下ToastをVisual Reference「B. Warm Rich」に合わせた。外枠はneutral、左accentは上下10px空けた3px rail、surfaceは既存token由来のwarm dark、radius 11px、34pxのsoft icon badge、title/detail、任意Undo、closeの階層にした。
5. D&Dは既存6px thresholdを超えた直後、有効な移動先をpointer到達前から表示するようにした。明示除外sourceはBuilder bar / drop zone、採用可能なBuilder候補はToday3を強調する。実target hover時だけ強調を上げ、既存のdrop indicator / insertion previewを表示する。

## 2. 原因

- Today3本文がbuttonとlocal inline-edit stateを持ち、pointerdownを停止していたため、card bodyからD&Dを始められなかった。
- Toast indicatorのkeyframeがscaleX(1) -> scaleX(0)で、残り時間表現になっていた。
- 大きいTimer clockは表示専用で、下段inputが使う既存number drag handlerへ接続されていなかった。
- Toast toneが外枠全体へ適用され、iconも円形だったため、参照のneutral frameとshort accent railの視覚階層になっていなかった。
- cross D&Dの強調状態が「pointerがtarget上にあるか」と結合しており、drag開始後の有効target guidanceを表現できなかった。

## 3. 保存・回帰契約

- pointerdown / threshold未満 / pointermove / guidance表示ではsave_configを呼ばない。
- 永続変更は既存のdrop handlerだけで行い、日付、stable source identity、重複、Today3上限、active Timerをdrop時にも再検証する。
- Today3 / Builderの順序保存、保存失敗rollback、source snapshot、Session、candidate exclusion、Undo処理は変更していない。
- Builder所属済み、Today3満杯、重複、対象source Timer実行中ではdestination guidanceを出さない。
- custom previewはproject color / project name / actionだけに絞り、buttonやhelperは含めない。

## 4. 変更ファイル

- src/App.tsx
- src/components/TimerPanel.tsx
- src/styles.css
- tests/visual/phase6-main.spec.ts
- tests/visual/phase72-cross-dnd.spec.ts
- tests/visual/phase72-followup-five.spec.ts
- docs/phase7.2/workreports/p72-followup-five-report.md

## 5. 追加テスト

phase72-followup-five.spec.tsへ10件を追加した。

- Today3 body clickでeditorが開かず保存0回、4pxでpreviewなし、8pxでD&D開始、右クリック / 「…」から共通editorが開く。
- 大きいTimer clockのclick無変更、上下drag、下段input同期、drop前保存0回、drop後1回保存、running / paused無効。
- 除外sourceのBuilder guidanceが6px超過後だけ即時表示され、target未到達ではhover強調にならない。
- Builder所属済みsourceでは復帰guidanceなし。
- 採用可能なBuilder候補ではToday3 guidanceあり、target未到達ではinsert markerなし。
- Today3満杯、重複、active TimerではToday3 guidanceなし。
- Toastのneutral border、11px radius、34px icon、10px rail inset、0% -> 100% keyframe、Undo 8秒 / 通常4秒、右下配置、横overflow 0。
- 100 / 125 / 150% DPI相当で主要controlとToastがviewport内に収まる。

既存cross D&Dテストには、実target到達後のBuilder hover強調、active drop zone、Today3 target強調を追加した。旧本文buttonを前提にしたPhase 6テストは、非編集text要素の内容検証へ更新した。

## 6. Visual QA

- 1440x900: Warm Rich Toast、Today3 3列、D&D開始直後のBuilder guidance、compact previewを画像確認。
- 860x900: Toastの右下配置、card / actionの折返し、横overflow 0を画像確認。
- 1920 / 1000 / 860: 既存cross D&Dの実drop geometry、insert marker、save-on-dropを自動確認。
- 100 / 125 / 150% DPI相当: viewport containmentと横overflow 0を自動確認。
- hover / focus / document hidden pause、queue最大3件、long text、running / paused guardも既存suiteで再確認。

## 7. 検証結果

| Gate | 結果 |
| --- | --- |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS |
| 追加follow-up tests | 10 / 10 PASS |
| 関連Phase 7.1 / 7.2 tests | 37 / 37 PASS |
| npm.cmd run test:visual | **248 / 248 PASS** |
| Rust fmt | PASS |
| Rust check | PASS |
| Rust clippy -D warnings | PASS |
| Rust tests | 103 unit + 2 capability PASS |
| git diff --check | PASS、既存生成JSONの改行warningのみ |

## 8. 残存事項

- PlaywrightのDPI確認はChromium deviceScaleFactorによる100 / 125 / 150%相当であり、実Windowsの複数monitor間DPI切替そのものではない。
- OS native tooltipの表示遅延は自動検証対象外。title付与とrunning / paused時の不付与は自動確認済み。
- Rust、schema、dependency、Tauri capability、version、tag、Release、配布assetは変更していない。
- 本作業はbranch上で完了しており、merge / PR / releaseは今回実施していない。

**IMPLEMENTED AND VERIFIED**
