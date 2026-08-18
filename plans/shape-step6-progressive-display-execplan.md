# Shape Step6 progressive display and metadata staging

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is maintained according to `PLANS.md` in the repository root.

## Purpose / Big Picture

Step6 (Preview) should become usable while the build is still running, as soon as there is either metadata or vector tiles to show. The metadata table should also update progressively as each stage produces new statistics. After this change, a user can open Preview during a build and see rows appear early, then later see counts update as extract1/extract2/vector tile stages progress.

## Progress

- [x] (2026-01-10 14:10 JST) Create ExecPlan and map the relevant UI and session metadata flow files.
- [x] (2026-01-10 14:25 JST) Add a Preview-ready guard that checks for metadata or tile existence and wire it into navigation.
- [x] (2026-01-10 14:30 JST) Add metadata polling in the Preview hook so the table refreshes during ongoing builds.
- [x] (2026-01-10 14:35 JST) Confirm download-stage base metadata persistence precedes stats aggregation (no changes required).
- [x] (2026-01-10 14:40 JST) Update the retired local task log with done/blocked and any validation evidence.

## Surprises & Discoveries

- Observation: Pending.
  Evidence: N/A.

## Decision Log

- Decision: Keep build-step validation strict and add explicit Preview navigation guards instead of loosening “build completed” logic.
  Rationale: This allows preview access without conflating build completion, and keeps save/commit semantics unchanged.
  Date/Author: 2026-01-10 / Codex

## Outcomes & Retrospective

- Pending implementation.

## Context and Orientation

Step6 corresponds to the Preview step in `plugins/shape-plugin/src/ui/components/steps-provider.tsx`. Navigation enablement is controlled by `validate` and `capabilities` in each step config, evaluated via `packages/plugin-ui-host/src/headless/controller/step-guards.ts`.

Preview metadata rows are loaded by `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`, which currently calls `useVectorTilePreviewMetadata` from `packages/ui/map/src/preview/useVectorTilePreviewMetadata.ts`. That hook performs a single load and does not poll, so the table does not update while the build is running.

Source metadata is persisted into the vector tile store tables (`sourceMetadata` and `featureMetadata`) through `SessionArtifactStore` in `plugins/shape-plugin/src/services/batch/SessionArtifactStore.ts`. The download stage currently runs `runDownloadMetadataOrchestrator`, which uses `updateRawSourceMetadata` to persist base rows and raw-stage stats. Extract1/extract2/vector tile stages update additional statistics through `runStageMetadataOrchestrator` and vector-tile postprocess.

## Plan of Work

First, add a “Preview-ready” guard in `plugins/shape-plugin/src/ui/components/steps-provider.tsx`. Define a helper that checks whether metadata exists (via `getShapeDbApiClient().query.listSourceMetadata(nodeId)` returning any rows) or vector tiles exist (existing tile-summary checks). Use this helper in two places: (1) `capabilities.canProceedToNext` for the build step to allow the Next button, and (2) `capabilities.canNavigateTo` plus `validate` for the preview step so the stepper and validation logic allow navigation when metadata or tiles exist. Keep the build step’s `validate` and `canSave` semantics unchanged so “build completed” stays strict.

Second, add polling for preview metadata. Extend `useVectorTilePreviewMetadata` in `packages/ui/map/src/preview/useVectorTilePreviewMetadata.ts` to accept an optional polling interval. When a poll interval is provided, it should load immediately and repeat at that interval, cleaning up on unmount. Update `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` to compute a polling interval when a build is running or paused and pass it into the hook, similar to the tile availability polling logic already present.

Third, confirm that download-stage base metadata is persisted before any stats updates. If the current download orchestrator already writes base rows, keep it but explicitly ensure base update precedes stat aggregation. If needed, split base persistence and stat aggregation in `plugins/shape-plugin/src/services/batch/session/stages/download/metadata/updateRawSourceMetadata.ts` so base rows are persisted even when stats aggregation is deferred, and wire this into `SessionController` to preserve progressive updates across stages.

## Concrete Steps

Work from the repo root.

1) Update Preview navigation guards.
   - Edit `plugins/shape-plugin/src/ui/components/steps-provider.tsx`.
   - Add a helper `isShapePreviewReady` (async) that checks for existing source metadata rows or tiles.
   - Wire `canProceedToNext` on the build step and `canNavigateTo` + `validate` on the preview step.
   - Ensure all checks use a required `nodeId` and do not introduce fallback logic.

2) Add metadata polling.
   - Edit `packages/ui/map/src/preview/useVectorTilePreviewMetadata.ts` to accept a `pollIntervalMs?: number` parameter.
   - Load immediately and poll when `pollIntervalMs` is a positive number.
   - Update `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` to pass a polling interval when build status is `processing` or `paused`.

3) Verify download metadata base persistence order.
   - Inspect `plugins/shape-plugin/src/services/batch/session/stages/download/metadata/updateRawSourceMetadata.ts`.
   - If base persistence is not guaranteed before stats aggregation, adjust to ensure base rows are written first. Keep stats aggregation behavior intact unless explicitly needed to defer.

## Validation and Acceptance

- Open the shape dialog, start a build, and confirm that the Preview step becomes reachable once either metadata rows or tiles exist.
- While the build runs, keep the Preview open and verify that metadata rows and counts update without manual refresh.
- Run targeted checks if feasible:
  - `pnpm --filter @hierarchidb/shape-plugin typecheck`
  - `pnpm --filter @hierarchidb/ui-map typecheck`

## Idempotence and Recovery

Changes are limited to UI navigation guards and metadata polling, plus any necessary ordering fixes in download metadata persistence. Re-applying patches should be safe. To rollback, revert the Step6 guard changes and remove metadata polling. If download metadata ordering is altered, revert the download metadata helper to restore the previous behavior.

## Artifacts and Notes

- No artifacts yet. Add short excerpts of the updated guard logic and polling hook once implemented.

## Interfaces and Dependencies

- `plugins/shape-plugin/src/ui/components/steps-provider.tsx` will introduce a new async readiness predicate used by Step capabilities.
- `packages/ui/map/src/preview/useVectorTilePreviewMetadata.ts` will accept an optional polling interval without breaking existing callers.
- `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` will control when metadata polling is active.
- `plugins/shape-plugin/src/services/batch/session/stages/download/metadata/updateRawSourceMetadata.ts` may be adjusted to guarantee base-row persistence before stats updates.

## Plan revisions

- (2026-01-10) Initial plan created.
- (2026-01-10) Marked progress steps complete after wiring Step6 guards and metadata polling; no download-stage metadata changes were required.
