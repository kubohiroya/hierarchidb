# Extract location/route store types into features packages

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` (repository root). Maintain this document in accordance with that file.

## Purpose / Big Picture

The runtime worker and app should not depend on plugin-owned type definitions for core location/route data. After this change, shared store types live in `@hierarchidb/location-store` and `@hierarchidb/route-store`, and both host/runtime code and plugins import those types from the new packages. You can verify this by checking that runtime-worker and app no longer import location/route types from `@hierarchidb/*-plugin`, and by running typecheck commands without type duplication errors.

## Progress

- [x] (2025-12-28 10:59 JST) Created `@hierarchidb/location-store` and `@hierarchidb/route-store` packages with initial type exports.
- [x] (2025-12-28 10:59 JST) Updated location-plugin and route-plugin to import core types from the new store packages and re-export them where necessary.
- [x] (2025-12-28 10:59 JST) Updated runtime-worker/app imports to reference the new store packages instead of plugin type exports.
- [x] (2025-12-28 10:59 JST) Updated workspace config (tsconfig paths, package dependencies) to include the new store packages.
- [ ] Run targeted typechecks and record results.

## Surprises & Discoveries

- Update: FeatureDefinition/FeatureRegistry were retired, so the earlier `@hierarchidb/tag` export mismatch is no longer applicable.

## Decision Log

- Decision: Create standalone `@hierarchidb/location-store` and `@hierarchidb/route-store` packages that only contain type definitions (no runtime logic, no DB implementations).
  Rationale: The request is to extract types used for runtime operation from plugins without moving behavior; keeping only types minimizes runtime coupling and avoids changing plugin behavior.
  Date/Author: 2025-12-28 / Codex
- Decision: Keep `RoutePoint.pointId` typed as `LocationPointId` by adding `@hierarchidb/location-store` as a dependency of `@hierarchidb/route-store`.
  Rationale: Route line definitions already model a reference to location points; retaining the branded ID preserves type safety across store packages.
  Date/Author: 2025-12-28 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

Location types currently live under `plugins/location-plugin/src/common/entities` and `plugins/location-plugin/src/common/types`. Route types live under `plugins/route-plugin/src/common/entities` and `plugins/route-plugin/src/common/types`. The runtime worker uses location/route data in `packages/runtime-worker/src/services/LocationQueryService.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/runtime-worker/src/services/RouteMutationService.ts`, and `packages/runtime-worker/src/services/RouteQueryService.ts`, while the app map route uses plugin type exports in `app/src/router/routes/map.tsx`. The new packages will sit under `packages/` and `packages/` and will export shared store types so both host and plugins can depend on them.

## Plan of Work

Create two new feature packages that only export type definitions. For location, move core point/entity/batch types (for example `LocationPointId`, `LocationPointProperties`, `LocationPointKind`, `LocationPoint`, `LocationType`, `LocationEntity`, and any batch or relation metadata types used by store records) into `packages//src`. For route, move core route line/entity types and constants (for example `RouteLineString`, `RoutePoint`, `RouteMode`, `ROUTE_MODES`, `RouteEntity`, and `RouteGenerationConfig`) into `packages//src`. Then update location-plugin and route-plugin to import those types from the new packages and re-export them from their index/common types modules as compatibility shims. Update runtime-worker and app imports to use the new store packages for these types. Finally, add path aliases in `tsconfig.base.json` and add dependencies in `package.json` where needed.

## Concrete Steps

1) Create `packages/` with `package.json`, `tsconfig.json`, and `src/index.ts` that export the extracted types. Follow the structure of `packages/` for scripts and tsconfig layout.
2) Create `packages/` with the same structure and exports.
3) Replace location-plugin type sources with imports from `@hierarchidb/location-store` and re-export them from `plugins/location-plugin/src/common/types/index.ts` to preserve existing import paths.
4) Replace route-plugin type sources with imports from `@hierarchidb/route-store` and re-export them from `plugins/route-plugin/src/common/types/index.ts`.
5) Update `packages/runtime-worker/src/services/route/ideGsmRouteCsv.ts` and `app/src/router/routes/map.tsx` to import shared types/constants from the store packages.
6) Update `tsconfig.base.json` paths to include `@hierarchidb/location-store` and `@hierarchidb/route-store`.
7) Update package dependencies: add new store packages to runtime-worker, app, and plugins as needed.
8) Run typechecks for the affected packages.

## Validation and Acceptance

Run the following commands and verify they complete successfully:
  - From repo root: `pnpm --filter @hierarchidb/location-store typecheck`
  - From repo root: `pnpm --filter @hierarchidb/route-store typecheck`
  - From repo root: `pnpm --filter @hierarchidb/runtime-worker typecheck`
  - From repo root: `pnpm --filter @hierarchidb/location-plugin typecheck`
  - From repo root: `pnpm --filter @hierarchidb/route-plugin typecheck`
If tests are skipped, record the reason in the linked GitHub Issue.

## Idempotence and Recovery

The steps are additive and safe to repeat. If a step fails, revert the new packages and import changes (`git checkout -- <files>`) and rerun the relevant typecheck to confirm the previous state. No database migrations are involved.

## Artifacts and Notes

- Expected evidence: `tsc` completes without TS5055 and without missing type export errors for the new store packages.

## Interfaces and Dependencies

The new store packages expose only type exports and constants. No runtime code should be added. Required dependencies are limited to `@hierarchidb/core-types` and any other existing type-only packages referenced by the extracted definitions. Ensure the exported types are identical in shape to their previous definitions to avoid runtime behavior changes.

Plan update note: Initial plan created to extract location/route store types into feature packages and update imports to remove host-to-plugin type coupling.
Plan update note: Marked completed progress items for package creation and import updates, and recorded the route-store dependency decision.
Plan update note: Noted that FeatureDefinition/FeatureRegistry were retired and the prior tag export blocker no longer applies.
