@hierarchidb/map-source
=======================

Dexie（IndexedDB）から地図描画用のデータ（GeoJSON）を取り出すための共通機能。Facade + Portで抽象化し、shape/location/route など複数プラグインで共通利用できます。

設計意図
--------
- 地図描画の「ソース取得」を統一し、Dexieのスキーマ差を吸収する。
- BBox/タイル（z/x/y）での抽出I/Fを固定し、UI/描画レイヤはこのAPIだけを見る。
- 今後の高速化（事前簡約・空間インデックス）やサーバ実行にも拡張しやすい形に。

アーキテクチャ
--------------
- Facade: `MapSourceService`
  - `getFeaturesInBBox(bbox, zoom?, filters?)`
  - `getFeaturesInTile({z,x,y}, filters?)`
  - `getMetadata()`
- Port: `MapSourcePort`
  - 実データ取得を担当。Dexieアダプタや将来のRDB/サーバに差し替え可。
- 付属アダプタ: `DexieShapePort`
  - shapeプラグインのEphemeral DB（rawBuffers）からFeatureCollectionを復元して取得（Naive版）。

使い方（最小）
----------------
```ts
import { MapSourceService, DexieShapePort } from '@hierarchidb/map-source';

const source = new MapSourceService(new DexieShapePort('hierarchidb-shape-ephemeral'));
const fc = await source.getFeaturesInTile({ z: 6, x: 55, y: 24 });
```

注意点（現状）
--------------
- DexieShapePortはNaive実装です。大規模データではメモリに載せず、事前簡約/索引を使うPortへ切替えてください。
- 座標系はGeoJSONの経緯度（EPSG:4326）想定。WebMercatorタイル境界は簡易計算でbbox化します。

今後の計画
----------
- 空間インデックスPort（R木 or グリッド）での高速BBox検索
- ズーム別事前簡約レイヤへのフォールバック（LOD）
- 共有タイルキャッシュ（CAS/Download連携）
- サーバサイド抽出へのPort（同じI/Fで差し替え）

