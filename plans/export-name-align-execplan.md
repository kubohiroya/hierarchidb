# Normalize Exported Type Names and Resolve Duplicate Symbols

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with its requirements.

## Purpose / Big Picture

After this change, developers can locate exported types and services quickly because file names match exported type names, and duplicated symbol names across packages are either consolidated or clearly distinguished by responsibility. This reduces confusion when tracing APIs across the host and plugin layers. Success is visible by running the dependency audit and by verifying that imports resolve to appropriately named files without collisions.

## Progress

- [x] (2025-12-28 17:45 JST) Scanned `packages/**/src`, `plugins/**/src`, and `app/src` for exported symbol duplicates and file-name mismatches.
- [x] (2025-12-28 14:35 JST) Decide the scope for “type name = file name” (component props vs. shared API types).
- [x] (2025-12-28 14:35 JST) Define rename/merge rules for duplicated symbols and document them.
- [x] (2025-12-28 14:47 JST) Apply renames, update imports/exports, and keep tests passing (RouteEngine extraction, LaneSemaphoreRegistry re-export, PluginWorkerModuleLoaderContract rename, plugin-service-api PascalCase files).
- [ ] (pending) Run targeted typechecks/tests and record results in TASKS.md.

## Surprises & Discoveries

- Many mismatches are UI component files exporting `*Props` types; renaming those files would be disruptive and likely not intended.
- Several duplicates appear in plugin internals (especially shape-plugin batch types), indicating parallel type definitions rather than explicit shared contracts.

## Decision Log

- Decision: Use an explicit scope for “type name = file name,” focusing on shared API/type-only modules and excluding component prop types.
  Rationale: Renaming UI component files to match prop types is noisy and not useful for discoverability.
  Date/Author: 2025-12-28 / Codex
- Decision: Consolidate `RouteGenerator` and `SearouteEngine` into a shared package (`@hierarchidb/route-engine`) and rewire runtime-worker + route-plugin to consume it.
  Rationale: Both implementations are functionally identical and cause duplicate symbol ambiguity.
  Date/Author: 2025-12-28 / Codex
- Decision: Keep `packages/` as the canonical `LaneSemaphoreRegistry` and re-export from build-runtime-services.
  Rationale: Prevents divergence and clarifies shared batch ownership.
  Date/Author: 2025-12-28 / Codex
- Decision: Rename duplicated UI types and runtime-worker interfaces per proposal (`TreeConsoleNodeContextMenuProps`, `PluginWorkerModuleLoaderContract`).
  Rationale: Removes duplicate symbol confusion without altering behavior.
  Date/Author: 2025-12-28 / Codex
- Decision: Rename plugin-service-api type files to match exported type names (PascalCase).
  Rationale: Eliminates file/type mismatch for discoverability.
  Date/Author: 2025-12-28 / Codex

## Outcomes & Retrospective

- Pending until implementation. This section will summarize which symbols were consolidated or renamed and any remaining exceptions.

## Context and Orientation

This repo contains shared packages under `packages/`, plugin implementations under `plugins/`, and the app under `app/`. Exported types and services are often re-exported through `index.ts`, but this plan excludes `index.ts` from renaming. The focus is on actual definition files in `src/` folders. Duplicated symbol names currently exist across multiple packages (for example, `RouteGenerator` in both runtime-worker and route-plugin), and many files export a type whose name does not match the filename.

Key files involved include:
- `packages//src/ImportExportService.ts` (base implementation)
- `packages/runtime-worker/src/services/ImportExportLifecycleService.ts` (runtime-worker augmentation)
- `packages/runtime-worker/src/services/route/*.ts` vs. `plugins/route-plugin/src/services/*.ts` (duplicated route engine types)
- `plugins/shape-plugin/src/common/types/*` and `plugins/shape-plugin/src/services/types.ts` (duplicated build-related types)

## Plan of Work

First, confirm the intended scope for renaming. The plan assumes that component files keep their names and only shared API/type files are aligned to exported type names. Next, group duplicates by responsibility: if two symbols represent the same concept in host and plugin, move the shared definition into a shared package (for example, a `*-store` or `plugin-service-api` module) and re-export from both sides. If the responsibilities diverge, rename one side to a specific name (e.g., `RuntimeRouteGenerator` vs. `PluginRouteGenerator`). After deciding the naming rules, rename files to match the exported types, update all imports/exports, and run type checks for the affected packages.

## Concrete Steps

1) Generate a duplicate/mismatch report and review it against the scope rules.
   - Run in repo root:
     pnpm exec dependency-cruiser -c .dependency-cruiser.cjs packages app
     python3 scripts/export-name-audit.py  (if created)
   - Expected: a list of duplicated symbol names and file-name mismatches.

2) Decide renames and shared module extractions.
   - For each duplicate symbol, write a short note describing whether to consolidate or rename.

3) Apply renames and update imports.
   - Use file moves and update imports via search/replace.

4) Validate.
   - Run targeted typechecks (for packages touched) and record results.

## Validation and Acceptance

- `pnpm --filter <affected-package> typecheck` succeeds for each modified package.
- Developers can locate the exported type by filename in the modified areas (manual inspection).
- There are no remaining duplicated symbol names in the chosen scope.

## Idempotence and Recovery

Renames can be re-run safely as long as imports are updated. If a rename fails, revert the affected files and rerun typecheck to confirm recovery. Avoid renaming index files.

## Artifacts and Notes

The initial scan (2025-12-28) produced a large list of duplicate symbol names and mismatches, especially in UI component prop types and shape-plugin batch types. These will be filtered by the scope decision.

## Interfaces and Dependencies

Primary dependencies are the existing TypeScript modules in `packages/`, `plugins/`, and `app/`. No external libraries are required. Naming changes must maintain existing exported interfaces and avoid introducing host-to-plugin dependencies outside approved paths.

Plan change note: Initial version created after the first duplicate/mismatch scan to guide scope and naming decisions.
