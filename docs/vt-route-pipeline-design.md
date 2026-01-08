# vt パイプライン設計（route 固有）

本ドキュメントは、route 固有の差分のみを記述する。
共通仕様は `docs/vt-pipeline-design.md` を参照。

## 対象ジオメトリ

- LineString（全世界で数万本規模、長大な経路を含む）

## UX フロー（route）

- Step2: 交通経路のデータソース選択
- Step3: 始点/終点の国別 + 経路種別の選択
- Step4: ビルド設定（入力仕様は `docs/vt-pipeline-design.md` を参照）
- Step5: ビルド
- Step6: プレビュー

## ステージ構成（route）

- route-fetch
- transform
- vt

## route-fetch ステージ（route）

- メタデータをダウンロードして始点/終点 ID を取得
- LocationQueryAPI で始点/終点の座標を取得
- WaypointsAPI を選択して経路の中間点を生成
  - 直線近似
  - 大圏航路近似
  - searoute-jp
  - 外部 API (OSM など)
- 外部 API 呼び出しは smartFetch（HTTP POST を含む）経由で実行
- LineString を FGB 化して stage1Buffers に保存
  - `domainType`: `route`
  - `sourceKey`: `${srcId}/${dstId}`（順序は区別）
- タスク単位: `srcId + dstId`（1タスク=1 stage1Buffer）
- transform タスク生成は plugin 側が責務を持つ
  - vt-orchestrator には transform/vt タスクを投入する

**キャッシュ**
- 外部 API の結果は smartFetch でキャッシュする
- 大圏航路/ searoute-jp の waypoints 計算結果もキャッシュし、再利用時は `reused` とする

## transform ステージ（route）

- shape と共通仕様
- ズーム帯ごとに簡略化した FGB を生成
- 帯内最小zのみ tileIndex 作成
- タスク単位: `stage1Buffer` × `band`（band0/1/2、band3 は条件付き）
- band3 は buildConfig の `band3Enabled` が true の場合のみ実行（デフォルト OFF）
  - band3Enabled は **兄弟/子孫の shape ノードのズーム帯サポート状況**に依存して決定する

**仕様**
- LineString がタイル境界を跨いでも、そのタイルに含まれる地物として抽出・描画されること
- tile coverage は turf を用い、tile index は geojson-vt を用いて整合させる

## band3 判定手順（route）

**入力**
- route ノード（親/兄弟関係の識別）
- 兄弟/子孫の shape ノード設定（ズーム帯サポート状況）

**手順**
1. 同一親配下または子孫に shape ノードが存在し、band3（z9-z11）対応が有効かを判定する
2. 1 が true の場合に `band3Enabled = true` とする
3. `band3Enabled` を BuildConfig に保存し、transform/vt の実行条件に利用する

**注記**
- LineString がタイル境界を跨ぐ場合でも、関連する shape が band3 を持つ前提で
  line の抽出/描画を一致させるため、shape 側の band3 のみで判定する

**出力**
- BuildConfig の `band3Enabled` フラグ

## vt ステージ（route）

- 固定タスク（1+64+4096） + band3 予約タスク
- geojson-vt でタイル生成し VTRouteMutationAPI へ保存

## API 利用

- LocationQueryAPI / LocationMutationAPI
- VTRouteQueryAPI / VTRouteMutationAPI
- WaypointsAPI（実装モジュール群を切替）

## 旧実装からの置換対象

- route-plugin の旧 `vectortile` ステージ関連コード
- 旧ストアを `vt-route-store` に置換
  - 旧ストアは **route 用の旧中間ストア**を指す

## route 固有のファイル補足

- `plugins/route-plugin/src/services/build/routeBuildConfig.ts`
  - Step4 の設定値から `BuildConfig` を組み立てる（入力仕様は `docs/vt-pipeline-design.md` を参照）
- `plugins/route-plugin/src/services/build/routeBuildRunner.ts`
  - vt-orchestrator の `runPipeline` を呼び出す
