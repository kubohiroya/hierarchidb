# Shape Step5 progress integration and session reuse

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with PLANS.md at `PLANS.md`.

## Purpose / Big Picture

Users should be able to run the Shape build once per node and resume it later without juggling multiple sessions. Step5 should show real progress sourced from the worker and let users pause/resume/cancel from the same view, while Step2-4 setting changes automatically clear only the persisted data they invalidate. The same session is identified by nodeId, and deletion is explicit from Step4.

## Progress

- [x] (2025-12-20 09:10Z) Collected current session, progress, and UI code paths for Shape batch processing.
- [x] (2025-12-20 18:30Z) Implemented sessionId=nodeId flow in ShapeDB/BatchSessionManager and aligned session creation to reuse existing records.
- [x] (2025-12-20 18:35Z) Added EphemeralShapeDB stage helpers, updated Step4 delete actions, and introduced auto-invalidation for Step2/3/4 setting changes.
- [x] (2025-12-20 18:40Z) Connected Step5 to useShapeProgress, wired control handlers to worker bridge, and added i18n for labels/status/stages.
- [ ] (2025-12-20 18:50Z) Validation: not run yet (documented below).

## Surprises & Discoveries

- Observation: The UI currently has `useShapeAPI` stubbed to reject, and WorkerAPI in `app/src/worker-runtime/worker.ts` does not expose batch methods. This means Step5 controls must be wired against available bridges and may need worker-side enablement later.
  Evidence: `plugins/shape-plugin/src/ui/hooks/useShapeAPI.ts` returns rejected Promise; `app/src/worker-runtime/worker.ts` does not include `startBatchSession` in its exposed API.

## Decision Log

- Decision: Session identity will be `nodeId` and persisted session data will be deleted only via explicit UI actions in Step4 or automatic invalidation from settings changes.
  Rationale: Aligns with the “single session per node” policy and simplifies recovery while keeping user control for deletion.
  Date/Author: 2025-12-20 / Codex
- Decision: Processing config changes invalidate stage data as follows: download changes clear download+extract+tiles, extraction changes clear extract+tiles, tile changes clear tiles.
  Rationale: Matches pipeline dependencies while avoiding unnecessary deletes for cleanup-only changes.
  Date/Author: 2025-12-20 / Codex

## Outcomes & Retrospective

Implemented sessionId=nodeId reuse, EphemeralShapeDB stage cleanup, auto-invalidation in Step2/3/4, and Step5 progress+i18n wiring. Validation was not run due to existing baseline typecheck failures; verify with `pnpm --filter @hierarchidb/shape-plugin typecheck` when ready.

## Context and Orientation

Shape batch processing uses the Shape plugin’s worker-side batch manager and Dexie databases. The persistent store lives in `plugins/shape-plugin/src/services/database/ShapeDB.ts` (batchSessions/batchTasks/etc). Temporary per-session data is stored in `plugins/shape-plugin/src/services/database/EphemeralShapeDB.ts` (rawBuffers/extractedBuffers/vectorTiles/sessions). The UI step that hosts Step4 settings is `plugins/shape-plugin/src/ui/components/steps/ShapeProcessingSettingsStep.tsx`, and Step5 is `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressStep.tsx`.

The current sessionId is generated as a UUID in `ShapeDB.createBatchSession`, and the worker-side batch manager starts a session in `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts` via `createSession`. Step4 deletion is implemented in `DownloadConfigSection.tsx` but filters by `nodeId` rather than `sessionId` and does not consider auto-delete rules. Step5 uses local component state rather than worker progress.

## Plan of Work

First, modify the session lifecycle so that `sessionId` always equals `nodeId`. Update `ShapeDB.createBatchSession` to accept an explicit sessionId and to upsert or reuse the existing record if it already exists. Update `BatchSessionManager.createSession` to detect an existing session record and reuse it instead of throwing when a session exists. Ensure `UnifiedShapeBatchManager.startBatchSession` continues to return the nodeId-based sessionId and keeps `sessionNodes` in sync.

Second, implement EphemeralShapeDB helpers for stage-aware session cleanup (for example, `clearStage(sessionId, stage)` and `hasStageData(sessionId, stage)`), so UI components can delete exactly the invalidated data. Update `DownloadConfigSection.tsx` to call stage-specific clearers keyed by `sessionId` (which equals `nodeId`). Keep the delete buttons disabled when the stage has no data or while processing. Also ensure deleting any stage clears the session metadata entry so progress does not show stale stage information.

