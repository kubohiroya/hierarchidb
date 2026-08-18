# Unify stage cache naming and restore four-stage pipeline (shape build)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is maintained according to `PLANS.md` at repository root.

## Purpose / Big Picture

After this change, the shape build pipeline uses four explicit stages (fetch, transform-by-band, transform-by-zoom, vt) and all intermediate data is expressed as caches. The naming in code, logs, and UI will align with the stage names, and the intermediate caches will live only in the ephemeral store. The only persistent outputs are the final vector tiles and metadata. A user can see this working by visiting Step4/Step5 and confirming that cache labels match the stage names and that deleting a cache removes the correct intermediate data.

## Progress

- [x] (2026-01-15 13:40Z) Write and commit this ExecPlan with the agreed naming, staging, and storage layout.
- [x] Implement new cache naming and stage vocabulary in shared types and UI labels.
- [x] Rewire transform-by-band to write/read ephemeral caches instead of persistent outputs.
- [x] Rewire transform-by-zoom to use cache naming consistently and remove redundant stores.
- [x] Update deletion paths and counts to align with the new cache layout.
- [x] Rename ephemeral cache tables (EphemeralGisDB/EphemeralShapeDB) to cache naming and update usages.
- [x] Run `pnpm typecheck` and record evidence in the retired local task log.

## Surprises & Discoveries

- (none yet)

## Decision Log

- Decision: Use four stages (fetch, transform-by-band, transform-by-zoom, vt) and rename all intermediate storage to Cache, not Buffer.
  Rationale: The stage names match user-facing intent and intermediate data is unstable; Cache makes that clear.
  Date/Author: 2026-01-15 / Codex
- Decision: Intermediate transform outputs should live only in ephemeral storage; persistent storage should hold only vt tiles and metadata.
  Rationale: transform outputs depend on user settings and should be deletable without long-term storage growth.
  Date/Author: 2026-01-15 / Codex

## Outcomes & Retrospective

- (pending)

## Context and Orientation

The shape build pipeline currently writes transform outputs into `@hierarchidb/vt-shape-store` and reads them in `packages/vt-orchestrator/src/vt/vtStage.ts`. A separate ephemeral database `packages//src/EphemeralShapeDB.ts` stores stage buffers with legacy table names (`extract2SourceBuffers`, `vectorTileSourceBuffers`) and these names no longer match current stage semantics. UI cache labels live in `plugins/shape-plugin/src/ui/locales/*.json` and the delete actions are wired in `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`.

Terms used in this plan:

- Stage: a named pipeline step that produces data consumed by the next step. The stages in scope are fetch, transform-by-band, transform-by-zoom, and vt.
- Cache: intermediate, ephemeral storage for data that can be regenerated from earlier stages. Caches are stored in the ephemeral shape database.
- Output: final, persistent data. In this plan, outputs are vector tiles and metadata.

## Plan of Work

Start by codifying the naming and stage vocabulary in shared types and UI strings. Update the shape-ephemeral schema to rename legacy tables to `transformByBandCache` and `transformByZoomCache`, and implement a Dexie migration that copies data from the legacy tables into the new tables on version bump. Next, update transform-by-band handling in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` so it writes to the ephemeral cache rather than the persistent `vt-shape-store`, and update `packages/vt-orchestrator/src/vt/vtStage.ts` so it reads the cache from the ephemeral store. Remove or stop writing to `transformBandBuffers` and `tileIndexBand` in `@hierarchidb/vt-shape-store`, and update any queries or summaries (e.g., `plugins/shape-plugin/src/services/vt/shapeStageMetadata.ts`) to use the ephemeral caches. Update deletion logic and counts in Step4 to remove the new caches and to compute counts from the new cache tables, making sure the buttons disable when counts reach zero. Finally, update docs/log strings and run typecheck.

## Concrete Steps

Run all commands from repository root `/Users/hiroya/WebstormProjects/hierarchidb`.

1) Create the new cache schema and migration in `packages//src/EphemeralShapeDB.ts`.
   - Bump the Dexie version and add new table names (transformByBandCache, transformByZoomCache) with indices matching the old tables.
   - In the upgrade handler, copy rows from `extract2SourceBuffers` to `transformByBandCache` and from `vectorTileSourceBuffers` to `transformByZoomCache`, then optionally clear the old tables.

2) Update the ephemeral query/mutation APIs.
   - Rename the `transformStageBuffers` and `vtStageBuffers` accessors to new cache names.
   - Update `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts` and `packages/runtime-worker/src/services/ShapeQueryService.ts` to use the new cache names.

3) Rewire transform-by-band output to ephemeral cache.
   - Replace `shapeStore.transformBandBuffers.put` in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` with writes to the ephemeral cache.
   - Update `packages/vt-orchestrator/src/vt/vtStage.ts` to read transform-by-band cache data from the ephemeral store rather than `vt-shape-store`.
   - Remove or no-op writes to `tileIndexBand` if no longer needed by vt stage; document rationale in the Decision Log.

4) Update summaries and UI dependencies.
   - Update `plugins/shape-plugin/src/services/vt/shapeStageMetadata.ts` to pull transform-by-band cache data from the ephemeral store.
   - Update Step4 delete counts to reference the new cache tables and ensure both transform-by-band and transform-by-zoom cache deletes use their own counts.
   - Update labels in `plugins/shape-plugin/src/ui/locales/en.json` and `plugins/shape-plugin/src/ui/locales/ja.json` to match stage names.

5) Validation.
   - Run `pnpm typecheck` and capture a short snippet of the success output and any warnings.
   - Manually verify Step4 cache delete buttons disable after deletion by checking counts in the UI (record in the linked GitHub Issue).

## Validation and Acceptance

Run `pnpm typecheck` from the repo root and expect exit code 0. In the UI, visit Shape Step4 and verify that the cache delete buttons are labeled “zoom-band cache” and “zoom-zoom cache” (Japanese equivalents in ja locale) and that they become disabled after deletion. Confirm that the build still produces vt tiles by running a normal build flow and observing completion.

## Idempotence and Recovery

Dexie upgrades are one-way. If a migration fails, delete the local IndexedDB for shape-ephemeral and rerun (this is safe for development). To rollback code changes, revert the modified files and restore the previous schema version in `EphemeralShapeDB.ts`. The ExecPlan includes updating the Decision Log if rollback becomes necessary.

## Artifacts and Notes

Expected `pnpm typecheck` snippet:
  > pnpm typecheck
  > ...
  > Tasks:    XXX successful, XXX total
  > (exit 0)

## Interfaces and Dependencies

- `packages//src/EphemeralShapeDB.ts` defines the ephemeral cache schema and must include the new table names.
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` writes transform-by-band cache entries.
- `packages/vt-orchestrator/src/vt/vtStage.ts` reads transform-by-band cache entries.
- `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts` uses cache counts to enable/disable delete buttons.

---

Plan updated: 2026-01-15 by Codex. Reason: initial plan creation for cache renaming and stage split.
