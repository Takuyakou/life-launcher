# P61-04 — 追加改善の総合QAと引渡し

前提: P61-00〜03が人間承認済み。承認したheadが取り込まれていることを確認。
branch案: `chore/p61-04-followup-readiness`。
参照: TEST-MATRIX全体、旧Phase6の基準結果、SPECIFICATION。

## 1. 統合基準の確認

各Stageの承認SHA、現在base、PR dependencyをstateで確認。
未承認commitを黙って混ぜない。未マージstackなら依存順を報告する。
旧P6.3/PR #9の承認・merge状態を再確認し、未解消を隠さない。

## 2. 主な受入項目

- Today3/Builderの新規＋追加なし。
- Builderの勝利条件等のselectなし、削除/dismissなし。
- NextStep/Wishlistの候補参照、二重登録DBなし。
- 元source側とBuilder側の今日へが同じ採用契約。
- 旧dismissで候補が取り出せなくならず、元データ/履歴は消していない。
- Wishlistは小さいmodal、NextStep詳細フォームの能力は維持。
- Guideと現物が一致し、ユーザーへ内部階層の暗記を要求しない。
- Today3完了は満了後の終了確定。3列・次の3件・identity・rollback維持。
- Quick/辞書/Explorer権限境界とキーボード操作の回帰なし。

## 3. 実行するQA

TEST-MATRIXの全実在コマンドと、追加したFLOW/DATA/FORM/GUIDE/KEEP試験を実行。
APIやnative呼出のmockで分かる範囲と、実Tauriで確認した範囲を分ける。
本体の実操作が必要なら既存の隔離環境を使い、ユーザーの使用中アプリを止めない。

Before/Afterは同fixtureで比較。新しい挙動と無関係な表示退行を分離。
既存55件のうち仕様廃止で置換したものを一覧化し、無関係coverageの脱落を確認する。
追加の安全検査・画像目視を行う。生ログ/個人pathを報告・PRへ出さない。

発見したbugは本Scopeの局所回帰だけ修正して再試験。
汎用保存層や推薦モデルの全面再設計が必要ならBLOCKEDとして別判断を求める。

## 4. 最終資料

`docs/phase6.1/workreports/P61-04-report.md`の1枚にまとめる。

- 適用元report・base・検証commit・PR一覧/依存順
- 実装した追加差分、維持したPhase6機能
- Today3/Builderの操作マトリクス
- 旧dismiss/旧Today3/Sessionの互換テスト
- Guide照合表
- 自動試験の実行コマンド/件数/結果
- Before/After代表画像への参照
- 現物確認できていない事項、既知課題、人間判断
- mergeする場合の順序案（実行しない）

`execution-state.json`は最終Stageの`WAITING_HUMAN_APPROVAL`にする。
全自動ゲートが通っても、製品Release許可をtrueにしない。

最終判定:
`PHASE 6.1 READY FOR HUMAN REVIEW — STOPPED`
または
`PHASE 6.1 BLOCKED — STOPPED`

## 5. この後は別指示

main統合、versionを1.1.0へ上げる作業、release notes、配布EXE/Installer/ZIP、
tag、GitHub Release、Web Demo追従、README/Zenn公開内容の変更は今回実行しない。
追加改善の完了と、v1.1の公開完了を混同しない。