Third, introduce auto-delete logic on UI setting changes. For Step2 (`ShapeDataSourceStep.tsx`), when dataSource changes, delete raw, extracted, and tile data if any exists for the session. For Step3 (`ShapeCountrySelectionStep.tsx`), when the selection matrix changes, delete the same downstream data. For Step4, compare previous and next `ProcessingConfig` and clear only the affected stages: download config changes clear raw + extracted + tiles; extraction config changes clear extracted + tiles; tile config changes clear tiles. Cleanup config changes should not delete data because they do not change outputs. Implement this in a shared helper to avoid inconsistent rules.

Fourth, wire Step5 to worker progress. Use `useShapeProgress` to subscribe to progress for the current sessionId (nodeId). Map the progress and status to `BuildStepPanel` props. Replace local `useState` placeholders with real values. Integrate control handlers to call the worker bridge (start/pause/resume/cancel) if the worker bridge provides batch methods for the shape node type. This wiring may initially be optimistic; if worker API does not expose those methods, the UI should fail gracefully with warnings rather than crashing.

Finally, apply i18n for Step5 display strings. Add shape-plugin locale keys for build stage titles/descriptions, control labels, and status messages in `plugins/shape-plugin/src/ui/locales/en.json` and `plugins/shape-plugin/src/ui/locales/ja.json`, and use `useTranslation` inside `ShapeBuildProgressStep.tsx` (and possibly `BuildStepPanel` if additional labels are needed). Ensure English defaults are preserved as fallbacks.

## Concrete Steps

1) Update `ShapeDB.createBatchSession` to accept an explicit sessionId and to insert or update by that key. Then update `BatchSessionManager.createSession` to reuse the existing record when the same sessionId (nodeId) exists, including when status is `completed`.
2) Add EphemeralShapeDB helpers for `clearStage`, `hasStageData`, and `clearSession` that all use `sessionId` filtering. Update Step4 delete handlers in `DownloadConfigSection.tsx` to use these helpers.
3) Add a shared UI helper (for example, `plugins/shape-plugin/src/ui/utils/sessionInvalidation.ts`) that, given the previous and next data/config, returns which Ephemeral stages to clear. Call this helper in Step2, Step3, and Step4 change handlers before applying the state update.
4) Update `ShapeBuildProgressStep.tsx` to derive `sessionId` from `data.nodeId` (and/or `data.batchSessionId` if present), use `useShapeProgress`, and map progress/status to `BuildStepPanel`. Add action handlers that call worker batch control APIs.
5) Add i18n keys for Step5 stage titles, descriptions, control labels, and status strings in the shape-plugin locales, and update the component to use them.

## Validation and Acceptance

Run `pnpm --filter @hierarchidb/shape-plugin typecheck` from the repo root if possible. In the UI, open a shape dialog, start a build, verify that Step5 shows progress and status transitions, and confirm that changing settings in Step2–4 clears existing cached data (the delete buttons should disable after clearing). Deleting stages from Step4 should remove only the relevant data for the current session.

## Idempotence and Recovery

All changes should be safe to re-run. If session reuse causes unexpected behavior, revert the changes in `ShapeDB.createBatchSession`, `BatchSessionManager.createSession`, and the UI invalidation helper. Ephemeral deletes operate on sessionId keys and are safe to repeat. If worker batch controls are unavailable, leave UI handlers guarded and log warnings.

## Artifacts and Notes

Expected deletion flow example (sessionId == nodeId):

  - User changes Tile config → UI checks `hasStageData(sessionId, 'vectorTiles')` → clears tiles for that session → progress resets to pre-tile stage.

## Interfaces and Dependencies

- `plugins/shape-plugin/src/services/database/ShapeDB.ts`: add explicit-session create/update flow.
- `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`: reuse session when sessionId exists; keep sharedSessions keyed by sessionId.
- `plugins/shape-plugin/src/services/database/EphemeralShapeDB.ts`: stage-level clear/exists helpers keyed by sessionId.
- `plugins/shape-plugin/src/ui/components/steps/DownloadConfigSection.tsx`: delete handlers use sessionId and new DB helpers.
- `plugins/shape-plugin/src/ui/components/steps/ShapeDataSourceStep.tsx`: data source change triggers invalidation cleanup.
- `plugins/shape-plugin/src/ui/components/steps/ShapeCountrySelectionStep.tsx`: selection change triggers invalidation cleanup.
- `plugins/shape-plugin/src/ui/components/steps/ShapeProcessingSettingsStep.tsx` and subcomponents: processing config change triggers invalidation cleanup.
- `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressStep.tsx`: uses `useShapeProgress` and i18n strings for Step5.

Plan change note: Updated Progress/Decision Log/Outcomes after implementing session reuse, invalidation, and Step5 wiring; validation remains pending.
