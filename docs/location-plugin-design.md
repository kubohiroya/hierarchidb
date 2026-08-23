# location-plugin 設計（LocationPoint SSOT + derived MVT）

本ドキュメントは location-plugin の正規設計を定義する。LocationPoint は metadata と検索の SSOT とし、MVT は MapLibre 描画と画像生成 runner のために再生成可能な派生成果物として扱う。MVT pipeline の詳細契約は `docs/location-mvt-pipeline-design.md` を参照する。

## 目的

- location ノードの作成フロー（Step2〜Step6）を現行 UI/UX と整合する形で定義する。
- `LocationPoint` を地点 identity、座標、検索 index、完全 metadata の唯一の永続ソースとして定義する。
- `source -> geometry -> tileEmit` の3 stageで、LocationPoint dataset から描画用 MVT を決定的に生成する。
- MapLibreGL の通常表示、hover/click detail、画像生成 runner が同じ source-layer と readiness contract を使う。

## 参照

- `docs/location-mvt-pipeline-design.md`
- `docs/build-session-spec.md`
- `docs/build-session-worker-ui-event-spec.md`
- `docs/vt-pipeline-design.md`
- `docs/vt-shape-pipeline-design.md`
- `docs/vt-route-pipeline-design.md`
- `docs/location-route-design-gap.md`

## 非目標

- MVT を LocationPoint や metadata の SSOT にすること。
- arbitrary metadata を MVT feature properties へ複製すること。
- `renderRank` / `importance` / `iconKey` / `labelClass` / `minZoom` を任意 metadata から推測、丸め、既定補完して tileEmit を継続すること。
- 旧 viewport GeoJSON path を正規描画 path として残すこと。移行・rollback surface としての扱いは `docs/location-mvt-pipeline-design.md#旧viewport-geojson-pathの移行とrollback` に限定する。

## UX フロー（Step2〜Step6）

### Step2: データソース選択

- 目的: 地点データの取得元を選択する。
- canonical runtime build では、Worker source strategy を持つ source だけを選択可能にする。
- 選択可能な source は `openstreetmap`（Nominatim）, `overpass`, `ourairports`, `openflights`, `world-port-index` とする。
- `ide-gsm` など tabular source は TabularReadPort が canonical worker session に接続されるまで選択不可とし、表示後の runtime rejection に任せない。
- DataSource は Strategy で登録し、UI 側は `dataSourceId` を記録する。
- ライセンス同意が必要な場合は Step2 で明示的にチェックする（shape と同等の UX）。

### Step3: データ範囲と種類の選択

- 目的: 国 × 地点種類（行政中心/空港/港湾/駅/インターチェンジ）を選択する。
- UI は **国 x 種類のマトリクス**で選択できる。
- DataSource が提供しない種類は `checked` で固定しない。`disabled + tooltip` で明示する。
- 既定値は dataSource metadata で定義し、UI は初期選択として反映する。

### Step4: ビルド設定（LOD と表示設定）

- 目的: 地点種類ごとに **build-time LOD** と **style-time LOD** を設定する。
- build-time LOD は zoom band × location type × `renderRank` / `importance` threshold で、MVT へ収録する Point を制御する。
- style-time LOD は MapLibre expression で `icon-image` / `icon-size` / `text-size` / `visibility` / `opacity` を制御する。
- 1 種類につき以下を設定する。
  - 表示方法: `circle` / `icon` / `label`
  - ズーム範囲: `minZoom`〜`maxZoom` を複数区間で指定可能
  - build-time threshold: `renderRank` の上限または `importance` の下限
- 低 zoom は首都・主要空港・主要港・主要駅だけを許可し、高 zoom では詳細駅・港・IC・都市を許可する。
- Step4 の値は MVT cache identity に含める。欠落や範囲外は build start の契約違反として失敗させる。

### Step5: ビルド（ダウンロード・パース・保存・MVT生成）

- 目的: データ取得、LocationPoint 保存、派生 MVT 生成を実行する。
- 正規 stage は `source -> geometry -> tileEmit` とする。
- 主な処理:
  1. CSV ダウンロード（またはローカル指定の読み込み）
  2. パースして `LocationPoint` レコードを生成
  3. `LocationMutationAPI` で LocationPoint と検索 index を保存
  4. `geometry` stage で LOD 選別済み Point artifact と tile relation を生成
  5. `tileEmit` stage で source-layer `location_points` の MVT を生成
  6. 進捗・結果を canonical build session として記録
