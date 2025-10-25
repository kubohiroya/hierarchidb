# Worker 動的 import 統一 要件定義

## 1. 文書の目的
`docs/design/worker-dynamic-import-architecture.md` の検討結果を実行フェーズへ落とし込むため、具体的なスコープ・成果物・成功条件・リスクを明文化する。

## 2. 背景
- 現在の runtime / プラグインでは静的 import と動的 import が混在し、Vite で `dynamic import will not move module into another chunk` 警告が発生している。
- Worker 初期化が同期 API 前提で設計されており、遅延ロードへ移行するには初期化シーケンスと状態管理の再設計が必要。

## 3. 目的 / 期待される成果
1. Worker/API/プラグイン読み込み経路を完全に動的 import へ統一し、Chunk 分離と遅延ロードを確実にする。
2. UI 側では `WorkerRuntimeProvider`+`Suspense` による非同期初期化、`WorkerClientProxy` による非同期 API を提供しつつ既存同期 API を互換レイヤで維持する。
3. プラグイン側は `load<Plugin>WorkerPeer()` 形式のファクトリ API を導入し、再エクスポートによる静的 import を撤廃する。
4. 型情報は従来どおり静的に配布し、`import type` を活用して `any` へ退避しない設計を保つ。

## 4. スコープ
- 対象: `@hierarchidb/app`, `@hierarchidb/runtime-worker`, `@hierarchidb/runtime-client`, `packages/plugins/*`、関連ユーティリティ (`WorkerAPIClient`, `WorkerProvider`, `storeRegistry` 等)。
- 含む: React Provider/Hook 層の再設計、Worker ローダーの新規実装、プラグイン worker のファクトリ化、テスト/型更新、ドキュメント整備。
- 含まない: プラグイン個別仕様の大幅変更、既存ビジネスロジックの改修、SSR 全面対応（影響調査と最小差分対応のみ）。

## 5. 成功条件 (DoD)
- Vite/Turbo ビルドから動的 import 併用警告が消える。
- `WorkerRuntimeProvider` + `WorkerClientProxy` を導入し、`pnpm --filter @hierarchidb/app typecheck` および該当テストがグリーンである。
- すべてのプラグイン worker が `load<Plugin>WorkerPeer()` または同等の非同期ファクトリを提供し、再エクスポート構成が残っていない。
- `docs/design/worker-dynamic-import-architecture.md` のステートマシン/フェーズに沿ったテスト (ユニット / 統合 / E2E) を追加または更新している。
- `.github/` 配下の CI ワークフロー/スクリプトを新しい import 体系に合わせて更新し、検証がグリーンである。
- `scripts/` や `knip.json`、`tsup.*`、`vitest.config.ts`、その他ビルド/解析系設定ファイルを新構成に合わせて更新し、関連コマンドが成功する。
- `TASKS.md` へ各フェーズ進捗・成果・ロールバック指針が記録されている。

## 6. 非対象 / 制約
- 既存 API を即座に破壊する変更は禁止。互換レイヤを設け、段階的に移行する。
- Node.js 実行時 (scripts / ツール) の import 体系は別タスクで扱う。
- ブラウザ向け bundle サイズ最適化は副次効果とし、今回のスコープに含めない。

## 7. 関連ドキュメント
- 設計メモ: `docs/design/worker-dynamic-import-architecture.md`
- 運用ルール: `AGENTS.md`（Codemod / ts-morph 運用指針含む）
- タスク管理: `TASKS.md`

## 8. 実装指針
- `WorkerRuntimeProvider` / `WorkerClientProxy` / `WorkerModuleLoader` / `WorkerStateStore` を Phase 1 で導入。
- プラグイン側では `loadXxxWorkerPeer(storeRegistry)` を導入し、Dexie 初期化等はファクトリ内部で完結させる。
- 型情報は `worker-public-plugin-definition.ts`（型のみ）と `worker/RuntimeWorkerService.ts`（実装）へ分離し、呼び出し側は `import type` で参照する。
- Codemod 方針:
  - `scripts/codemods` 配下に ts-morph ベースのユーティリティを追加し、import 差し替えやファクトリひな形挿入を自動化。
  - 実行テンプレート: `pnpm ts-node scripts/codemods/xxx.ts --plugin <name>` → `pnpm lint --fix` → `pnpm --filter <pkg> typecheck`。

