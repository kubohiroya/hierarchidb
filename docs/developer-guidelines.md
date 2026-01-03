# HierarchiDB Developer Guidelines (Plugins & Packages)

This document defines non-negotiable rules (MUST/MUST NOT), strong
recommendations (SHOULD/SHOULD NOT), and allowed options (MAY/MAY NOT)
for package maintenance in this monorepo. The goal is to keep typing
strict, packages interoperable, and builds reproducible.

## Dependencies and Packaging

- MUST: Use `workspace:*` to reference sibling packages. Do not path-map to
  built artifacts (`dist/*`) in `tsconfig`. No per-package tsconfig aliasing
  to other packages' `dist`.
- MUST: Emit type declarations (`d.ts`) for every publishable package. Do not
  disable `dts` as a workaround. Fix typings or narrow public API instead.
- MUST: Treat runtime frameworks or singletons shared across the app as
  `peerDependencies`, and mirror them in `devDependencies` for local builds.
  Typical peers:
  - Database/Storage layer: `dexie`
  - React ecosystem: `react`, `react-dom`
  - UI frameworks: `@mui/material`, `@mui/icons-material`
- MUST NOT: Put these peers into `dependencies` (prevents duplicate installs
  and cross-version type conflicts).
- SHOULD: Keep small leaf utilities in `dependencies` when they are internal
  implementation details (no host integration required).
- MAY: Add package-level `tsup` `external` entries for large UI libs to avoid
  bundling in libraries.

### Peer vs Dependency decision table

- Database, UI frameworks, React, routing, map engines: peerDependency (MUST)
- Low-level pure utils used internally (e.g., hashing, small parsers): dependency (SHOULD)
- Types-only imports: devDependency (SHOULD)

## Type Strictness

- MUST: No `any`. Prefer exact types. If a third-party lib has no types,
  add a local `.d.ts` shim with explicit, minimal contracts.
- MUST: Avoid `unknown` in public APIs. Use precise interfaces.
- MUST: Model external registries by domain-specific interfaces (e.g.,
  `ShapeGroupStore<T>` instead of `unknown`).
- MUST: Prefer branded IDs from `@hierarchidb/common-type` (`NodeId`, `EntityId`).
  Do not cast between them. Introduce mapping helpers if needed.
- MUST: Keep `BaseEntityHandler`/Dexie types concrete:
  `protected table: Table<TEntity, EntityId>` and
  `applyAdditionalSearchCriteria(query: Collection<TEntity, ...>, ...)`.
- SHOULD: Use module augmentation to describe host-provided UI contracts
  (e.g., `@hierarchidb/ui-map`) rather than loosening consumer code.

## tsconfig and Build

- MUST: Do not path-map other packages' `dist` in `tsconfig`. Only
  `workspace:*` and local `src/*`.
- MUST: Keep `dts` generation ON for all packages. If types are not stable,
  narrow the package public API until stable.
- MUST: For bundlers (`tsup`), treat React/MUI/Map/DB as externals in libraries.
- SHOULD: If UI/Worker parts are not type-stable, export only the stable
  shared layer in the package entry and re-expose UI/Worker later.

### Vite 開発サーバの復旧手順

- 基本的には `pnpm dev` の再起動だけで HMR 不調は解消される。補助スクリプト (`dev:diagnose` など) は廃止済み。
- それでも更新が取り込まれない場合は以下の順で対応する。
  1. 既存の Vite dev サーバを終了する。
  2. `rm -rf app/node_modules/.vite node_modules/.vite` などで `.vite` キャッシュを手動削除する。
  3. 必要であれば `app/src/version.ts` にコメントを 1 行追加して HMR を強制する。
  4. 再度 `pnpm dev` を起動する。
- Turbo キャッシュを疑う必要はほぼ無いが、どうしても復旧しない場合のみ `pnpm run clean` を検討する。

## Public API Design

- MUST: Export only stable, documented types from the root entry.
- SHOULD: Gate不安定な領域は subpath exports（例: `./shared` や `./ui`）で管理しつつ、
  Worker 系は `@hierarchidb/runtime-shared-module-paths` の `importRuntimeWorker()` / `importPluginWorker()`
  を経由して公開する。直接 `*/worker` サブパスをアプリ側に露出しない。

## Temporary Workarounds Policy

- MUST NOT: Disable `dts` as a temporary fix.
- MUST: Prefer one of these tactics, in order:
  1) Tighten public surface (limit exports).
  2) Add explicit local shims with precise contracts.
  3) Module augmentation for host packages used in apps.
  4) Add typed adapters at the boundary rather than loosening core types.

## PR Checklist (Mandatory)

- [ ] Uses `workspace:*` for internal deps; peers are in `peerDependencies`.
- [ ] No `any`/`unknown` in public types. Local shims are explicit.
- [ ] `d.ts` generation enabled and passing.
- [ ] Tables/Collections typed with Dexie v4 types.
- [ ] Public API exports are stable; unstable areas hidden or under subpaths.
- [ ] Bundler `external` configured for React/MUI/Map/DB.

## MUI and Material Icons

- MUST: Treat `@mui/material` and `@mui/icons-material` as peerDependencies
  for libraries/plugins. Do not bundle them. Add as devDependencies for local
  builds.

## Dexie

- MUST: Use Dexie v4 across the monorepo for type consistency.
- MUST: Mark Dexie as a `peerDependency` and add a matching `devDependency`.
- MUST: Type Dexie usage (`Table<TEntity, EntityId>`, `Collection<TEntity,...>`)
  in handlers. No implicit `any`.

## Ambient Declarations (.d.ts) Policy

- MUST NOT: Create hand-maintained `.d.ts` files under any `src/` directory.
  - Rationale: source-local shims drift and are hard to audit.
- MUST: If you need an ambient module declaration (e.g. `declare module 'xlsx/xlsx.mjs'`), place it under the repository-level `types/` folder.
- MUST: Keep ambient declarations minimal (prefer `unknown` boundaries internally, but do not leak `any` to public APIs).
- MUST NOT: Introduce files whose name includes `shim` (e.g. `*shim*.d.ts`) unless explicitly allowlisted by `scripts/check-shims.mjs`.

Recommended naming under `types/`:
- Third-party package shim: `types/<package>.d.ts` (e.g. `types/topojson-simplify.d.ts`)
- Third-party subpath shim: `types/<package>-<subpath>.d.ts` (e.g. `types/xlsx-xlsx-mjs.d.ts`)
- Cross-cutting asset/module declarations: `types/ambient-modules.d.ts`

Enforcement:
- `pnpm run build:pre` runs `pnpm shims:check` and will fail if the shim policy is violated.
