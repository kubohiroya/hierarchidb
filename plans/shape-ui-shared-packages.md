# Move shared Shape UI/hooks into ui-map and ui-batch-progress packages

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `PLANS.md` at repository root. Maintain this document in accordance with that file.

## Purpose / Big Picture

The shape plugin currently owns hooks and UI logic that are useful across GIS-oriented plugins (shape, location, route) and across generic batch-processing UIs. This change extracts those reusable parts into shared packages: `@hierarchidb/ui-map` for vector-tile preview helpers and `@hierarchidb/ui-batch-progress` for batch progress and task aggregation hooks. After the change, shape-plugin imports these shared packages, reducing duplication and paving the way for location/route to adopt the same APIs. Success is confirmed by passing `pnpm --filter @hierarchidb/shape-plugin typecheck` and by seeing the shared packages compile in the workspace.

## Progress

- [x] (2025-12-21 23:16) Create this ExecPlan and enumerate candidate shared units.
- [x] (2025-12-21 23:18) Add new `packages/ui/gis` and `packages/ui/batch` with initial exports.
- [x] (2025-12-21 23:18) Move generic preview hooks into ui-gis and update shape-plugin imports.
- [x] (2025-12-21 23:18) Move generic batch hooks into ui-batch-progress and update shape-plugin imports.
- [x] (2025-12-21 23:18) Update workspace paths and package dependencies.
- [x] (2025-12-21 23:18) Run shape-plugin typecheck and record results in `TASKS.md`.
- [x] (2026-01-09) Consolidate preview hooks into `@hierarchidb/ui-map` and remove `@hierarchidb/ui-gis`.

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Consolidate shared map preview helpers into `@hierarchidb/ui-map` and keep `@hierarchidb/ui-batch-progress` for batch progress.
  Rationale: A single shared map package avoids encouraging bespoke map components across plugins while still allowing focused batch UI helpers.
  Date/Author: 2025-12-21 Codex

## Outcomes & Retrospective

Shared preview hooks now live in `@hierarchidb/ui-map` and batch progress helpers in `@hierarchidb/ui-batch-progress`. Shape-plugin builds against those packages and typecheck passes, making the shared APIs ready for location/route adoption.

## Context and Orientation

The shape-plugin UI hooks live under `plugins/shape-plugin/src/ui/hooks` and were recently split into smaller units. The vector-tile preview pipeline is in `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` plus helper hooks under `plugins/shape-plugin/src/ui/hooks/preview`. Batch progress hooks are under `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts` and `plugins/shape-plugin/src/ui/hooks/build`. The goal is to move reusable logic into new shared packages under `packages/ui/`.

`@hierarchidb/ui-map` contains hooks that coordinate vector tile preview behavior: metadata loading, search/match, map layer highlighting, and map identify selection. These are GIS-specific and share the same MapLibre primitives and MUI theme.

`@hierarchidb/ui-batch-progress` will contain hooks that coordinate batch progress subscriptions and task aggregation for staged builds. These are not GIS-specific and should depend on the batch and worker client packages.

## Plan of Work

Create the new `packages/ui/gis` and `packages/ui/batch` packages with `package.json`, `tsconfig.json`, and `src/index.ts`. Move the preview hooks into `ui-map` and adapt them to accept generic row/selection callbacks so shape-plugin can keep its domain rules outside of the shared package. Move the batch progress hook and stage task aggregation hook into `ui-batch-progress`. Update `tsconfig.base.json` paths so the workspace can resolve the new packages, and update `plugins/shape-plugin/package.json` peer/dev dependencies to include `@hierarchidb/ui-map` and `@hierarchidb/ui-batch-progress`. Finally, update `useShapePreviewStep` and `useShapeProgress`/`useShapeBuildProgressStep` to import the shared hooks.

## Concrete Steps

1) Add `packages/ui/gis` with `package.json`, `tsconfig.json`, and `src/index.ts`.
2) Add `packages/ui/batch` with `package.json`, `tsconfig.json`, and `src/index.ts`.
3) Move preview hooks to `packages/ui/map/src/preview` and update shape-plugin references.
4) Move batch hooks to `packages/ui/batch/src/hooks` and update shape-plugin references.
5) Update `tsconfig.base.json` paths and shape-plugin package dependencies.
6) Run `pnpm --filter @hierarchidb/shape-plugin typecheck` and record the exit code in `TASKS.md`.

## Validation and Acceptance

Run `pnpm --filter @hierarchidb/shape-plugin typecheck` from repo root and confirm exit code 0. Manual verification should confirm the preview step still renders map highlighting and metadata tables, and the build progress step still shows stage/task status.

## Idempotence and Recovery

All changes are refactors. If something fails, revert the new packages and restore the shape-plugin-local hooks, then re-run typecheck. The changes can be repeated safely since they do not mutate data.

## Artifacts and Notes

Keep the shared hooks generic by accepting callbacks for row IDs, search text, and selection resolution. Avoid adding new dependencies beyond those already used in shape-plugin.

## Interfaces and Dependencies

`@hierarchidb/ui-map` exports:
* `useVectorTilePreviewMetadata`
* `useVectorTilePreviewSearch`
* `useVectorTilePreviewSelection`
* `useVectorTilePreviewMapLayers`

`@hierarchidb/ui-batch-progress` exports:
* `useBatchProgressState`
* `useBuildTaskProgress`

Shape-plugin uses these exports in `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` and `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`.

Plan update note: marked milestones complete after moving hooks into ui-gis/ui-batch-progress and passing shape-plugin typecheck.
