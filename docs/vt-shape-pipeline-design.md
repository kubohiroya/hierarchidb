# vt パイプライン設計（shape 固有）

本ドキュメントは、shape 固有の差分のみを記述する。
共通仕様は `docs/vt-pipeline-design.md` を参照。

## 対象ジオメトリ

- Polygon / MultiPolygon（境界を含むポリゴン群）

## UX フロー（shape）

- Step2: データソース選択
- Step3: 国/自治体レベルの選択
- Step4: ビルド設定（入力仕様は `docs/vt-pipeline-design.md` を参照）
- Step5: ビルド
- Step6: プレビュー

Step3 の country-availability Dedicated Worker は UI と別の JavaScript realm であるため、
Worker entry 自身が API 公開前に build-time database prefix から exact `shape-chunks` 名を構成し、
inert な Shape chunk-store 参照を一度だけ初期化する。UI entry の初期化を Worker realm へ共有されたものと
みなさず、未初期化、空の database prefix、または別名での再初期化は fail closed とする。

## ステージ構成（shape）

- `source`
- `geometry`
- `tileEmit`

`TaskStage` は `docs/build-session-spec.md` をSSOTとする。旧文書の処理phase名との対応は次のとおり。

| canonical `TaskStage` | 旧phase名 |
| --- | --- |
| `source` | `shape-fetch` |
| `geometry` | `transform` |
| `tileEmit` | `vt` |

旧phase名は既存artifact/config/API識別子を説明する場合に限って使用し、taskQueueやbuild-session eventのstage IDには使用しない。

各 stage の AbortController は session pipeline の AbortSignal に連結する。pause 時は親 signal が source / geometry / tileEmit の実行 worker へ伝播し、実 pipeline Promise が settle するまで task status の再キューと `paused` 永続化を行わない。checkpoint heartbeat と cleanup は fire-and-forget にせず同じ Promise に含め、各永続化境界で abort を再検証する。abort 後に完了した古い run の task/cache/artifact/event 更新は拒否する。

## Worker database 所有境界（shape）

- shape worker entry はAPIを利用可能にする前に、同じbundle module graphが参照する `ephemeral`、`shape`、`shape-chunks` の3 database singletonを明示初期化する
- database名は単一の `getBuildDatabasePrefix()` から `getDBName(prefix, kind)` で導出し、各database kindを固定する
- SharedWorker本体の `WorkerService` による初期化を、shape plugin worker bundle側の初期化として扱わない
- 既に異なる名前で初期化されたsingleton、空のdatabase名、未初期化アクセスは契約違反として失敗させ、lazy initialization、既定名補完、fallbackで処理を継続しない

## Worker network設定の所有境界（shape）

- runtime bootstrapは起動時とWorker API更新時のCORS proxy base URLを、必須の `shapeBuildExtensions.setCorsProxyBaseURL` を通じてshape worker moduleへ明示伝播する
- shape worker moduleは自身の `@hierarchidb/download` stateを更新する。共有network portは次回参照時に設定値の一致を検証し、変更済みなら再生成する
- runtime bootstrapは `WorkerAPI.setUiStorageBridge` で受け取ったread-through bridgeを、自身とshape worker moduleそれぞれの `AuthService` へ登録する。shape側の登録は必須の `shapeBuildExtensions.setUiStorageBridge` を通じて行う
- dynamic plugin chunkとruntime bootstrap chunkがmodule scopeを暗黙共有すると仮定しない。別runtime moduleの設定、環境変数、compatibility既定値からproxyや認証sessionを推測しない

## source stage（shape）

- GeoJSON を国 + 自治体レベル単位で分割し取得
- smartFetch を通して取得（認証・リトライ・nodeId 超えキャッシュ）
- flatgeobuf に変換して stage1Buffers に保存
  - `domainType`: `shape`
  - `sourceKey`: `${countryCode}:${adminLevel}`（countryCode は **ISO2 を正**とし、dataSource 側で ISO2/ISO3 の揺れを吸収しない）
