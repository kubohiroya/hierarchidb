# Node Type Plugins: 依存管理とインポート規約

この文書は node-type/*-plugin の依存関係とインポート方法を統一し、ビルド/実行時の衝突や重複バンドル、開発効率低下を防ぐための厳格なルールを定めます。

## 原則（Core Principles）
- 役割分担: 実行時にホストが提供すべきライブラリは `peerDependencies`。プラグインが持つ処理は `dependencies`。ビルド/テスト専用は `devDependencies`。
- 一貫性: モノレポ内参照は公開APIのみ。深いパスへの import は禁止。型は `import type` を優先。
- 外部化: peer 管理ライブラリはバンドルから除外（`tsup.base.config.ts` の external 参照）。

## ライブラリ別の分類

### MUST（必ず入れる）
- `peerDependencies`: `react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `dexie`, （採用時）`maplibre-gl`, `react-i18next`, `i18next`
- `devDependencies`: `typescript`, `tsup`, `vitest`, `@testing-library/*`, `@types/*`

### SHOULD（入れるべき）
- `dependencies`: `@hierarchidb/util`（必須ユーティリティ）
- 必要に応じて `@hierarchidb/feature/*`（例: `@hierarchidb/table-metadata`, `@hierarchidb/download`, `@hierarchidb/tabular`）

### SHOULD NOT（入れるべきではない）
- `dependencies` に peer にすべきライブラリ（React/MUI/Dexie/i18n/Map）
- 他プラグイン実装パッケージ（強結合を避ける）

### MUST NOT（入れてはいけない）
- `runtime-*` やアプリ層のパッケージへ直接依存
- `comlink` などランタイム境界の橋渡し実装（ホスト側が管理）

### MAY / MAY NOT（許容/不要）
- 型だけ必要なモノレポ内パッケージは `import type` + `devDependencies` を許容（MAY）
- Storybook 等の運用ツールは通常プラグイン内には不要（MAY NOT）

## インポート規約
- 公開APIのみ: `import { getDBName } from '@hierarchidb/util'`
- 型は `import type` で取り込み、JS 出力を抑制
- 重量/オプション機能は `await import('...')` で動的読込（プレビュー/解析など初期表示に不要なもの）

## tsup external 設定
モノレポ共通の `tsup.base.config.ts` に以下を external 済み:
```
react, react-dom, @mui/material, @mui/icons-material,
@emotion/react, @emotion/styled, maplibre-gl, dexie,
react-i18next, i18next
```
各プラグインの `tsup.config.ts` は特殊要件がない限り追加設定不要です。追加する場合も上記方針を必ず守ってください。

## Dexie/DB 命名規約
- DB 名は `getDBName('<kebab-suffix>')` を使用（例: `core-db`, `ephemeral-db`, `spreadsheet-metadata-db`）。
- 共有実装がある場合は `@hierarchidb/table-metadata` などの feature パッケージを優先。

## 変更前チェックリスト
- [ ] peer へ入れるべきものを peerDependencies に置いたか
- [ ] tsup external で peer が二重バンドルされないか
- [ ] 型のみの依存は `import type` + devDependencies に出来ないか
- [ ] 内部パッケージは公開APIからのみ参照しているか

