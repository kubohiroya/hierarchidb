@hierarchidb/route-searoute
===========================

このパッケージは「仕様のみ」を提示します（実装はまだ行いません）。

目的
----
- 港のオープンデータを基に、海峡・運河・海上グリッドからなる簡略化グラフを構築し、任意の2港間の海路を「セグメントIDの集合」で返す仕組みを提供する。
- 全組合せ事前計算（O(n²)）を避け、オンデマンド経路探索で応答する。
- 描画は map-view (MapLibre GL JS + deck.gl) 側で行い、本機能は「経路セグメント集合の解決」に専念する。

非目標
------
- 海図相当の厳密性や海運規制の完全対応は初期範囲外。
- 大規模サーバ分散の設計は別フェーズ。まずはクライアント/ローカルDexie運用想定。

用語・データモデル（概念）
---------------------------
- PortNode: 港（id, name, lon, lat, country）。
- Segment: 経路セグメント（id, fromId, toId, lengthKm, type, coords[]）。type: 'strait' | 'canal' | 'grid' | 'port-link'。
- GridNode: 海上グリッド点（id, lon, lat）。
- Graph: PortNode/ GridNode を頂点、Segment を辺とする有向（または無向）グラフ。隣接は fromId → [Segment] で管理。

機能範囲（仕様）
-----------------
1) 取り込み（Ingest）
- 港オープンデータの取得（CSV/JSON）。必須項目: id/name/lon/lat。
- 海峡・運河のラインデータ取得（GeoJSON LineString）。各LineStringは入出点（fromId/toId）を持つか、座標から導出する。
- 海上グリッドの生成: 指定ステップ（例: 5度）で世界海域にグリッド点を生成し、4近傍（または8近傍）でSegmentを張る。陸域/航行不可マスは将来のマスク適用で除外可能。
- 保存: Dexieへ ports/nodes/segments/adjacency を格納。adjacencyは `[fromId+segId]` をキーとする隣接テーブル。

2) 経路計画（Routing）
- 入力: fromPortId, toPortId, options（avoidCanals, allowStraits, maxHops など）。
- 出力: RoutePlanResult { segments: string[]（順序付きセグメントID配列）, distanceKm }。
- 手法: Dijkstra もしくは A*（ヒューリスティック: 球面距離）。
- コスト: デフォルトは lengthKm。将来的に潮流/通行料/気象/制限で重み拡張。

3) 可視化連携
- 応答はセグメントID配列。描画側はID→Segment（coords）解決で LineString を表示。
- VectorTile化は別フェーズ（セグメントからMVTを遅延生成/キャッシュ）。

データ入手とフォーマット（例）
-------------------------------
- Ports: { id, name, lon, lat, country } のJSON/CSV。
- Straits/Canals: GeoJSON FeatureCollection（LineString）。propertiesに `id/fromId/toId/name` など任意拡張可。
- グリッド: ステップ角度とbboxを指定してローカル生成。coords = [[lon,lat],[lon,lat],…]。

Dexie想定スキーマ（概略）
-------------------------
- ports: `&id, name, country`
- nodes: `&id, lon, lat`
- segments: `&id, fromId, toId, lengthKm, type, coords`
- adjacency: `&[fromId+segId], fromId, segId`

API（抽象I/F）
--------------
- DataSourcePort: `fetchPorts()`, `fetchStraits()`, `fetchCanals()`
- StorePort: `putPorts()`, `putSegments()`, `putGrid()`, `getAdjacency(id)`, `getPortById()`, `getPorts()`
- RouterPort: `planRoute(fromPortId, toPortId, opts) -> RoutePlanResult`
- Facade:
  - IngestService: DataSource → Store
  - RouterService: Store → RouterPort 実装で経路探索

パフォーマンスとスケーリング
----------------------------
- 前計算は「港×港」ではなく「グリッド＋地物」生成のみ。問い合わせはオンデマンド探索。
- グリッドの解像度（stepDegrees）とbboxで精度/容量を調整。
- A*導入で探索効率化（ヒューリスティック＝大円距離）。

キャッシュ/重複管理（将来展開）
-------------------------------
- オープンデータの取得には @hierarchidb/download（CAS+SHA3+refCount）を使用し、重複ダウンロードとストレージ重複を排除。
- VectorTile化後のタイルキャッシュもCASで管理可能。

制約・未決事項
---------------
- 航行不可領域（陸/浅瀬/制限海域）の扱い（マスク/コスト増加）。
- 海峡・運河の入口/出口ノードの精密化（幾何的スナップ/トポロジ補正）。
- 実測航路（AISなど）を取り込むかは未定。

実装計画（段階）
-----------------
1. 仕様確定（本ドキュメント）
2. データソース選定/スキーマ確定
3. Ingest（保存）と Router（探索）の最小実装
4. A*最適化、マスク/コスト導入
5. VectorTile化・map-view連携・キャッシュ

注: 現時点では実装コードは追加しません。ここに記した仕様を合意した上で、段階的に実装へ移行します。
