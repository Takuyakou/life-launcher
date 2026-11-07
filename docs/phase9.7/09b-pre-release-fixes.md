# P97 リリース前修正（E・F）報告

- 日付: 2026-11-07
- ブランチ: `fix/p97-pre-release`（`main` = `3fbd8fb` から）
- 判定: **DONE**（自動ゲート済み）

> このチェックアウトには A〜D のブランチと報告が無かったため、`main` から `fix/p97-pre-release` を作り直し、E・F だけを入れています。A〜D は含まれていません。

## 実装内容の要約

MHTMLの組み立て中に、元のHTMLの大きさへ画像のdata URLと埋め込むCSSの大きさを足していき、上限を超えた時点で `outerHTML` を作る前に `MhtmlError("too-large")` で止めるようにした。JSONの取り出しは、かっこの中にいるときだけ `"` で文字列を切り替えるようにし、JSONより前の説明に `"` が1つだけあっても取り出せるようにした。`undo_import()` も `commit_import()` と同じく、自分の書き込みの前に設定の読み直しを抑止するようにした。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src/mhtml/assembleMhtml.ts` | 組み立て中の大きさの積み上げと、上限を超えた時点での `too-large`。画像のdata URL、埋め込むCSS、既存の `<style>` / `style` 属性の増分を数える。最後の `outerHTML` の確認は残す |
| `src/importJson.ts` | 文字列の切り替えを `depth > 0` のときだけにした。JSONより前の説明の `"` では文字列に入らない |
| `src-tauri/src/commands/import.rs` | `suppress_reload_for_own_write()` を追加し、`commit_import()` と `undo_import()` の書き込み前に呼ぶ。単体テストを1件追加 |
| `tests/visual/phase97-mhtml.spec.ts` | 大きい画像1つを500回参照する組み立てで、`outerHTML` を読む前に `too-large` で止まることを確認するテストを追加 |
| `tests/visual/phase97-import.spec.ts` | JSONより前に `"` が1つだけある説明から取り出せることを追加 |
| `docs/phase9.7/09b-pre-release-fixes.md` | この報告 |

## E. MHTMLの組み立て中に上限を確かめる

### 直したこと

- `assembleMhtml()` の最初に、元のHTML（`result.html`）のバイト数を数える。
- 画像を `data:` URL に置き換えるたびに、そのdata URLのバイト数を足す。足した時点で上限を超えていれば、`src` を書き換える前に `MhtmlError("too-large", "MHTMLを展開すると大きすぎます")` を投げる。
- `<link rel="stylesheet">` を `<style>` に埋め込むときは、埋め込むCSS全体のバイト数を足す。足した時点で上限を超えていれば、`<style>` をDOMに入れる前に投げる。
- 元からある `<style>` と `style` 属性は、書き換えで増えた分（書き換え後のバイト数 − 書き換え前のバイト数）を足す。CSSの中の `url()` がdata URLに置き換わった分もここで数える。
- 最後に `outerHTML` を作ったあとの確認は残している。積み上げは「元のHTML＋置き換えで増える分」の控えめな見積もりなので、最後の確認はそのまま必要。
- 上限を超えた時点で関数を抜けるため、`outerHTML` は作られない。500回参照・100KBの画像・上限150KBのテストでは、2回目の置き換えで止まる。

### テスト

`tests/visual/phase97-mhtml.spec.ts` に「assembly stops before outerHTML when the running size exceeds the limit」を追加した。

- 100,000文字のbase64画像1つを、500個の `<img src="cid:big">` から参照する。
- 上限は150,000バイト。元のHTML（約15KB）＋1回目（約100KB）は下回り、2回目で超える。
- `Element.prototype.outerHTML` の getter を差し替えて読まれたかを見る。
- 結果は `code === "too-large"` かつ `outerHtmlRead === false`。直す前は最後の確認まで `outerHTML` を作るため、このテストは失敗する。

## F. 取り込みの小さな直し

### F-1. 説明文の `"` でJSONを取り出せなくなる

- `src/importJson.ts` の走査を、`depth === 0` のときは `{` だけを見るように変えた。`depth > 0` のときだけ `"` で文字列の中かを切り替える。
- これで、JSONより前の説明に `"` が1つだけあっても、その `"` では文字列に入らず、JSONの `{` から候補を読める。
- `tests/visual/phase97-import.spec.ts` の取り出しテストに、`説明に " が1つだけあります。` のあとにJSONを置くケースを追加した。

### F-2. `undo_import()` の書き込みで設定を読み直さない

- `src-tauri/src/commands/import.rs` に `suppress_reload_for_own_write()` を追加した。`suppress_reload_until` に「今から900ms」を入れる。
- `commit_import()` は今までと同じ処理をこの関数に置き換え、`undo_import()` も `write_config()` の直前に呼ぶようにした。取り消しの書き込みでも、自分の書き込みによる設定の読み直しは起きない。
- 単体テスト `own_import_write_suppresses_reload` で、呼んだあとに `suppress_reload_until` が未来の時刻になっていることを確認した。

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm run lint` | 成功（0エラー、0警告） |
| `npm run build` | 成功 |
| `npm run public:check` | 成功（3,648ファイル、0 blockers） |
| `cargo fmt --check` | 成功 |
| `cargo check` | 成功 |
| `cargo clippy --all-targets -- -D warnings` | 成功 |
| `cargo test` | 158 unit + 1 capability = 159件成功 |
| `npm run test:visual` | 642件成功（2.6分） |
| `git diff --check` | 成功 |

## 判断メモ

- Eの積み上げは、最終的な `outerHTML` の正確なバイト数ではなく「元のHTML＋置き換えで増える分」の控えめな見積もりにした。上限の手前で早めに止まることが目的で、最後の正確な確認は残している。
- `<link>` のCSSは元のHTMLに含まれていないため、埋め込むCSS全体を足す。元からある `<style>` と `style` 属性は、増えた分だけを足す。
- 画像の `srcset` を外す分や、置き換えで消える元の `src` の分は引いていない。安全側に倒している。
- F-1は、JSONの外の `"` を無視するだけで、JSONの中の文字列の扱いは変えていない。JSONより前に `{` がある場合は、その候補が壊れていれば従来どおり取り出せない（指示の範囲外）。
- F-2の900msは `commit_import()` と同じ値。書き込み後の設定監視の読み直しをまたぐための既存の値に合わせた。

## 提案

- A〜D を別のブランチで進めている場合は、このブランチに合流させたうえで、報告の A〜D の節を足す。
- MHTMLの実機確認は、大きい画像を多数参照する実ファイルでも一度行うとよい（自動テストはDOMの組み立てだけを確認している）。
