# ResolverDialog ヘッドレス E2E テスト整備ノート

## 背景
- `packages/node-type/resolver-plugin/src/components/ResolverDialog.tsx` は `@hierarchidb/ui-dialog` の `HeadlessMultiStepDialog` を直接利用するようになりました。
- 暫定対応として `describe.skip` されていた `ResolverDialog.e2e.test.tsx` を再有効化し、実装と同じコンポーネント構成でモックを撤去しています。
- テストは `import.meta.env.MODE === 'test'` でのみ公開される隠しコントロール（`aria-label` に `Next` / `Complete` / `Cancel` を付与）を利用し、ヘッドレスダイアログのステップ遷移とコミットを検証します。

## 前提条件
- ResolverDialog のテスト対象は HeadlessMultiStepDialog のレンダリング結果であり、MUI テーマが必要です。テストでは `ThemeProvider` + `createTheme()` で包んでいます。
- `entity` フィクスチャを渡し、名前・スキーマなどの必須項目が事前に埋まっている状態を作ることで Save ボタンが有効になります。
- `DuplicateResolutionStep` などで利用するプロパティは JSON 文字列／配列のモック値で十分です。外部 API コールは行われません。
- `console.error` のハンドリングを追加していないため、失敗時にはテスト出力を確認して原因調査を行ってください。

## 実行手順
- パッケージローカルでの検証
  - `pnpm --filter @hierarchidb/resolver-plugin test -- --run`
- ワークスペース全体での検証が必要な場合
  - `pnpm -w test -- --filter resolver-plugin`

## ロールバック手順
- テストを一時停止する場合は `packages/node-type/resolver-plugin/src/components/__tests__/ResolverDialog.e2e.test.tsx` を `describe.skip` に戻し、タスク管理（TASKS.md）のチェックリストを更新してください。
- HeadlessMultiStepDialog 側の API 変更でテストが壊れた場合は、このノートを参照して隠しコントロールやフィクスチャの更新箇所を特定し、再調整してください。

## メモ
- 将来的に MultiStepDialog の UI 側に Playwright 由来のシナリオを取り込む際は、本テストを最小統合テストとして維持しつつ、E2E で補完する想定です。
- スキーマ入力テキストのバリデーションを強化した場合は、`working` フィクスチャの JSON 文字列が新しい制約を満たしているか確認してください。