## 9. フェーズ別作業概要
- **Phase 1: Runtime 基盤整備**
  - `WorkerClientProxy` 実装、`WorkerRuntimeProvider` で Suspense 化、既存 API 互換レイヤ構築。
  - テスト: Provider/Proxy のユニットテスト、初期化ステートマシンの状態遷移テスト。
- **Phase 2: プラグイン移行テンプレート**
  - 代表プラグイン（folder/resolver 等）でファクトリ API 化、ts-morph codemod 検証。
  - Tools: ts-morph codemod（現在は未配備）で import 置換を自動化予定。
- **Phase 3: 全プラグイン展開**
  - codemod 適用、ドキュメント更新、`pnpm -r typecheck`/`pnpm -r test` で網羅確認。
  - 旧 API の deprecation アナウンス → 削除。
- **Phase 4: 仕上げ**
  - ビルド/警告確認、UX fallback 調整、リリースノート作成。

## 10. リスクと対応
| リスク | 対応策 |
| --- | --- |
| Suspense 由来の UX 低下 | Fallback コンポーネントを設計、`ensureInitialized` のタイムアウト監視を導入 |
| 互換レイヤのデグレ | Proxy に統合テストを追加し、同期 API 呼び出しを全て監視 |
| Codemod の誤変換 | dry-run オプションと差分確認を codemod に実装し、`pnpm lint --fix` `pnpm typecheck` をセットで実行 |
| テストカバレッジ低下 | Phase ごとにユニット + 統合 + E2E の追加を必須化 |

## 11. 受け入れ手順
1. Phase 1〜4 を順次実施し、各 Phase 完了時に `TASKS.md` で DoD を満たしたことを記録。
2. 最終的に `pnpm build:turbo` / `pnpm -w typecheck` / 主要パッケージの `pnpm test` を成功させる。
3. ドキュメント（本ファイルと設計メモ）を更新し、レビュワー承認を得る。

## 12. ロールバック指針
- 各 Phase のコミット/ブランチを分離し、問題発生時は直近の Phase をリバート。
- プラグイン毎のファクトリ導入は feature flag で切り替え可能にし、必要に応じて旧静的 import パスを再度有効化する。



## 13. 現状調査メモ
- `WorkerAPIClient` は同期シングルトンとして `getWorkerClient()` を直接呼び出しており、状態遷移は内部ステートと window グローバルに依存。Suspense 互換ではない。
- `WorkerProvider` は `WorkerAPIClient` と `WorkerInitializationChannel` を組み合わせた独自の状態管理を実装しており、fallback UI はあるが Promise を手動で扱っている。
- `app/src/client.ts` の `initializeWorker()` はローカル Worker エントリ (`./worker.ts`) を生成した後、`WorkerProvider` が公開する `window.__HDB_WORKER_CLIENT_REF__` を通じて `WorkerBridge` へクライアント参照を共有する。プラグイン側で直接 `@hierarchidb/*/worker` を import する経路は排除済み。
- （2025-09-30 更新）プラグイン worker は `register*WorkerStores` ファクトリ経由に統一済みで、`StylerEntitiesDB` などの静的再エクスポートは撤去された。現在はモジュール末尾で `export { StylerEntitiesDB }` する実装はなく、chunk 分割は阻害されていない。
- runtime 側では `FeatureBootstrap` が多数の静的 import を保持し、オプション機能のみ `importOptionalFeature()` で遅延化している。
- 既存の codemod/自動化仕組みは未整備だったため runner.ts を新設。今後のフェーズでは各プラグイン向け codemod を `scripts/codemods/mods/*.ts` に配置する想定。


## 14. 設定ファイル監査
- 詳細: `docs/requirements/dynamic-import-settings-audit.md`
- 当面は上記メモにて対象ファイルと作業状況を管理する。
