# @hierarchidb/map-source

最終更新: 2026-04-05

HierarchiDB の地図ソース管理パッケージ。MapLibre GL JS のソース定義（ベクトルタイル、ラスター、GeoJSON 等）の抽象化と管理を提供する。

## FeatureCollection Schema

`featureCollectionJsonSchema` は `FeatureCollection` payload の container-level GeoJSON
check である。Ajv strict mode で検証し、型変換、既定値補完、追加プロパティ削除は行わない。
GeoJSON extension field は意図的に許容し、provider-specific property contract は利用側 plugin が所有する。

## 依存関係

`@hierarchidb/util`, `ajv`

## 関連パッケージ

- [`@hierarchidb/map-adapter`](../map-adapter/) — 地図アダプタ（ソースの登録先）
- [`@hierarchidb/ui-map`](../ui/map/) — 地図 UI コンポーネント

## ライセンス

MIT