- `dataSource`、ISO2 `countryCode`、整数 `adminLevel`、`sourceKey`、source request signature は cache/source identity の必須要素とする。upstream revision は取得できる場合に identity へ含め、存在する空文字を欠落扱いで無視しない
- identity の欠落・空値・非 canonical 値を `unknown`、`XX`、`:0`、空 URL、node/task 情報からの推測で補完しない
- タスク単位: `countryCode + adminLevel`（1タスク=1 stage1Buffer）
- `geometry`タスク生成はplugin側が責務を持つ
  - vt-orchestratorには`geometry` / `tileEmit`タスクを投入する
- 国コードの ISO2/ISO3 変換は plugin の dataSource strategy が担う（外部 API の国コード揺れは許容しない）
- 内部の基準コード体系は ISO2 を採用し、`sourceKey` とキャッシュキーは ISO2 統一で運用する
- 例: GeoBoundaries/GADM の URL は ISO3 を要求するため、strategy 側で ISO2 → ISO3 変換して URL を生成する
- SharedWorker / worker asset から ISO3166 CSV を読む場合も、app base path（例: `/hierarchidb/`）配下の `iso3166-2-level1.csv` を解決し、base path 欠落による ISO3→ISO2 変換失敗を silent fallback で吸収しない

### Raw source cache の network 所有境界

- upstream download は shape-plugin の data-source strategy が所有し、明示的な `FetchNetworkPort` と `auth.scope='shape'` を持つ ChunkStore だけが network access を実行する
- runtime-worker の `ShapeQueryService` と raw source cache helper は、既存の IndexedDB cache に対する local read / write / list / count / relation 操作だけを所有する
- 現行buildの raw source cache key は download URL（`http://` または `https://`）である。明示的に legacy key mode を選んだwriterが生成する `download:` key も raw source entry として識別する
- 同じ ChunkStore 内の `geoboundaries:metadata:*` などのmetadata entryは raw source cacheのlist/count/read対象に含めない
- runtime-worker の local-only Shape ChunkStore は `FetchNetworkPort` を生成せず、network fetch API を呼び出した場合は `LocalShapeChunkStoreNetworkAccessError`（`LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN`）で即時に失敗する
- auth scope の補完、auth無効化、stale cacheへの読み替えによって誤ったnetwork要求を継続してはならない

### Raw source cache の network 所有境界

- upstream download は shape-plugin の data-source strategy が所有し、明示的な `FetchNetworkPort` と `auth.scope='shape'` を持つ ChunkStore だけが network access を実行する
- runtime-worker の `ShapeQueryService` と raw source cache helper は、既存の IndexedDB cache に対する local read / write / list / count / relation 操作だけを所有する
- 現行buildの raw source cache key は download URL（`http://` または `https://`）である。明示的に legacy key mode を選んだwriterが生成する `download:` key も raw source entry として識別する
- 同じ ChunkStore 内の `geoboundaries:metadata:*` などのmetadata entryは raw source cacheのlist/count/read対象に含めない
- runtime-worker の local-only Shape ChunkStore は `FetchNetworkPort` を生成せず、network fetch API を呼び出した場合は `LocalShapeChunkStoreNetworkAccessError`（`LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN`）で即時に失敗する
- auth scope の補完、auth無効化、stale cacheへの読み替えによって誤ったnetwork要求を継続してはならない

### Raw source cache の network 所有境界

