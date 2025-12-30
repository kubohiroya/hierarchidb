# Unify map DB naming across shape/location/route

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` at the repository root and must remain compliant with its requirements.

## Purpose / Big Picture

Users should be able to reason about map previews without memorizing special-case database names or table layouts. After this change, the shape, location, and route map layers all use consistent database names, class names, and table names: each entity has a `{Entity}DB` with `features` and `vectorTiles` tables, referenced via `getDBName('shape'|'location'|'route')`, and accessed through the standard `*QueryAPI/*MutationAPI` interfaces. This consistency is observable by reading the map preview code, the worker query services, and the storage classes, and by exercising the map preview to confirm it still renders tiles after migration.

## Progress

- [x] (2025-12-30 19:44 JST) Inventory current DB names, class names, table layouts, and API entry points for shape/location/route.
- [x] (2025-12-30 20:21 JST) Define migration strategy for renaming DBs and tables, including compatibility handling for existing data (clear-and-regenerate for map tiles/metadata).
- [x] (2025-12-30 20:21 JST) Update storage classes to use `ShapeDB` / `LocationDB` / `RouteDB` and tables `features` / `vectorTiles`.
- [x] (2025-12-30 20:21 JST) Update worker query/mutation services and map preview (`app/src/router/routes/map.tsx`) to point at unified storage.
- [ ] (2025-12-29 13:10 JST) Validate map preview rendering and run targeted typecheck/tests (or document why not run).

## Surprises & Discoveries

- Observation: Location metadata uses `LocationEntitiesDB` with table `groupEntities` in `getDBName('location')`, while vector tiles live in `EphemeralLocationDB` using `getDBName('location-ephemeral')`.
  Evidence: `plugins/location-plugin/src/worker/locationEntitiesDB.ts`, `packages/features/location-store/src/EphemeralLocationDB.ts`.
- Observation: Route vector tiles are stored in `TilesDB` (`getDBName('vectortile')`) and route metadata uses `RouteDatabase` with `lineStrings` in `getDBName('route-db')`.
  Evidence: `packages/runtime-worker/src/services/RouteQueryService.ts`, `packages/features/route-store/src/RouteDatabase.ts`, `packages/features/gis-sdk/src/TilesDB.ts`.

## Decision Log

- Decision: Use a single DB name per entity (`shape`, `location`, `route`) and align table names to `features` and `vectorTiles`.
  Rationale: Matches the requested uniform rule and removes special-case knowledge in /map.
  Date/Author: 2025-12-29 / Codex
- Decision: Drop `groupEntities` as the lifecycle target; treat `features` and `vectorTiles` as the lifecycle-managed tables when present.
  Rationale: User requirement to process features/vectorTiles instead of hard-coded groupEntities.
  Date/Author: 2025-12-30 / Codex

## Outcomes & Retrospective

- Not completed yet.

## Context and Orientation

The `/map` route aggregates layers for shape/location/route and retrieves vector tiles via worker APIs. The current implementation uses inconsistent DB names and storage classes: shape uses `ShapeDB` with `getDBName('shape')`, location uses `LocationEntitiesDB` for feature data (db name `getDBName('location')`) and a separate `EphemeralLocationDB` for vector tiles (db name `getDBName('location-ephemeral')`), while route stores tiles in `TilesDB` (db name `getDBName('vectortile')`) and line strings in `RouteDatabase` (db name `getDBName('route-db')`). Entity lifecycle handling is currently keyed to `groupEntities`/`relations` stores via `storeRegistry`.

Relevant files to inspect and modify include:

- `app/src/router/routes/map.tsx` for layer aggregation and tile providers.
- `packages/features/shape-store/src/ShapeDB.ts` for shape storage tables and DB name.
- `packages/features/location-store/src/EphemeralLocationDB.ts` and `plugins/location-plugin/src/worker/locationEntitiesDB.ts` for location storage.
- `packages/features/route-store/src/RouteDatabase.ts` and `packages/features/gis-sdk/src/TilesDB.ts` for route storage.
- `packages/runtime-worker/src/services/ShapeQueryService.ts`, `packages/runtime-worker/src/services/LocationQueryService.ts`, `packages/runtime-worker/src/services/RouteQueryService.ts` for query APIs.
- `packages/common/api/src/WorkerAPI.ts` and `packages/plugin-service-api/src/types/*.ts` for API surface checks.

A “vector tile” here means a Mapbox Vector Tile PBF stored as raw bytes in a Dexie table (usually `vectorTiles`). A “feature metadata” record means the per-feature properties (for shapes/points/lines) stored in a `features` table.

## Plan of Work

Start by cataloging the current DB class names, table names, and `getDBName(...)` values for shape/location/route. Identify where feature metadata and vector tiles are currently stored for each entity. Next, choose a migration approach: keep backward compatibility by reading from old tables if present, or perform a one-time migration/clear to the new schema. Because map previews are read-heavy and data can be regenerated, prefer an idempotent migration that either migrates tables or clears old ephemeral data and documents the expected regeneration flow.

Implement the storage changes in these steps:

- Shape: confirm `ShapeDB` already uses `getDBName('shape')` and has `features` and `vectorTiles`. Ensure any other shape storage code uses the same names and does not reference alternate tables.
- Location: replace `LocationEntitiesDB` and `EphemeralLocationDB` with a single `LocationDB` that holds `features` and `vectorTiles`. Update the DB name to `getDBName('location')`, rename tables accordingly, and update any location batch or query services to use the new tables. Migration policy is “clear & regenerate” (no copying from old tables); document this and ensure cleanup paths exist.
- Route: rename `RouteDatabase` to `RouteDB`, change the DB name to `getDBName('route')`, and consolidate vector tiles into a `vectorTiles` table in `RouteDB`. Replace `lineStrings` with `features` and update read/write paths. If `TilesDB` remains necessary for other features, scope its usage away from route map previews. Update route query services to fetch tiles from the new `RouteDB.vectorTiles`.
- Entity lifecycle: update `storeRegistry` and `EntityLifecycleManager` to process `features` and `vectorTiles` stores (plus existing relations). Remove `groupEntities` naming from the registry and any plugin stores. Ensure duplicate/paste/import operations copy `features` and (if present) `vectorTiles`, and delete operations clean up both.

Update the worker query/mutation services to use the new DB classes and tables. Then update `/map` layer construction to reference the new DB names and tile sources. Finally, run targeted typecheck/tests or document why they were skipped. Ensure `TASKS.md` includes the migration and rollback steps.

## Concrete Steps

Work from the repository root `/Users/hiroya/WebstormProjects/hierarchidb`.

1) Inventory current storage and APIs:
   - Run: `rg -n "getDBName\('|vectorTiles|features|LocationEntitiesDB|RouteDatabase|TilesDB" app packages plugins`
   - Record the findings in `TASKS.md` under task 1966.

2) Update location storage to `LocationDB` with `features` and `vectorTiles`.
   - Edit `plugins/location-plugin/src/worker/locationEntitiesDB.ts` to rename `LocationEntitiesDB` to `LocationDB` and `groupEntities` to `features`.
   - Edit `packages/features/location-store/src/EphemeralLocationDB.ts` to replace with the unified `LocationDB` (or rename and move) and change `getDBName('location-ephemeral')` to `getDBName('location')`.
   - Update all imports and usage sites (pointRepository, query services, batch processing) to match the new class and table names.
   - Implement a migration policy of clearing old tables on upgrade, and document that tiles/feature data will be regenerated by existing batch flows.

3) Update route storage to `RouteDB` with `features` and `vectorTiles`.
   - Edit `packages/features/route-store/src/RouteDatabase.ts` to rename the class to `RouteDB` and change DB name to `getDBName('route')`.
   - Add `features` and `vectorTiles` tables (replace `lineStrings`), and update read/write paths in the route worker to use them.
   - Update `packages/runtime-worker/src/services/RouteQueryService.ts` to read vector tiles from `RouteDB.vectorTiles` instead of `TilesDB`.
   - If `TilesDB` remains used elsewhere, ensure route no longer depends on it for map previews.

4) Update lifecycle store registry to use `features` and `vectorTiles`.
   - Edit `packages/runtime-worker/src/entity/store.ts` and `packages/runtime-worker/src/entity/store-registry.ts` to rename group store semantics to features and add a vectorTiles store interface.
   - Edit `packages/runtime-worker/src/entity/EntityLifecycleManager.ts` to copy/delete features and vectorTiles based on registered stores.
   - Update plugin worker registrations (location/shape/route) to register feature/vectorTiles stores.

5) Update /map and worker APIs to use unified names.
   - Edit `app/src/router/routes/map.tsx` to use `getDBName('location')` and `getDBName('route')` for vector layers.
   - Update any type exports or usage that reference renamed classes/tables.

6) Validate and document.
   - Run: `pnpm --filter @hierarchidb/location-plugin typecheck` and `pnpm --filter @hierarchidb/route-plugin typecheck`.
   - If not run, document the reason in `TASKS.md` with a follow-up plan.

## Validation and Acceptance

Acceptance is achieved when:

- The `/map` route shows shape/location/route tiles with the unified DB naming and class/table names.
- The worker query APIs fetch vector tiles from `ShapeDB.vectorTiles`, `LocationDB.vectorTiles`, and `RouteDB.vectorTiles` via `getDBName('shape'|'location'|'route')`.
- Feature metadata for each entity is stored in `features` tables, and the old ad-hoc tables are no longer referenced.

To validate, run the typecheck commands above and load a project with existing shape/location/route nodes. The map preview should render tiles for all three categories without console errors.

## Idempotence and Recovery

Schema migrations must be idempotent. If the upgrade path performs data copy, the copy should check for existing records and avoid duplication. If the migration clears old data, document that tiles are regenerated by running the existing build flows for each plugin.

Rollback involves reverting the DB name/class/table changes and restoring previous query service logic to read from the legacy tables (`LocationEntitiesDB`/`EphemeralLocationDB`, `TilesDB`).

## Artifacts and Notes

- No artifacts yet.

## Interfaces and Dependencies

The APIs are provided via `WorkerAPI` (in `packages/common/api/src/WorkerAPI.ts`) and the query/mutation types are defined in `packages/plugin-service-api/src/types/*.ts` and re-exported by `packages/features/location-store/src/index.ts` and `packages/features/route-store/src/index.ts`. The map preview uses these via `ensureWorkerAPI()` from `@hierarchidb/ui-worker-client`.

Any new database class should be a Dexie class in the relevant feature package, with tables named `features` and `vectorTiles`, and a `getDBName('shape'|'location'|'route')` constructor default. This must be reflected in the worker services that read vector tiles.
