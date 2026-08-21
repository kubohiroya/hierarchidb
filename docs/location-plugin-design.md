# location-plugin 設計（非VT・MapLibre 検索型）

本ドキュメントは location-plugin の再設計方針を定義する。既存の vt パイプライン設計を参考にしつつ、**ベクトルタイルを生成しない**前提で Step2-6 の UI/処理フロー、データモデル、検索 API、ui-map 連携を整理する。

## 目的

- location ノードの作成フロー（Step2〜Step6）を現行 UI/UX と整合する形で定義する。
- MapLibreGL の表示範囲（bbox/zoom）に応じて Dexie.js から高速に地点を抽出・描画できる構成を明文化する。
- 「モートン順序の共通接頭辞を用いた階層的検索」を LocationQueryAPI の設計軸として定着させる。

## 参照（差分前提）

- `docs/vt-pipeline-design.md`
- `docs/vt-shape-pipeline-design.md`
- `docs/vt-route-pipeline-design.md`
- `docs/location-route-design-gap.md`

## 非目標（本設計で行わないこと）

- location 用ベクトルタイル（MVT）の生成・保存・配信。
- vt-store / vt-orchestrator への接続。
- stage1/transform/vt の 3 ステージ構成への合わせ込み。

## UX フロー（Step2〜Step6）

### Step2: データソース選択

- 目的: 地点データの取得元を選択する。
- 初期実装は **CSV データソースのみ**を提供する。
- DataSource は Strategy で登録し、UI 側は `dataSourceId` を記録する。
- ライセンス同意が必要な場合は Step2 で明示的にチェックする（shape と同等の UX）。

### Step3: データ範囲と種類の選択

- 目的: 国 × 地点種類（行政中心/空港/港湾/駅/インターチェンジ）を選択する。
- UI は **国 x 種類のマトリクス**で選択できる。
- DataSource が提供しない種類は `checked` で固定しない。`disabled + tooltip` で明示する。
- 既定値は dataSource metadata で定義し、UI は初期選択として反映する。

### Step4: ビルド設定（表示レンジ設定）

- 目的: 地点種類ごとに **表示方法 × ズーム範囲**を設定する。
- 1 種類につき以下を設定する。
  - 表示方法: `circle` / `icon`
  - ズーム範囲: `minZoom`〜`maxZoom` を **複数区間**で指定可能
- UI は多値選択スライダー（range slider）で区間を編集する。
- 表示方法ごとにスライダーを分け、`circle` と `icon` の区間が重複してもよい。
- 設定は Step5 以降の描画に使用し、build 処理は **表示レンジの情報を保存**するのみ。
- ズーム上限は **11** とする（shape の band3 上限に合わせる）。

### Step5: ビルド（ダウンロード・パース・保存）

- 目的: データ取得とポイント保存を実行する。
- 主な処理:
  1. CSV ダウンロード（またはローカル指定の読み込み）
  2. パースして Point レコードを生成
  3. `LocationMutationAPI` で保存
  4. 進捗・結果を Batch セッションとして記録
- 保存時に以下を行う:
  - Step3 の国/種類フィルタを適用
  - 必須フィールド（緯度/経度/名称/国コード）検証
  - `pointId` の重複を統合（同一 ID は上書き）
  - `metadata` に任意列を格納

## CSV 列定義（参照実装）

現行の CSV 取り込み実装を **参照仕様**として採用する。データソースごとの必須/任意列と型変換は以下の通り。

### 共通パーサ挙動

- デリミタは `,` を既定とする。
- 改行は `\n` に正規化し、空行は無視する。
- ダブルクォートは CSV のエスケープとして扱い、`""` は `"` に復元する。
- ヘッダありの場合、ヘッダ名は英数字以外を除去し小文字化して照合する。

### OurAirports（空港）

- 必須列:
  - `id`
  - `name`
  - `latitude_deg` or `latitude`
  - `longitude_deg` or `longitude`
- 任意列:
  - `ident`
  - `type`
  - `iata_code` or `iata`
  - `gps_code` or `icao`
  - `local_code`
  - `municipality`
  - `iso_country`
  - `country_name` or `country`
  - `iso_region`
  - `scheduled_service`
  - `elevation_ft`
  - `continent`
  - `home_link`
  - `wikipedia_link`
  - `keywords`
- 型変換:
  - `latitude*`, `longitude*`, `elevation_ft` は数値化（数値化不可は破棄）

### OpenFlights（空港）

- ヘッダなし（列位置で参照）
- 必須列:
  - `0:id`, `1:name`, `6:latitude`, `7:longitude`
- 任意列:
  - `2:city`, `3:country`, `4:iata`, `5:icao`
  - `8:altitude`, `9:timezone`, `10:dst`, `11:tz`
  - `12:type`, `13:source`
- 型変換:
  - `latitude`, `longitude`, `altitude`, `timezone` は数値化

### World Port Index（港湾）