- upstream download は shape-plugin の data-source strategy が所有し、明示的な `FetchNetworkPort` と `auth.scope='shape'` を持つ ChunkStore だけが network access を実行する
- runtime-worker の `ShapeQueryService` と raw source cache helper は、既存の IndexedDB cache に対する local read / write / list / count / relation 操作だけを所有する
- 現行buildの raw source cache key は download URL（`http://` または `https://`）である。明示的に legacy key mode を選んだwriterが生成する `download:` key も raw source entry として識別する
- 同じ ChunkStore 内の `geoboundaries:metadata:*` などのmetadata entryは raw source cacheのlist/count/read対象に含めない
- runtime-worker の local-only Shape ChunkStore は `FetchNetworkPort` を生成せず、network fetch API を呼び出した場合は `LocalShapeChunkStoreNetworkAccessError`（`LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN`）で即時に失敗する
- auth scope の補完、auth無効化、stale cacheへの読み替えによって誤ったnetwork要求を継続してはならない

## geometry stage（shape）

- ズーム帯ごとに簡略化した FGB を生成
- **帯内最小zのみ tileIndex 作成**
- band3 予約は adminLevel>=2 を扱うタスクに限定
- タスク単位: `stage1Buffer` × `band`（band0/1/2、band3 は条件付き）
- band3 は「いずれかの国で adminLevel>=2 が選択された場合」に自動 ON
- 簡略化は turf の Ramer–Douglas–Peucker を使用し、許容誤差は Step4 設定に従う（入力仕様は `docs/vt-pipeline-design.md` を参照）
- Source stage が session に保存した finite `baseTolerance` と整数 `vertexLimit=6553` を必須入力とする。Geometry task 内で代表 feature の再探索や固定 tolerance へのフォールバックを行わない
- `vertexLimit=6553` は排他的な閾値であり、正常出力は feature ごとの `vertexCount < 6553` を満たす
- multiplier/minRatio/maxRatio は band ごとに finite、`0.0..2.0`、`minRatio <= multiplier <= maxRatio` を満たすことを事前検証し、clamp・並べ替え・既定値補完を行わない

## tileEmit stage（shape）

- 固定タスク（1+64+4096） + band3 予約タスク
- geojson-vt でタイル生成し VTMutationAPI へ保存
- production の SharedWorker artifact は tile encoder の `@maplibre/vt-pbf` を build 時に bundle する。ブラウザが解決できない bare module specifier を entry/chunk に残さず、artifact boundary 検証で違反を fail-fast に拒否する
- `tileEmitConfig.invalidGeometryFilter` は5つの boolean check を持つ必須 config とし、旧 source/fetch config key を読まない
- invalid geometry filtering の stage owner は tileEmit とし、geometry artifact を GeoJSON collection に復元した後、tileEmit が使用する geojson-vt index の作成直前に一度だけ適用する
- legacy の tile-local `enableTopojsonSimplify=true` は canonical filter 後にgeometryを再変形してtask単位メトリクスと最終入力を乖離させるため、設定契約違反として拒否する。再有効化には簡略化をcanonical filter前へ移す設計変更を必須とする
- tile partitioning 後の各geojson-vt入力はindex作成直前に構造・finite・WGS84・ring contractを再検証する。これは品質checkやwarning metadataを再計数する第二filterではない
- 非 finite / WGS84 範囲外座標、必須 geometry/payload 欠落は task failure とする。明示的に有効な品質 check に不適合な polygon だけを drop + `TaskQueueRecord.metadata.resultSeverity='warning'` の対象とする
- 品質 check の評価順は `area` → `lineLength` → `maxEdgeLength` → `selfIntersection` → `triangleRingRatio` とする。複数 check に不適合な polygon は最初の check だけに計上する
- フィルタ後の feature だけを入力に `featureStats` と `featuresByContinent` を再構築し、親タイルサマリーと全 geojson-vt build flow が同じ collection を使用する
- warning metadata は `invalidPolygonFilteredCount`、`invalidPolygonCheckedCount`、`invalidPolygonFilteredRate`、`affectedFeatureCount`、`featureErrorCountTotal`、`invalidPolygonFilteredByCheck` を task metadata のトップレベルに保存する

## Cache identity 契約（shape）

