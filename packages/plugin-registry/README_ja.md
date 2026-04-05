# @hierarchidb/plugin-registry

最終更新: 2026-04-05

HierarchiDB の全プラグインを集約し、UI / Worker / Icon / Database のモジュールローダーと `PluginDefinition` を自動生成するレジストリパッケージ。ビルド時にコード生成ツール（`tools:gen-plugin-registry`）が `generated/` 配下にレジストリコードを出力し、アプリケーションはこのパッケージ経由で全プラグインにアクセスする。

## 主要な機能

- 全プラグインの `PluginManifest` を集約した `pluginDefinitions` の提供
- UI / Worker / Icon / Database モジュールの遅延ローダー
- `PluginRegistryEntry` から `PluginDefinition` への変換（`derivePluginDefinitions`）
- モジュールスペシファイア抽出（`derivePluginModuleSpecifiers`）

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/plugin-registry` | メインレジストリ（全プラグインエントリ） |
| `@hierarchidb/plugin-registry/ui-loaders` | UI モジュール遅延ローダー |
| `@hierarchidb/plugin-registry/worker-loaders` | Worker モジュール遅延ローダー |
| `@hierarchidb/plugin-registry/icon-loaders` | Icon モジュール遅延ローダー |
| `@hierarchidb/plugin-registry/database-loaders` | Database モジュール遅延ローダー |
| `@hierarchidb/plugin-registry/plugin-definitions` | PluginDefinition 配列 |
| `@hierarchidb/plugin-registry/types` | 型定義（PluginRegistryEntry 等） |
| `@hierarchidb/plugin-registry/derivations` | 変換ユーティリティ |

## ビルドプロセス

```text
pnpm --workspace-root run tools:gen-plugin-registry
  → generated/ 配下にレジストリコードを生成
  → tsdown で dist/ にバンドル
```

全プラグインのビルドが完了した後にレジストリをビルドする（Turbo pipeline で依存順序を保証）。

## 依存関係

全 11 プラグインに直接依存:

basemap, folder, linker, location, resolver, route, shape, spreadsheet, styler, timeline（+ yaml-plugin は package.json 未登録の場合あり）

## ディレクトリ構成

```text
generated/          # Auto-generated registry code (by tools:gen-plugin-registry)
├── registry.ts
├── types.ts
├── derivations.ts
├── ui-loaders.ts
├── worker-loaders.ts
├── icon-loaders.ts
├── database-loaders.ts
└── plugin-definitions.ts
src/
├── derivations.ts  # derivePluginDefinitions, derivePluginModuleSpecifiers
└── types.ts        # PluginRegistryEntry, PluginIconConfig, PluginCapabilities
```

## 関連パッケージ

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginManifest 型定義
- [`@hierarchidb/core-types`](../core-types/) — NodeType 等の共有型
- 全プラグイン（`plugins/*`）— レジストリの入力元

## ライセンス

MIT