- 必須列:
  - `port_name` or `portname` or `main_port_name` or `mainportname` or `name`
  - `latitude` or `lat`
  - `longitude` or `lon` or `lng`
- 任意列:
  - `port_number` or `portnumber` or `port_id`
  - `country_code` or `countrycode` or `iso2` or `countryalpha2`
  - `country` or `country_name`
  - `region_name` or `region`
  - `un/locode` or `unlocode` or `locode`
  - `harbor_size` or `harborsize`
  - `harbor_type` or `harbortype`
  - `shelter`
  - `tide_range` or `tiderange`
- 型変換:
  - `latitude`, `longitude` は数値化
  - `country_code` が 2 文字の場合のみ ISO2 として扱う
  - `country_name` が 2 文字の場合は無視する

### IDE-GSM（ユーザー提供）

- ヘッダあり（列位置 + ヘッダ名で metadata を作成）
- 必須列（固定位置）:
  - `0:name`
  - `1:latitude`
  - `2:longitude`
- 任意列（固定位置）:
  - `3:admin1`
  - `4:countryName`
  - `5:adminCenterFlag`（`1` なら行政中心）
- metadata:
  - 6列目以降はヘッダ名をキーに `metadata` へ格納する。
- 型変換:
  - `latitude`, `longitude` は数値化
  - `adminCenterFlag` は `1`/`0` の文字列判定
- 補正:
  - `countryName` から ISO2 を解決して `countryCode` を付与
  - `admin1` から `admin1Code` を解決

### CSV 不足ケースの扱い（参照実装準拠）

- 必須列が欠落している行は **スキップ**する（エラーで停止しない）。
- 文字列→数値変換に失敗した行は **スキップ**する。
- 解析対象の CSV が **想定ヘッダに一致しない**場合は空配列を返し、Step5 側で「0 件」として扱う。
- countryCode / countryName が取得できない場合は空欄のまま保存し、Step3 の国フィルタは一致しない。
- 正常に取得・解析できたデータが0件の場合だけ空結果として成功できる。network/auth失敗、登録strategyの
  例外、必須endpoint欠落、またはresponse shape違反を空結果へ変換せず、task/sessionを失敗させる。

### Step6: プレビュー

- 目的: 地図表示 + メタデータ表を確認する。
- 2 画面構成（地図 / テーブル）を維持する。
- MapLibreGL では viewport 変化に応じて `LocationQueryAPI` を呼び出し、必要な地点のみ描画する。
- テーブルは Step5 で保存した `LocationPoint.metadata` を仮想テーブル表示で参照する。

## データモデル（Location）

- `LocationPoint` は GroupEntity として扱う（詳細は `@hierarchidb/location-store` の型に準拠）。
- 主要フィールド:
  - `nodeId`
  - `pointId`
  - `name`
  - `latitude` / `longitude`
  - `kind`（地点種類）
  - `countryCode` / `countryName`
  - `metadata`（任意列の辞書）

### LocationType の表示名対応

- `area_centroid`: 行政中心
- `airport`: 空港
- `port`: 港湾
- `railway_station`: 駅
- `interchange`: インターチェンジ

## LocationMutationAPI（保存系）

責務は **Point の永続化**と **検索インデックス（モートンキー）の更新**に限定する。

想定 API:

- `bulkUpsertPoints(nodeId, points[])`
- `clearPoints(nodeId)`
- `recordSession(nodeId, summary)`
- `saveBuildConfig(nodeId, buildConfig)`

## LocationQueryAPI（検索系）

責務は **Viewport への高速抽出**と **メタデータ参照**に限定する。

想定 API:

- `queryByViewport(nodeId, bbox, zoom, kinds?, options?)`
- `queryByMortonPrefixes(nodeId, prefixes, kinds?)`
- `getPoint(nodeId, pointId)`
- `listMetadata(nodeId, filter?)`

### Prefetch マージン

- 表示範囲の外側まで **少し余分に取得**するため、検索時にマージン指定を行う。
- `queryByViewport` の `options` にマージンを指定する。
  - `prefetchMarginPx`: 画面ピクセル単位で bbox を拡張する（推奨）
  - `prefetchMarginRatio`: bbox の幅/高さに対する比率で拡張する（低ズーム向け）
- 既定値: `prefetchMarginPx = 64`
- 上限値: `prefetchMarginPx <= 512`（過剰取得抑制）

## モートン順序の共通接頭辞検索（Dexie 最適化）

### 基本方針

- `lon/lat` を固定精度の整数へ正規化し、**モートン順序（Z-order）**で 1 本のキーに変換する。
- キーは固定長の **16 進文字列**（例: 16〜20 桁）として保存する。
- 表示範囲（bbox + zoom）を **タイル集合へ変換**し、必要なモートン接頭辞の集合を算出する。
- Dexie の `between` / `startsWith` を利用し、接頭辞検索を複数回実行する。

### Dexie スキーマ案（要約）

