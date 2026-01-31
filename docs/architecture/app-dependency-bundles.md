# App Dependency Bundles

This note captures the current layering contract introduced for `@hierarchidb/app`.
It documents how workspace dependencies are grouped behind bundle facades and what
remains as direct third-party imports.

## 1. Classification of `@hierarchidb/app` dependencies

`app/package.json` exposes two workspace bundles plus a small set of external
libraries. The table summarises their responsibilities.

| Category | Packages | Purpose |
| --- | --- | --- |
| UI bundle | `@hierarchidb/ui-shell` | Aggregates all UI-facing workspace packages consumed by the shell (treeconsole, auth, routing, dialogs, etc.). |
| Feature bundle (retired) | _n/a_ | 旧 `@hierarchidb/feature-core` は撤廃済み。App は必要なワークスペースパッケージ（common-\*, runtime-\*, plugin-registry など）を直接依存として解決する。 |
| UI platform | `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `jotai` | React UI toolkit, iconography, styling, and state primitives. |
| Routing | `@tanstack/react-router` | Strongly-typed router used by the app shell. |
| Runtime bridge | `comlink`, `dexie`, `reflect-metadata`, `inversify` | Worker messaging, IndexedDB wrapper, decorators, and DI container. |
| Product UX | `react-joyride`, `react-resizable`, `react-draggable`, `react-hook-geolocation`, `isbot` | Guided tours, resizable layouts, drag/drop, geolocation helper, bot detection. |
| i18n | `i18next-browser-languagedetector`, `i18next-http-backend` | Language detection and translation resource loading. |

## 2. `@hierarchidb/ui-shell` exports

`@hierarchidb/ui-shell` re-exports UI packages so consuming code never points at
individual workspace packages. Available subpaths include:

- `components`
- `plugin-ui-host`
- `ui-auth`
- `ui-dialog`
- `ui-icon`
- `ui-i18n`
- `ui-layout`
- `ui-map`
- `ui-navigation`
- `ui-routing`
- `ui-theme`
- `ui-tour`
- `ui-treeconsole-{base|breadcrumb|toolbar|treetable}`
- `ui-usermenu`

The root export exposes `UIShellPackages` so tooling (`dep-fence`, dependency graphs)
can assert bundle membership.

## 3. Feature bundle retirement

以前は `@hierarchidb/feature-core` が runtime / registry / plugin API を
再エクスポートしていましたが、NodeNext 導入後は下記の課題が顕在化しました。

- dist 出力を持たない “仮想” パッケージのため、Vite の本番ビルドで解決不能になる
- 依存の所在が不透明になり、`dep-fence` や Turbo の pipeline が複雑化する
- プラグインごとの import path を把握しづらく、型調整のたびに bundle 側を更新する必要がある

そのため App は `@hierarchidb/core-types` / `@hierarchidb/tree-api` / `@hierarchidb/batch-api` /
`@hierarchidb/runtime-{client|worker}` / `@hierarchidb/plugin-registry` /
`@hierarchidb/plugin-ui-sdk` などを**直接**依存する方針へ戻しました。
`dep-fence` では “UI bundle 以外から UI 系パッケージを直 import しない”
ルールだけを維持し、_feature_ 領域については実体パッケージをそのまま参照します。

## 4. Verification

- `dep-fence` policies (`app-ui-shell-bundle`, `app-feature-core-bundle`) forbid
  direct imports from the underlying UI packages in `@hierarchidb/app`.
- `pnpm --filter @hierarchidb/ui-shell build` produces the façade bundle consumed by the app.
- `pnpm --filter @hierarchidb/app {build,typecheck,test}` stays green with only
  UI bundle + 実体 feature パッケージの依存で完結する。

Keep this document in sync when adding new public subpaths to either bundle or when
the app introduces additional top-level dependency categories.