- source: 必須の `dataSource + sourceKey + request signature + output shaping config signature` と、存在する場合の upstream revision
- geometry: `sourceKey + bandIndex + source artifact hash + baseTolerance + geometry config signature`
- tileEmit: `bandIndex + zBase + tileId + canonical bufferIds[] + tileEmit config signature`
- 各必須文字列は空でなく、各数値は finite かつ定義された整数/範囲でなければならない。`bufferIds` は field 自体を必須とし、空配列は正規の empty-tile 判定としてのみ許容する
- 永続済み `cacheKey` / `inputHash` は両方が空でない場合だけ有効とする。一方だけの欠落、stage不明、identity構成値欠落をlegacy keyや既定値で補完しない
- `sourceKey` は正規の `ISO2:adminLevel`、source request は絶対HTTP(S) URLとして検証する。URLのrequest targetはsource `inputHash`へ含め、queryの異なるrequestを同一入力へ収束させない。upstream revisionは存在する場合に空でない値を要求する
- identity builderは文字列のtrim、数値の丸め、空配列への置換を行わない。`bufferIds` は明示された配列の各要素を検証した後にsetとしてsort/deduplicateし、field欠落と明示的な空配列を区別する
- task生成時に完全な `cacheKey` / `inputHash` pairを永続化する。resume/reconcileのreaderはtaskの正規stageとこのpairだけを読み、他のtask payloadからidentityを再構成しない
- identity契約違反はtaskのinsert/deleteより前にreconcileをrejectする。pipeline/sessionは失敗を正規error経路でUIへ可視化し、不完全なtaskや既存artifactを変更しない

## Artifact lineage / cleanup 契約（shape）

- 正規 lineage は `selection meta -> source artifact -> geometry artifact -> tileEmit artifact` とする
- 上流 artifact の削除・置換・invalid化は、参照する下流 artifactと未完了taskを下流端まで cascade cleanup する
- 永続 vector tile record は source/geometry cache への逆参照を持たないため、source/geometry invalidation は対象 nodeId の vector tile、tile summary、feature metadata、data-source metadata をすべて削除する。この node 単位削除は正規の lineage 境界であり、曖昧な fallback ではない
- cleanup 順序は、永続 tile/metadata の単一 ShapeDB transaction、source artifact に保存された正規 `rawSourceCacheKey` で特定する対象 raw chunk、relation/task/error と対象 geometry/source cache の単一 EphemeralDB transaction とする。source cache ID を chunk metadata ID へ読み替えず、上流 cache を先に消して下流探索を不能にしない
- cleanup target の cache ID は対象 nodeId に所有されることを削除前に検証し、別 node の data/meta record を指す場合は契約違反として失敗させる
- fresh build は task生成前に対象 nodeId の tileEmit artifact/relation/task を無効化し、旧config/hashの tile を新規出力と混在させない
- `timestamp === 0` の cache data は対応metadataが存在すれば正常な二相書込み結果である。metadataが存在しないdataだけを incomplete cache として cleanup する
- cleanup は同一targetで再試行可能な冪等操作とし、存在しないrecordを契約違反に読み替えない
- cleanup 完了前の artifact/cache は再利用不可とし、一部削除失敗を成功扱いしない
- cleanup failure は session/task の可視な error とし、stale artifact を残したまま次stageやresumeへ進まない
- UIの選択変更では cleanup、draft更新、旧build-session削除がすべて成功した後にのみ前回選択baselineを進める。失敗時はbaselineを保持し、UI-internal `criticalError` でSSOT lifecycleを`failed`にする

## Border geometry / shared-arc inventory（#548）

本節は #548 の実装前 inventory であり、現行 runtime の仕様を変更しない。国境・海岸線・共有境界の storage、spatial index、shared arc、arc simplification、polygon reconstruction は、以下の現行 Shape pipeline 契約を前提に小粒 Issue へ分割する。

### 現行永続形式