- 保存時に以下を行う:
  - Step3 の国/種類フィルタを適用
  - 必須フィールド（緯度/経度/名称/国コード）検証
  - `pointId` の重複を統合（同一 ID は上書き）
  - `metadata` に任意列を格納
  - render classification（`renderRank` / `importance` / `iconKey` / `labelClass` / `minZoom`）を明示 source から確定

### Step6: プレビュー

- 目的: 地図表示 + メタデータ表を確認する。
- 2 画面構成（地図 / テーブル）を維持する。
- MapLibreGL は MVT source-layer `location_points` を描画 source とする。
- hover/click/detail panel は MVT feature の `pointId` から `LocationQueryAPI.getPoint` / `listMetadata` で完全 metadata を取得する。
- テーブルは Step5 で保存した `LocationPoint.metadata` を仮想テーブル表示で参照する。
- 通常地図の location MVT 表示は `VITE_LOCATION_MVT=1` で有効化する。既定は OFF であり、OFF の間だけ旧 viewport GeoJSON path を rollback surface として使用できる。
- MVT 表示が ON の場合、旧 viewport GeoJSON の `queryByViewport` を同時実行しない。tile 欠落、provider 例外、破損 record は error として扱い、GeoJSON へ自動 fallback しない。

## CSV 列定義（参照実装）

現行の CSV 取り込み実装を参照仕様として採用する。データソースごとの必須/任意列と型変換は以下の通り。

### 共通パーサ挙動

- デリミタは `,` を既定とする。
- 改行は `\n` に正規化し、空行は無視する。
- ダブルクォートは CSV のエスケープとして扱い、`""` は `"` に復元する。
- ヘッダありの場合、ヘッダ名は英数字以外を除去し小文字化して照合する。

### OurAirports（空港）

- 必須列: `id`, `name`, `latitude_deg` or `latitude`, `longitude_deg` or `longitude`
- 任意列: `ident`, `type`, `iata_code` or `iata`, `gps_code` or `icao`, `local_code`, `municipality`, `iso_country`, `country_name` or `country`, `iso_region`, `scheduled_service`, `elevation_ft`, `continent`, `home_link`, `wikipedia_link`, `keywords`
- 型変換: `latitude*`, `longitude*`, `elevation_ft` は数値化（数値化不可は破棄）

### OpenFlights（空港）

- ヘッダなし（列位置で参照）
- 必須列: `0:id`, `1:name`, `6:latitude`, `7:longitude`
- 任意列: `2:city`, `3:country`, `4:iata`, `5:icao`, `8:altitude`, `9:timezone`, `10:dst`, `11:tz`, `12:type`, `13:source`
- 型変換: `latitude`, `longitude`, `altitude`, `timezone` は数値化

### World Port Index（港湾）

- 必須列: `port_name` or `portname` or `main_port_name` or `mainportname` or `name`, `latitude` or `lat`, `longitude` or `lon` or `lng`
- 任意列: `port_number` or `portnumber` or `port_id`, `country_code` or `countrycode` or `iso2` or `countryalpha2`, `country` or `country_name`, `region_name` or `region`, `un/locode` or `unlocode` or `locode`, `harbor_size` or `harborsize`, `harbor_type` or `harbortype`, `shelter`, `tide_range` or `tiderange`
- 型変換: `latitude`, `longitude` は数値化。`country_code` が 2 文字の場合のみ ISO2 として扱う。`country_name` が 2 文字の場合は無視する。

### IDE-GSM（ユーザー提供）

- ヘッダあり（列位置 + ヘッダ名で metadata を作成）
- 必須列（固定位置）: `0:name`, `1:latitude`, `2:longitude`
- 任意列（固定位置）: `3:admin1`, `4:countryName`, `5:adminCenterFlag`（`1` なら行政中心）
- metadata: 6列目以降はヘッダ名をキーに `metadata` へ格納する。
- 型変換: `latitude`, `longitude` は数値化。`adminCenterFlag` は `1`/`0` の文字列判定。
- 補正: `countryName` から ISO2 を解決して `countryCode` を付与し、`admin1` から `admin1Code` を解決する。

### CSV 不足ケースの扱い（参照実装準拠）

