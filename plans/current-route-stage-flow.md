# Route pipeline migration map

最終更新: 2026-08-21

## 文書の位置づけ

本書はIssue #549でroute buildを正規3ステージへ統合するための移行図である。
仕様SSOTではない。次の正規仕様に従う。

- `docs/route-build-flow-spec.md`
- `docs/vt-route-pipeline-design.md`
- `docs/build-session-worker-ui-event-spec.md`

## 正規フロー

```mermaid
flowchart TD
  UI[RouteBuildStep] --> CMD[canonical Worker build command]
  CMD --> ORCH[RouteBuildSessionOrchestrator]
  ORCH --> SESSION[RouteBuildSession]
  SESSION --> SOURCE[source]
  SOURCE --> GEOMETRY[geometry]
  GEOMETRY --> TILE[tileEmit]
  TILE --> DONE[completed]

  SESSION --> EVENTS[canonical 4 Worker events]
  EVENTS --> UI
```

正規stage IDは`source / geometry / tileEmit`である。旧語は次の対応で読み替える。

| 正規stage | 旧語 |
| --- | --- |
| `source` | fetch, route-fetch |
| `geometry` | transform |
| `tileEmit` | vt, vectorTile |

## source

```mermaid
flowchart LR
  S0[data-source + Step3 selection]
  S1[location resolution]
  S2[explicit route engine]
  S3[original LineString]
  S4[source cache + lineage]
  S5[geometry tasks]
  S0 --> S1 --> S2 --> S3 --> S4 --> S5
```

- routeごとにオリジナルLineStringを1本だけ生成する。
- engineは`direct / great_circle / osm_route / searoute / custom`から明示する。
- engine欠落、未対応method、load失敗を別engineへfallbackしない。
- `searoute_jp`を`searoute`の別名として受理しない。入力に現れた場合は契約違反として失敗する。
- source artifactの永続化後にのみsource taskを完了する。

## geometry

```mermaid
flowchart LR
  G0[source cache]
  G1[zoom-band filtering]
  G2[endpoint-preserving RDP]
  G3[tile-to-route inverted index]
  G4[geometry cache]
  G5[tileEmit tasks]
  G0 --> G1 --> G2 --> G3 --> G4 --> G5
```

- filtering、simplification、index生成を同じstageで行う。
- 始点/終点は必ず保持する。
- LineStringが横切るtileを、端点がtile外でもindexへ含める。
- no-op handlerはtaskを`completed`にしない。

## tileEmit

```mermaid
flowchart LR
  T0[geometry cache + index]
  T1[tile clipping]
  T2[MVT encoding]
  T3[route vector-tile store]
  T4[tile summary]
  T0 --> T1 --> T2 --> T3 --> T4
```

- geometry成果物だけを入力とする。
- MVTとsummaryの永続化後にtask/stageを完了する。
- geometry成果物欠落をsource直読みや空tileで補完しない。

## 現行mainの二重経路

2026-08-21時点では、次の2経路が併存する。

```mermaid
flowchart TD
  UI[RouteBuildStep]
  UI --> DIRECT[importIdeGsmRoutes]
  DIRECT --> INDEX[buildRouteTileIndex]
  INDEX --> MVT[generateRouteVectorTiles]

  FORM[RouteBuildLaunchForm]
  FORM --> ORCH[RouteBuildSessionOrchestrator]
  ORCH --> SESSION[RouteBuildSession]
  SESSION --> SOURCE[source: generator result discarded]
  SESSION --> NOOP1[geometry: no-op]
  SESSION --> NOOP2[tileEmit: no-op]
```

直接経路は実成果物を生成するがcanonical session/eventの所有外である。
session経路はcanonical event sourceだが、sourceはgenerator結果を永続化せず、
geometry/tileEmitは実処理を行わない。
どちらも単独では正規仕様を満たさない。

## Issue #549の統合順

1. `RouteBuildSession`の各stageをWorker serviceの実処理へ接続する。
2. canonical command/APIから`RouteBuildSessionOrchestrator`を起動可能にする。
3. `RouteBuildStep`をcanonical command + event subscriptionへ切り替える。
4. UIの直接3処理経路を削除する。
5. `RouteBuildLaunchForm`が本番導線でない場合は削除し、必要なら同じcanonical commandへ接続する。
6. 同一nodeIdに複数session/runが存在しないことをテストする。

## 完了条件

- UIからWorkerまで正規entry pointが1つである。
- `source -> geometry -> tileEmit`の各stageに対応artifactがある。
- canonical 4イベントがstage/taskのauthoritative stateを配信する。
- no-op成功、暗黙fallback、別経路への互換切替が存在しない。