| 領域 | 現行 record / table | 所有者 | #548 での扱い |
| --- | --- | --- | --- |
| source artifact | `EphemeralSourceCacheRecord` / `sourceCache`, `sourceCacheMeta` | `packages/gis-sdk/src/ephemeral/EphemeralDBRecordTypes.ts` | 入力 GeoJSON/FGB 単位の artifact。shared arc storage へ読み替えない。 |
| geometry artifact | `EphemeralGeometryCacheRecord` / `geometryCache`, `geometryCacheMeta` | `packages/gis-sdk/src/ephemeral/EphemeralDBRecordTypes.ts` | band 単位の簡略化済み FGB。topology graph や arc identity は保持しない。 |
| tile relation | `EphemeralTileIdToBufferRelation` / `tileEmitBufferRelations` | `packages/gis-sdk/src/ephemeral/EphemeralDBRecordTypes.ts` | geometry buffer と tileEmit task の関係。spatial index の代替として扱わない。 |
| vector tile output | `VectorTileRecord` / `vectorTiles`, `ShapeTileSummaryRecord` / `tileSummaries` | `packages/shape-store/src/VectorTileRecord.ts`, `packages/shape-store/src/ShapeDB.ts` | 最終 MVT 出力。source/geometry cache への逆参照を持たない。 |
| metadata | `featureMetadata`, `sourceMetadata`, `tabularMetadata` | `packages/shape-store/src/ShapeDB.ts` | preview/search 用 metadata。shared arc topology の SSOT ではない。 |
| task/session | `buildTasks`, `buildSession*`, `buildStageStatuses` | `packages/gis-sdk/src/ephemeral/EphemeralDBRecordTypes.ts`, `packages/shape-store/src/ShapeDB.ts` | build lifecycle の状態。geometry topology を保存しない。 |

現行の `geometryCache` は `id / nodeId / domainType / bandIndex / sourceKey / data / featureCount / vertexCount / polygonCount / extractionRatio / tolerance / timestamp` を中心とする artifact cache である。共有境界 arc、隣接関係、arc-to-polygon reconstruction relation、topology-preserving simplification metadata は正規 field として存在しない。#548 の storage workstream は、これらを既存 field へ詰め込まず、正規 schema と ownership を先に定義する。

### 現行処理境界

- `source` は国×ADM selection から source artifact を生成する。`sourceKey` は ISO2 `countryCode:adminLevel` を正とする。
- `geometry` は source artifact を band 単位に簡略化し、FGB を `geometryCache` へ保存する。`packages/vt-orchestrator/src/transform/createGeometryStageHandler/runGeometryStageOutputPhase.ts` は出力 collection から tile id を集め、`tileEmitBufferRelations` を再構築する。
- `tileEmit` は `geometryCache` を GeoJSON collection へ復元し、invalid geometry filter 後の同一 collection から `featureStats`、`featuresByContinent`、geojson-vt index、vector tile output を作る。参照: `plugins/shape-plugin/src/services/vt/runShapeTileEmitStageSection.ts`、`packages/vt-orchestrator/src/vt/createLayerIndexForTile.ts`。
- cascade cleanup は persistent tile/metadata、raw source buffer、ephemeral source/geometry/task/relation/error の順に削除する。参照: `plugins/shape-plugin/src/services/vt/runShapeArtifactCascadeCleanup.ts`。

### 実装済み / 部分実装 / 未実装の分類

