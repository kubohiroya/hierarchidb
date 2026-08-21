# route ビルド前〜ビルド仕様

最終更新: 2026-08-22

## 仕様の位置づけと優先順位

本書を route の Step2〜Step6、location 連動、ビルド設定、ステージ責務、
cache identity の正規仕様（SSOT）とする。

- `docs/build-session-worker-ui-event-spec.md` は Worker→UI の4イベント契約を定義する。
- `docs/build-session-spec.md` の `source / geometry / tileEmit`、task status、fail-fast 原則を
  route にも適用する。
- `docs/vt-route-pipeline-design.md` は本書のステージ別詳細だけを補足する。
- `docs/location-route-design-gap.md` と `plans/current-route-stage-flow.md` は調査・移行資料であり、
  本書と衝突する記述を仕様根拠にしない。
- `plugins/route-plugin/README.md` / `README_ja.md` は利用者向け概要であり、契約の詳細は本書を参照する。

旧文書・旧コードで使われる語は次のように対応させる。新規の型、event、task、永続recordでは
旧語を使わない。

| 正規ステージ | 旧称 | 責務 |
| --- | --- | --- |
| `source` | `fetch`, `route-fetch` | 入力取得、location解決、LineString生成、source cache永続化 |
| `geometry` | `transform` | ズーム帯別filtering、simplification、tile転置index生成、geometry cache永続化 |
| `tileEmit` | `vt`, `vectorTile` | geometry cache/indexからMVTを生成し、route storeへ永続化 |

## 確定した非交渉事項

- 1つの `nodeId` に対する build session は1つだけ存在する。
- Worker側の正規entry pointは
  `RouteBuildSessionOrchestrator -> RouteBuildSession` とする。
- UIは正規Worker commandを通じてstart/pause/resumeを要求する。UIから
  `importIdeGsmRoutes -> buildRouteTileIndex -> generateRouteVectorTiles` を独立に直列実行する経路は
  使用しない。この3つのdirect mutation APIとbrowser-local orchestratorは削除し、正規経路として残さない。
- 各ステージは実成果物を生成する。未実装/no-op handlerがtaskやstageを`completed`にしてはならない。
- 必須入力、設定、engine、cache metadata、timingが欠落・不正な場合は即時に失敗する。
  丸め、clamp、既定値補完、別engineへの暗黙fallbackで継続しない。

## 目的

本ドキュメントは、route の pre-build から build/preview までの仕様を定義する。
特に、route 成果物が location 定義に強く依存する点（非レイトバインディング）を明示する。

## 前提: route と location の関係

- route の LineString は、location が提供する始点/終点の緯度経度を入力として生成される。
- このため route 成果物は location 定義に従属し、location 変更の影響を受ける。
- location と route は保存先 DB が異なるため、Dexie transaction で厳密な原子性は保証しない。
- 非原子的更新により route が stale になることを許容し、事後検出で運用する。

## Step3: 国×交通モードフィルタ（selectedArrayByCountries）

### UI 仕様

- 縦軸: 国名
- 横軸:
  - OR 条件（始点または終点が一致）: 空路 / 海路 / 高速鉄道 / 在来線鉄道 / 道路
  - AND 条件（始点かつ終点が一致）: 空路 / 海路 / 高速鉄道 / 在来線鉄道 / 道路
- 1 国あたり 10 チェックボックスを持つ。

### 初期状態

- Step2 のデータソースが返したcoverageに存在する「国×交通モード」だけチェックボックスを有効化する。
- Step3の行はcoverageに存在する国だけで構成する。coverage外のISO国をdisabled行として描画しない。
- 生成されたチェックボックスは初期状態で `checked` とする。
- coverageはデータソース入力の実在範囲であり、location DB内の現在のノード集合ではない。
  したがって、coverageに存在する国はlocation DBに解決可能なPointがまだ無くても表示する。
- coverage APIの正規payloadは `coverageByCountryOr` と `coverageByCountryAnd` だけである。
  `coverageByCountry` alias、5-cell行、nullish fallback、空coverage、不明route modeは契約違反として失敗させる。
- 選択されたroute行の始点/終点をsourceステージで解決できない場合は、理由を持つtask errorとして
  可視化する。「処理対象なし」や空成果物へ読み替えない。

