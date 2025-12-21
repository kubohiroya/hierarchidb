# Rename ui-tabular-extract and ui-data-grid to consistent names

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `PLANS.md` at repository root. Maintain this document in accordance with that file.

## Purpose / Big Picture

The UI packages for tabular previews and data grids have confusing names (`ui-tabular-extract`, `ui-data-grid`) and inconsistent component naming (`TabularPreviewLite`, `TabularPreview`). This change renames the packages and key exports so the names match their actual responsibilities and read consistently across spreadsheet, styler, shape, location, and route plugins. After the change, developers should be able to infer which package is low-level grid primitives versus higher-level tabular workflows purely from the names. Success is verified by updated imports and a passing `pnpm --filter @hierarchidb/shape-plugin typecheck`.

## Progress

- [x] (2025-12-21 23:44) Create this ExecPlan and confirm the rename targets and new names.
- [x] Rename `@hierarchidb/ui-data-grid` → `@hierarchidb/ui-grid` and update paths/imports.
- [x] Rename `@hierarchidb/ui-tabular-extract` → `@hierarchidb/ui-tabular` and update paths/imports.
- [x] Rename key exports (`TabularPreviewLite` → `TabularPreviewGrid`, `TabularPreview` → `DataGridPreview`) and update usages.
- [x] Update plugin registry references, docs, and configs.
- [x] Run `pnpm --filter @hierarchidb/shape-plugin typecheck` and record in `TASKS.md`.

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Use `@hierarchidb/ui-grid` for low-level grid primitives and `@hierarchidb/ui-tabular` for higher-level tabular workflows.
  Rationale: This makes the package hierarchy explicit and avoids the misleading “extract” name.
  Date/Author: 2025-12-21 Codex

- Decision: Rename `TabularPreviewLite` to `TabularPreviewGrid` and `TabularPreview` to `DataGridPreview`.
  Rationale: These names communicate what the component renders and which layer it belongs to.
  Date/Author: 2025-12-21 Codex

## Outcomes & Retrospective

- Outcome (2025-12-22): Packages renamed to `@hierarchidb/ui-grid` and `@hierarchidb/ui-tabular`, with `TabularPreviewGrid` and `DataGridPreview` exports standardized and all imports/docs updated.

## Context and Orientation

`packages/ui/data-grid` currently provides grid primitives (`GenericDataGrid`, `DataGridPreview`). `packages/ui/tabular-extract` provides tabular workflows and uses `GenericDataGrid` via `TabularPreviewGrid`. Many plugins import both packages. The rename must update package names in `package.json`, tsconfig paths, and all import paths across the workspace, plus any generated registry references.

## Plan of Work

Update package names in `packages/ui/data-grid/package.json` and `packages/ui/tabular-extract/package.json`. Update `tsconfig.base.json` path aliases accordingly. Rename the exported components by updating their filenames and exports, and update all imports and references across the repo. Update plugin dependencies and the generated plugin registry to match the new package names. Finally, run the shape-plugin typecheck and record the results.

## Concrete Steps

1) Rename package names and update path aliases in `tsconfig.base.json`.
2) Rename `TabularPreview` to `DataGridPreview` and adjust exports in `packages/ui/data-grid/src/index.ts`.
3) Rename `TabularPreviewLite` to `TabularPreviewGrid` and adjust exports in `packages/ui/tabular-extract/src/index.ts`.
4) Replace all imports of `@hierarchidb/ui-data-grid` → `@hierarchidb/ui-grid` and `@hierarchidb/ui-tabular-extract` → `@hierarchidb/ui-tabular`.
5) Update `package.json` dependencies in plugins and packages to the new names.
6) Update generated registry references or regenerate registry if needed.
7) Run `pnpm --filter @hierarchidb/shape-plugin typecheck` and record the result in `TASKS.md`.

## Validation and Acceptance

`pnpm --filter @hierarchidb/shape-plugin typecheck` succeeds. Imports compile cleanly across spreadsheet/styler/shape/location/route for the renamed packages and components.

## Idempotence and Recovery

This is a pure rename. Re-running replacements is safe. Roll back by reverting the renames and paths if issues occur, then re-run typecheck.

## Artifacts and Notes

The rename touches many files; keep the changes mechanical and avoid behavioral changes.

## Interfaces and Dependencies

`@hierarchidb/ui-grid` should continue to export `GenericDataGrid`, `CrossView*`, and the renamed `DataGridPreview`. `@hierarchidb/ui-tabular` should export the tabular workflow components and `DataGridPreviewGrid`.

Plan update note: created to guide the package and component renaming for UI grid/tabular layers.
