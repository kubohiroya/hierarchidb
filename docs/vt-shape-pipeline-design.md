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

## ステージ構成（shape）

- shape-fetch
- transform
- vt

## shape-fetch ステージ（shape）

- GeoJSON を国 + 自治体レベル単位で分割し取得
- smartFetch を通して取得（認証・リトライ・nodeId 超えキャッシュ）
- flatgeobuf に変換して stage1Buffers に保存
  - `domainType`: `shape`
  - `sourceKey`: `${countryCode}:${adminLevel}`（countryCode は **ISO2 を正**とし、dataSource 側で ISO2/ISO3 の揺れを吸収しない）
- タスク単位: `countryCode + adminLevel`（1タスク=1 stage1Buffer）
- transform タスク生成は plugin 側が責務を持つ
  - vt-orchestrator には transform/vt タスクを投入する
  - 国コードの ISO2/ISO3 変換は plugin の dataSource strategy が担う（外部 API の国コード揺れは許容しない）
  - 内部の基準コード体系は ISO2 を採用し、`sourceKey` とキャッシュキーは ISO2 統一で運用する
  - 例: GeoBoundaries/GADM の URL は ISO3 を要求するため、strategy 側で ISO2 → ISO3 変換して URL を生成する

## transform ステージ（shape）

- ズーム帯ごとに簡略化した FGB を生成
- **帯内最小zのみ tileIndex 作成**
- band3 予約は adminLevel>=2 を扱うタスクに限定
- タスク単位: `stage1Buffer` × `band`（band0/1/2、band3 は条件付き）
- band3 は「いずれかの国で adminLevel>=2 が選択された場合」に自動 ON
- 簡略化は turf の Ramer–Douglas–Peucker を使用し、許容誤差は Step4 設定に従う（入力仕様は `docs/vt-pipeline-design.md` を参照）

## vt ステージ（shape）

- 固定タスク（1+64+4096） + band3 予約タスク
- geojson-vt でタイル生成し VTMutationAPI へ保存

## 旧実装からの置換対象

- shape-plugin の旧 `vectortile` ステージ関連コード
- `shape-store` を `vt-shape-store` に置換
  - `shape-store` は **shape 用の旧中間ストア**を指す

## shape 固有のファイル補足

- `plugins/shape-plugin/src/services/build/shapeBuildConfig.ts`
  - Step4 の設定値から `BuildConfig` を組み立てる（入力仕様は `docs/vt-pipeline-design.md` を参照）
- `plugins/shape-plugin/src/services/build/shapeBuildRunner.ts`
  - vt-orchestrator の `runPipeline` を呼び出す