| 分類 | 現状 | 根拠 | 後続判断 |
| --- | --- | --- | --- |
| geometry cache | 実装済み | `EphemeralGeometryCacheRecord`, `finalizeGeometryStageCache` | #548 storage schema と混同しない。必要なら新規 topology/arc store を定義する。 |
| tile relation index | 部分実装 | `tileEmitBufferRelations` | tileEmit task 入力用 relation であり、containment query や adjacency の汎用 spatial index ではない。 |
| simplification | 部分実装 | `createGeometryStageHandler` | 現行 handler には `fallbackTolerance`、ratio clamp、代表 feature 探索が残る。fail-fast 契約への整合は #548 とは別の前提修正または子 Issue として扱う。 |
| invalid geometry filter | 実装済み | `tileEmitConfig.invalidGeometryFilter` | stage owner は tileEmit。shared arc simplification の品質 filter と混在させない。 |
| shared-border arc extraction | 未実装 | 該当する正規 table / API / stage が存在しない | storage identity と input dataset alignment を先に仕様化する。 |
| country adjacency | 未実装 | adjacency relation の正規 record が存在しない | shared arc extraction の出力から導出するか、別 index とするかを仕様で決める。 |
| topology-preserving arc simplification | 未実装 | arc graph と polygon reconstruction relation が存在しない | per-feature RDP と別責務として扱う。 |
| polygon reconstruction | 未実装 | coastline/shared arc から polygon を復元する stage/API が存在しない | reconstruction の入力不変条件、失敗条件、出力 artifact を先に定義する。 |

### 後続 sub-issue 分割案

1. `docs(shape): specify border geometry storage identity and schema`
   - 入力: 本 inventory。
   - DoD: arc、edge、ring、polygon reconstruction relation、dataset revision、node ownership、cache identity を定義する。
   - Rollback: docs-only revert。
2. `docs(shape): specify spatial index and containment query contract`
   - 入力: storage identity/schema。
   - DoD: tile/spatial index の用途、key、query boundary、更新/削除時の lineage を定義する。
   - Rollback: docs-only revert。
3. `feat(shape): add border geometry storage behind a default-off flag`
   - 入力: storage/index docs。
   - DoD: 新規 store を既定 OFF で追加し、既存 source/geometry/tileEmit record を読み替えない。
   - Rollback: flag OFF、schema migration 方針に従う。
4. `feat(shape): extract shared-border arcs with explicit topology invariants`
   - 入力: storage store。
   - DoD: arc identity、orientation、owner polygon relation、coastline/shared-border distinction、contract errors を実装する。
   - Rollback: flag OFF、対象 arc store の再生成。
5. `feat(shape): simplify shared arcs without breaking polygon topology`
   - 入力: shared arc extraction。
   - DoD: topology invariant を満たす simplification と検証 fixture を実装する。
   - Rollback: flag OFF、simplified arc artifact の破棄。
6. `feat(shape): reconstruct polygons from coastline and shared arcs`
   - 入力: simplified arcs。
   - DoD: reconstruction failure を可視な task error とし、clamp/default/silent repair で閉じない。
   - Rollback: flag OFF、reconstructed artifact の破棄。
7. `feat(shape): integrate border geometry pipeline and regression validation`
   - 入力: reconstruction。
   - DoD: source/geometry/tileEmit lineage、cache cleanup、Step5/preview validation、benchmark を通す。
   - Rollback: flag OFF、対象 artifact cleanup。

### #548 実装時の禁止事項

- 既存 `geometryCache.metadata` に topology graph を暫定保存して正規 schema の代替にすること。
- `tileEmitBufferRelations` を adjacency / spatial index の汎用 SSOT として扱うこと。
- source/geometry/tileEmit の既存 `cacheKey` / `inputHash` を、arc identity や reconstruction identity へ読み替えること。
- 共有境界の不一致、開いた ring、向き不一致、非 finite 座標を clamp、snap、default 補完で成功扱いすること。
- 未確認の外部 geometry library を正規仕様に固定すること。

## 旧実装からの置換対象

- shape-plugin の旧 `vectortile` ステージ関連コード
- `shape-store` を `vt-shape-store` に置換
  - `shape-store` は **shape 用の旧中間ストア**を指す

## shape 固有のファイル補足

- `plugins/shape-plugin/src/services/build/shapeBuildConfig.ts`
  - Step4 の設定値から `ObsolateBuildConfig` を組み立てる（入力仕様は `docs/vt-pipeline-design.md` を参照）
- `plugins/shape-plugin/src/services/build/shapeBuildRunner.ts`
  - vt-orchestrator の `runPipeline` を呼び出す
