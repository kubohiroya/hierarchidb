# shapeのsourceBuffers整備とchunk-storeの役割整理

このExecPlanは進行中の作業記録であり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を常に最新化する。

この文書はリポジトリ直下の `PLANS.md` に従って維持する。

## Purpose / Big Picture

shape-pluginのビルド処理におけるextract2/vectortileの入出力をephemeral DBのsourceBuffersで扱えるようにする。extract1の入力はchunk-storeのダウンロードキャッシュ（flatgeobuf+gzip）をそのまま利用する。sourceBuffersはステージごとにテーブルを分け、検索キーはextract2がnodeId+国コード+自治体レベル、vectortileがnodeId+tileIdを満たす。TreeNode削除時に関連バッファが一括削除されることを確認する。

## Progress

- [x] (2026-01-10 00:25 JST) ExecPlanの作成と目的の整理を完了。
- [x] EphemeralShapeDBにsourceBuffers（extract2/vectortile）を追加し、インデックスを更新する。
- [x] extract2の入出力が新bufferスキーマに書き込まれるようにする。
- [x] vectortile入力でchunk-storeを書き込まない経路を作る。
- [x] vectortileSourceBuffersにtileId検索用インデックスを追加する。
- [ ] TreeNode削除で新bufferが削除されることを確認する。
- [x] download出力をchunk-storeへ保存し、extract1入力がchunk-store経由になるよう更新する。

## Surprises & Discoveries

- Observation: 既存のrawBuffers/extractedBuffers/vectorTilesがephemeralに存在するが、ステージ別テーブルでの検索キー要件を満たさない。
  Evidence: `packages//src/ephemeral/EphemeralGisDB.ts` のスキーマ定義。

## Decision Log

- Decision: extract2/vectortileはステージ別のsourceBuffersテーブルとして実装する。
  Rationale: 検索キーが異なるため、テーブル分割で意図を明確化できるため。
  Date/Author: 2026-01-10 / Codex
- Decision: download出力はchunk-storeへ保存し、extract1入力はcacheKey経由でchunk-storeを読む。
  Rationale: ノード間キャッシュ共有と削除の両立を確保するため。
  Date/Author: 2026-01-10 / Codex

## Outcomes & Retrospective

未記入（作業完了時に更新）。

## Context and Orientation

shape-pluginのビルド処理は `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` と `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` がextract1/2を生成し、`plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` がvectortileを実行する。ephemeral DBは `packages//src/ephemeral/EphemeralGisDB.ts` を基底に、shape専用の拡張が `packages//src/EphemeralShapeDB.ts` にある。現在、vectortile入力は `packages/runtime-worker/src/services/vectorTileStageRunner.ts` がchunk-storeに書き込み、`packages/runtime-worker/src/services/StageProcessingService.ts` がchunk-storeから読み込む。

本タスクでは、extract1入力はchunk-storeのダウンロードキャッシュを利用し、extract2/vectortileの入出力はステージ別のsourceBuffersで完結させる。検索キーとして extract2は `nodeId+countryCode+adminLevel`、vectortileは `nodeId+tileId` を保持する。

## Plan of Work

1) `packages//src/ephemeral/EphemeralGisDB.ts` と `packages//src/EphemeralShapeDB.ts` のスキーマを更新する。extract2SourceBuffersとvectortileSourceBuffersを追加し、前者は `[nodeId+countryCode+adminLevel]`、後者は `[nodeId+tileId]` を付与する。バージョンを上げ、必要ならアップグレード時にクリアする。

2) extract2の出力にcountryCode/adminLevelを埋める。`shapeStageWorker.ts` と `LocalExtractAdapters.ts` の `putExtractedBuffer` 呼び出しに国コード・自治体レベルを追加する。

3) vectortile入力のchunk-store書き込みを止める。`vectorTileStageRunner.ts` にephemeral書き込みモードを追加し、shapeの `RuntimeWorkerVectorTileAdapter` からはephemeral書き込みモードを使用する。必要に応じて、geojson入力の場合は新しいbufferIdを発行しephemeral extract2SourceBuffersへ書き込み、StageProcessingServiceがそこから読むようにする。

4) vectortile出力のtileIdを算出してephemeral vectortileSourceBuffersに保存する。`StageProcessingService` の `storeVectorTiles` でtileIdを付与し、ephemeral DBにも反映する。

5) TreeNode削除で新bufferが削除されることを確認する。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb`。

- `packages//src/ephemeral/EphemeralGisDB.ts` を編集し、extract2SourceBuffers/vectortileSourceBuffersの型とインデックスを追加する。
- `packages//src/EphemeralShapeDB.ts` のバージョン定義を更新し、追加インデックスを含める。
- `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` と `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` のbuffer書き込みに国コード・自治体レベルを追加する。
- `packages/runtime-worker/src/services/vectorTileStageRunner.ts` と `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` を更新し、vectortile入力がephemeralを使うようにする。
- `packages/runtime-worker/src/services/StageProcessingService.ts` でvectorTiles保存時にtileIdを設定し、ephemeral DBにも反映する。

## Validation and Acceptance

`pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、型エラーがないことを確認する。必要なら `pnpm --filter @hierarchidb/runtime-worker typecheck` を追加する。

受け入れ確認は以下。

- extract1入力はchunk-storeのダウンロードキャッシュを利用し、extract2/vectortileはephemeral sourceBuffersで取得できる。
- extract2SourceBuffersはnodeId+countryCode+adminLevelで検索できる。
- vectortileSourceBuffersはnodeId+tileIdで検索できる。

## Idempotence and Recovery

スキーマ変更は再実行可能だが、ephemeral DBのupgradeでキャッシュがクリアされる。問題があれば対象ファイルの差分をrevertして旧スキーマに戻す。

## Artifacts and Notes

必要に応じてスキーマ変更の抜粋やテストログを短く貼る。

## Interfaces and Dependencies

`EphemeralGisDB` と `EphemeralShapeDB` の型定義を更新し、buffer書き込み側で新フィールドを埋める。vectortile入力はephemeral vectortileSourceBuffersに保存し、StageProcessingServiceはそこから読み取るようにする。

最終更新: 2026-01-10 12:40 JST（download chunk-store対応を追加）
