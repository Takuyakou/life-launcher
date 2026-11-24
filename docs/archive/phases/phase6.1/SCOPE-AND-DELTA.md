# Phase 6.1 — 報告書の事実と追加差分

## 1. 入力資料

一次資料: `reference/phase6-final-report.md`（ユーザー提供、内容を変更せず同梱）。
このパッケージ作成時にはリポジトリのソースやPRを新たに監査していない。
以下の「現在」は**報告書時点**の状態であり、P61-00で現物と照合する。
元報告書内の相対リンクは製品repoの元配置を前提とし、付属報告書が全部同梱されている意味ではない。

## 2. SOURCE_FACT: 基準

| 項目 | 報告書の値 |
|---|---|
| 元基準commit | `1b0459d3f0b637e2aad4143429a6ea304effe917` |
| 最終実装commit | `74f4a9608f3b5e2ef857f580db45dd0abbe270bf` |
| 最終branch | `chore/p6-03-v11-readiness` |
| 最終PR | #9、P6.3は`WAITING_HUMAN_APPROVAL` |
| P6.0 / P6.1 / P6.2 | `APPROVED` |
| 製品version | `1.0.0`のまま |
| 未実施 | P6.3のmain merge、version変更、tag、release binary生成、Release公開 |

## 3. SOURCE_FACT: 完了済みで今回作り直さないもの

報告書§4〜§8より:

- Main順: 勝利条件 → 今やる一手 → 今日の3件 → 今日を組み立てる → 次の一手 → やりたいこと → 今日の実行。
- Today3はTimer満了**後の終了確定**で完了。手動停止・切替では完了にしない。
- stable source identity、3件完了後だけ次batch、履歴保持、3→2→1列。
- BuilderはもともとProject/Wishlist/Session等からの派生。独立の登録DBではない。
- 候補打切りの真因は**5件保存上限ではなく8件のrender打切り**。既に撤廃済み。
- Builderは全候補・5件ページング・dismiss永続化・page clamp/reload復元済み。
- NextStepはタイマーなしcompact list。NextStep/Wishlistの今日へは元データを残すcopy。
- duplicate/3件制限feedback、保存失敗時rollback。
- Quick/辞書のExplorer表示、Rust側のIDから再解決、対象制限、権限追加なし。
- 辞書の座標ベース矢印移動・カテゴリ選択色・context menu keyboard操作。
- Today3カード密度、Project色border、完了数表示、辞書初期focus等のレビュー修正。

## 4. SOURCE_FACT: 新要件と変わる箇所

報告書§6では以下が実装済みになっている。**旧実装の失敗ではなく、今回の追加設計で置き換える。**

| 報告書時点 | Phase 6.1での変更 |
|---|---|
| Builder headerの＋追加、詳細Project dialog | Builderから新規作成する入口を撤去 |
| NextStepも詳細Project dialog | 設定能力は維持。見出し/作成対象を分かりやすくする |
| Wishlist header追加＋行内入力 | 行内入力を小さい登録モーダルへ |
| Builder上の削除＝dismiss、元source不変 | 新しい参照ビューでは削除/dismiss操作を出さない |
| BuilderはSession等も候補源 | 今回の候補源はNextStep/Wishlistに絞る提案。Sessionは消さない |

Today3の＋追加の正確な残存箇所、Builderプルダウンの実際の役割・選択肢、
Guideのファイル位置/現行記述は総合報告書だけでは確定しない。P61-00で調べる。

## 5. APPROVED_CHANGE: 会話で合意した追加方針

1. 登録は主にNextStep/Wishlist。上のToday Builder/Today3は作成ではなく選択・実行。
2. Today BuilderとToday3の新規＋追加を取り除く。
3. Builderで勝利条件等を選ぶプルダウンを取り除く。行の採用先はToday3。
4. Builderは元候補を参照する画面。別の自由入力候補プールを増やさない。
5. Builderで元データの編集/削除をしない。元データはNextStep/Wishlistで管理。
6. sourceの「今日へ」からToday3へ直接入れる近道は残す。
7. 下から上への「昇格」は内部モデル。ユーザーに理解・暗記を要求しない。
8. Wishlistの追加方式をNextStepと同じモーダルの操作文法へ。
9. Guide / 使い方も実装後の流れに更新。

## 6. PROPOSAL: 今回採用する詳細の第一案（P61-00で確認）

- Builder候補は、設定済みProject.nextStepとWishlistから導出。
  Session由来の独立候補はBuilderから除外するが、他の履歴表示/候補機能を消さない。
- Builderで複数選択checkboxを新設せず、既存の行ごとの`今日へ`を使う。
- 旧dismiss値は初期化/一括削除せず、新しいBuilder候補への適用を止める。
- Wishlistは既存の本文1項目だけを必須入力にする。新規のメモ列やProject項目は足さない。
- NextStepの追加がProject作成ならdialog名を`プロジェクトを追加`等へ整える。
  メイン見出しの`次の一手 ＋追加 件数 説明`は維持し、登録内容の補足で理解を助ける。
- Today3空状態には`今日の候補を見る`という**移動リンク**を置く。
  候補自体が0なら下の登録元へ案内。上段から新しいフォームを生やさない。
- 次batch開始後の案内はBuilderへ。旧Today3追加dialogを開く経路を残さない。

これらは現行実装の断定ではない。互換上の問題があればP61-00で代案と理由を示す。

## 7. NEEDS_CODE_CHECK: 特に勝手に決めない点

- `今日を組み立てる`のselectは候補「source」ではなく送付先選択かもしれない。
  実際のhandler/optionを調べる。単語だけの検索置換をしない。
- `今やる一手`の推薦対象・優先順は今回変更しない。
  会話の概念図を根拠に「Today3だけから推薦」「Today3を必ず優先」へ変えない。
- Today3のラベルsnapshot、元項目更新との連携、active batch内重複、日付境界は既存contractを照合。
- 旧dismissの保存場所・スキーマ・日付スコープは不明。実コードで確定する。
- Wishlist編集/追加の共通部分、文字数制約、IME対応、保存失敗UIは既存実装を読む。
- Guideが同一コンポーネント内か別ファイルか、多言語かは現物を確認。

## 8. 変更しない／撤回する古い指示

- 「Builderを5件以上保存できるDBにする」は撤回。既に派生し打切りも撤廃済み。
- 「Today3/Builderの＋追加を他と統一する」は今回撤回。上段の新規入力自体を削る。
- 「Builderから右クリック削除」は今回撤回。参照ビューからは削除しない。
- 「全セクションの登録フォームを同一にする」はしない。下段2種類のみ操作文法を共通化。
- 「0秒になった瞬間Today3完了」とはしない。報告書の満了後の終了確定を維持。
- 旧P6.1の3列/次batch/Explorer/辞書実装のやり直しは行わない。
- old v1.0への巻き戻し、実データreset、Do Now推薦再設計は対象外。

## 9. テストの基準（実行済みと称して再利用しない）

報告書の値: `test:visual` 55/55、Rust 92 unit + 2 capability contract、
`public:check` 145 files/0 blockers、PR #9 Actions PASS。
これらは**過去の報告値**。今回の変更後には再実行し、新しい結果を記録する。
`test`/`test:e2e`が存在しないことも報告済み。TEST-MATRIX.mdの実在入口を使う。