- 必須列が欠落している行は **スキップ**する（エラーで停止しない）。
- 文字列→数値変換に失敗した行は **スキップ**する。
- 解析対象の CSV が **想定ヘッダに一致しない**場合は空配列を返し、Step5 側で「0 件」として扱う。
- countryCode / countryName が取得できない場合は空欄のまま保存し、Step3 の国フィルタは一致しない。
- 正常に取得・解析できたデータが0件の場合だけ空結果として成功できる。network/auth失敗、登録strategyの例外、必須endpoint欠落、またはresponse shape違反を空結果へ変換せず、task/sessionを失敗させる。
- canonical runtime build の source identity は source kind、request target、country/type selection signature、parser/schema version、auth scope を含む `inputHash` として保存する。
- `401/403` は `auth-required` pause とし、空配列・stale cache・completed success へ変換しない。
- source stage は LocationPoint dataset hash、point count、selection signature、source artifact lineage の保存が成功した後にのみ completed へ遷移する。

## データモデル（Location）

`LocationPoint` は GroupEntity として扱う。metadata/query の SSOT であり、MVT や MapLibre feature から metadata を復元してはならない。

主要フィールド:

- `nodeId`
- `pointId`
- `name`
- `latitude` / `longitude`
- `kind`（地点種類）
- `countryCode` / `countryName`
- `mortonKey`（viewport / 近傍検索用）
- `metadata`（任意列の辞書）
- `renderRank`
- `importance`
- `iconKey`
- `labelClass`
- `minZoom`

`renderRank` / `importance` / `iconKey` / `labelClass` / `minZoom` は render classification と呼ぶ。これらは LocationPoint 本体に保持する正規フィールドであり、tileEmit 時に arbitrary metadata から推測してはならない。値が欠落、不正、範囲外の場合は LocationPoint 保存または geometry planning の契約違反として失敗させる。

### LocationType の表示名対応

- `area_centroid`: 行政中心
- `airport`: 空港
- `port`: 港湾
- `railway_station`: 駅
- `interchange`: インターチェンジ

## LocationMutationAPI（保存系）

責務は Point の永続化、検索インデックス（モートンキー）の更新、build config と session summary の保存に限定する。

想定 API:

- `bulkUpsertPoints(nodeId, points[])`
- `clearPoints(nodeId)`
- `clearLocationVectorTiles(nodeId)`
- `clearLocationArtifacts(nodeId)` は Point と location source artifact metadata を削除する。派生 MVT cleanup は runtime-worker の `VTStoreRegistry` に登録された location vector tile store 経由で実行し、LocationPoint metadata SSOT から推測して削除対象を決めない。
- `recordSession(nodeId, summary)`
- `saveBuildConfig(nodeId, buildConfig)`

## LocationQueryAPI（検索系）

責務は LocationPoint SSOT への検索と metadata 参照に限定する。描画用 MVT の decode 結果から query API の結果を合成してはならない。

想定 API:

- `queryByViewport(nodeId, bbox, zoom, kinds?, options?)`
- `queryByMortonPrefixes(nodeId, prefixes, kinds?)`
- `getVectorTile(nodeId, z, x, y)` は LocationDB の `vectorTiles` を `nodeId/z/x/y` で取得する。absent tile は `null`、record 破損や座標契約違反は error とし、GeoJSON query へ fallback しない。
- `getPoint(nodeId, pointId)` は LocationPoint SSOT の `data.pointId` で検索し、該当 `LocationFeature` を返す。MVT の feature id や properties から metadata を合成しない。空 `pointId` は契約違反として error にする。
- `listMetadata(nodeId, filter?)`

## Worker store registration

Location worker は `registerLocationWorkerStores()` で `VTStoreRegistry` に `nodeType='location'` の vector tile store を登録する。`VTStoreRegistry` は worker 内の派生 MVT store 境界であり、公開 query API の代替ではない。UI や外部 runner が tile bytes を読む場合は `LocationQueryAPI.getVectorTile(nodeId,z,x,y)` を使い、worker 内の lifecycle/copy/delete など node type 共通処理が store adapter を必要とする場合だけ `VTStoreRegistry.requireVectorTiles('location')` を使う。

登録済み node type の二重登録は契約違反として error にする。未登録 node type を empty store として扱ったり、LocationPoint の viewport query へ fallback してはならない。

### Prefetch マージン

- 表示範囲の外側まで少し余分に取得するため、検索時にマージン指定を行う。
- `queryByViewport` の `options` にマージンを指定する。
  - `prefetchMarginPx`: 画面ピクセル単位で bbox を拡張する（推奨）
  - `prefetchMarginRatio`: bbox の幅/高さに対する比率で拡張する（低ズーム向け）
- 既定値: `prefetchMarginPx = 64`
- 上限値: `prefetchMarginPx <= 512`（過剰取得抑制）

