# Unify vector tile and intermediate storage per node type (remove VtShapeDb/VtDb)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md lives at `PLANS.md` in the repository root. This ExecPlan must be maintained in accordance with that document.

## Purpose / Big Picture

Users need a single, predictable storage model for build artifacts across node types. After this change, intermediate artifacts are stored only in per-node ephemeral DBs, and build results are stored in each node type’s persistent DB (ShapeDB/RouteDB/LocationDB). The legacy VtShapeDb and VtDb are removed entirely. This enables consistent cleanup behavior (Step4 manual/auto delete) and consistent node deletion handling that removes all associated artifacts by `nodeId`.

## Progress

- [x] 2026-01-19 16:35 JST: Created initial ExecPlan skeleton and context.
- [x] 2026-01-20 00:25 JST: Completed inventory of VtShapeDb/VtDb usages; only legacy packages and app dependency remained.
- [ ] 2026-01-20 00:30 JST: Removed legacy packages (`vt-store`, `vt-shape-store`) and app/tsconfig aliases; validation pending.
- [x] Milestone 1: Inventory all VtShapeDb/VtDb usage and define replacement targets.
- [ ] Milestone 2: Move intermediate artifacts to EphemeralShapeDB/EphemeralRouteDB/EphemeralLocationDB.
- [ ] Milestone 3: Move vector tile storage to ShapeDB/RouteDB/LocationDB.
- [ ] Milestone 4: Update deletion flows (Step4 manual/auto delete + CoreDB delete hooks).
- [ ] Milestone 5: Remove legacy packages and verify end-to-end behavior.
- [ ] 2026-01-19 10:55 JST: pnpm test failed due to geoboundaries network ENOTFOUND in shape-plugin full-flow test; validation still blocked.
- [ ] 2026-01-19 11:00 JST: pnpm test retry still failed with ENOTFOUND in shape-plugin full-flow test.
- [ ] 2026-01-19 11:05 JST: pnpm test retry with NODE_OPTIONS=--dns-result-order=ipv4first still failed with ENOTFOUND in shape-plugin full-flow test.
- [ ] 2026-01-19 11:12 JST: Attempted dns.setServers override for Node; dns.lookup still returned ENOTFOUND.
- [ ] 2026-01-19 11:18 JST: pnpm test retry still failed with ENOTFOUND in shape-plugin full-flow test.

## Surprises & Discoveries

- Test validation depends on external geoboundaries connectivity; shape-plugin full-flow test fails when network/DNS is unavailable.
  Evidence: `shape-vt-pipeline.full-flow.headless.test.ts` failed with ENOTFOUND for `www.geoboundaries.org` during pnpm test.
- Node's `dns.setServers` does not affect `dns.lookup`, so overriding DNS servers in-process did not change the failure.
  Evidence: `node -e "dns.setServers(...); dns.lookup(...)"` still returned ENOTFOUND.

## Decision Log

- Decision: Remove VtShapeDb and VtDb entirely and migrate all references to per-node DBs.
  Rationale: User requirement and simpler mental model; eliminates ambiguous naming and store boundaries.
  Date/Author: 2026-01-19, Codex
- Decision: Intermediate artifacts live in Ephemeral*DB per node type; final artifacts live in per-node persistent DBs.
  Rationale: Aligns with Step4 deletion semantics and node lifecycle cleanup.
  Date/Author: 2026-01-19, Codex

## Outcomes & Retrospective

- Not started.

## Context and Orientation

Current storage layout splits intermediate artifacts and tiles across multiple stores:

- `packages/vt-shape-store`: `VtShapeDb` stores fetch and transform caches.
- `packages/vt-store`: `VtDb` stores vector tiles used by UI queries.
- `packages/features/shape-store`: `ShapeDB` is the persistent domain DB for shape features.
- `packages/features/route-store`: `RouteDB` is the persistent domain DB for route features.
- `packages/features/location-store`: `LocationDB` is the persistent domain DB for location points (defined in `EphemeralLocationDB.ts`).
- `packages/features/shape-store/src/EphemeralShapeDB.ts`: `EphemeralShapeDB` stores current transform caches and tile relations.

The goal is to remove `VtShapeDb` and `VtDb` entirely and use per-node DBs:

- Intermediate artifacts: `EphemeralShapeDB`, `EphemeralRouteDB`, `EphemeralLocationDB`.
- Build results: `ShapeDB`, `RouteDB`, `LocationDB`.

“Intermediate artifacts” means data produced during fetch/transform that can be discarded via Step4 manual delete or auto-delete settings. “Build results” means artifacts used by MapLibreGL rendering or feature list metadata, which should persist as long as the node exists (unless the user deletes them).

## Plan of Work

First, inventory all usage of `VtShapeDb` and `VtDb`. Document each call site, what it stores, and the intended replacement store. This inventory is the foundation for safe migration and should be added to this ExecPlan as a short table or list of mappings.

Next, migrate intermediate artifacts to per-node ephemeral DBs. For shape, move any remaining fetch/transform caches and tile relations into `EphemeralShapeDB`. For route and location, add or confirm `EphemeralRouteDB` and `EphemeralLocationDB` equivalents if they do not exist; define schemas for intermediate fetch/transform outputs and any indices needed for downstream stages. Update vt-orchestrator and stage handlers to read/write from the new ephemeral tables.

Then, migrate vector tile storage. Replace all `VtDb` reads/writes with per-node DBs: `ShapeDB` for shape tiles, `RouteDB` for route tiles, and `LocationDB` for location tiles (if location generates tiles; if not, explicitly remove tile paths and keep point-based rendering). Update query/mutation APIs to route tile operations to the correct DB. Ensure UI tile loaders use the new storage paths.

