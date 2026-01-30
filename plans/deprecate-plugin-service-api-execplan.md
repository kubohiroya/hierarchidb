# Deprecate plugin-service-api by relocating contracts to plugin-base and feature APIs

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, the shared contracts that plugins and the host use are no longer sourced from `@hierarchidb/plugin-service-api`. Core plugin contracts live in `@hierarchidb/plugin-base`, and feature contracts live in dedicated API packages such as `@hierarchidb/location-api`, `@hierarchidb/route-api`, `@hierarchidb/shape-api`, and a new `@hierarchidb/style-api`. Users can run typechecks without relying on `plugin-service-api`, and the repository moves closer to safely removing that package entirely.

## Progress

- [x] (2026-01-30 13:20 JST) Create a new style API package and move Style* contracts into it.
- [x] (2026-01-30 13:20 JST) Move plugin contract types (PluginManifest/registry/lifecycle/etc.) into plugin-base and update exports.
- [x] (2026-01-30 13:20 JST) Replace imports across app/runtime-worker/plugins to use the new packages.
- [x] (2026-01-30 13:20 JST) Reduce plugin-service-api to transitional re-exports only, or remove unused files.
- [x] (2026-01-30 13:20 JST) Run targeted builds/typechecks and record results.

## Surprises & Discoveries

- Observation: plugin-service-api still contains many base plugin contracts even after location/route/shape extraction.
  Evidence: `packages/plugin-service-api/src/types/*` listing on 2026-01-30.
- Observation: runtime-worker typecheck required tree-api/dist availability and TreeQueryAPI parity; added missing TreeQueryAPI methods and updated search mode to align with tree-api.

## Decision Log

- Decision: Put base plugin contracts (PluginDefinition, PluginManifest, registry/lifecycle/extension types) in `@hierarchidb/plugin-base`.
  Rationale: User-directed architecture decision; plugin-base is the shared headless API surface for plugins.
  Date/Author: 2026-01-30 / Codex

- Decision: Introduce `@hierarchidb/style-api` for style contracts.
  Rationale: Align style domain with location/route/shape API package pattern.
  Date/Author: 2026-01-30 / Codex

## Outcomes & Retrospective

- plugin-service-api now exports only transitional re-exports; location/route APIs moved to feature packages and consumers updated.

## Context and Orientation

`packages/plugin-service-api/src/types` currently holds the remaining shared contracts: plugin definitions, registry metadata, lifecycle hooks, style contracts, and location/route API contracts. Location/route/shape contracts are migrating to feature API packages (`packages/features/*-api`). The goal is to make `plugin-service-api` unnecessary by moving base contracts into `packages/plugin-base` and style contracts into a new `packages/features/style-api` package, then updating consumers to import from those new locations. Typechecks are performed using `pnpm --filter <pkg> typecheck`, and public type resolution goes through `dist/*.d.ts`.

## Plan of Work

First, introduce a new feature API package `packages/features/style-api` modeled after `shape-api` and `route-api`. Move `styleTypes.ts`, `StyleQueryAPI.ts`, and `StyleMutationAPI.ts` from plugin-service-api into the new package and export them from its `src/index.ts`. Update `tsconfig.base.json` paths to include the new package.

Second, create a plugin-base types area (for example, `packages/plugin-base/src/types`) and move core plugin contracts from plugin-service-api into that area. These include the plugin manifest/definition/registry types, lifecycle and extension APIs, NodeTypeAPI, base search criteria, and common result types. Update `packages/plugin-base/src/index.ts` to re-export these new types.

Third, update consumers to import from the new packages: style-related imports should use `@hierarchidb/style-api`, and plugin base contracts should use `@hierarchidb/plugin-base`. Update package.json dependencies to include the new packages and remove direct plugin-service-api dependencies where no longer used.

Fourth, simplify `packages/plugin-service-api` to act as transitional re-exports only (or remove unused files). If transitional re-exports are kept, the module should re-export from `plugin-base`, `location-api`, `route-api`, `shape-api`, and `style-api` with a short comment that the package is deprecated.

Finally, run targeted builds and typechecks for the new packages and the main consumers (app, runtime-worker, styler plugin, etc.). Record command outputs and any warnings.

## Concrete Steps

All commands run from repository root: `/Users/hiroya/WebstormProjects/hierarchidb`.

1) Create `packages/features/style-api`:
   - Add `package.json`, `tsconfig.json`, and `src/index.ts`.
   - Move `styleTypes.ts`, `StyleQueryAPI.ts`, `StyleMutationAPI.ts` into `src/`.
   - Update `tsconfig.base.json` paths to include `@hierarchidb/style-api`.

2) Add plugin-base type exports:
   - Create `packages/plugin-base/src/types/*` and move base plugin contracts.
   - Update `packages/plugin-base/src/index.ts` to export the new types.

3) Update imports and dependencies:
   - Replace `@hierarchidb/plugin-service-api` style imports with `@hierarchidb/style-api`.
   - Replace plugin contract imports with `@hierarchidb/plugin-base`.
   - Adjust affected `package.json` files.

4) Adjust plugin-service-api:
   - Remove moved files or convert to re-exports only.
   - Update `packages/plugin-service-api/src/index.ts` accordingly.

5) Validation:
   - `pnpm --filter @hierarchidb/style-api build`
   - `pnpm --filter @hierarchidb/style-api typecheck`
   - `pnpm --filter @hierarchidb/plugin-base build`
   - `pnpm --filter @hierarchidb/styler-store typecheck`
   - `pnpm --filter @hierarchidb/styler-plugin typecheck`
   - `pnpm --filter @hierarchidb/runtime-worker typecheck`
   - `pnpm --filter @hierarchidb/app typecheck`

## Validation and Acceptance

The change is accepted when:

1) `@hierarchidb/style-api` exports the style contracts and builds successfully.
2) Base plugin contracts are exported from `@hierarchidb/plugin-base`.
3) All affected packages compile with typecheck commands above, and no imports rely on plugin-service-api for moved contracts.
4) plugin-service-api contains only transitional re-exports or is unused by consumers.

## Idempotence and Recovery

All steps are additive and can be rerun safely. If a step fails, revert the most recent file edits and re-run the relevant build/typecheck commands. To roll back, restore `plugin-service-api` type files and re-point imports to `@hierarchidb/plugin-service-api`.

## Artifacts and Notes

Collect command output for build/typecheck runs in the TASKS.md log. Keep any warnings (such as tsdown define warnings) recorded for later cleanup.

## Interfaces and Dependencies

`@hierarchidb/style-api` must export:
- `StyleValueType`, `StyleType`, `StyleKeyValueEntry`, `StyleDescriptor`, `StyleKeyValues`, `StyleRecord`
- `StyleQueryAPI`, `StyleMutationAPI`

`@hierarchidb/plugin-base` must export:
- `PluginDefinition`, `PluginManifest` (and supporting plugin metadata/registry types)
- `PluginExtensionAPI`, `PluginLifecycleAPI`, `PluginRegistryAPI`, `PluginTreeAPI`, `NodeTypeAPI`
- `BaseSearchCriteria`, `OperationResult`, `PaginatedResult`, `PackageJson`
- `EntityLifecycleHooks`, `extensions`, and registry serialization/resolution types as currently defined

If transitional re-exports are kept in `plugin-service-api`, they must re-export from `plugin-base` and the feature API packages without redefining the types.
