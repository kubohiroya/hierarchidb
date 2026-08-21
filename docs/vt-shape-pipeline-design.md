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

## 旧実装からの置換対象

- shape-plugin の旧 `vectortile` ステージ関連コード
- `shape-store` を `vt-shape-store` に置換
  - `shape-store` は **shape 用の旧中間ストア**を指す

## shape 固有のファイル補足

- `plugins/shape-plugin/src/services/build/shapeBuildConfig.ts`
  - Step4 の設定値から `ObsolateBuildConfig` を組み立てる（入力仕様は `docs/vt-pipeline-design.md` を参照）
- `plugins/shape-plugin/src/services/build/shapeBuildRunner.ts`
  - vt-orchestrator の `runPipeline` を呼び出す
