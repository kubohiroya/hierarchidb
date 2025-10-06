# Route プラグインと Location プラグインの連携仕様

この文書では、2025-10-06 時点までの議論・検討内容を踏まえ、Route プラグインが Location プラグインで管理される `LocationPoint` と連携して経路データを構築するための仕様を整理する。新規実装および既存コードの改修は、本ドキュメントを基準に行う。

## 背景と方針

- Route プラグインは **同じツリーノード階層（または子孫階層）内に存在する LocationPoint** を参照し、経路の始点・中継地点・終点を決定する。
- 各 LocationPoint には一意の `locationCode` を付与し、Route 側は `locationCode` をキーに参照する。
- データソースは「場所コードや経路属性（交通手段、距離、所要時間など）を取得するため」に利用し、座標が含まれる場合でも **LocationPoint との一致検証に用いる参考値** として扱う。
- Location プラグインではストラテジごとに `locationCode` をどの属性から生成するかを定義し、Route プラグインでは各データソースストラテジで「始点コード・終点コード・経路属性」を抽出する。

## Location プラグイン側の具体化

### 1. 型・スキーマの整理

- `LocationPoint` 型を以下のように再定義する：
  - 必須フィールドに `locationCode`, `treeNodeId`, `lat`, `lng` を含め、`nodeId`（紐づく Location エンティティ）との 1:n 関係を保持。
  - データソース固有の識別子・座標・信頼度などを `sourceMetadata` として保持できる構造に拡張。
- Dexie スキーマ（`pointRepository`, `LocationEntitiesDB`）に `locationCode` のユニークインデックスを追加し、高速な参照と整合性チェックを担保する。

### 2. ストラテジの調整

- `pointFactories` および `services/download/strategies/*` で、どの属性を `locationCode` とするかを必ず返却するようにする。
- 座標がデータソースに含まれる場合は `sourceCoordinates` として保存し、最終的な `lat/lng` と比較するための補助データとする。
- 座標を含まないソースの場合は、既存ロジック（GeoCoder、既存辞書など）で補完し、LocationPoint 作成時には必ず最終座標を持つようにする。

### 3. ドキュメント・テスト

- `packages/plugins/location-plugin/batch-processing-ja.md` に `locationCode` の導入理由、データソース別のマッピング方針、整合性チェック手順を追記する。
- `pointFactories` 等に対するユニットテストを追加し、ソース別ストラテジが `locationCode` と座標を正しく返却することを保証する。

## Route プラグイン側の具体化

### 1. WorkingCopy / Entity の再設計

- `RouteEntity` / `RouteWorkingCopy` を以下のように更新する：
  - `startLocationCode`, `endLocationCode`, `viaLocationCodes: string[]` を追加し、コードベースで経路構造を保持。
  - 「ラインジオメトリ」は LocationPoint の解決結果から生成されるため、`resolvedCoordinates`（生成日時や整合性ステータスを含む）など別フィールドを設ける。
  - 既存の `waypoints` フィールドは、必要に応じて LocationPoint 参照前の暫定データとして扱うか、撤廃する。

### 2. LocationPoint 解決レイヤ

- Route 作成・編集時、`RouteBatchManager` や UI ステップコンポーネントから Dexie ストア経由で LocationPoint を引き当て、同一ツリー階層内に存在するかチェックする。
- LocationPoint が見つからない／階層が異なる場合はエラー扱いとし、保存を拒否する。座標が一致しない場合は metadata に警告として記録する。
- 中継地点は `viaLocationCodes` を LocationPoint へ解決し、座標列を生成するヘルパーを実装する。

### 3. データソースストラテジ

- `services/RouteBatchManager` と `download/strategies/*` を改修し、データソースから得た属性を以下のように整理する：
  - `startCode` / `endCode`… LocationPoint に登録されるべき位置コード。
  - `viaCodes`… 中継地点に相当する位置コード配列。
  - `transportMode`, `distance`, `duration` などの経路属性。
- 必要に応じて LocationPoint 参照前の照合用情報（例：`sourceStartCoordinates`）を metadata として保持する。

### 4. UI の更新

- `RouteBasicInfoStep` / `RouteSelectionStep` などで、LocationPoint を検索・選択する UI を導入。オートコンプリートやツリー選択によって `locationCode` を確定させる。
- `RouteSelectionStep` では、コード選択後に LocationPoint を取得し、最終的な座標列と距離を再計算（またはデータソース値と比較）する仕組みを組み込む。

### 5. テスト

- `RouteBatchManager`、`RouteEntityHandler` に対し、以下のテストケースを追加する：
  - 存在する LocationPoint であれば保存できる。
  - 同一ツリー階層外の LocationPoint を指定した場合はエラーになる。
  - データソースが提供する座標と LocationPoint の座標が一致しない場合に警告が記録される。