- `locationPoints`
  - `&[nodeId+pointId]`
  - `[nodeId+mortonKey]`
  - `[nodeId+kind+mortonKey]`
  - `nodeId`
  - `kind`

### 検索手順（概念）

1. `bbox + zoom` を **マージン分拡張**する（prefetch 用）。
2. 拡張した `bbox` から対象タイル集合を算出（WebMercator 前提）。
3. 各タイルのモートン接頭辞（prefix）を生成。
4. `prefix` を固定長へ補完して `start/end` 範囲を作り、
   `where('[nodeId+mortonKey]').between([nodeId, start], [nodeId, end])` を実行。
5. 結果を **元の bbox** で再フィルタし、重複を `pointId` で除去。

### 補足

- `kind` フィルタを使う場合は `[nodeId+kind+mortonKey]` を優先する。
- viewport のズーム変化は 200〜300ms デバウンスし、並列クエリは Abort/キャンセル可能にする。
- 表示性能を優先し、必要に応じて `prefix` 集合を LRU キャッシュする。

## ui-map 側の実装方針（MapLibreGL）

### 目的

- viewport 内の地点のみ取得し、`circle`/`icon` 表示を切り替える。

### 表示レイヤ構成（案）

- `location-points-circle`（GeoJSONSource）
  - filter: `kind in selectedKinds`
  - minzoom/maxzoom: Step4 の circle 設定に合わせて動的更新
- `location-points-icon`（GeoJSONSource）
  - filter: `kind in selectedKinds`
  - minzoom/maxzoom: Step4 の icon 設定に合わせて動的更新

### スタイル方針

- アイコンは既存の **map のモードレスダイアログ内トグルボタン**で使用しているものを流用する。
- アイコン/円の色は識別可能な **仮色** を付与する（後で置換可能な定数で管理）。
- サイズ計算式はプロパティで注入可能にし、拡張性を確保する。
  - 例: `sizeFn(zoom, kind, mode)` を受け取り `circle-radius` / `icon-size` を決定する。
  - 既定は **ズームに対して線形**で変化する式とする。

#### 仮色（デフォルト）

| kind | color |
| --- | --- |
| area_centroid | `#1f77b4` |
| airport | `#ff7f0e` |
| port | `#2ca02c` |
| railway_station | `#d62728` |
| interchange | `#9467bd` |

#### sizeFn 仕様（デフォルト）

- 入力: `(zoom: number, kind: LocationType, mode: 'circle' | 'icon')`
- 出力: `{ circleRadiusPx: number; iconScale: number }`
- 単位:
  - `circleRadiusPx`: px
  - `iconScale`: MapLibre の `icon-size`（スプライト原寸に対する倍率）

**既定の線形式**

- `circleRadiusPx = clamp(2 + zoom * 0.6, 2, 10)`
- `iconScale = clamp(0.6 + zoom * 0.05, 0.6, 1.4)`

`clamp(min, max)` は `min <= value <= max` の範囲に収める。

#### ui-map への適用

- `circle-radius` は `circleRadiusPx` をそのまま適用する。
- `icon-size` は `iconScale` をそのまま適用する。

### データフロー

1. MapLibre の `moveend` / `zoomend` で `bbox` と `zoom` を取得。
2. `prefetchMarginPx` を指定して `LocationQueryAPI.queryByViewport` を呼び出す。
3. GeoJSONSource を更新（差分パッチ or 全置換）。
4. Step4 の表示設定に応じてレイヤの `minzoom/maxzoom` と `icon-size/circle-radius` を更新。

## 既存実装との主な差分

- `LocationVectorTileService` を **廃止**し、QueryAPI ベースの取得へ置換する。
- `LocationDB.vectorTiles` は **移行で停止/削除**し、`locationPoints` を単一ソースとする。
- Step5 は **データの保存のみ**を行い、タイル生成や変換処理を持たない。
- tabular metadata はbuild-time database prefixから生成した完全名 `<prefix>-location-metadata`（TabularDatabaseManager）に保存し、行データ・index・queryは同じく明示した完全名 `<prefix>-tabular-source-rowstore-db` を共有する。`LocationDB` は features の永続化のみを担う。prefixや完全名のfallbackは行わない。

## canonical Worker start入力

- Runtime bootstrapはTreeNodeの`draftData`を無加工でlocation pluginへ渡す。
- Workerは`LocationEntityPayload.dataSource / selectedArrayByCountries / concurrentDownloads`から
  `LocationBuildConfig`を決定的に構築する。エンティティ型に存在しない
  `draftData.buildConfig`を要求しない。
- 選択された国ごとに1つのsearch configを作り、行のcolumn indexは
  `area_centroid / airport / port / railway_station / interchange`の確定順序で解釈する。
- country keyはuppercase ISO 3166-1 alpha-2を要求し、trimや大文字化で補正しない。
- 未選択、不正な並列数、またはWorker sessionが未対応のdata sourceは
  空buildや別sourceへ読み替えず、startを失敗させる。

## 確認事項（要決定）

- なし。
