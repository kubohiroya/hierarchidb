目的
- CIにwarn-onlyのポリシーチェック（check-deps / dependency-cruiser / syncpack / publint / attw）を追加し、依存・公開物・アーキの問題を一覧化。
- appの型を引き締め（as any/unknown削減、render型の厳密化、shims.d.ts削減）し、型安全性を底上げ。
- runtime-workerにNode先行の統合テスト（fake-indexeddb）を追加して、Undo/Redo等の代表フローを回帰担保。

変更概要
- CI: `.github/workflows/policy-checks.yml` 新規（警告のみ・失敗しない）
  - 実行順: `pnpm -w check:deps:pkg` → `pnpm -w arch:dc` → `pnpm -w deps:list` → `pnpm -w pkg:publint` → `pnpm -w pkg:attw`
- 型引き締め:
  - TreeConsole系: `onContextMenuAction(action: string, node: TreeNodeData)` に統一、ハンドラ/呼出しを型安全化
  - Loader/初期化/Router: any/unknown撤去、RouteObject安全キャスト、Worker terminateの整備
  - TrashDialog/Converter: render引数の具体型化（unknown撤廃）、`common-type`に統一
  - shims.d.ts: `@hierarchidb/common-core`等を削除し縮小（UI/Bootstrap系は最小宣言のみ維持）
- テスト: `packages/runtime-worker/worker/src/e2e/__tests__/undo-redo.headless.test.ts` を追加（create→rename→move→undo×2→redo×2）
- TASKS.md: CIタスク/テスト戦略の更新

背景 / 理由
- 依存ポリシー・公開物・型の品質を可視化し、段階的にゼロ警告へ向けて運用可能にするため。
- as any/unknownやshimsの恒常化を避け、将来的にパッケージ側で型公開するための地ならし。
- UIのE2Eはコストが大きいため、まずNode（fake-indexeddb）で機能回帰を担保し、その後UIはスモークで確認する方針。

受け入れ基準（DoD）
- `pnpm --filter @hierarchidb/app typecheck` がグリーン（routesの一時excludeなし）。
- runtime-workerのheadlessテストが実行できる（sandboxではEPERM終了あり。CIではパッケージフィルタで合格確認）。
- `.github/workflows/policy-checks.yml` が各チェックをWARNのみで実行（ログに一覧化）。
- 新規差分にas any/unknownの恒常化がないこと（diff検索で0）。

ロールバック手順
- CI: 当該workflowを無効化/削除。
- 型引き締め: 変更前へ戻す（ただしshims再拡大は推奨せず、必要箇所のみ最小化）。
- テスト: 追加E2E/ヘッドレスファイルを削除。

実行ログ（ローカル参考）
- typecheck: appグリーン。モノレポは一部パッケージ未インストールに起因するWARN/ERRORあり（CIで順次是正）。
- headless: undo/redo シナリオ追加（EPERMは終了時の既知現象）。
- policy checks: check-depsはskipLibCheckやpeer整合などの違反を検出（WARN運用で落とさず早期可視化）。

フォローアップ
- UIパッケージで型公開を進め、`app/src/types/shims.d.ts` を段階撤去。
- `@tanstack/provider-query` の正式型導入（または置換）で shim 撤去。
- runtime-worker bootstrap の型公開（`WorkerInitializationChannel` 等）。
