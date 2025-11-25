# Node Type Plugins: 依存管理とインポート規約

この文書は node-type/*-plugin の依存関係とインポート方法を統一し、ビルド/実行時の衝突や重複バンドル、開発効率低下を防ぐための厳格なルールを定めます。

## 原則（Core Principles）
- 役割分担: 実行時にホストが提供すべきライブラリは `peerDependencies`。プラグインが持つ処理は `dependencies`。ビルド/テスト専用は `devDependencies`。
- 一貫性: モノレポ内参照は公開APIのみ。深いパスへの import は禁止。型は `import type` を優先。
- 外部化: peer 管理ライブラリはバンドルから除外（`tsup.base.config.ts` の external 参照）。

## TypeScript 設定（必読）
- rootDir の扱い: 原則として `rootDir` は固定しません（TypeScript に共通ルートを自動計算させる）。ただし、他パッケージの `src` を直接参照する構成は避け、依存は公開エントリ経由で解決してください。
- モジュール解決: 基本は `module: "ESNext"`, `moduleResolution: "node"`。`node16`/`nodenext` は `.js` 拡張子必須の警告（TS2835）を誘発しやすいため使用しません。
- 生成物: パッケージ側のビルドは `tsup` に任せ、`tsconfig` では `noEmit: true` を既定とし、必要に応じて `outDir: "dist"` のみ指定します。
- include/exclude: `include: ["src/**/*.ts", "src/**/*.tsx"]` を推奨。`dist`, `node_modules`, `**/*.test.*` は `exclude` すること。

## クロスパッケージ import の取り扱い
- 公開 API のみを使用: `@hierarchidb/{package}` のエクスポートから参照し、`src/*` などのディープパスは使用禁止。
- 型参照の前提（日付更新）: 以前は多くのパッケージで `exports.types` を `src/RuntimeWorkerService.ts` に向けていましたが、複数エントリ（UI/Worker/Workers/*）を公開するプラグインでは `dist/*.d.ts` を型エントリとします（例: shape-plugin）。利用側は公開エントリから解決し、`import type` を優先して JS 出力を抑制してください。
- Node 環境型: Node グローバル（例: `process`）を型として使う必要がある場合、パッケージの `tsconfig.json` に `types: ["node"]` を追加します（例: `node-type/linker-plugin`）。

## package.json の `exports` / `types` ポリシー（重要・更新）
- 目的: 複数エントリ（UI/Worker/Workers/*）や Web Worker の公開があるプラグインでの型解決とビルド安定性を両立する。
- ルール（ライブラリ側、=他パッケージに公開する側）
  - 単一エントリの軽量ライブラリ: `exports.types`/`types` は `src/RuntimeWorkerService.ts` を指してよい。
  - 複数エントリや Worker を公開するプラグイン（例: shape-plugin）: `exports.types`/`types` は `dist/*.d.ts` を指す。`exports.import`/`module`/`main` は `dist/*.js` を指す。
- ルール（プラグイン／利用側）
  - 公開エントリ（`@hierarchidb/*`）のみ import。`rootDir` 固定は不要。
  - `module: "ESNext"` + `moduleResolution: "node"` を使用。
- 備考: UI パッケージ群で TS2742（jsx-runtime 依存の暗黙型）を防ぐため、公開 TSX は戻り値型を明示すること（下記参照）。

## 公開 TSX コンポーネントの戻り値型（MUST）

- 目的: 依存パッケージの d.ts バンドル時に `jsx-runtime` など外部型への暗黙依存により TS2742 が発生するのを防止するため、公開 API の TSX コンポーネントは戻り値型を必ず明示します。
- ルール（MUST）:
  - `export function Foo(...)` は `: JSX.Element` または `: JSX.Element | null` を付ける。
  - `export const Foo = (...) => (...)` は `React.FC<Props>` を使うか `: JSX.Element` を付ける。
  - 返り値が `null` を取り得る場合は `| null` を含める。
- 背景: 本モノレポは `exports.types` を `src` に向けるため、依存側の d.ts 生成時に公開関数の戻り値推論が「名前付け不能な外部型」へ波及しうる。明示注釈でポータブルな型に固定します。

## tsconfig パスエイリアスの取り扱い（MUST/SHOULD）

- 公開ソースでのエイリアス禁止（MUST）: ライブラリの公開ソース内では、パッケージ内専用の `tsconfig.paths`（例: `~/*`）に依存しないこと。外部の tsconfig が同じ設定を持たないと解決できず、利用側がビルド前 typecheck に失敗します。
- `types` は `src` 指向（MUST）: すべての内部パッケージは `package.json` の `types` と `exports.types` を `src` に向けます。これにより、ビルド前でも型解決可能になります。
- エイリアスが必要な場合（SHOULD）:
  - ビルド時に相対へ書き換える（`ts-transform-paths` / `tsc-alias` など）構成にする。
  - または、公開エクスポート面では相対参照に統一する。
どちらの方針でも、依存パッケージ側で追加設定なしに解決できることが要件です。

## 互換性とビルド安定化のための禁止事項
- `module: "Node16"` や `moduleResolution: "nodenext"` の使用を避ける（モノレポ内の型参照で拡張子付与エラーを招くため）。
- ディープインポート（`@hierarchidb/*/src/...` など）。
- 依存のシャドーイングや二重バンドル（peer にすべきものを dependencies に置くなど）。

## 変更前チェックリスト（更新）
- [ ] peer へ入れるべきものを `peerDependencies` に置いたか
- [ ] `tsup` の external で peer が二重バンドルされないか
- [ ] 型のみの依存は `import type` + `devDependencies` に出来ないか
- [ ] 内部パッケージは公開 API からのみ参照しているか（ディープインポート禁止）
- [ ] `tsconfig.json` が `module: ESNext` / `moduleResolution: node` で、`rootDir` を不要に固定していないか

## ID ポリシー（更新）
- Entity の ID は `NodeId` に統一します。従来の `EntityId` は廃止済みです。
- タグ関連は独立した `TagId` を使用します（`NodeId` と混同しない）。
- Working Copy/ダイアログ系 API も `NodeId` を受け渡し ID とします（例: `MultiStepDialogAPI.createWorkingCopy(): Promise<NodeId>`）。


## ライブラリ別の分類

### MUST（必ず入れる）
- `peerDependencies`: `react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `dexie`, （採用時）`maplibre-gl`, `react-i18next`, `i18next`
- `devDependencies`: `typescript`, `tsup`, `vitest`, `@testing-library/*`, `@types/*`

