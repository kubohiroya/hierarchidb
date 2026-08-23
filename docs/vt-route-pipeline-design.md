# route vector-tile pipeline design

最終更新: 2026-08-22

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
- canonical route input resolver が解決したlocation参照と始点/終点Point
- `RouteBuildConfig.sourceConfig`
- route generation method/options

### 処理

1. data-source strategyからroute metadataを取得する。
2. data-source strategy / adapter境界で始点/終点のlocationを解決し、session入力では
   location IDと座標を厳格検証する。
3. `direct / great_circle / osm_route / searoute / custom` の明示されたengineで
   LineStringを生成する。
   engine registryはmethodごとのcapabilityを必須とし、engine id/version、method、
   任意のaccepted route modes、network requirement、waypoint対応を検証する。
   source planningで確定した`routeMode`はgeneration requestへ渡し、engine capabilityの
   `acceptedRouteModes`で明示されていない組み合わせを拒否する。
   mode×method×engine capability matrixが確定するまで、未宣言のroute mode対応を
   generator側で推測しない。
   `osm_route`は`baseUrl`/`osrmBaseUrl`、`profile`、`geometries`、`overview`を明示必須とし、
   未指定時に既定profileやgeometry形式を補完しない。
   engine responseはWGS84 finite座標、2点以上、始終点一致、finite non-negative distance、
   任意durationを満たす場合だけ正規resultとして扱う。
4. routeごとにオリジナルLineStringを1本だけsource cacheへ永続化する。
5. geometry taskを、永続化に成功したsource artifactから生成する。

engine、location、routeMode、座標、generation設定が欠落・不正な場合はtaskを失敗させる。
別engine、直線、大圏航路、cacheへの暗黙fallbackは行わない。
session内では曖昧なlocation検索を行わず、admin name/codeは正規`RouteFeature`をSSOTとして
source cache metadataへ重複保存しない。

selection-driven start の `tabularSourceId` / `selectedArrayByCountries` は
route plugin の canonical boundary で `RouteBuildRouteInput[]` に解決する。
app bootstrap や runtime-worker の汎用 start adapter は route固有fieldを参照しない。
direct-route と selection-driven の混在、external payload の `routeBuildInput.routes`、
空selection、空解決結果、endpoint未解決は source task 作成前に失敗させる。
resolver output の順序は route mode、始点location ID、終点location ID、source row identity で
決定的に固定し、committed / working-copy の input source によって分岐しない。

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

### zoom band / config契約

- `geometryConfig.zoomBandBoundaries`は2要素以上のstrictly increasingな`0..22`整数列とする。
- `routeGeometryConfig.minDistanceMetersByBand`と`simplifyToleranceByBand`は必須で、
  長さが`zoomBandBoundaries.length - 1`と一致するfiniteな非負値列とする。
- geometry engineは`turf`、simplification algorithmは`geojson`を明示し、RDP toleranceはdegree単位とする。
- 中間bandは`[boundary[i], boundary[i+1]-1]`、最終bandは
  `[boundary[last-1], boundary[last]]`、`zBase=boundary[i]`とする。
- 不正値を丸め、sort、clamp、末尾値反復、既定値で修復しない。

### artifact / index契約

- 1 route×1 zoom bandにつき1つのgeometry artifactを`EphemeralDB.geometryCache`へ永続化する。
  filter通過時は端点保持済みLineStringを1本含むFlatGeobufとし、shape/locationと共通の
  VT handlerが読む正規binary入力に揃える。filter除外時はtile転置indexへ登録せず、
  空featuresのGeoJSONを明示的な空artifactとして保存する。
- geometry metadataの`format`は非空artifactで`flatgeobuf`、filter除外artifactで`geojson`とする。
  tileEmit対象relationが`flatgeobuf`以外を参照した場合は形式fallbackせず失敗する。
- geometry metadataはsource cache ID、source input/content hash、geometry input/content hash、
  route mode、band、filter/simplification設定、filter結果、count、完了時刻を保持する。
- tile転置indexは`EphemeralDB.tileEmitBufferRelations`のpacked tile ID→geometry buffer関係とし、
  VT orchestratorの共通tile ID encodingを使う。境界への接触も交差に含める。
- Web Mercator緯度範囲外のLineStringは失敗させ、tile座標へclampしない。
- 経度差が180°を超えるsegmentはantimeridianを横断するworld-wrap区間として列挙し、
  経度seamの両側tileをindexへ含める。
- 同一sourceの旧geometry artifact/relation削除と新artifact/meta/relation書込みは、
  read-back検証を含む単一EphemeralDB transactionで行う。
- `RouteDB.tileIndex`をcanonical geometry→tileEmit lineageのSSOTとして参照しない。
- route MVT の source-layer は `layer0`、`promoteId` は `id`、交通モードpropertyは
  `routeMode` とする。route plugin 内部は common constants を参照し、folder map は同じ値を返す
  ui-map の route source-layer helper を使用する。

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

tileEmitはshape/locationと同じ`createVtHandler`を使用し、
`EphemeralDB.tileEmitBufferRelations`から親tile単位のtaskを決定的に生成する。
成果物は`RouteDB.vectorTiles`へ保存し、正のbyte数をread-back検証してからtaskを完了する。
task計画の入力集合は現在のsessionが計画したroute×bandのgeometry cache IDに固定する。
同じnodeIdに残る過去sessionの別source artifact/relationを現在のMVTへ混入させない。

geometry cache/indexが欠落・不正な場合は失敗する。source artifactを直接読んでtileを生成する
互換経路や、空tile成功への読み替えは行わない。

## 正規実行境界

- session lifecycleの所有者は`RouteBuildSessionOrchestrator -> RouteBuildSession`とする。
- `RouteBuildSession`は各stageの実処理をWorker serviceへ委譲し、canonical event sourceとして
  authoritative task snapshotとtask progressを提供する。
- UIの`RouteBuildStep`はWorker commandとcanonical event subscriptionだけを利用する。
- 旧route mutation APIの`importIdeGsmRoutes / buildRouteTileIndex / generateRouteVectorTiles`と
  browser-local orchestratorは使用・公開せず、canonical sessionと競合する別build経路を持たない。

## Issue #1375適用後の状態（2026-08-22）

- `RouteBuildSession`の`source` handlerはgenerator結果を検証し、direction-awareなidentityと
  入力署名を持つLineString GeoJSONをsource cacheへ永続化する。
- `RouteBuildSession`の`geometry` handlerはsource artifactを検証し、zoom band別geometry
  artifactとtile転置indexを永続化する。
- `tileEmit` handlerは共通`createVtHandler`でMVTを生成し、`RouteDB.vectorTiles`への書込みと
  read-back検証を完了してからtask/stageを完了する。
- `RouteBuildStep`はWorker canonical subscription確立後にcanonical commandだけを送信する。
- browser-local orchestrator、直接3処理のroute mutation API、重複session mapは削除済みである。
- `RouteGenerator` / `SearouteEngine`はengine欠落、load失敗、不正responseをfail-fastにする。

## 検証観点

- `source -> geometry -> tileEmit`の順序とcanonical eventが一致する。
- 各stageの完了時に対応artifactが存在する。
- bidirectional指定の有無でsource keyの方向性が決定的に変わる。
- LineStringが横切る全tileで描画される。
- engine/cache/configの契約違反が可視なtask/session failureになる。