### OR/AND 連動

- 同一行で OR 側をチェックした交通モードは、同モードの AND 側を自動で `checked/disabled` にする。
- OR 側が外れた場合は、AND 側の `disabled` を解除する（AND 側の最終状態はユーザー操作を反映）。

### state 更新

- Step3 の操作結果は `selectedArrayByCountries` に反映する。
- `selectedArrayByCountries` はcoverage国だけをkeyに持ち、各rowはOR 5列 + AND 5列の10 booleanだけを保持する。
- Step5 の fetch 対象は `selectedArrayByCountries` を唯一の選択入力として扱う。

## Step4: Build 設定

- shape の build 設定 UI を route でそのまま再利用する。
- 範囲・単位・デフォルト値・ズーム帯適用ルールは原則 shape と共通。
- VT 設定カードも shape と共用する。
- 将来拡張として OSRM Route API / searoute-js の追加パラメータを導入可能にする。

### 設定のSSOT

- 永続化する唯一のbuild設定は `RouteEntity.buildConfig` に格納する `RouteBuildConfig` とする。
- 共通ステージ設定は `sourceConfig / geometryConfig / tileEmitConfig / cleanupConfig` に保持する。
- route固有設定は `routeGeneration / routeGeometryConfig / laneCaps` 等、`RouteBuildConfig` の
  明示フィールドに保持する。
- `RouteProcessingConfig` を別の永続設定木として併存させない。runtime-only handleはbuild設定へ
  シリアライズせず、nodeIdに対応するbuild-session SSOT状態木へ保持する。
- 同じ設定を `buildConfig` と別フィールドへ複製したり、欠落値を別フィールドから補完したりしない。

2026-08-21時点の`RouteEntity.buildConfig`は`BaseBuildConfig<string>`型で、route固有フィールドを
型として保証していない。また、`RouteProcessingConfig`型は存在するが永続設定として使用されていない。
#248の設定分離DoDはこのSSOT決定で置き換え、後続実装では`buildConfig`を`RouteBuildConfig`へ
型整合させ、未使用の第二設定型を残さない。

## Step5: Build

### UI/制御

- build ステップの UI 構成と動作は shape と基本的に同一とする。
- 実装は最大限共用し、route 固有差分のみ差し込む。
- `RouteBuildStep` は Container、hooksを持たない `RouteBuildStepView`、
  `useRouteBuildStepState` に分離する。Viewは共通`BuildSessionProgressPanel`を直接使用し、
  route専用の再ラップcomponentやbrowser-local lifecycle stateを持たない。
- route UI adapterが所有するのは`source / geometry / tileEmit`のstage vocabulary、表示label、
  必須build入力、Worker transport指定、結果表示へのdraft反映だけとする。購読検証、snapshot readiness、
  progress buffering、command mutation stateは`@hierarchidb/ui-build-sessions`の共通kernelを使用する。
- subscriptionおよびcommand transportの初期化が完了するまでstart/resumeを禁止する。
  canonical sessionが`queued`の間はqueued cancelだけを表示し、
  `cancelQueuedBuildSession`へ接続する。pause/resume/cancel成功をlocal stateで合成しない。
- canonical `paused / completed / failed`とRoute固有の前回crash insightは、共通Panelの
  suspend/completion/crash dialog surfaceへ接続する。canonical timingの欠落を
  draft timestampや`Date.now()`で補完しない。

### 内部パイプライン

- `source` ステージ:
  - shape と同様にデータソースごとの strategy pattern で実装を切り替える。
  - 交通モードに応じた LineString GeoJSON を生成する。
  - source cache には「オリジナル 1 本のみ」の LineString GeoJSON を保存する。
    - shape のようなズーム帯別 GeoJSON コピーは作成しない。
