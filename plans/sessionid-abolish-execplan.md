# sessionId廃止とnodeId統一の実装

このExecPlanは生きた文書であり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective`を作業の進行に合わせて必ず更新する。リポジトリ直下の`PLANS.md`に従って維持する。

## Purpose / Big Picture

ユーザーは「1ノード=1セッション」を前提に運用する。これを守るため、`sessionId`の概念を完全に廃止し、すべてのバッチ処理を`nodeId`のみで識別する。これにより、UI上のステージ進捗・削除操作・再開操作が`nodeId`に統一され、余計なセッションID管理による不整合が消える。動作確認として、Stage4の削除操作とStage5の進捗表示が`nodeId`だけで成立し、`sessionId`関連のフィールドが型・API・DBから消えていることを確認できる。

## Progress

- [x] 2025-12-29T10:20+09:00 依頼内容とスコープ（全体廃止・フォールバックなし）を確定した。
- [x] 2025-12-29T10:25+09:00 ExecPlanを作成し、作業の全体像を定義した。
- [ ] 2025-12-29T10:25+09:00 共通API/WorkerAPIからsessionId型を削除しnodeIdへ統一する（完了: 未着手、残り: 全部）。
- [ ] 2025-12-29T10:25+09:00 shape/location/routeのDB・サービス・UIをnodeId基準へ統一する（完了: 未着手、残り: 全部）。
- [ ] 2025-12-29T10:25+09:00 テスト更新と動作検証を完了する（完了: 未着手、残り: 全部）。
- [ ] 2025-12-29T11:20+09:00 共通API/Worker/shapeバッチの型・実装をnodeIdへ寄せ、ShapeDB/EphemeralGisDB/ShapeTileMetadataDBのスキーマ移行を追加（完了: 一部、残り: UI/他プラグイン/残存sessionId）。

## Surprises & Discoveries

- まだ記録なし。

## Decision Log

- Decision: `sessionId`は完全廃止し、`nodeId`に統一する。フォールバックは持たない。
  Rationale: 1ノード=1セッション仕様に合致し、二重管理による不具合を避けるため。
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

- まだ記録なし。

## Context and Orientation

このリポジトリはモノレポで、UIは`app/`、コア型は`packages/common/types`、バッチ制御APIは`packages/common/api`にある。shape/location/routeはそれぞれ`plugins/shape-plugin`、`plugins/location-plugin`、`plugins/route-plugin`と、共有ストアの`packages/features/*-store`に分かれている。

現在は`sessionId`が多数の型とDBレコードに登場するが、実装上は`nodeId`をsessionIdとして使っている箇所も混在している。今回の方針では`sessionId`という概念自体を廃止し、**すべてのAPI・DBキー・UI判定を`nodeId`に統一**する。`ShapeEntity`/`LocationEntity`/`RouteEntity`が持つ`buildStartedAt`/`buildFinishedAt`（または同等の日時）で完了状況を管理し、セッションIDの復活はしない。

主な対象ファイル（必ずリポジトリ相対パスで確認する）:

- `packages/common/api/src/BatchControlAPI.ts` と `packages/common/api/src/WorkerAPI.ts`（バッチAPIの型）
- `packages/common/types/src/datasource.ts`（ISO型は既にここへ移動済み）
- `packages/ui/worker-client/src/workerBridge.ts`（UIからWorker APIの呼び出し）
- `app/src/worker-runtime/worker.ts`（Worker APIの実装）
- `plugins/shape-plugin/src/services/batch/**`（バッチ実行とDBの主処理）
- `plugins/shape-plugin/src/ui/hooks/**` と `plugins/shape-plugin/src/ui/components/**`（Stage4/Stage5 UI）
- `packages/features/shape-store/src/ShapeDB.ts`、`packages/features/shape-store/src/EphemeralShapeDB.ts`（shapeのDexieスキーマ）
- `packages/features/location-store/src/index.ts`、`packages/features/route-store/src/index.ts`（entity型）
- `packages/plugin-service-api/src/types/*.ts`（location/routeのAPI型）

## Plan of Work

最初に共通APIから`sessionId`を削除する。`BatchControlAPI`の`BatchSessionId`型と、`BatchSessionStatus`/`BatchProgressEvent`/`BatchSessionState`の`sessionId`フィールドを削除し、すべて`nodeId`をキーとする形に変更する。同時に`WorkerAPI`の`getBatchSessionStatus`/`pauseBatchSession`/`resumeBatchSession`/`cancelBatchSession`/`getBatchTasks`は`nodeId`を引数に取るよう変更し、`startBatchSession`は`nodeId`を受け取り`BatchSessionStatus`を返す形に統一する。

次にWorker実装（`app/src/worker-runtime/worker.ts`）とUIブリッジ（`packages/ui/worker-client/src/workerBridge.ts`）を合わせ、`sessionId`を参照する呼び出しや型をすべて`nodeId`に置き換える。UIの進捗監視は`nodeId`をキーにする。これに合わせて`plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`や`useShapeBatchTasks.ts`の引数やデバッグログを`nodeId`に変更し、`sessionId`変数名を排除する。

DBスキーマは`sessionId`依存が強いので、Dexieテーブルの主キーやインデックスを`nodeId`基準に変更する。例えば`batchSessions`/`batchTasks`/`extractedBuffers`/`rawBuffers`/`vectorTiles`/`metadata`に存在する`sessionId`列を削除し、`nodeId`へ置換する。フォールバックは不要なので、バージョンアップ時に旧テーブルをクリアする移行を明示する。`EphemeralGisDB`系の`hasStageData`/`clearStage`は`nodeId`を受け取り、内部のクエリは`nodeId`を使う。

shape/location/routeのサービス層は、`sessionId`という引数を持つAPIを削除し、`nodeId`を渡すように統一する。`ShapeEntity`の`batchSessionId`などのフィールドは不要なので削除し、既存の`buildStartedAt`/`buildFinishedAt`で進捗を管理する。location/routeも同様に、進捗と履歴の参照は`nodeId`基準で行う。

最後にテストとドキュメントを更新する。`sessionId`という文字列に依存するテストは、`nodeId`を使うように書き換える。動作検証として、Stage4でキャッシュ削除ボタンが有効であること、Stage5で過去の`sessionId`由来のログが出ないこと、ビルド開始/完了日時が正しく更新されることを確認する。

## Concrete Steps

作業ディレクトリは`/Users/hiroya/WebstormProjects/hierarchidb`とする。

1) 共通APIを更新する。
   - `packages/common/api/src/BatchControlAPI.ts` の `BatchSessionId` と `sessionId` フィールドを削除し、`nodeId`中心の型に更新する。
   - `packages/common/api/src/WorkerAPI.ts` の該当メソッド引数・戻り値を`nodeId`基準に変更する。

2) WorkerブリッジとWorker実装を更新する。
   - `packages/ui/worker-client/src/workerBridge.ts` の API 呼び出しを `nodeId` に統一する。
   - `app/src/worker-runtime/worker.ts` の `startBatchSession` / `getBatchSessionStatus` / `pauseBatchSession` / `resumeBatchSession` / `cancelBatchSession` / `getBatchTasks` を `nodeId` で扱う。

3) DBスキーマとDAOを更新する。
   - `packages/features/shape-store/src/ShapeDB.ts` と `packages/features/gis-sdk/src/ephemeral/EphemeralGisDB.ts` のテーブル設計を `nodeId` 基準に変える。
   - schema version を更新し、旧データをクリアするマイグレーションを追加する。

4) shape/location/route のサービス・UIを更新する。
   - `plugins/shape-plugin/src/services/batch/**` と `plugins/shape-plugin/src/ui/hooks/**` の `sessionId` 変数・引数を `nodeId` に置換する。
   - `plugins/shape-plugin/src/common/types/ShapeEntity.ts` から `batchSessionId` を削除し、`buildStartedAt`/`buildFinishedAt`で管理する。
   - `packages/features/location-store/src/index.ts` / `packages/features/route-store/src/index.ts` などで `sessionId` 参照を排除し `nodeId` へ統一する。

5) テストを更新し、検証を行う。
   - `rg -n "sessionId"` の残りを確認して修正する。
   - 主要な typecheck/test を実行し、Stage4/Stage5のUI動作を確認する。

## Validation and Acceptance

- `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、型エラーがないこと。
- `pnpm --filter @hierarchidb/location-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` を実行し、国コード関連の型エラーがないこと。
- UIで shape の Stage4 に移動し、「ステージ2キャッシュ削除」「タイル削除」が `nodeId` だけで有効になること。
- Stage5を開いたときに `sessionId` を含むログが出ないこと。

## Idempotence and Recovery

- コード変更は再実行可能である。Dexieのスキーマ変更は一度だけ行われるため、動作確認後にリロードすれば問題は再現しない。
- もし問題が出た場合は、該当ファイルの差分を revert すれば元の動作に戻る。

## Artifacts and Notes

- 変更後の`rg -n "sessionId"`出力はゼロ件になることを期待する（ただし文字列定数としての"sessionId"まで除去するかは要確認）。

## Interfaces and Dependencies

- `packages/common/api/src/BatchControlAPI.ts` の`BatchSessionStatus`は `nodeId` のみを必須にする。
- `packages/common/api/src/WorkerAPI.ts` は `nodeId` でバッチ操作を行うメソッド群を持つ。
- `packages/features/shape-store/src/ShapeDB.ts` は `nodeId` をキーとする。`sessionId` フィールドは持たない。
- `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts` や `useShapeBatchTasks.ts` は `nodeId` をキーに進捗とタスクを取得する。

---

更新履歴: 2025-12-29 初版作成。sessionId廃止の全体方針に合わせて作成。
