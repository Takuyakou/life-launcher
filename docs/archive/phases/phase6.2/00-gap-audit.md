# P62-00 Current Main Gap Audit

## 基準

- 監査日: 2026-09-07
- 監査対象main: `a6d17d1f0b29a533764c168aeac6a93ea137c722`
- Phase 6.1実装統合SHA: `53d2919494a5198280feb19fb5090d9fb1ee1c1f`（上記mainの履歴に含まれる）
- Product version: `1.0.0`（変更しない）
- このStageでは製品コードを変更せず、Phase 6.2の差分とデータ契約だけを固定する。

## 監査結果

| 領域 | 現在の実装 | Phase 6.2で固定する差分 | Stage |
|---|---|---|---|
| Today Builder | NextStepとWishlistをsource-onlyで派生。5件/page。候補は平坦な行で、各行にsource名を表示 | source別group見出し + compact row。ページ内に存在するgroupだけ表示 | P62-01 |
| `今日へ` | Builder、NextStep、Wishlistの3か所に常設 | Builderだけに残し、NextStep/Wishlistから削除 | P62-01 |
| 候補除外 | 旧dismiss値はlocalStorageに残るが、表示filterにも新規書込にも使わない | stable source identityの日付内除外を新設。旧dismissは移行しない | P62-01 |
| Today3 | stable `sourceKey`、採用時の本文/環境/手順書/分数snapshot、最大3件 | 候補除外・source完了・source削除時の連動解除とactive timer guardを追加 | P62-01/02 |
| source lifecycle | Today3完了とsourceのactive状態は分離済み。ただし明示的なsource完了と履歴はない | `完了にする`と`削除`を分離し、明示完了だけ履歴化 | P62-02 |
| Records | Session、前週集計、今週の重点、鮮度レビューを表示 | source完了履歴を追加し、見出しへ事実に即したmuted説明を付ける | P62-02/04 |
| Quick/Dictionary | `showInSidebar`と`showInOverlay`の独立bool。Dictionaryには「サイドバーに追加」がある | Sidebarに「辞書に移動」、Dictionaryは「サイドバーに移動」へ。削除と分離 | P62-03 |
| Start Environment | Project/Wishlist編集のraw checkbox。`buttonIds`配列順で起動。schema上限なし | 共通Picker、検索、source tab、実icon、選択summary。新規選択上限2件 | P62-03 |
| Guide/spec | Phase 6.1の「3か所に今日へ」「Builderに削除なし」を記載 | Phase 6.2の実動作へ同期 | P62-04 |
| Web Demo | BuilderはToday3のpreviewで、候補追加はToday3下。NextStepカードにtimer開始あり | 登録元→Builder→Today3の中心導線へ同期。native-only機能は入れない | P62-05 |

## Current mainの具体的事実

### Today層

- Project source identityは`project:{project.id}`。
- Wishlist source identityは`wishlist:{item.id}`。旧同文keyは最初の一致項目だけaliasとして扱う。
- Today3 timer identityは`today:{sourceKey}`。Do NowからのProject timerは`project.id`そのものを`sourceId`に使う。
- Builderの並び順は`life-launcher-today-builder-order`へ保存する。
- 旧`life-launcher-today-builder-dismissed`はテストで保持を確認するだけで、現在の候補算出へ使わない。
- Today3のplanned completionはToday itemだけを完了し、Project.nextStepやWishlistを変更しない。

### Records

- Sessionは`SessionLogEntry`として別ファイルへ保存され、`projectId`、label、日時、分数、note、manualを持つ。
- 「動かしたプロジェクト」は前週のSessionをProject IDまたはlabelで集計する。manual sessionも除外しない。
- 「今週の重点」は`Project.weeklyFocus`で、最大3件。
- 「鮮度レビュー」は、`nextStepReviewedAt`を優先し、なければ`nextStepUpdatedAt`から14日以上経過したProjectを対象にする。Session最終実行日ではない。
- source完了履歴に相当するmodel、command、UIはない。

### Quick / Dictionary

- Sidebar表示は`showInSidebar !== false`、Dictionary表示は`showInOverlay !== false`。
- Dictionaryの現行「サイドバーに追加」は`showInSidebar=true`にし、Dictionary page名をSidebar groupへ流用する。`showInOverlay`は維持する。
- Sidebar側にはDictionaryへ移す操作がなく、編集dialogで2つのboolを直接変更する必要がある。
- ボタン削除はProjectの`buttonIds`参照も除去する。表示所属の変更はactionやProject参照を削除してはならない。

### Start Environment

- 保存先はProjectおよびWishlistの`buttonIds`。Today3採用時に配列をsnapshotする。
- Rust migrationは旧単数`buttonId`を配列末尾へ移し、空白と重複を除去する。配列順は保持する。
- 起動時は`buttonIds`順に各Launcher buttonのactionsを展開するため、配列順がlaunch orderである。
- 現行TypeScript/Rust/JSON Schemaに件数上限はない。現在の編集UIは既知buttonだけをcheckboxで表示する。

## Phase 6.2で固定する判断

1. 日次候補除外は`today.candidateExcludedSourceKeys`としてconfigへ保存する。日付切替時にToday items/victoryと一緒にclearする。
2. 旧dismiss storageは意味が異なるため移行せず、読み書きしないまま保持する。
3. source完了履歴はSessionと分離した`sourceCompletions`配列としてconfigへ保存する。source変更と履歴追加を1回のconfig saveでatomicに確定する。
4. NextStepの`完了にする`はProjectを残し、nextStepとnextStep固有triggerを空にする。Projectの色、開始環境、手順書、timer設定は保持する。
5. NextStepの`削除`は現行互換としてProject登録を削除する。Sessionは保持し、完了履歴は作らない。
6. Wishlistの完了はactive inboxから除去して履歴化し、削除は履歴を作らず除去する。
7. active timerに対応するsourceの除外・完了・削除はUIとhandlerの両方で拒否する。
8. Start Environment Pickerの新規選択上限は2件。既存の3件以上は自動truncateせず、順序と起動を維持する。
9. Pickerでの追加は末尾、解除は残りの相対順を維持する。新しいD&D並べ替えは追加しない。

## blocker

P62-01開始を妨げる未解決の仕様矛盾はない。各変更は既存schemaへ後方互換なoptional/default fieldを追加して実装できる。
