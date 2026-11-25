# P62-00 UI Action Map

## Today層

| Surface | Primary action | Context menu | Phase 6.2の責務 |
|---|---|---|---|
| NextStep | 追加・編集 | 上へ、下へ、編集、完了にする、削除 | 登録とsource管理。常設`今日へ`は置かない |
| Wishlist | 追加・編集 | 上へ、下へ、編集、完了にする、削除 | 一時置き場とsource管理。常設`今日へ`は置かない |
| Today Builder | `今日へ` | 上へ、下へ、今日の候補から外す | 自動派生候補から今日の3件を選ぶ唯一の場所 |
| Today3 | 短時間開始、通常開始 | 上へ、下へ、削除 | 今日のactive execution。最大3件 |
| Do Now | 推薦を短時間/通常開始 | 既存動作 | 迷ったときの開始経路 |

### Builder layout

- page sizeは5件を維持する。
- ページ内のNextStepとWishlistをgroup化し、存在するgroup見出しだけ表示する。
- source labelを各行で繰り返さない。
- NextStep行はProject色・名称、本文、`今日へ`を表示する。
- Wishlist行はneutral identity、本文、`今日へ`を表示する。
- 長文はbuttonを押し出さず折返しまたは省略 + titleで補完する。
- 0/1/5/6/10/11/50件、mixed source、860/1366/1440/1920で横overflowを出さない。
- D&Dのghost、黄色挿入線、pointermove非保存、drop-only保存を維持する。

### Candidate exclusion

- Builder行の右クリックへ「今日の候補から外す」を追加する。
- active timer対象ならdisabledにし、理由をtitleまたはstatusで伝える。
- 除外後はBuilderから即時に消え、同sourceのToday3も消える。
- NextStep/Wishlist登録とToday Activity/Recordsは残る。

## source completion / delete

### 完了確認

```text
完了にしますか？

「対象本文」

この項目は今後の候補から外れます。
これまでの実行記録は残ります。

[キャンセル] [完了にする]
```

- default focusはキャンセル。
- `完了にする`はdangerではなく明示完了のsemanticを使う。
- Escape/backdropはキャンセルし、起点へfocusを戻す。

### 削除確認

```text
削除しますか？

「対象本文またはProject名」

この登録を削除します。
完了としては記録されません。

[キャンセル] [削除]
```

- `削除`はdanger styling。
- NextStepではProject登録削除であることを本文に明記する。
- active timer中は完了・削除の両方をdisabledにする。

## Quick / Dictionary

| 操作 | field変化 | 保持するもの |
|---|---|---|
| Sidebar「辞書に移動」 | `showInSidebar=false`, `showInOverlay=true` | button ID、actions、group、overlayPage、dictionaryOrder、Project参照 |
| Dictionary「サイドバーに移動」 | `showInSidebar=true`, `showInOverlay=true` | Dictionary表示、actions、overlayPage、dictionaryOrder、Project参照 |

- DictionaryからSidebarへ移す際のgroupは現行互換とし、dictionary page名があれば同名group、なければ既定groupを使う。
- Dictionaryに残る仕様でもラベルはPhase 6.2指示どおり「サイドバーに移動」とする。
- 移動操作は削除の直前にseparatorで分ける。
- 保存失敗時は表示所属とgroupをrollbackする。
- mouse右クリックとkeyboard context menuで同じ項目・disabled状態を提供する。

## Start Environment Picker

### 対象

- Project追加/編集
- Wishlist編集
- Today3は採用時snapshotを使い、直接Pickerを置かない。

### collapsed summary

```text
開始環境  2 / 2

[icon  選択済み項目  ×]
[icon  選択済み項目  ×]

[開始環境を選ぶ]
```

### picker

- dialog title: `開始環境を選ぶ`
- tab: `すべて` / `サイドバー` / `辞書`
- search対象: label、Sidebar group、Dictionary page、aliases
- row: 実icon/favicon、label、group/page、選択状態
- 新規選択上限: 2件
- Enter/Spaceでtoggle、Escape/backdropで破棄、保存/キャンセル後にopenerへfocus return
- 860pxでdialog全体をviewport内に収め、候補部分をscroll可能にする。

### order / legacy

- `buttonIds`の配列順をlaunch orderとして維持する。
- 選択解除は残りの相対順を変えず、新規選択は末尾へ追加する。
- Picker内D&Dは追加しない。
- 既存3件以上は表示・保存・起動時にtruncateしない。上限超過中は追加だけを無効にし、解除は可能にする。
- dialogを変更せず閉じた場合、未知IDを含む既存配列を勝手に書き換えない。

## Records copy freeze

実ロジックに合わせ、P62-04では次を使う。

| 見出し | muted説明 |
|---|---|
| 動かしたプロジェクト | 先週のセッションに記録されたプロジェクト |
| 今週の重点 | 今週優先して進めるプロジェクトを最大3件まで選びます |
| 鮮度レビュー | 次の一手を14日以上更新・確認していないプロジェクト |
| 完了した項目 | 今後の候補から外した、完了済みの項目 |

「動かしたプロジェクト」はmanual sessionも含むため「タイマーで実行した」とは書かない。「鮮度レビュー」はSession最終実行日ではなくNextStep更新/確認時刻が基準である。
