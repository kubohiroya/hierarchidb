# Extract shape/styler store and move host access to store APIs

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

The runtime-worker and app should no longer reach into plugin internals for shape/location/route/styler data access or cleanup. After this change, the host uses store packages for database helpers and API contracts, and runtime cleanup flows go through mutation APIs instead of dynamic imports. You can verify success by checking that `app/src/router/routes/map.tsx` imports only store packages for map layer data and that `packages/runtime-worker/src/entity/EntityLifecycleManager.ts` performs cleanup through mutation APIs without importing plugin databases.

## Progress

- [x] (2025-12-28 11:25 JST) Created `@hierarchidb/shape-store` and `@hierarchidb/styler-store` packages with index exports and build/typecheck scripts.
- [x] (2025-12-28 11:33 JST) Moved shape DB and ephemeral DB implementations to `shape-store` and re-exported them from shape-plugin database entrypoints.
- [x] (2025-12-28 11:37 JST) Moved location/route DB helpers into store packages and re-exported them from plugin database entrypoints.
- [x] (2025-12-28 11:44 JST) Added store re-exports for Query/Mutation API types and updated plugin-service-api contracts for tile retrieval and cleanup.
- [x] (2025-12-28 11:50 JST) Updated runtime-worker services and EntityLifecycleManager to use store mutation APIs and store DB helpers.
- [x] (2025-12-28 11:56 JST) Updated map UI to fetch vector tiles through worker query APIs and import styler metadata from `styler-store`.
- [ ] (2025-12-28 12:00 JST) Validation pending: run targeted typechecks for shape-store, styler-store, runtime-worker, and affected plugins/app.

## Surprises & Discoveries

- Observation: Location and route vector tiles are stored outside the plugin DBs (ephemeral location DB and `TilesDB`), so query APIs need explicit tile retrieval methods.
  Evidence: `app/src/router/routes/map.tsx` previously used `getEphemeralLocationDB()` and `TilesDB` directly.

## Decision Log

- Decision: Keep plugin database entrypoints as thin re-exports to preserve existing imports while moving canonical implementations to store packages.
  Rationale: This reduces churn inside plugin code while removing host-side plugin dependencies.
  Date/Author: 2025-12-28 / Codex

- Decision: Implement location tile retrieval by nodeId (resolve session internally) and route tile retrieval by sessionId.
  Rationale: Location sessions are discoverable by nodeId in the ephemeral DB, while route tiles are keyed only by sessionId.
  Date/Author: 2025-12-28 / Codex

- Decision: Provide placeholder `StylerQueryAPI`/`StylerMutationAPI` interfaces in styler-store.
  Rationale: Styler data is stored on TreeNode data/draftData, so TreeQueryAPI/TreeMutationAPI remain the runtime source of truth; placeholders satisfy host contract requirements without inventing runtime services.
  Date/Author: 2025-12-28 / Codex

## Outcomes & Retrospective

This change removes direct plugin DB imports from host code and consolidates store access, but validation is still pending. Re-run targeted typechecks to confirm the new store packages and runtime-worker compile cleanly.

## Context and Orientation

Shape DB logic previously lived in `plugins/shape-plugin/src/services/database/ShapeDB.ts` and `plugins/shape-plugin/src/services/database/EphemeralShapeDB.ts`. Route DB logic lived in `plugins/route-plugin/src/services/database/RouteDatabase.ts`, and location tiles were stored in `plugins/location-plugin/src/database/EphemeralLocationDB.ts`. The map route (`app/src/router/routes/map.tsx`) read tiles directly from these DBs and from `TilesDB` in `@hierarchidb/gis-sdk`. Cleanup logic in `packages/runtime-worker/src/entity/EntityLifecycleManager.ts` used dynamic imports of plugin databases to delete artifacts. Query/Mutation API contracts are defined under `packages/plugin-service-api/src/types` and are implemented by runtime-worker services.

## Plan of Work

Create new store packages for shape and styler, move DB classes into store packages, and keep plugin database entrypoints as re-exports. Add DB helpers to existing location/route store packages so the host no longer imports plugin DBs. Extend Query/Mutation API contracts to include vector tile access and cleanup methods, implement those methods in runtime-worker services, and configure EntityLifecycleManager to call the mutation APIs. Update the map route to request vector tiles through worker query APIs and to import styler metadata from `styler-store`. Update dependency manifests and tsconfig path mappings to include the new store packages.

## Concrete Steps

Work from the repo root.

1) Create store packages and move DB helpers.
   - Create `packages/features/shape-store` with `src/ShapeDB.ts`, `src/EphemeralShapeDB.ts`, and `src/index.ts` exporting DB classes and types.
   - Create `packages/features/styler-store` with `src/StylerEntity.ts`, `src/StylerAPI.ts`, and `src/index.ts` exporting styler types and API placeholders.
   - Copy location/route DB helpers into their respective store packages and re-export them from plugin database entrypoints.

2) Update host services and APIs.
   - Add `getVectorTile` methods to Location/Route Query APIs.
   - Add `clearShapeArtifacts`, `clearLocationArtifacts`, `clearRouteArtifacts` to Mutation APIs and implement them in runtime-worker services.
   - Inject mutation services into `EntityLifecycleManager` from `WorkerService`.

3) Update UI map tile providers.
   - Replace direct DB access in `app/src/router/routes/map.tsx` with `getShapeQueryAPI()`, `getLocationQueryAPI()`, and `getRouteQueryAPI()` calls.
   - Replace `MAPLIBRE_PROPERTY_METADATA` import with the store export.

4) Update dependencies and path aliases.
   - Add path aliases in `tsconfig.base.json` for new store packages.
   - Add new store dependencies in `app`, `runtime-worker`, and affected plugins.

## Validation and Acceptance

Run the following commands from the repo root and expect no errors:

  - `pnpm --filter @hierarchidb/shape-store typecheck`
  - `pnpm --filter @hierarchidb/styler-store typecheck`
  - `pnpm --filter @hierarchidb/runtime-worker typecheck`
  - `pnpm --filter @hierarchidb/shape-plugin typecheck`
  - `pnpm --filter @hierarchidb/styler-plugin typecheck`
  - `pnpm --filter @hierarchidb/app typecheck`

Acceptance is confirmed when host code no longer imports plugin DB modules for shape/location/route/styler access and map tile loading works via worker query APIs.

## Idempotence and Recovery

These changes are additive and safe to reapply. If any step fails, revert the new store packages and import updates and rerun the relevant typechecks to confirm the previous state. No database migrations are involved.

## Artifacts and Notes

- Expected evidence: `app/src/router/routes/map.tsx` imports only store packages for shape/location/route/styler data access.
- Expected evidence: `packages/runtime-worker/src/entity/EntityLifecycleManager.ts` uses mutation APIs and has no plugin database imports.

## Interfaces and Dependencies

The store packages export DB helpers and API contracts; runtime behavior still lives in runtime-worker services. Shape and route DB helpers rely on Dexie and `@hierarchidb/util`. The styler store exports the same `StylerEntity` types and MapLibre metadata used by the UI. All host-side interactions with plugin artifacts should go through store APIs rather than plugin implementation modules.

Plan update note: Rewrote the ExecPlan to comply with `PLANS.md`, and updated Progress/Decision Log to reflect store extraction, runtime-worker cleanup changes, and map tile provider updates.