### SHOULD（入れるべき）
- `dependencies`: `@hierarchidb/util`（必須ユーティリティ）
- 必要に応じて `@hierarchidb/features/*`（例: `@hierarchidb/table-metadata`, `@hierarchidb/download`, `@hierarchidb/tabular`）

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

### PeerStore データの扱い
- プラグイン固有の `PeerRow` / `PeerStore` では、`data` フィールドが未定義の場合でも必ず**型付きの既定値**を格納すること。
  - 例: `type FooPeerData = { schemaVersion: 1; domain?: FooDomain }` のように `schemaVersion` を含む最小構造体を定義する。
  - 実装側では `normalizeFooPeerData(undefined) => { schemaVersion: 1 }` のような正規化関数を用意し、`put/bulkUpsert` で必ず通過させる。
- UI 側が `PeerStore#get` を呼び出した際に `data` が `undefined` になることを禁止する。既定値を返すことで、`FolderPeerData` などデータを持たないプラグインでも型安全に扱えるようにする。
- 一時的にドメインデータを持たないプラグインでも `PeerStore<T>` は `T = FooPeerData` の形で具体的な型パラメータを使用し、`any` や `unknown` を使用しない。

## 変更前チェックリスト
- [ ] peer へ入れるべきものを peerDependencies に置いたか
- [ ] tsup external で peer が二重バンドルされないか
- [ ] 型のみの依存は `import type` + devDependencies に出来ないか
- [ ] 内部パッケージは公開APIからのみ参照しているか
## Shape Plugin Build/Exports

The `@hierarchidb/shape-plugin` package now ships full ESM builds in `dist/`:

- `dist/preconnect.ts` — main library entry (types: `dist/index.d.ts`)
- `dist/shared/preconnect.ts` — shared types and helpers (types: `dist/shared/index.d.ts`)
- `dist/ui/preconnect.ts` — UI exports (components, hooks) (types: `dist/ui/index.d.ts`)
- `dist/worker/preconnect.ts` — legacy worker entry（互換用）
- `dist/worker-factory/preconnect.ts` — modulePaths 経由で解決される Worker ファクトリ API
- `dist/workers/*.js` — dedicated Worker entry points (Download/Simplify1/Simplify2/VectorTile)

Consumers should import as follows:

- App (main thread): `import { ... } from '@hierarchidb/shape-plugin'`
- UI: `import { ... } from '@hierarchidb/shape-plugin/ui'`
- Worker preload: `await import('@hierarchidb/runtime-shared-module-paths').then((m) => m.importPluginWorker('shape'))`
- Worker factories: `import('@hierarchidb/shape-plugin/worker')`

Notes:

- UI/Worker do not import app internals. The app provides the Worker client via:
  `import { registerWorkerClientHook } from '@hierarchidb/runtime-client'`
  and `registerWorkerClientHook(useWorkerAPIClient)` at startup.
- The app should reference `@hierarchidb/shape-plugin` entries via dist (avoid src deep imports).
- `exports` in package.json are configured accordingly; TS type resolution points to `dist/*.d.ts`。Worker 互換が必要な場合は `./worker` を、既定経路は `./worker-factory` を活用する。

### DTS policy

- `index` and `shared/index` emit .d.ts.
- `ui/index` emits .d.ts (branded IDs are avoided; use plain string aliases in shared types).
- `worker/index` JS-only for now; dedicated `workers/*` are compiled to JS bundles.
  We can add .d.ts once internal Dexie store types are stabilized.
