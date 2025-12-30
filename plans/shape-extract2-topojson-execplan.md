# Extract2 を TopoJSON ベースに切り替え、Step4 デフォルトを適正化する

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md はリポジトリ直下の `PLANS.md` を参照し、この文書はその要件に従って維持すること。

## Purpose / Big Picture

ユーザーが geoBoundaries の簡略化済み GeoJSON を使ってビルドしたとき、Step4 の過度なデフォルト値が原因で境界が崩れるのを避ける。extract2 の処理を TopoJSON ベースに切り替え、同一タイル座標内で境界を共有したまま簡略化することで、国境や行政境界の破綻を抑える。完了後は、Step4 のデフォルト値が穏当な設定に戻り、extract2 の結果がタイル内で整合的になることを UI とビルドログで確認できる。

## Progress

- [x] 2025-12-30 18:20 JST ExecPlan を作成した。
- [x] 2025-12-30 18:55 JST topojson-simplify を追加し、TopoJSON 簡略化ユーティリティを実装した。
- [x] 2025-12-30 19:05 JST extract2 の worker/local 実装を TopoJSON ベースの簡略化に切り替えた。
- [x] 2025-12-30 19:15 JST Step4 のデフォルト値を適正化し、UI と設定の整合を取った。
- [ ] 手動検証またはログ確認を行い、結果を TASKS.md に記録する。

## Surprises & Discoveries

- Observation: shape-plugin には `topojson-client` と `topojson-server` はあるが、TopoJSON そのものを簡略化する `topojson-simplify` が未導入だった。
  Evidence: `plugins/shape-plugin/package.json` に `topojson-simplify` が存在しない。

## Decision Log

- Decision: TopoJSON ベースの簡略化は extract2 のみに適用する。
  Rationale: extract1 は広域・大量処理のためコストが大きく、境界整合の恩恵は extract2 の最終段で最大化できるため。
  Date/Author: 2025-12-30, Codex
- Decision: TopoJSON の簡略化は `topojson-simplify` を導入して行う。
  Rationale: topojson-server/client だけでは共有境界を保持したまま簡略化できないため。
  Date/Author: 2025-12-30, Codex
- Decision: タイル単位の grouping は extract2 タスクの `zoomLevels` を使い、bbox 中心点でタイルを一意に決める。
  Rationale: タイル境界での共有形状を保ちつつ重複出力を避けるため、複数タイルへの重複割り当てを避ける必要がある。
  Date/Author: 2025-12-30, Codex

## Outcomes & Retrospective

（完了時に記載）

## Context and Orientation

この変更は shape-plugin のバッチ処理と UI のデフォルト設定に影響する。

extract2 の処理は次の2経路がある。

- Worker 経由: `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` の `processExtract2Task` が `extractGeoJson` を使って簡略化している。
- ローカル経由: `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` の `LocalExtract2Adapter` が同じ `extractGeoJson` を使う。

`extractGeoJson` は `packages/features/gis-sdk/src/processing/geometryExtract.ts` にあり、各 Feature を独立に簡略化するため共有境界がずれる可能性がある。

Step4 のデフォルト値は `plugins/shape-plugin/src/common/types/constants.ts` の `DEFAULT_PROCESSING_CONFIG` と、UI の `plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx` で反映される。現在は `tolerance` や `minVertexCountForAreaFilter` が高く、過度な簡略化に寄っている。

TopoJSON は「共有境界を一度トポロジーとして統合し、その弧を簡略化してから Feature に戻す」形式で、境界の破綻を抑える。ここでは topojson-server で `Topology` を作成し、topojson-simplify で弧を簡略化し、topojson-client で FeatureCollection に戻す。タイル単位の grouping は bbox の中心点から求めた tile 座標で行い、各 Feature を一つのタイルへ割り当てる。

## Plan of Work

