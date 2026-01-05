# Shape download chunk-storeキャッシュ強化と削除連携

このExecPlanは進行中の作業記録であり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を常に最新化する。

この文書はリポジトリ直下の `PLANS.md` に従って維持する。

## Purpose / Big Picture

shape-pluginのdownloadで取得したGeoJSON/FlatGeobuf等のデータをchunk-storeによりnodeId単位で共有し、再利用できるようにする。同時に、HTTPのETag/Last-Modifiedを用いたキャッシュ判定をHEADで行い無駄なダウンロードを避ける。TreeNode削除時にはchunk-storeの関連を削除し、参照が残っていないデータは自動的に消えることを観察できるようにする。

## Progress

- [x] (2026-01-09 23:30 JST) ExecPlanの作成と目的の整理を完了。
- [x] (2026-01-09 23:55 JST) chunk-storeのHEAD判定実装とフォールバック挙動を追加した。
- [x] (2026-01-09 23:58 JST) shape data sourceのchunk-store利用をnodeId関連付けに変更した。
- [x] (2026-01-10 00:01 JST) TreeNode削除経路でchunk-storeのdeleteForNodeが走るようにした。
- [x] (2026-01-10 00:08 JST) 変更の影響範囲とロールバック手順を更新した。

## Surprises & Discoveries

- Observation: chunk-storeは条件付きGETでETag/Last-Modifiedを利用しているが、HEADチェックは未実装だった。
  Evidence: `packages/features/chunk-store/src/index.ts` の `getOrFetchForNode` が GET に `If-None-Match`/`If-Modified-Since` を付与している。
- Observation: shapeの主要データソース（GeoBoundaries/NaturalEarth/GADM）はchunk-storeを利用していたが、nodeIdは共有IDで固定されていた。
  Evidence: 各strategyの `getOrFetchWithRetry` 呼び出しが `SHARED_SHAPE_NODE_ID` を使用していた。

## Decision Log

- Decision: downloadのHTTPキャッシュ判定はHEADを優先し、失敗時は従来の条件付きGETにフォールバックする。
  Rationale: ユーザー要求に合わせ、HEADで一致する場合はネットワーク転送を省く。
  Date/Author: 2026-01-09 / Codex
- Decision: data sourceのcacheはnodeId単位のrelationsを作りつつ、同一cacheKeyで重複保存を避ける。
  Rationale: 削除時の参照解決を可能にし、共有メリットはchunk-storeのidentity解決に委ねる。
  Date/Author: 2026-01-10 / Codex

## Outcomes & Retrospective

ETag/Last-ModifiedのHEAD判定でキャッシュ再利用が可能になり、shapeの主要データソースはnodeId単位でchunk-store relationsを持つようになった。TreeNode削除時にchunk-storeの参照が外れ、参照が残らなければ実データも削除される。未検証のため、実行時ログとtypecheckでの確認が残る。

最終更新: 2026-01-10 00:08 JST（進捗更新）

変更メモ: 実装完了に伴いProgressとOutcomesを更新し、HEAD判定・nodeId関連付け・削除連携が完了した旨を記録した。

## Context and Orientation

shape-pluginのdownloadは `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` からデータソース戦略へ委譲され、`plugins/shape-plugin/src/services/datasources/*.ts` がHTTP取得とキャッシュを担当する。chunk-storeは `packages/features/chunk-store/src/index.ts` の `DexieChunkStore` に実装され、`getOrFetchForNode` がキャッシュ判定と保存を行う。TreeNode削除は `plugins/shape-plugin/src/worker/plugin.ts` の `beforeDelete` が呼ばれ、`shapeBatchAPI.cleanupProcessingData` 経由で後始末を行う。

ここでの「chunk-store」は、IndexedDB(Dexie)を使ったキャッシュ層であり、`files/chunks/relations/keys` テーブルを持つ。`relations` は nodeId と cacheKey の対応を表し、参照がなくなると実データを削除できる。

## Plan of Work

まず `packages/features/chunk-store/src/index.ts` の `getOrFetchForNode` に HEAD判定を追加する。既存のETag/Last-Modifiedを条件付きで送信し、304または同一メタデータの場合はGETをスキップしてキャッシュを返す。HEADが失敗・未対応の場合は現在のGETベース判定にフォールバックする。

次に、shape-pluginのデータソースで `SHARED_SHAPE_NODE_ID` を使っている箇所を、取得対象の `nodeId` を利用する形に変える。`plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`、`GADMStrategy.ts`、`NaturalEarthStrategy.ts` で、`FetchOptions` に `nodeId` を追加して `getOrFetchWithRetry` の引数に渡す。`shapeStageWorker.ts` の `processDownloadTask` で `nodeId` を `fetchData` に渡し、nodeIdごとにrelationsが作られるようにする。nodeId未指定の利用箇所では既存の共有IDを使う。

最後に、TreeNode削除経路で chunk-store の `deleteForNode` が走るようにする。`DexieChunkStore` に nodeId単位の削除ユーティリティを追加し（内部的に `deleteForNode` を使う）、`plugins/shape-plugin/src/worker/api.ts` の `cleanupProcessingData` で shape-chunks DB に対して削除処理を行う。これにより nodeId に紐づく relations が削除され、参照が残っていないデータは削除される。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb`。

1) `packages/features/chunk-store/src/index.ts` を編集し、`getOrFetchForNode` にHEAD判定を追加する。
2) `plugins/shape-plugin/src/services/datasources/DataSourceStrategy.ts` に `nodeId?: NodeId` を追加する。
3) `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` で `fetchData` 呼び出しに nodeId を渡す。
4) `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts` / `GADMStrategy.ts` / `NaturalEarthStrategy.ts` で nodeId を使って `getOrFetchWithRetry` を呼ぶ。
5) `packages/features/chunk-store/src/index.ts` に nodeId単位の削除メソッドを追加し、内部で `deleteForNode` を呼ぶ。
6) `plugins/shape-plugin/src/worker/api.ts` の `cleanupProcessingData` に chunk-store削除を追加する。

## Validation and Acceptance

`pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、型エラーがないことを確認する。必要に応じて `pnpm --filter @hierarchidb/runtime-worker typecheck` を追加する。

受け入れ確認は以下。

- download実行後に nodeId を削除した際、chunk-storeのrelationsが消え、参照が残っていなければ data/chunks が削除されること。
- ETag/Last-Modifiedを持つURLでは、2回目以降にHEAD判定で304相当となり、GETが発行されないこと（ログで確認）。

## Idempotence and Recovery

HEAD判定追加やnodeId関連付けは安全に再実行できる。問題があれば対象ファイルの変更をrevertし、chunk-storeの挙動を旧仕様に戻す。

## Artifacts and Notes

必要に応じて、HEAD判定のログや削除処理のログを短く貼る。

## Interfaces and Dependencies

`DexieChunkStore` の新メソッドは既存の `deleteForNode` を利用し、呼び出し側は `createShapeChunkStore` を使って同一DBを参照する。`FetchNetworkPort` の `head` を利用し、GETはフォールバックとして残す。

最終更新: 2026-01-09 23:30 JST（初版作成）
