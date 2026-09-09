# Today3 採用解除 作業報告

## 対象

本体 `Takuyakou/life-launcher`、base `e59612b`。
ブランチ `fix/today3-remove-action`。Web Demo、Quick、Dictionary、Rust、Timer仕様、batch条件は変更しない。
HTMLモックは配置の参考だけに利用し、既存React・CSS token・保存処理で実装した。

## 変更

- `src/App.tsx`: カード左下と右クリックに「今日の3件から外す」。下部右側のTimerを維持。
- `src/styles.css`: ghost actionと折り返し可能なfooter。既存Project color・font・border・focus-visibleを使用。
- `tests/visual/today3-remove.spec.ts`: 8試験を追加。
- `docs/spec/current-spec.md`: Today3解除仕様を更新。

解除はstable source keyで最新configから対象を解決し、Today3だけを変更する。source・候補除外一覧・Sessionには書き込まない。
旧データのsource key未設定項目は、残るカードのindex由来の現在識別子を保存し、前方カードの解除によるactive timerの紐付け変化を防ぐ。
active timerは最新refでも確認し、ネイティブdisabledの迂回や古いcallbackからの呼び出しも拒否する。paused、満了確認中もactive timer保持中は同じ扱い。
保存は既存persistConfigのoptimistic更新とrollbackを利用。成功時だけ短いToastを表示し、確認ダイアログは出さない。

## 完了済み項目

現行の右クリック削除は完了済みToday3にも許可されていたため、同じ範囲で採用解除を提供する。
3件全完了時だけ次batchを表示する条件は変更しない。完了項目を外すとbatchボタンは非表示になり、空き枠へ採用できる。元sourceは完了扱いにしない。

## 検証

- `npm.cmd run lint`: PASS
- `npm.cmd run build`: PASS
- `npm.cmd run test:visual`: **108 PASS**（既存100＋追加8）
- 追加試験: NextStep/Wishlist/候補/Sessionの保持、reload、UIおよびReact handler直接呼出時のguard、paused、他カード解除、停止後解除、保存失敗時のsnapshot/order復元、完了済みbatch、旧データidentity保持。
- 既存Today3 D&D試験: ghost/黄色線、pointermove中保存なし、drop時1回保存、失敗時rollbackを含めPASS。
- Visual QA: 1440px 3列 / 1000px 2列 / 860px 1列。長文、hover、focus-visible、running disabledを撮影・目視確認。footerのoverflow・操作同士の重なりなし。
- 出力は `dist/visual-qa/test-results/today3-remove-*`。既存資料の画像再生成分はコミットしない。

## 残存懸念・境界

自動UI試験は既存Tauri mockを使用し、実TauriウィンドウでのsmokeとEXE再生成は未実施。Rustとnative保存APIは変更していない。
同じProjectからDo Nowを開始した場合は、Today3由来のtimerとは異なる既存source IDを維持する。今回のdisabledは対象Today3のtimer source一致に基づく。
既存persistConfigの並行保存制御自体は今回のscope外で、保存契約を変更していない。
mainへのマージ、Web Demoへの反映は行わず、報告して停止する。