- UI コンポーネントには LocationPoint 選択／検証フローをカバーするテストを追加する。

## プラグイン間連携の共通事項

- `LocationPointService` のような API（Dexie ラッパー）を Location プラグインで提供し、Route プラグインから `locationCode` で問い合わせる。
- LocationPoint 作成時には `treeNodeId` が必須であることを保証し、Route 側でも同じ ID を利用する。
- Route 保存（`RouteEntityHandler`）時に LocationPoint の存在チェック・階層整合性チェックを実行して、データ不整合を防ぐ。

## Location プラグインと Shape プラグインの連携仕様

Route と同様に、Shape プラグインも LocationPoint 由来の行政区画情報と連携できるよう、以下の仕様を設ける。

### 1. LocationPoint への行政区画コード付与

- `LocationPoint` 型に `gid0`, `gid1`, `gid2` など hierarchical な行政区画コードを追加し、データソース側のストラテジで解決する。
- 行政区画コードは特定データセット（GADM など）に固定せず、resolver-plugin で定義する変換表を参照して任意体系を扱えるようにする（例：ソース別コード → 内部統一コード）。
- バッチ処理では位置コードと同時に行政区画コードを決定し、Dexie スキーマで `locationCode`/`gid*` にインデックスを張る。
- これにより LocationPoint から行政区画単位で検索したり、異なるプラグイン間で一致確認ができる。

### 2. ShapeArea 型と Dexie 永続化

- Shape プラグインでは新たに `ShapeArea` 型を定義し、行政区画コード（`gid*`）とベクトルタイル上の MultiPolygon を関連付ける。
- ベクトルタイルとしての形状データは既存バッチ処理で生成済みのため、`ShapeArea` 自体は MultiPolygon 本体を保持せず、「対応するタイル ID／ズームレベル／フィーチャ ID」など参照情報を保持する。
- `ShapeArea` は PersistentGroupEntity として Dexie DB（例: `ShapeAreasDB`）に保存し、ツリーノード単位で複数行政区画を保持できるようにする。
- バッチ処理（Shape Batch Manager）では行政区画コードをキーとして ShapeArea を生成し、タイル参照情報と共に保存する。

### 3. LocationPoint ↔ ShapeArea の相互検索

- 行政区画コードにインデックスを張った LocationPoint / ShapeArea 双方を用意することで、
  - LocationPoint から所属する行政区域（ShapeArea）を検索
  - ShapeArea（行政区域）から包含する LocationPoint を検索
  できるようになる。
- これにより、行政区域単位の可視化・統計集計・バッチ処理が容易になる。

### 4. 実装ステップの概略

1. `LocationPoint` 型とスキーマを更新し、行政区画コードを必須化。既存データには移行処理を準備する。
2. Location データソースストラテジで行政区画コードの解決ロジックを追加し、ユニットテストで保証する。
3. `ShapeArea` 型・Dexie スキーマ・バッチ処理を整備し、行政区画コードで multi-polygon を永続化する。
4. Location/Shape 双方に行政区画コード検索 API を実装し、相互検索のユニットテスト・統合テストを追加する。

## データソース別マッピング例

| ソース | LocationPoint での `locationCode` | Route で利用する主キー | 補足 |
| ------ | -------------------------------- | ------------------------- | ---- |
| OpenStreetMap / Overpass | OSM Node/Way/Relation ID （`osm_id` など） | OSM の同一 ID | 座標はデータとして付属するが、LocationPoint 座標と一致するか検証用に比較する |
| GeoNames | `geonameId` | 同じ `geonameId` | GeoNames に座標あり。LocationPoint 作成時に座標を保存し、Route ではコードと座標の一致を検証 |
| Wikidata | `wikidataId`（Qxxx） | 同じ ID | 座標がない場合は LocationPoint 側で別ソースから補完。Route は ID が一致するかだけを見る |
| カスタムCSV | CSV 列で定義した地点コード | 同じコード | 座標有無は入力に依存。座標なしの場合は LocationPoint 生成時に別途補完手段を設ける |

## 今後の実装タスク（例）

1. LocationPoint 型と Dexie スキーマの更新、`locationCode` 正規化処理の実装。
2. 各 Location データソースストラテジで `locationCode` を返すように改修し、ユニットテストを追加。
3. Route Entity/WorkingCopy の再定義と Migration スクリプト（既存データの `startLocationCode` 等への移行）。
4. Route プラグインのストラテジ／UI コンポーネントを `locationCode` ベースに書き換え、整合性チェックロジックを追加。
5. Route 保存処理・バッチ処理に LocationPoint 整合性チェックを組み込み、テストカバレッジを拡張。
6. `docs/plugins/location-plugin/batch-processing-ja.md` など関連ドキュメントの補強。

以上の仕様に沿って変更を進めることにより、Location-Route 間のデータ参照が一貫し、ルートデータの整合性と保守性が高まる。
