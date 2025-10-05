# E2E / 結合テスト共通ユーティリティ運用ノート

このドキュメントは、Playwright ベースの E2E テストおよび runtime-worker 結合テスト（WFL/headless）が共有しているユーティリティとその検証方法を、テスト作成者・レビュー担当向けにまとめたものです。

## 1. Playwright 向けユーティリティ

パス: `e2e/utils/test-helpers.ts`

### 主な提供機能
- ベース URL の組み立て（ブラウザルーター/ハッシュルーター両対応） `buildAppUrl`
- Worker フラグの適用・リセット `configureWorkerCmdprocOverride` / `resetWorkerFlagOverrides`
- ガイドツアー解消・TreeTable/Working Copy 待機・Undo/Redo 操作などの UI 操作ヘルパー
- SpeedDial を介したフォルダ CRUD、ドラッグ＆ドロップ、Trash 復旧といった主要動線の共通化
- シナリオ別データ初期化 `setupTestData`、アニメーション待機、スクリーンショット・コンソール追跡

### 実動での検証
- 代表例: `e2e/cp-routing-wc-flow.spec.ts`
  - フラグ ON/OFF 2 ケースで同ヘルパーを呼び出し、localStorage + env 両経路が意図通りに働くことを確認。
  - CRUD/Drag & Drop/Working Copy 同期など、提供関数を組み合わせて 1 シナリオを構成。
- その他 `e2e/folder/…`, `e2e/route/…`, `e2e/treetable/…` でも同ヘルパーを import して共通操作を共有。

> Playwright スイート全体がこのファイルに依存しているため、ヘルパーが期待通り動作しない場合はシナリオ自体が失敗します。

### 実行制御
- `e2e/utils/skip-if-disabled.ts` で `HIERARCHIDB_E2E=1` が未指定なら `test.skip` を実行。CI／ローカルでの切替を容易にします。

## 2. Worker 結合テスト向けユーティリティ

パス: `packages/runtime/worker/src/e2e/utils/worker-flag-helpers.ts`

### 主な提供機能
- `createWorkerFlagOverrideLifecycle()` による環境変数 snapshot の作成／適用／復元
- JSON ペイロード生成 `createWorkerFlagOverridePayload()`（Playwright 側の localStorage 初期化にも流用）
- `withWorkerFlagEnvOverrides()` を介した env 操作のラップ

### 実動での検証
- 代表例: `packages/runtime/worker/src/e2e/__tests__/folder-undo-redo.wfl.test.ts`
  - `beforeEach` で `resetEnv()`、シナリオ内で `applyEnvOverrides()` を呼び、Undo/Redo の成功可否を比較。
  - Worker フラグの不整合があると直ちにテストが失敗する設計。
- このヘルパーを Playwright 側 `test-helpers.ts` が直接 import しているため、UI 経由の検証でも同じロジックが利用される。

### 共通エントリ
- `packages/runtime/worker/src/e2e/test-worker.entry.ts` — Fake IndexedDB + Comlink をサンドボックスに露出し、全 WFL から同一の `WorkerService` API を利用。

## 3. グローバルなテストセットアップ

パス: `vitest.setup.base.ts`

### 主な提供機能
- Comlink, Worker, fetch, structuredClone 等の Node ポリフィル
- IndexedDB 全削除ヘルパー `clearAllDatabases()`
- `setupBasicTestEnvironment()` による `beforeEach` 登録（DB クリーン + モック reset）

### 実動での検証
- すべての runtime-worker / headless テストがこの設定を取り込んで実行。
- DB リセットやモッククリアが機能しないと既存シナリオが不安定になるため、基盤が常時検証される。

## 4. 期待動作のレビュー観点

- **新しい Playwright シナリオを追加する場合**: 既存ヘルパーで解決できない UI 操作かどうかを確認し、汎用化できるコードは `test-helpers.ts` に追加。履歴としてこの文書 or `TASKS.md` に整備方針を追記すると良い。
- **Worker フラグを増やす場合**: `WORKER_FLAG_ALLOWED_OVERRIDES` への追加 → ヘルパーでの payload 生成／env 適用 → Playwright と WFL 双方でのシナリオ実行確認。
- **環境依存エラーが疑われる場合**: `skip-if-disabled.ts` の判定や `test-helpers.ts` 中の `addInitScript` など初期化ロジックを確認。WFL で再現するかどうかを切り分ける。

## 5. 参考リンク
- Playwright ガイド: `docs/testing/cp-routing-wc-playwright.md`
- runtime-worker WFL ガイド: `docs/testing/runtime-worker-wfl.md`
- ResolverDialog headless テストメモ: `docs/testing/resolver-dialog-headless-e2e.md`
- Vitest ランタイムメモ: `docs/testing/vitest-runtime.md`

---

ユーティリティの挙動は個別ユニットテストではなく「それを使用する統合シナリオの成功」で常時検証されています。 新規テストを追加する場合は、既存ユーティリティの再利用可否と副作用（フラグ・DB 初期化など）を必ず確認し、必要ならこの文書に注意点を追記してください。
