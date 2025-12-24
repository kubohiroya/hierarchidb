# plugin-loaders

## 役割
- プラグインの静的 loader マップとレジストリ定義を提供する。
- UI/Worker/DB/Icon を完全分離したロード入口を公開する。
- UI ローダーの依存解決やロード順（依存関係）の判定を担当する。
- `plugin-runtime` から参照される低レベル層として振る舞う。

## 主な公開物
- `pluginRegistry` / `pluginDefinitions`（生成済み定義の薄い re-export）
- `ui-loaders` / `worker-loaders` / `database-loaders` / `icon-loaders`
- `ui-plugin-loader`（UI モジュールのロード実装）
- `di/`（UI ローダー用の DI コンテナ）

## 依存ルール
- `plugin-loaders` は `plugin-runtime` に依存しない。
- `plugin-runtime` は `plugin-loaders` を利用してよい。

