# Extract Large TSX Logic (400+ Lines) into Hooks

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

The repository contains multiple TSX files over 400 lines (excluding tests/stories). These files blend UI rendering with state, effects, and orchestration. The goal is to split non-view logic into custom hooks or helper components so each TSX is smaller, easier to read, and maintainable without behavior changes. Work proceeds in order from the top-10 largest files (excluding tests/stories).

## Progress

- [x] (2026-02-02 01:50 JST) Extract Route 1: modelessDialogContent.tsx (split hooks to modelessDialogContentData).
- [x] (2026-02-02 02:45 JST) Extract Route 2: ResourceLayerMap.tsx (stats logic to useResourceLayerMapStats).
- [x] (2026-02-02 03:35 JST) Extract Route 3: useLocationMapPreviewStep.tsx (split metadata/map/config hooks).
- [x] (2026-02-02 04:35 JST) Extract Route 4: usePluginDialogController.tsx (step-navigation hook).
- [x] (2026-02-02 10:21 JST) Extract Route 5: MapPage.tsx
- [x] (2026-02-02 12:34 JST) Extract Route 6: LocationMapPreview.tsx
- [x] (2026-02-02 12:34 JST) Extract Route 7: plugins.tsx
- [ ] (2026-02-02) Extract Route 8: SimpleBFFAuthContext.tsx
- [ ] (2026-02-02) Extract Route 9: GenericDataGrid.tsx
- [ ] (2026-02-02) Extract Route 10: ShapeBuildProgressPanel.tsx
- [x] (2026-02-02 12:34 JST) Run typecheck per affected package/plugin and record results.

## Surprises & Discoveries

- (2026-02-02) tsdown emitted index3.d.ts for location/route plugins; normalize-dts.mjs now prefers index3 to keep public exports consistent.
- (2026-02-02) spreadsheet-plugin d.ts reexports caused CIRCULAR_REEXPORT; normalize-dts.mjs now rewrites ui/index.d.ts imports based on dist/ui/index.js to avoid cycles.

## Decision Log

- Decision: Process files in descending line-count order (excluding tests/stories) to maximize impact first.
  Rationale: Largest files have the highest maintenance cost and complexity.
  Date/Author: 2026-02-02 / Codex.

## Outcomes & Retrospective

- Outcome: Pending.

## Plan of Work

1) For each target TSX, identify logic candidates (state, effects, data transform, handlers).
2) Extract logic into a sibling `use*` hook or helper component file.
3) Replace in-file logic with hook calls and keep UI behavior unchanged.
4) Run package/plugin typecheck after each target (or batch) and record results in the linked GitHub Issue.
5) Update this ExecPlan progress and surprises.

## Validation and Acceptance

- Each target TSX delegates non-view logic to a hook or helper component.
- Rendering output and behavior remain unchanged.
- Target package/plugin typecheck succeeds (exit 0).
- the linked GitHub Issue and ExecPlan contain progress and verification logs.
Plan change note: Completed Route 1 modelessDialogContent split and recorded app typecheck. Completed Route 2 ResourceLayerMap stats hook extraction and recorded ui-map typecheck. Completed Route 3 LocationMapPreviewStep hook split and recorded location-plugin typecheck. Completed Route 4 usePluginDialogController step-navigation hook split and recorded plugin-ui-host typecheck. Completed Route 5 MapPage hook split and recorded app typecheck after normalize-dts update.
