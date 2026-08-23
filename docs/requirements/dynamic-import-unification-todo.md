# Worker 動的 import 統一 TODO リスト

## 共通準備
- [x] `scripts/codemods/` ディレクトリと README の雛形を作成
- [x] `package.json` に codemod 実行用スクリプト (`pnpm codemod:worker-factory`) を追加
- [x] ts-morph / prettier / eslint を codemod 実行環境として確認

## Phase 1: Runtime 基盤整備
- [x] `WorkerClientProxy` を新規追加 (`packages/runtime/worker/src/client-proxy.ts` など)
- [ ] `WorkerRuntimeProvider` を React Suspense 対応で実装
  - 参考実装: `reference/app0/src/shared/providers/worker-provider`（旧 Suspense 対応）、現行 `app/src/contexts/WorkerProvider.tsx`
  - やること: `WorkerStateStore`/`WorkerModuleLoader` を組み込んだ fallback・エラーハンドリングの再設計とテスト
- [x] `WorkerModuleLoader` を実装し、Proxy から利用
- [x] `WorkerStateStore` を実装し、Proxy から利用
- [ ] 既存 `WorkerAPIClient` を Proxy 経由に書き換え（同期 API は互換レイヤで維持）
  - 参考実装: `reference/packages/worker` の初期化ロジック、`app/src/WorkerAPIClient.ts`
  - やること: 新 Proxy 経由の再試行/エラー伝播を StateStore と整合させる
- [ ] `app/src` のエントリで Provider を採用し、初期化フローを切り替え
  - 参考実装: `reference/app0/src/shared/providers`、`app/src/init` 既存ブートストラップ
  - やること: Suspense 対応 Provider の導入、既存ブートログ/進捗ログの移行
- [ ] Unit/Integration テストを追加 (`ensureInitialized`, state machine)
  - 参考実装: `app/src/worker-runtime/__tests__/workerRuntime.integration.test.ts`（雛形）、`reference/packages/worker/tests`
  - やること: Vitest `EMFILE` 回避策、CI での実行確立

## Phase 2: プラグイン移行テンプレート
- [x] codemod `scripts/codemods/migrate-plugin-worker.ts` を作成（2025-10-25 時点で撤去済み、後継ツール検討中）
  - import 再エクスポート → `load<Plugin>WorkerPeer` へ変換
  - `import type` を追加し、型安全にする
- [ ] folder/resolver プラグインで codemod を試験適用（resolver 完了、folder 未着手）
  - 参考実装: resolver 適用済み差分 (`packages/plugins/resolver-plugin/…`)、`packages/plugins/dialog-impl-status.md`
  - やること: folder plugin への dry-run → 本適用 → typecheck/log 記録
- [ ] Dexie 初期化・VTStoreRegistry 登録処理をファクトリへ集約
  - 参考実装: route/spreadsheet worker (`packages/plugins/*/src/worker/RuntimeWorkerService.ts`)、`reference/packages/plugin-folder`
  - やること: 共通ヘルパー化（loader + VTStoreRegistry）、ModuleLoader からの呼び出し統合
- [ ] 代表プラグインの typecheck/test を実行し記録
- [ ] Location / Timeline plugin: 現状 `load*EntitiesDbModule` が存在せず Dexie preload の対象外。Dexie バックエンド導入方針を決定し、必要であればヘルパーを実装して WorkerModuleLoader に統合
  - 参考実装: shape plugin の Dexie 登録、`reference/packages/plugin-folder` の旧 worker
  - やること: Dexie 利用有無の判断、必要なら loader 追加・ModuleLoader 更新

## Phase 3: 全プラグイン展開
- [ ] `scripts/` 配下のユーティリティ（`package.json` の `dev:*` / `build:*` スクリプト、dep-fence、codemod runner 等）を新しい import/プラグイン構成に合わせて更新（run-env-vite.sh 廃止後のフローで検証）
- [ ] `knip.json` / `knip.*` の未使用判定設定を調整し、新構成のエントリを検出対象に追加
- [ ] 共通ビルド/設定ファイル (`tsup.*`, `vitest.config.ts`, `eslint.config`, `dep-fence.config` 等) を見直し、runtime/プラグイン構成変化に追随
- [ ] プラグイン全体へ codemod を適用（basemap / styler / spreadsheet / route / timeline 等）
  - 参考資料: `packages/plugins/dialog-impl-status.md`（codemod の後継は未決定）
  - やること: 未適用プラグインの洗い出し、dry-run 記録、適用順序の策定
- [ ] 旧再エクスポートの削除と型エクスポート (`worker-public-plugin-definition.ts`) の整備
- [ ] `pnpm -r typecheck` と主要テストスイートを実行
- [ ] `.github/workflows` / `.github/actions` のスクリプトで参照するパッケージ名・パスを新構成へ更新し、CI dry-run を確認
- [ ] 対象 GitHub Issue に各プラグインの移行完了を記録
- [x] Location plugin: `LocationSelectionStep` の `handleMatrixChange` で TODO のままになっている checkboxState 変換ロジックを実装（shape-plugin Step4CountrySelection.tsx の実装を踏襲）
  - 対応: `handleMatrixChange` を matrix 引数付きで実装、選択済みのみを永続化するよう更新（SAMPLE_COUNTRIES / LOCATION_TYPES 準拠）
  - フォローアップ: テスト追加（mock 行列→state）
- [ ] Timeline plugin: `MapPreviewStep` / `AnimationViewerStep` にある placeholder UI（ベースマップ描画なし）を basemap-plugin の preview 実装と同等の機能に置き換える
  - 参考実装: `packages/plugins/basemap-plugin/src/components/BaseMapPreview.tsx`, `reference/app0/src/features/tree-console`
  - 進捗: 両ステップでフレーム／座標情報をオーバーレイ表示するスタイリングを追加（MapIcon + coordinate chip）。今後は `@hierarchidb/ui-map` を用いた実マップ描画とバッチ進捗連携を実装
- [x] Shape plugin: worker entry で Dexie Group/Relation store を自動登録するロジックと `loadShapeEntitiesDbModule` を追加し、route/spreadsheet プラグインと同じ preload パターンに揃える
  - 対応: `packages/plugins/shape-plugin/src/worker/RuntimeWorkerService.ts` に Dexie 登録を実装、`app/src/worker-runtime/WorkerModuleLoader.ts`・`runtime-shared/module-paths` へ shape を追加
  - フォローアップ: テスト拡充とドキュメント整備（Phase 4 で実施）

## Phase 4: 仕上げとリリース準備
- [ ] Suspense fallback UI とエラーハンドリングを調整
- [ ] `docs/design/worker-dynamic-import-architecture.md` と本 TODO を更新（完了状態を明記）
- [ ] `.github/workflows` の実行結果を確認し、必要なら badge や README のステータス説明を更新
- [ ] `pnpm build:turbo` / `pnpm -w typecheck` / `pnpm -w test` を最終確認
- [ ] リリースノート・移行ガイドを作成

## 保守タスク
- [ ] Codemod の dry-run / 差分出力オプションを実装
- [ ] CI に codemod dry-run を追加（未適用差分検出用）
- [ ] プラグイン API の deprecation 通知をコードコメントとドキュメントへ反映

## Known Issues / Follow-ups
- [ ] ResolverPlugin: `PropertyResolverEntityHandler.test.ts` が Dexie のクリーンアップに時間を要するため、afterAll で DB を確実に削除する恒久対応が必要
