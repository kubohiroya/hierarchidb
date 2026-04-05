# @hierarchidb/plugin-service-api

最終更新: 2026-04-05

HierarchiDB プラグインサービス API の過渡的な re-export パッケージ。`plugin-base`、`style-api`、`shape-api`、`location-api`、`route-api` のエクスポートを集約して再公開する。

> **注意**: 本パッケージは非推奨（deprecated）の過渡的パッケージです。新規コードでは各 API パッケージを直接 import してください。

## 再エクスポート元

| パッケージ | 内容 |
| --- | --- |
| [`@hierarchidb/plugin-base`](../plugin-base/) | PluginManifest、PluginStepRegistry 等 |
| [`@hierarchidb/style-api`](../style-api/) | StyleRecord、StyleDescriptor 等 |
| [`@hierarchidb/shape-api`](../shape-api/) | ShapeEntity 型等 |
| [`@hierarchidb/location-api`](../location-api/) | LocationEntity 型等 |
| [`@hierarchidb/route-api`](../route-api/) | RouteEntity 型等 |

## ライセンス

MIT
