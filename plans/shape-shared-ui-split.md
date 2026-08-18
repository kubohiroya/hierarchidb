# Split shape-plugin UI/hooks for shared GIS reuse

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `PLANS.md` at repository root. Maintain this document in accordance with that file.

## Purpose / Big Picture

The shape plugin contains several large UI components and hooks that bundle multiple responsibilities (data fetching, selection, map interaction, and UI rendering). This change breaks those large units into smaller, reusable parts that are intentionally shaped for future reuse in the location and route plugins. After the change, each major concern lives in a focused component or hook, making it easier to share logic without dragging shape-specific details along. The change is validated by `pnpm --filter @hierarchidb/shape-plugin typecheck` and by confirming that the Step2–Step5 UI continues to render with the same behavior.

## Progress

- [x] (2025-12-21 22:30) Create this ExecPlan and record the target files to split.
- [x] (2025-12-21 22:40) Identify the largest/most complex shape UI/hooks and define the new shared boundaries.
- [x] (2025-12-21 22:45) Split preview logic into focused hooks (metadata load, search/selection, table data, map layers).
- [x] (2025-12-21 22:46) Split build-progress logic into focused hooks (status mapping, stage definitions, session actions).
- [x] (2025-12-21 22:47) Split large processing UI sections (Download/Extraction) into subcomponents.
- [x] (2025-12-21 22:49) Update imports/exports and confirm typecheck passes; record logs in the retired local task log.

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Keep the new reusable units inside `plugins/shape-plugin/src/ui` but name and structure them so they can be moved into a shared `@hierarchidb/ui-*` package later without breaking boundaries.
  Rationale: The request is to split for reuse; relocating to a new package is larger scope and can be done later once the boundaries are proven.
  Date/Author: 2025-12-21 Codex

## Outcomes & Retrospective

Preview/build/progress logic and large processing panels were decomposed into focused hooks/components. Shape-plugin typecheck passes and the boundaries are ready for future extraction into shared GIS UI packages.

## Context and Orientation

The shape plugin’s Step UI lives under `plugins/shape-plugin/src/ui/components/steps` and uses hooks under `plugins/shape-plugin/src/ui/hooks`. Several files are large and mix multiple responsibilities:

* `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` handles preview metadata loading, search/filtering, selection context, table rows/columns, and MapLibre layer management.
* `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts` handles progress status, stage definitions, task grouping, and start/pause/cancel actions.
* `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts` mixes subscription wiring, polling, and progress/status mapping.
* `plugins/shape-plugin/src/ui/components/steps/ExtractionConfigSection.tsx` and `DownloadConfigSection.tsx` render multiple distinct UI panels in a single file.

The goal is to split those responsibilities into smaller hooks/components with clear, reusable interfaces.

## Plan of Work

First, split the preview hook into multiple focused hooks. Create a small set of new hooks under `plugins/shape-plugin/src/ui/hooks/preview/` (or a similar shared subfolder) to isolate:
* metadata loading from Dexie,
* search/match computation,
* selection-context derivation and map identify handling,
* table rows/columns and sorting,
* map layer creation and filter updates.

Update `useShapePreviewStep.ts` to compose those hooks and keep only high-level wiring. Each new hook should accept plain inputs and return plain outputs to make future extraction straightforward.

Next, split build-progress logic. Extract stage definitions, status mapping, pane progress computation, and session control actions into separate hooks under `plugins/shape-plugin/src/ui/hooks/build/` (or similar). Keep `useShapeBuildStep.ts` as a coordinator hook that composes those pieces.

Then, split UI sections:
* Move the area filter controls, extraction controls, and precision controls from `ExtractionConfigSection.tsx` into focused subcomponents (e.g., `ProcessingAreaFilterCard`, `ProcessingExtractionCard`, `ProcessingPrecisionCard`).
* Split `DownloadConfigSection.tsx` into smaller UI blocks (e.g., `DownloadCacheControls`, `DownloadRetrySettings`, `DownloadTimeoutFields`).

Ensure each new subcomponent receives its data and event handlers via props only, with no direct state access, to preserve reusability.

Finally, update imports/exports, ensure the step components render the same UI, and run `pnpm --filter @hierarchidb/shape-plugin typecheck`. Record command outputs in the linked GitHub Issue.

## Concrete Steps

1) Create the new hook/component files under `plugins/shape-plugin/src/ui/hooks/...` and `plugins/shape-plugin/src/ui/components/...` as described above.
2) Refactor `useShapePreviewStep.ts`, `useShapeBuildStep.ts`, `useShapeProgress.ts`, `ExtractionConfigSection.tsx`, and `DownloadConfigSection.tsx` to use the new pieces.
3) Update any exports in `plugins/shape-plugin/src/ui/hooks/index.ts` or new index files as needed.
4) From repo root, run:
   pnpm --filter @hierarchidb/shape-plugin typecheck
   Expect exit code 0.
5) Record the command and result in the linked GitHub Issue.

## Validation and Acceptance

Run `pnpm --filter @hierarchidb/shape-plugin typecheck` from the repository root and confirm exit code 0. Manually open the shape dialog steps (Step2–Step5) and verify that download/extraction settings, build progress, and preview behave as before (no missing UI or errors). Record the typecheck result in the linked GitHub Issue.

## Idempotence and Recovery

All changes are additive refactors. Re-running the steps is safe. If behavior regresses, revert the new hook/component files and restore the original monolithic implementations, then re-run typecheck.

## Artifacts and Notes

Capture command output for typecheck and keep the new modules small and focused. Avoid adding comments unless the logic is non-obvious; use English if needed.

## Interfaces and Dependencies

The new hooks/components should depend only on existing shape UI types and helper utilities. Do not introduce new external dependencies. Use the existing `ShapeEntity`, `ShapeFeatureMetadataRow`, `ProcessingConfig`, and `BuildStage` types. Ensure new interfaces are shape-agnostic in naming and surface area so they can be moved into a shared `@hierarchidb/ui-*` package later.

Plan update note: marked all milestones complete after splitting preview/build/progress hooks, decomposing processing UI panels, and passing shape-plugin typecheck.