- `geometry` ステージ:
  - route では filtering と simplification を一括で実行する。
  - `geometryConfig.geometryEngine='turf'` と `simplifyAlgorithm='geojson'` を明示必須とし、
    route の RDP simplification tolerance は緯度経度のdegree単位とする。
  - `zoomBandBoundaries` は `0..22` のstrictly increasingな整数列で2要素以上、
    `minDistanceMetersByBand` / `simplifyToleranceByBand` はband数と同じ長さのfiniteな非負値列とする。
    値の丸め、sort、clamp、末尾値の反復、既定値補完は行わない。
  - 各bandは`zBase=zMin`とし、中間bandの上端は次boundaryの直前、最終bandだけ最後のboundaryを
    含む。LineStringの端点を保持し、`zBase`で横切るtileの転置indexを生成する。
  - filteringでrouteが除外されたbandも、空FeatureCollectionのgeometry artifactを永続化する。
    空成果物をno-op成功へ読み替えず、filter結果とlineageをartifact metadataへ保持する。
  - tile index対象のLineStringはWeb Mercator緯度範囲内でなければならない。範囲外座標を
    tile端へclampしない。経度差が180°を超えるsegmentはantimeridianを横断するworld-wrap区間とし、
    経度seamの両側tileをindexへ含める。
  - filtering / simplification / index生成のいずれかを省略して成功扱いにしない。
- `tileEmit` ステージ:
  - shape/location と共通の`createVtHandler`を利用する。
  - geometry cacheとtile転置indexを読み、MVT生成とroute storeへの永続化までを完了する。
  - 親tile単位のtaskはtile転置indexから決定的に生成し、各taskは正のtile件数を生成しなければ失敗する。
  - task入力は現在のsessionが計画したroute×bandのgeometry cache IDだけに限定し、同じnodeIdに残る
    過去sessionの別source artifact/relationを現在のMVTへ混入させない。
  - `RouteDB.vectorTiles`への書込み結果をbyte単位でread-back検証した後にのみ完了する。

### source key / cache identity

- `sourceKey` は論理route identityであり、`<routeMode>:<fromLocationId>:<toLocationId>` とする。
- routeは既定で方向付きとし、始点/終点の順序を保持する。
- `metadata.bidirectional === true` または `metadata.oneway === false` が契約どおり明示されたrouteだけ、
  `(longitude, latitude, locationId)` の辞書順で端点を並べ、双方向を同一`sourceKey`へ正規化する。
- directionality metadataが欠落している場合にbidirectionalと推測しない。不正型や
  `bidirectional` / `oneway` の矛盾を既定値へ補完しない。
- geometry生成に影響する座標、generation method/options、build設定は入力`meta`/`inputHash`へ含める。
  `sourceKey`が同一でも入力署名が異なればcacheを再利用しない。
- routeMode、locationId、座標、入力署名の必須要素が欠落・不正な場合は契約違反として失敗する。

例:

```text
road:location-a:location-b                  # directional
waterway:location-a:location-b              # explicitly bidirectional and canonicalized
```

無条件に始終点をsortする旧仕様と、常に`${srcId}/${dstId}`で方向を保持する旧仕様は廃止する。

### metadata 保存

- data-source strategy / location 解決境界は、正規 `RouteFeature.startPoint / endPoint` の
  route metadata に以下を保存する:
  - location からコピーした始点/終点座標
  - 始点/終点の admin0〜2 の name/code
  - 始点終点間の距離
  - 中継点数
- `RouteBuildSession` が受け取る `RouteBuildRouteInput` は、この境界で解決済みの
  location ID と始点/終点座標を必須入力とする。session 内で曖昧な文字列検索や
  別 location への fallback を行わない。
- source cache metadata は route metadata の複製先ではない。後続stageがartifactの同一性と
  lineageを検証できるよう、`sourceKey`、`inputHash`、content hash、route mode、directionality、
  generation method、location ID、始点/終点座標、距離、所要時間、中継点数、feature/vertex数、
  永続化完了時刻を保存する。admin name/codeは正規`RouteFeature`をSSOTとし、source cacheへ
  重複保存しない。
- geometry cacheはroute×zoom bandごとに1件を`EphemeralDB.geometryCache`へ保存し、
  `geometryCacheMeta`へdata以外のlineageを保存する。metadataにはsource cache ID、source input/content
  hash、geometry input/content hash、route mode、band範囲、filter閾値、simplification tolerance、
  filter結果、feature/vertex/tile数、永続化完了時刻を含める。