After storage migration, update deletion flows. Step4 manual delete buttons and auto-delete settings must clear intermediate artifacts from Ephemeral*DB and optionally clear build results from the per-node DB. CoreDB node deletion must cascade: when a node is deleted, all artifacts with that `nodeId` must be removed from the relevant Ephemeral*DB and domain DB.

Finally, remove `packages/vt-shape-store` and `packages/vt-store` from dependencies and code. Update documentation and tests, and ensure `pnpm lint && pnpm format && pnpm typecheck && pnpm test` pass.

## Milestones

Milestone 1 produces a complete migration map. Use ripgrep to list all references to `VtShapeDb`, `VtDb`, and `vt-shape-store`/`vt-store`. For each reference, record the replacement store and API. Acceptance: The mapping is recorded in this ExecPlan and includes every usage site.

Milestone 2 moves intermediate artifacts to Ephemeral*DBs. Update schemas in `packages/features/shape-store/src/EphemeralShapeDB.ts` (and create or confirm `EphemeralRouteDB`/`EphemeralLocationDB` in their respective packages). Update fetch/transform handlers to write into these stores. Acceptance: Intermediate artifacts can be created and cleared via Step4 deletion for each node type.

Milestone 3 moves tiles to per-node DBs. Update tile write paths (currently using `VtDb`) to use `ShapeDB` / `RouteDB` / `LocationDB`. Update query APIs and UI loaders accordingly. Acceptance: Tiles render from the per-node DBs and `VtDb` is no longer referenced.

Milestone 4 updates deletion flows. Connect Step4 manual delete and auto-delete settings to Ephemeral*DB cleanup. Ensure CoreDB node deletion triggers cleanup in `EntityLifecycleManager` for shape/route/location. Acceptance: Deleting a node removes all associated artifacts by `nodeId`.

Milestone 5 removes legacy packages and validates. Remove `packages/vt-shape-store` and `packages/vt-store` from dependencies, exports, and build scripts. Update docs to reflect the new storage layout. Acceptance: workspace builds cleanly and no code references the deleted packages.

## Concrete Steps

All commands run from `/Users/hiroya/WebstormProjects/hierarchidb`.

Inventory legacy stores:

  rg -n "VtShapeDb|vt-shape-store|VtDb|vt-store" packages plugins

Find Ephemeral*DB definitions and update schemas:

  rg -n "EphemeralShapeDB|EphemeralRouteDB|EphemeralLocationDB" packages

Run required checks after schema and storage changes:

  pnpm lint
  pnpm format
  pnpm typecheck
  pnpm test

## Validation and Acceptance

Validation must confirm both functionality and cleanup behavior:

- Shape: build produces tiles and feature metadata in `ShapeDB`, intermediate artifacts in `EphemeralShapeDB`, and Step4 delete clears intermediate artifacts. CoreDB delete removes all artifacts by `nodeId`.
- Route: build produces tiles and line strings in `RouteDB`, intermediate artifacts in `EphemeralRouteDB`, and Step4 delete clears intermediate artifacts. CoreDB delete removes all artifacts by `nodeId`.
- Location: build produces points and metadata in `LocationDB`, intermediate artifacts in `EphemeralLocationDB` if used. Step4 delete clears intermediates. CoreDB delete removes all artifacts by `nodeId`.

Run `pnpm lint && pnpm format && pnpm typecheck && pnpm test` and expect exit 0.

## Idempotence and Recovery

The migration should be repeatable. Schemas must be versioned so that re-running builds does not corrupt data. If a migration step fails, revert the code changes and run cleanup scripts to remove partially migrated tables. Rollback is achieved by reverting commits and restoring `vt-shape-store`/`vt-store` usage.

## Artifacts and Notes

Inventory (2026-01-20):
- `packages/vt-shape-store/**`: legacy Dexie store for fetch/transform buffers. Replacement: `EphemeralShapeDB` tables in `packages/features/shape-store`.
- `packages/vt-store/**`: legacy tile store. Replacement: per-node DBs (`ShapeDB` / `RouteDB` / `LocationDB`) backed by `@hierarchidb/vectortile-store`.
- `app/package.json`: dependency on `@hierarchidb/vt-store` (removed during cleanup).
- `tsconfig.base.json`: path aliases for `@hierarchidb/vt-store` and `@hierarchidb/vt-shape-store` (removed during cleanup).

Record schema version bumps and cleanup validation here once implemented.

## Interfaces and Dependencies

Primary interfaces to update:

- `packages/features/shape-store/src/ShapeDB.ts` and `EphemeralShapeDB.ts` for shape artifacts.
- `packages/features/route-store/src/RouteDatabase.ts` and any EphemeralRouteDB counterpart.
- `packages/features/location-store/src/EphemeralLocationDB.ts` for `LocationDB` and ephemeral storage.
- `packages/vt-orchestrator/src/vt/vtStage.ts` and any pipeline stages that write tiles.
- `plugins/*/src/services/vt/*` for fetch/transform/vt stage wiring.
- `packages/runtime-worker/src/entity/EntityLifecycleManager.ts` for node deletion cleanup hooks.

Dependencies to remove:

- `packages/vt-shape-store` (all exports and callers).
- `packages/vt-store` (all exports and callers).

## Change Log

2026-01-19: Initial ExecPlan created to guide the removal of VtShapeDb/VtDb and per-node storage unification.
