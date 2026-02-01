# Extract Large TSX Logic (400+ Lines) into Hooks

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

The repository contains multiple TSX files over 400 lines (excluding tests/stories). These files blend UI rendering with state, effects, and orchestration. The goal is to split non-view logic into custom hooks or helper components so each TSX is smaller, easier to read, and maintainable without behavior changes. Work proceeds in order from the top-10 largest files (excluding tests/stories).

## Progress

- [x] (2026-02-02 01:50 JST) Extract Route 1: modelessDialogContent.tsx (split hooks to modelessDialogContentData).
- [ ] (2026-02-02) Extract Route 2: ResourceLayerMap.tsx
- [ ] (2026-02-02) Extract Route 3: useLocationMapPreviewStep.tsx
- [ ] (2026-02-02) Extract Route 4: usePluginDialogController.tsx
- [ ] (2026-02-02) Extract Route 5: MapPage.tsx
- [ ] (2026-02-02) Extract Route 6: LocationMapPreview.tsx
- [ ] (2026-02-02) Extract Route 7: plugins.tsx
- [ ] (2026-02-02) Extract Route 8: SimpleBFFAuthContext.tsx
- [ ] (2026-02-02) Extract Route 9: GenericDataGrid.tsx
- [ ] (2026-02-02) Extract Route 10: ShapeBuildProgressPanel.tsx
- [ ] Run typecheck per affected package/plugin and record results.

## Surprises & Discoveries

- None yet.

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
4) Run package/plugin typecheck after each target (or batch) and record results in TASKS.md.
5) Update this ExecPlan progress and surprises.

## Validation and Acceptance

- Each target TSX delegates non-view logic to a hook or helper component.
- Rendering output and behavior remain unchanged.
- Target package/plugin typecheck succeeds (exit 0).
- TASKS.md and ExecPlan contain progress and verification logs.
Plan change note: Completed Route 1 modelessDialogContent split and recorded app typecheck.