- tileEmit対象となる非空geometry artifactは、shape/locationと共通のVT handlerが読むFlatGeobufで保存し、
  metadataの`format`を`flatgeobuf`とする。filter除外artifactは転置indexへ登録せず、空featuresの
  GeoJSONと`format=geojson`を保存する。転置indexが非FlatGeobuf artifactを参照した場合は失敗する。
- 正規tile転置indexは`EphemeralDB.tileEmitBufferRelations`のtile→geometry buffer関係とする。
  tile IDはVT orchestratorの共通packed IDを使い、tile境界への接触も交差として含める。
  旧`RouteDB.tileIndex`はcanonical geometry→tileEmit lineageのSSOTとして使用しない。
- 同一route sourceのgeometry cache更新は、旧band artifact/relation削除、新artifact/meta、
  新relation書込み、read-back検証を1つのEphemeralDB transactionで完了する。

## Step6: Preview

- shape/location の preview と基本的に同じ UI 構成を利用する。
- FloatingWindow で以下を重ね表示できる:
  - Metadata: routes
  - 交通モード表示トグル
  - スタイル設定
- 交通モードは 5 アイコンボタンの複数 on/off トグルとする（location の表示種別トグルと同様）。
- 保存先は shape と同様の FloatingWindow 永続化（位置・サイズ・モード）を使う。

## location 変更時の波及仕様

### location 行削除

- 対象 location 行がいずれかの route から参照される場合、location UI で警告ダイアログを表示する。
- 選択肢:
  - 参照 route をカスケード削除して続行
  - キャンセル

### location 行更新

- 対象 location 行が参照中の場合、警告ダイアログを表示する。
- 選択肢:
  - 参照 route をカスケード更新して続行
  - キャンセル
- カスケード更新対象は「同一始点終点を参照する全 route ノード」とする。

### プロパティ別の更新ルール

- 始点/終点の座標変更または admin code 変更:
  - 該当 route ノードで該当経路の fetch キャッシュを削除
  - route UI に `rebuild required` タグを表示
  - sessions に「再ビルド予約」項目を作成
    - 予約は route ノード単位でまとめる（経路単位では作らない）
- それ以外（admin name など）:
  - 対応 route metadata を即時更新

## stale 判定と整合チェック

- stale 判定に使う比較項目は次のセット:
  - 座標
  - admin code
  - admin name
- Metadata は通常、保持中の値を受動表示する。
- ただし Step6 の `Metadata: routes` 右上に、route ノード全体を対象にした手動整合チェックボタンを置く。
- 整合チェック結果は次を表示する:
  - `✅同期済み(件数)`
  - `⚠️更新が必要(件数/全体件数)`
- stale 判定は自動では行わず、手動ボタンで実行する。

## Worker→UI event契約

- route sessionは `sessionStatusUpdated / heartbeat / stageSnapshotUpdated / taskProgressUpdated` の
  4イベントだけを配信する。
- `stageSnapshotUpdated` は開始済みstageのauthoritative full task snapshotであり、未開始stageには配信しない。
- task progressはfiniteな`0..100`だけを受理し、taskIdごとの単調増加versionを持つ。
- aggregate progressからcanonical eventを推測・変換しない。
- 詳細は `docs/build-session-worker-ui-event-spec.md` を参照する。

## canonical Worker start入力

- Runtime bootstrapはTreeNodeの`draftData`を無加工でroute pluginへ渡す。
- 現行のdirect-route入力は`RouteEntityPayload.buildConfig / routeMode / startLocationId /
  endLocationId / lineGeometry`を必須とし、`lineGeometry`の先頭・末尾を始点・終点座標として使う。
- `routeMode`は`ROUTE_MODES`の正規値を直接保持する。`transportMode`や`transportSelection`から
  暗黙変換せず、欠落・不正値はstart時の契約違反として失敗させる。
- 存在しない`draftData.routes`を別の入力SSOTとして追加しない。
- 座標はfiniteかつlongitude `-180..180` / latitude `-90..90`を満たすことを要求し、
  routeMode、location ID、座標、またはbuild設定が不正な場合はstartを失敗させる。
- `selectedArrayByCountries`から複数routeを計画するsource strategyへの移行は
  location連動とStep3選択契約を実装するIssue #262の対象であり、direct-route入力と混在させない。