まず extract2 の TopoJSON 化を行うために `topojson-simplify` を `plugins/shape-plugin/package.json` に追加する。次に、TopoJSON 変換・簡略化・復元を担う小さなユーティリティを `plugins/shape-plugin/src/services/batch/utils/topojsonExtract.ts`（新規）に実装する。ユーティリティは `FeatureCollection` を受け取り、タイル単位で Topology を作る。タイル単位の grouping は `Extract2Task.zoomLevels` の最小値を使い、bbox の中心点から tile 座標を算出して Feature を一意に割り当てる。bbox が取得できない Feature は変換せず、そのまま戻す。各タイルごとに Topology を作り、`presimplify`→`simplify` を実行し、`feature` で FeatureCollection に戻す。最後にタイルごとの結果を結合し、元の Feature の properties と id を保持する。

extract2 の worker 版 (`shapeStageWorker.ts`) と local 版 (`LocalExtractAdapters.ts`) の両方で、`extractGeoJson` 直前にこの TopoJSON 簡略化を挟み込む。既存の retry による tolerance/quantize の調整は継続するが、TopoJSON の extract には「同じ tolerance を使う」方針で統一する。変換に失敗した場合は従来の per-feature 簡略化へフォールバックし、失敗がタスク全体を止めないようにする。

Step4 のデフォルト値は、geoBoundaries の `simplifiedGeometryGeoJSON` を前提に過度な値を戻す。具体的には次の値に変更する。

- extract1: tolerance 8.0、minVertexCountForAreaFilter 1500、areaThreshold 10000（据え置き）、enablePerFeatureExtraction は true
- extract2: tolerance 2.5、quantize 2000、enablePerFeatureExtraction は true

UI 側の `TileConfigSection.tsx` で表示されるデフォルト値も同じ値に揃える。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb` とする。

1. `plugins/shape-plugin/package.json` に `topojson-simplify` を追加する。
2. `plugins/shape-plugin/src/services/batch/utils/topojsonExtract.ts` を新規作成し、以下の機能を実装する。
   - FeatureCollection を受け取る
   - bbox から tile 座標を計算し、同じ tile に属する Feature を grouping
   - group ごとに topojson-server で Topology 化
   - topojson-simplify の `presimplify`→`simplify` を実行
   - topojson-client の `feature` で FeatureCollection に戻す
   - 全タイルの結果を結合し、FeatureCollection を返す
3. `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` の `processExtract2Task` に TopoJSON 簡略化を挿入し、失敗時は既存の `extractGeoJson` にフォールバックする。
4. `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` の `LocalExtract2Adapter` でも同様に TopoJSON 簡略化を使用する。
5. `plugins/shape-plugin/src/common/types/constants.ts` と `plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx` の Step4 デフォルト値を上記の数値に更新する。
6. `TASKS.md` の運用ログに変更内容・理由・検証結果を記載する。

## Validation and Acceptance

ビルド実行後に Step5 と Step6 を確認する。以下を観察する。

- Step4 の default 値が指定通りに表示される。
- extract2 の Completed メッセージが出ること（従来通り）。
- vectortile 生成後、Step6 プレビューで国境が破綻せず連続して見える。

可能であれば `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、エラーがないことを確認する。

## Idempotence and Recovery

変更は差分の上書きのみで、繰り返し適用しても安全である。TopoJSON 化が不具合を起こした場合は、ユーティリティの呼び出しを削除し、Step4 デフォルト値を旧値へ戻せばロールバックできる。

## Artifacts and Notes

（作業中に差分やログを追加）

## Interfaces and Dependencies

- 新規依存: `topojson-simplify`（shape-plugin に追加）。
- 既存依存: `topojson-server`, `topojson-client`（shape-plugin 既存）。
- 主要な変更対象:
  - `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`
  - `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`
  - `plugins/shape-plugin/src/services/batch/utils/topojsonExtract.ts`（新規）
  - `plugins/shape-plugin/src/common/types/constants.ts`
  - `plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx`

変更履歴: 2025-12-30 19:30 JST bbox 不明な Feature はそのまま保持する方針を追加し、進捗を反映した。
