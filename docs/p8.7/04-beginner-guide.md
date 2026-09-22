# P8.7-04 Beginner-Friendly Guide

判定: PASS

## Changes

- Guide冒頭を「3分で使ってみる」にし、Project作成から記録確認までを5段階で案内する構成へ変更した。
- Project / NextStep / Wishlist / Today3 / Do Nowを、作曲の具体例を使って初心者向けに説明した。
- Today Picker、短時間・通常・計測Timer、開始環境、手順書ビューアー、Quick、辞書、記録の使い分けを日常フローに沿って整理した。
- Backup / ZIP復元 / Software Resetと、ユーザーファイル本体を削除しない契約を簡潔に説明した。
- よく迷う操作をFAQへまとめ、tray常駐を含む終了動作も説明した。
- 既存Guide dialogのTOC、章移動、focus、keyboard、narrow layoutは維持した。
- ユーザー向け表記を「手順書ビューアー」へ統一し、current specも同じ10章構成へ同期した。

## Beginner review

初回利用者がGuideだけを読み、次の流れを実行できる構成になっている。

1. プロジェクトを作る。
2. 次の一手を決める。
3. 今日の3件へ選ぶ。
4. 5分で始める。
5. 終了後に記録を見る。

## Files

- `src/content/helpGuide.ts`
- `tests/visual/phase8-guide-sync.spec.ts`
- `docs/spec/current-spec.md`

## Verification

- `npm run lint`: PASS
- `npm run build`: PASS（既存chunk size warningのみ）
- Guide focused Playwright: 8 passed / 0 failed
- `git diff --check`: PASS

対象Playwright:

- `tests/visual/phase61-guide.spec.ts`
- `tests/visual/phase62-records-guide.spec.ts`
- `tests/visual/phase8-guide-sync.spec.ts`

## Verdict

初心者が最初のProjectを作り、Today3へ選び、Timerを開始するまでの説明が具体的な手順として成立している。仕様列挙中心だったGuideを、最初の3分と日常利用を軸にした説明書へ更新した。
