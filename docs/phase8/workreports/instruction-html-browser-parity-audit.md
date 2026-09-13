# 手順書HTML表示 改修前監査

日付: 2026-09-13。基準commit: `228e7bea3e430df8337f332e7613c482f5811416`。

## 現行経路

1. Rustの`read_instruction`が登録済み手順書ルート内の`.html`を最大2 MiB、UTF-8、read-onlyとして返す。
2. Reactの`InstructionViewer`が`renderSafeHtml`を通し、`sandbox="allow-same-origin"`の`iframe srcDoc`へ渡す。
3. DOMPurifyはscript/form/iframe/objectに加え、`base`、`meta`、`link`、`img`も除去する。
4. iframeは幅960px上限、左右padding、枠線とshadowを持つ。
5. 外部起動はOSの既定アプリへ委譲するが、UIは一律「既定のエディタで開く」と表示する。

## 崩れの主因

- 外部stylesheet、画像、font参照が除去される。
- `srcDoc`に元HTMLの基準URLがないため、相対URLを元ファイル位置から解決できない。
- viewport幅がアプリ側で960pxに制限され、通常ブラウザと異なるresponsive breakpointになる。
- 文書の`meta viewport`が失われる。

## 維持する安全境界

- HTMLは登録済み手順書ルート内、2 MiB以下、UTF-8だけを読む。
- iframe分離を維持し、`allow-scripts`、`allow-forms`、`allow-popups`は追加しない。
- script、event handler、form controls、nested iframe、object/embedは除去する。
- リモートCSS・画像・font・通信はiframe内CSPで拒否する。
- 相対asset用のTauri scopeは、既存検証を通った登録済みルートだけに限定する。
- Markdown/Textの表示・編集経路は変更しない。

## 実装方針

- 読み取り時に検証済みrootだけをTauri asset protocolへ再帰許可する。
- 元HTMLの親directoryを`convertFileSrc`し、安全な`base`としてsanitized documentへ挿入する。
- `style`、相対stylesheet、相対画像、相対fontを許可し、iframe内に追加の厳格CSPを置く。
- HTML iframeをcontent pane全面へ広げ、ブラウザと同じviewport幅で描画する。
- 直接Chromium表示とアプリiframe表示のgeometry/computed style/asset loadを比較する。