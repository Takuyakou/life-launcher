# 手順書HTML表示 改善作業報告

日付: 2026-09-13。基準commit: 228e7bea3e430df8337f332e7613c482f5811416。

## 1. 実装結果

- ウィンドウ名、document title、空状態名を「手順書ビューワー」へ統一した。
- HTML表示時の外部起動を「ブラウザで開く」とし、上部アイコンとツリー右クリックを同期した。
- Markdown/Textは実態に合わせて「既定のアプリで開く」とした。
- HTML iframeの960px上限、外側padding、枠線、shadowを外し、本文領域全体をHTML viewportにした。
- 元HTMLのdocument/head、meta viewport、inline style、CSS variablesを保持する。
- 相対stylesheet、画像、CSS url()、font URLを元HTMLの親フォルダー基準で解決する。
- asset protocolへ追加する範囲は、既存のpath検証を通った登録済み手順書rootだけとした。
- Markdown/Textの表示、編集、保存、競合検知には変更を加えていない。

## 2. Browser parity

同じfixtureを直接Chromium表示した場合と、Life Launcherのsanitized iframeで表示した場合を比較した。

| 項目 | 結果 |
| --- | --- |
| doctype / document / head / body | PASS |
| meta viewport | PASS |
| inline style / CSS variables | PASS |
| relative external stylesheet | PASS |
| relative image / CSS background image | PASS |
| flex / grid / table | PASS |
| absolute positioning | PASS |
| responsive breakpoint | PASS |
| 長い日本語 / 特殊文字 | PASS |
| iframe全幅 / horizontal containment | PASS |

1366 x 768と860 x 720で、iframe実viewportと同じ幅の直接Chromium baselineを使い、computed styleとgeometryを比較した。wideは3列、narrowは1列へ同じ条件で切り替わる。

目視では、HTML本文がcontent pane左上から全幅で表示され、アプリ側CSSの混入、余分な白枠、text/button overlap、horizontal overflowがないことを確認した。

## 3. Security

維持または追加した境界:

- sandbox="allow-same-origin"を維持し、scripts/forms/popupsは許可しない。
- script、event handler、form controls、nested iframe、object、embedを除去する。
- iframe専用CSPでscript、connect、media、object、frame、worker、formを拒否する。
- リモートstylesheet、画像、font、CSS url()、CSS @importを除去または拒否する。
- Playwrightで外部hostへのrequestが0件であることを実測した。
- 相対assetはTauri asset protocolと登録済みroot scopeの両方を通る。
- 登録root外、UNC、traversal、reparse point、hard link、2 MiB超、binary、非UTF-8の既存拒否を維持する。
- npm auditは全依存、production-onlyともに0 vulnerabilities。
- public:checkは300 files、0 blockers。

## 4. Test

| Gate | 結果 |
| --- | --- |
| HTML browser parity / security | 3 / 3 PASS |
| npm.cmd run test:visual | 202 / 202 PASS |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS |
| cargo fmt --check | PASS |
| cargo check | PASS |
| cargo clippy --all-targets -- -D warnings | PASS |
| cargo test | 99 unit + 2 capability PASS |
| npm audit --audit-level=low | PASS |
| npm audit --omit=dev --audit-level=low | PASS |
| npm.cmd run public:check | PASS |
| git diff --check | PASS |
| tauri build --no-bundle | PASS |

Native release binaryはbuild確認だけに使用し、配布物や確認用EXEの更新は行っていない。

## 5. 意図的な差分と残存懸念

- JavaScript依存UI、form、nested frame、remote assetは安全性のためブラウザと同じ動作にはしない。
- inline SVG/MathML、video/audioは従来どおり表示対象外。
- 存在しない相対assetや、登録root外へ出る相対pathは読み込めない。
- 実ファイルごとのCSS差異はあり得るため、問題HTMLがあればfixtureへ追加して比較可能。
- version、tag、GitHub Release、Web Demoは変更していない。