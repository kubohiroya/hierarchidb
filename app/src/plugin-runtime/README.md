# plugin-runtime

## 役割
- アプリの実行時コンテキストに基づいた「プラグイン運用」を担当する。
- インストール済みプラグインのフィルタリングや表示用データを整形する。
- DB prewarm/IndexedDB クリアなどの運用系ユーティリティを提供する。
- プラグイン構成（どのプラグインをロードするか）の方針を管理する。

## 主な責務
- `plugin-registry.ts`: app/package.json を基準にインストール済みプラグインを確定
- `plugin-presentation.ts`: 表示用ラベル/アイコン/説明を整形
- `databases.ts` / `clearIndexedDb.ts`: DB 関連の prewarm/clear を実施
- `plugins.config.ts`: アプリの plugin ロード方針を定義

## 依存ルール
- `plugin-runtime` は `plugin-loaders` を利用してよい。
- `plugin-runtime` から `plugin-loaders` への依存は片方向にする。