## モートン順序の共通接頭辞検索（Dexie 最適化）

### 基本方針

- `lon/lat` を固定精度の整数へ正規化し、モートン順序（Z-order）で 1 本のキーに変換する。
- キーは固定長の 16 進文字列（例: 16〜20 桁）として保存する。
- 表示範囲（bbox + zoom）をタイル集合へ変換し、必要なモートン接頭辞の集合を算出する。
- Dexie の `between` / `startsWith` を利用し、接頭辞検索を複数回実行する。

### Dexie スキーマ案（要約）

- `locationPoints`
  - `&[nodeId+pointId]`
  - `[nodeId+mortonKey]`
  - `[nodeId+kind+mortonKey]`
  - `nodeId`
  - `kind`

### 検索手順（概念）

1. `bbox + zoom` をマージン分拡張する（prefetch 用）。
2. 拡張した `bbox` から対象タイル集合を算出（WebMercator 前提）。
3. 各タイルのモートン接頭辞（prefix）を生成。
4. `prefix` を固定長へ補完して `start/end` 範囲を作り、`where('[nodeId+mortonKey]').between([nodeId, start], [nodeId, end])` を実行。
5. 結果を元の bbox で再フィルタし、重複を `pointId` で除去。

## MapLibre 表示契約

- MVT source-layer は `location_points` とする。
- 描画 layer は `location-points-circle`, `location-points-icon`, `location-points-label` を標準名とする。
- layer filter は `type`, `renderRank`, `importance`, `minZoom`, `labelClass` を使う。
- style-time LOD は Step4 の `representationByZoomLevelConfig`, `iconConfig`, `labelConfig` から生成する。
- app の folder map では node ごとに point/icon/label の vector layer を生成し、各 layer は source-layer `location_points` と `promoteId=pointId` を使う。
- `circle` / `icon` / `label` の初期 layout は MapLibre layer 追加時に適用する。後続の layout 更新だけに依存して初回 render を不完全にしてはならない。
- hover/click は feature の `pointId` だけを query key とし、detail panel は `LocationQueryAPI` で取得した full metadata を表示する。
- icon sprite 登録、style load、source load、初回 visible tile load が完了するまで、画像生成 runner は map ready と扱ってはならない。

## MVT feature property schema

MVT feature は描画に必要な allowlist のみを持つ。

| property | 必須 | 型 | 用途 |
| --- | --- | --- | --- |
| `pointId` | yes | string | LocationPoint lookup key / feature id |
| `type` | yes | string | layer filter |
| `name` | yes | string | label text |
| `countryCode` | yes | string | style/filter |
| `renderRank` | yes | integer | build-time/style-time LOD |
| `importance` | yes | number | build-time/style-time LOD |
| `iconKey` | yes | string | `icon-image` |
| `labelClass` | yes | string | label style |
| `minZoom` | yes | number | visibility gate |

arbitrary `metadata` は MVT へ複製しない。

## canonical Worker start入力

- Runtime bootstrap は TreeNode の `draftData` を無加工で location plugin へ渡す。
- Worker は `LocationEntityPayload.dataSource / selectedArrayByCountries / concurrentDownloads` から `LocationBuildConfig` を決定的に構築する。エンティティ型に存在しない `draftData.buildConfig` を要求しない。
- 選択された国ごとに1つの search config を作り、行の column index は `area_centroid / airport / port / railway_station / interchange` の確定順序で解釈する。
- country key は uppercase ISO 3166-1 alpha-2 を要求し、trim や大文字化で補正しない。
- 未選択、不正な並列数、または Worker session が未対応の data source は空 build や別 source へ読み替えず、start を失敗させる。

## 既存実装との差分

- LocationPoint は metadata/query の SSOT として維持する。
- MVT は LocationPoint dataset、LOD config、encoder version、source-layer、`z/x/y` から生成される派生成果物である。
- 旧 viewport GeoJSON path は正規描画 path ではない。flag OFF rollback や migration 中の検証 surface として残す場合も、MVT 契約とは別 path として明示する。
- tabular metadata は build-time database prefix から生成した完全名 `<prefix>-location-metadata`（TabularDatabaseManager）に保存し、行データ・index・query は同じく明示した完全名 `<prefix>-tabular-source-rowstore-db` を共有する。`LocationDB` は `features` を LocationPoint SSOT として、`vectorTiles` を derived MVT artifact として永続化する。prefix や完全名の fallback は行わない。

## 確認事項

- なし。
