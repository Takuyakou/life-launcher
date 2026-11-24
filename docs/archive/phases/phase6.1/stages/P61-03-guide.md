# P61-03 — Guide / 使い方と仕様の同期

前提: P61-01/02承認済み。
branch案: `docs/p61-03-in-app-guide`。
参照: GUIDE-UPDATE.md、TEST-MATRIXのGUIDE。

## 実施順

1. 実際の最新Guideを再読し、P61-00で特定したファイル/入口を確認。
2. 登録→今日へ→開始の最短ルートと、Builder経由の選別ルートを現物で追う。
3. GUIDE-UPDATEの文章を、確定したUI label・完成動作に合わせて反映。
4. Today3/Builderの＋追加、送付先select、dismiss、Wishlist行内登録の古い説明を置換。
5. 今日の3件の完了は「満了後の終了確定」とし、manual stop/継続と区別。
6. 次の3件、source保持、5件pagination、空状態、旧dismiss候補再表示を必要範囲で説明。
7. Do Nowの現行条件・NextStepの登録対象を正確に記す。
8. 既存のQuick/辞書/Explorer/手順書の正しい説明は保ち、古い場合だけ修正。
9. current-specにも同じ事実を反映し、Guideの説明に対応するテストを記録。

## 更新の境界

対象はアプリ内Guideとcurrent-spec。文章修正で必要なcomponent変更は許可。
Guide専用の新機能、強制tutorial、新FAQ system、Web Demo改修はしない。
同じrepoに複数言語のGuideが既存なら意味を揃える。新たな翻訳基盤は不要。
公開v1.0.0のREADME/Releaseを未公開v1.1の説明へ先行変更しない。

## 検証

- Guideへ記載した手順を既存Playwrightで実行可能にする。
- 見出し・内部リンク・折りたたみ・focus・スクロール・狭幅を確認。
- `Guide claim → source → automated test`の対応表をworkreportへ。
- 最新コードにない操作を、サンプル文のまま残さない。
- lint/build/public checkと関連browser試験。

## 完了報告

変更したGuide節、除去した旧手順、実装照合の証拠表、匿名画像、実行テスト、
未確認事項を記録。Guide内容から不要な業務用タスク管理・昇格モデルの教程を除く。

PR作成後STOP。P61-04で統合回帰する。
