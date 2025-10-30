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
| Feature bundle | `@hierarchidb/feature-core` | Aggregates runtime, registry, and plugin feature APIs consumed by the app and worker bridge. |
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

## 3. `@hierarchidb/feature-core` exports

`@hierarchidb/feature-core` hides data/service packages behind a stable facade.
Important subpaths:

- `common-{api|auth|types}`
- `runtime-{client|worker}`
- `util`
- `map-adapter`
- `plugin-presentation`
- `plugin-registry` (+ `/types`, `/derivations`)
- `plugin-ui-sdk`
- Node-type plugin bundles (`basemap`, `folder`, `linker`, `location`, `resolver`,
  `route`, `shape`, `spreadsheet`, `styler`, `timeline`)
- `tabular-source-xlsx`

`FeatureCorePackages` lists every exported module for automated validation.

## 4. Verification

- `dep-fence` policies (`app-ui-shell-bundle`, `app-feature-core-bundle`) forbid
  direct imports from the underlying packages in `@hierarchidb/app`.
- `pnpm --filter {@hierarchidb/ui-shell,@hierarchidb/feature-core} build` produces
  façade bundles (dist/). The app build reuses those outputs.
- `pnpm --filter @hierarchidb/app {build,typecheck,test}` stays green with only
  bundle dependencies.

Keep this document in sync when adding new public subpaths to either bundle or when
the app introduces additional top-level dependency categories.
