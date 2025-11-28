# タスク: Comlink/Worker 境界の型強化（any排除）

目的
- Comlink の expose/wrap で any/キャストを排除し、境界で型が消えないようにする。
- 共有契約（`@hierarchidb/common-api`）に実装を厳密一致させ、コンパイル時に逸脱を検出する。

範囲
- `WorkerService` の公開APIを `WorkerAPI` の関数群に限定（privateなクラス実装を直接渡さない）。
- 呼び出し側は `wrap<WorkerAPI>(worker)` を徹底し、全呼び出しでキャストを排除。
- `ProxyMarked` の露出を最小化（返り値はシリアライズ可能なプレーンオブジェクト/プリミティブに揃える）。

提案ファイル/変更箇所
- `packages/runtime/worker/src/RuntimeWorkerService.ts`（`WorkerService` の公開インターフェース確認）
- `@hierarchidb/common-api`（必要時、契約の明確化と型の更新）

実施手順
1) `WorkerService` が返す各 API の戻り値/引数が `@hierarchidb/common-api` と一致しているか型チェック。
2) `wrap<WorkerAPI>()` を用いて呼び出す側の型を強制（キャスト排除）。
3) クラスのインスタンスをそのまま expose せず、`expose<WorkerAPI>(impl)` でプレーンな関数群として公開。
4) `ProxyMarked` を返す箇所の設計を見直し、必要なら関数越しに操作させるようAPIを再設計。

受け入れ基準
- `pnpm typecheck` で any/unsafe の lint/型チェックエラーがない（`no-explicit-any`/`no-unsafe-*`）。
- `WorkerAPI` と実装が完全一致（型テストで確認）。
- ランタイム挙動は不変（E2E 非回帰）。

依存関係
- なし（Zod 導入・レジストリ雛形と並行可）。

テスト方針
- 型テスト（`expectTypeOf`）で `getQueryAPI/getMutationAPI/...` の戻り値が `& ProxyMarked` を露出せず、`WorkerAPI` 契約内に収まっていることを確認。
- E2E で基本的な問い合わせ/更新の動作を回帰検証。

補足（tsconfig/ESLint）
- `strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true` を確認。
- ESLint: `@typescript-eslint/no-explicit-any: 'error'`, `no-unsafe-assignment/argument/member-access/return` を有効化。

