# Rename bandIndex to bandIndex Across Shape Pipelines

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md lives at `PLANS.md` in the repository root and this plan must be maintained in accordance with it.

## Purpose / Big Picture

Users and developers currently see the field name `bandIndex` even though it is not globally unique; it is only an index within a node’s zoom-band configuration. After this change, the codebase, APIs, and storage will consistently use the name `bandIndex`, reducing ambiguity and making it clear that the value is local to a node. Success is visible by running the build pipeline without schema errors and by observing logs/UI/API payloads that show `bandIndex` instead of `bandIndex`.

## Progress

- [x] (2026-02-04 10:52 JST) Replace bandIndex with bandIndex in TypeScript types, function signatures, logs, UI, and tests.
- [x] (2026-02-04 11:05 JST) Update Dexie schema for transformCache/tileIdToBufferRelations to bandIndex and handle upgrade.
- [x] (2026-02-04 11:20 JST) Update documentation references and validate via typecheck (completed: docs update; remaining: none).

## Surprises & Discoveries

- Observation: tsdown emits a "define" warning during build, but build completes successfully.
  Evidence: tsdown warning during @hierarchidb/shape-api, @hierarchidb/shape-store, and @hierarchidb/vt-orchestrator builds on 2026-02-04.

## Decision Log

- Decision: Clear transformCache and tileIdToBufferRelations on schema upgrade to avoid ambiguity between legacy band fields and bandIndex and to avoid partial migrations of ephemeral data.
  Rationale: The data is ephemeral and rebuildable, and this avoids keeping legacy field names in runtime data structures.
  Date/Author: 2026-02-04 / Codex

## Outcomes & Retrospective

Band field naming is now consistently `bandIndex` across code, schema, and documentation. Dexie schema version 18 introduces the transformCache band index and clears ephemeral band-indexed tables on upgrade. Typechecks for shape-store, vt-orchestrator, and shape-plugin completed successfully; builds refreshed dist outputs.

## Context and Orientation

Shape build pipelines store per-band artifacts in Dexie tables keyed by `bandIndex`. The tables live in `packages//src/EphemeralShapeDB.ts` and are accessed from services in `plugins/shape-plugin/src/services/vt/` and `packages/vt-orchestrator/src/`. The UI and API types referencing per-band data live under `packages//src/` and `plugins/shape-plugin/src/ui/`.

Key areas:
- `packages//src/EphemeralShapeDB.ts` defines the Dexie schema and indexes for transform caches and tile-to-buffer relations.
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` and `packages/vt-orchestrator/src/vt/vtStage.ts` read/write band-related metadata.
- `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts` constructs per-band tasks and queries by band.
- UI labels and task titles live in `plugins/shape-plugin/src/common/utils/taskTitles.ts` and locale JSON files.

## Plan of Work

First, replace all TypeScript-level uses of `bandIndex` with `bandIndex` across packages, plugins, and app code, including log payloads and UI helpers. Update string keys and task IDs to use the new name where they are semantically labels, keeping the same numeric value.

Second, update the Dexie schema in `packages//src/EphemeralShapeDB.ts` by bumping the version and changing indexes from `[nodeId+bandIndex]` to `[nodeId+bandIndex]`. Add an upgrade step that clears `transformCache` and `tileIdToBufferRelations` so there is no mixed field state.

Third, update documentation and plan references to use `bandIndex`. Finish by running typechecks for impacted packages and updating the linked GitHub Issue logs.

## Concrete Steps

Run these steps from the repository root (`/Users/hiroya/WebstormProjects/hierarchidb`).

1) Ensure `bandIndex` is the sole band field name in code and JSON where it represents the band index. Verify no unintended leftovers.

   Example command and check:
     rg -n "\\bbandIndex\\b" app packages plugins

2) Update `packages//src/EphemeralShapeDB.ts`:
   - Add a new Dexie version (next integer) with `bandIndex` indexes.
   - In the upgrade callback, clear `transformCache` and `tileIdToBufferRelations`.

3) Update docs and plan files referencing bandIndex (e.g., `docs/vt-pipeline-design.md`).

4) Run typecheck:
     pnpm --filter @hierarchidb/shape-store typecheck
     pnpm --filter @hierarchidb/vt-orchestrator typecheck
     pnpm --filter @hierarchidb/shape-plugin typecheck

5) Record the commands and outcomes in the linked GitHub Issue and update this ExecPlan Progress.

## Validation and Acceptance

- Launch the app and run a shape build to ensure the Dexie SchemaError is gone.
- Logs and UI should show `bandIndex` consistently for band-related metadata.
- Typechecks pass for the affected packages.

## Idempotence and Recovery

These changes are safe to re-run. If the schema upgrade clears caches, the data can be rebuilt by re-running the pipeline. To rollback, revert the code changes and downgrade the schema version to the previous value.

## Artifacts and Notes

- Expected typecheck command output should end with exit code 0. Capture this in the linked GitHub Issue.

## Interfaces and Dependencies

- Dexie schema changes are implemented in `packages//src/EphemeralShapeDB.ts`.
- API and UI types are in `packages//src/` and `plugins/shape-plugin/src/ui/`.
- Task construction and band usage live in `plugins/shape-plugin/src/services/vt/` and `packages/vt-orchestrator/src/`.

Plan updated on 2026-02-04: initial plan created for bandIndex rename and then completed with schema/typecheck verification.
