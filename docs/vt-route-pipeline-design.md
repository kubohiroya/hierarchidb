# route vector-tile pipeline design

最終更新: 2026-08-21

本書は `docs/route-build-flow-spec.md` のステージ別実装契約を補足する。
route のStep2〜Step6、location連動、設定SSOT、cache identityに関して本書と同仕様が
衝突する場合は、`docs/route-build-flow-spec.md` を優先する。

共通のbuild-session lifecycleとWorker→UI eventは、次を参照する。

- `docs/build-session-spec.md`
- `docs/build-session-worker-ui-event-spec.md`

## 対象ジオメトリ

- GeoJSON `LineString`
- 全世界で数万本規模、長大な経路を含む
- 始点と終点はlocation由来のPointへlineageを持つ

## 正規ステージ

route pipelineは次の3ステージを、この順序で実行する。

1. `source`
2. `geometry`
3. `tileEmit`

旧称 `route-fetch / fetch`、`transform`、`vt / vectorTile` は説明上の対応語に限り、
新規task、event、永続recordのstage IDには使用しない。

## source stage

### 入力

- route node ID
- Step2 data-source selection
- Step3 `selectedArrayByCountries`
- data-source strategy / adapterが解決したlocation参照と始点/終点Point
- `RouteBuildConfig.sourceConfig`
- route generation method/options

### 処理

1. data-source strategyからroute metadataを取得する。
2. data-source strategy / adapter境界で始点/終点のlocationを解決し、session入力では
   location IDと座標を厳格検証する。
3. `direct / great_circle / osm_route / searoute / custom` の明示されたengineで
   LineStringを生成する。
4. routeごとにオリジナルLineStringを1本だけsource cacheへ永続化する。
5. geometry taskを、永続化に成功したsource artifactから生成する。

engine、location、routeMode、座標、generation設定が欠落・不正な場合はtaskを失敗させる。
別engine、直線、大圏航路、cacheへの暗黙fallbackは行わない。
session内では曖昧なlocation検索を行わず、admin name/codeは正規`RouteFeature`をSSOTとして
source cache metadataへ重複保存しない。

### source keyと入力署名

- `sourceKey`は`<routeMode>:<fromLocationId>:<toLocationId>`を基本とする。
- 方向付きrouteは始点/終点順を保持する。
- 契約どおりbidirectionalと明示されたrouteだけ端点を正規化する。
- 座標、generation method/options、stage設定は`meta`/`inputHash`に含める。
- 同一`sourceKey`でも入力署名が変わったartifactはrecycleしない。
- canonical direct-route startでは`routeMode`を正規値として明示必須にし、
  `transportMode`や`transportSelection`から補完しない。

## geometry stage

### 入力

- source artifact
- `RouteBuildConfig.geometryConfig`
- `RouteBuildConfig.routeGeometryConfig`

### 処理

1. ズーム帯ごとにroute filteringを適用する。
2. 始点/終点を必ず保持してRDP simplificationを適用する。
3. LineStringが横切るtileを列挙し、tile→routeの転置indexを生成する。
4. ズーム帯ごとのgeometry cacheとindexを永続化する。

LineStringは、始点/終点がtile外でも交差するtileの候補に含める。
filtering、simplification、index生成の一部をno-opにしてtaskを`completed`へ進めない。

## tileEmit stage

### 入力

- geometry cache
- tile転置index
- `RouteBuildConfig.tileEmitConfig`

### 処理

1. 対象tileごとにgeometry cacheからLineStringを読む。
2. tile境界でclipし、MVT featureへ変換する。
3. route vector-tile storeへ永続化する。
4. tile summaryとtask/stage完了状態を、永続化成功後に更新する。

geometry cache/indexが欠落・不正な場合は失敗する。source artifactを直接読んでtileを生成する
互換経路や、空tile成功への読み替えは行わない。

## 正規実行境界

- session lifecycleの所有者は`RouteBuildSessionOrchestrator -> RouteBuildSession`とする。
- `RouteBuildSession`は各stageの実処理をWorker serviceへ委譲し、canonical event sourceとして
  authoritative task snapshotとtask progressを提供する。
- UIの`RouteBuildStep`はWorker commandとcanonical event subscriptionだけを利用する。
- UIがroute mutation APIの3処理を独立に順次呼ぶ現行経路はIssue #549で撤去する移行対象とする。

## Issue #1373適用後の残差分（2026-08-21）

- `RouteBuildSession`の`source` handlerはgenerator結果を検証し、direction-awareなidentityと
  入力署名を持つLineString GeoJSONをsource cacheへ永続化する。
- `RouteBuildSession`の`geometry` / `tileEmit` handlerは実成果物を生成せず完了する。
  したがってsession経路は3stageすべてのartifact契約を満たさない。
- `RouteBuildStep`には
  `importIdeGsmRoutes -> buildRouteTileIndex -> generateRouteVectorTiles` の直接実行経路が残る。
- `RouteGenerator` / `SearouteEngine`はengine欠落、load失敗、不正responseをfail-fastにする。
- geometry / tileEmitの実成果物化とUI直接実行経路の撤去はIssue #549の後続Issueで行う。

## 検証観点

- `source -> geometry -> tileEmit`の順序とcanonical eventが一致する。
- 各stageの完了時に対応artifactが存在する。
- bidirectional指定の有無でsource keyの方向性が決定的に変わる。
- LineStringが横切る全tileで描画される。
- engine/cache/configの契約違反が可視なtask/session failureになる。
