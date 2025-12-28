# Eliminate host-to-plugin direct dependencies outside plugin-registry

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This plan is governed by PLANS.md at repository root. Maintain this document in accordance with that file.

## Purpose / Big Picture

The goal is to ensure host-side code only depends on individual plugins via plugin-registry. After this change, host packages (app, runtime-worker, and shared feature stores) will no longer import or depend on plugin packages directly. Instead, shared types and utilities that host code needs will live in feature store packages, and plugins will re-export those shared artifacts. This reduces cyclic dependencies, makes plugin boundaries explicit, and avoids host builds pulling plugin internals.

Success is observable by running dependency-cruiser with the repository config and seeing that any remaining host-to-plugin edges exist only through plugin-registry, and that direct imports of @hierarchidb/*-plugin from host packages are removed. This can be verified by a fresh dependency-cruiser run and by grep searches for plugin imports in host packages.

## Progress

- [ ] (2025-12-28 15:30Z) Create an inventory of host-side direct plugin imports and dependency declarations, and record which are intentional vs. disallowed.
- [ ] (2025-12-28 15:30Z) Move IDE-GSM location parsing and point replacement helpers out of location-plugin into a host-side store package and update runtime-worker to use the store.
- [ ] (2025-12-28 15:30Z) Extract SpreadsheetEntity types into a new host-side store package, update styler-store to use it, and update spreadsheet-plugin to re-export it.
- [ ] (2025-12-28 15:30Z) Remove host package.json dependencies on individual plugins, replacing them with plugin-registry dependencies where required.
- [ ] (2025-12-28 15:30Z) Re-run dependency-cruiser and document remaining cycles/edges, confirming only plugin-registry mediates host-plugin dependencies.

## Surprises & Discoveries

- Observation: runtime-worker still dynamically imports @hierarchidb/location-plugin for IDE-GSM helpers, which is a direct host-to-plugin dependency.
  Evidence: packages/runtime-worker/src/services/LocationMutationService.ts imports @hierarchidb/location-plugin.
- Observation: @hierarchidb/styler-store depends on @hierarchidb/spreadsheet-plugin for SpreadsheetEntity types, which is another host-to-plugin dependency.
  Evidence: packages/features/styler-store/src/StylerEntity.ts imports @hierarchidb/spreadsheet-plugin.

## Decision Log

- Decision: Treat host-to-plugin imports and package.json dependencies as disallowed unless they pass through plugin-registry modules.
  Rationale: The user requirement explicitly allows plugin-registry as the only host-facing dependency path; removing other edges reduces cycles and clarifies layering.
  Date/Author: 2025-12-28 / Codex

## Outcomes & Retrospective

Pending. This section will be updated after completing the milestones and validation steps.

## Context and Orientation

Host side means code in app/, packages/runtime-worker/, packages/common/, and packages/features/ that should not import plugin packages directly. Plugin code lives under plugins/*-plugin/ and is exposed to the host via @hierarchidb/plugin-registry generated loaders and definitions. Feature store packages (packages/features/*-store) are intended to hold shared types and storage implementations that host code can depend on safely.

Key files and modules to update:

- packages/runtime-worker/src/services/LocationMutationService.ts currently dynamic-imports location-plugin for IDE-GSM helpers.
- plugins/location-plugin/src/services/ide-gsm/ideGsmCsv.ts and plugins/location-plugin/src/services/pointRepository.ts contain the helpers that should move to a store package.
- packages/features/styler-store/src/StylerEntity.ts imports spreadsheet-plugin types.
- plugins/spreadsheet-plugin/src/common/types/SpreadsheetEntity.ts defines SpreadsheetEntity types that should move to a store package.
- packages/runtime-worker/package.json and app/package.json declare direct plugin dependencies that should be removed or minimized in favor of plugin-registry.
- app/vite.config.ts contains explicit plugin spec alias mappings; this must be checked for whether it violates the dependency rule or is part of the plugin-registry toolchain.

Definitions:

- plugin-registry: The generated registry and loader modules in packages/plugin-registry, which provide the authoritative plugin definitions and dynamic import loaders for UI/worker/icon/database modules.
- store package: A package in packages/features/*-store that exposes types and persistence APIs that host code can depend on without importing plugin implementation code.

## Plan of Work

First, enumerate all host-side imports of @hierarchidb/*-plugin and all host package.json dependencies on plugin packages. Classify each as acceptable (plugin-registry) or disallowed (direct host dependency). Use this list to drive the refactor.

Second, remove the runtime-worker dependency on location-plugin by moving IDE-GSM parsing and point replacement helpers into @hierarchidb/location-store. Update location-store exports to include the moved functions, and update location-plugin to re-export them from the store. Update runtime-worker to import these helpers from location-store instead of location-plugin.

Third, remove styler-store’s dependency on spreadsheet-plugin by creating a new packages/features/spreadsheet-store package. Move SpreadsheetEntity and SpreadSheetDataSourceType definitions into this new store package, and re-export them from spreadsheet-plugin. Update styler-store to import from spreadsheet-store and update its package.json dependencies accordingly.

Fourth, update host package.json dependencies to remove direct plugin dependencies. app/package.json and packages/runtime-worker/package.json should keep plugin-registry and store packages, while direct plugin dependencies should be removed unless the dependency is explicitly required for plugin-registry generation. For Vite config alias lists, decide whether those lists can be derived from plugin-registry outputs or the existing plugin alias plugin without direct plugin dependencies; document the decision and align config accordingly.

Finally, rerun dependency-cruiser and grep scans to confirm that host-side plugin imports are gone. Capture the output in TASKS.md and update this plan’s Progress and Outcomes sections.

## Concrete Steps

Run the following commands from the repository root and compare results to the expected outputs described below.

1) Inventory direct plugin imports in host code.
   Command: rg -n "@hierarchidb/[^\"'\s]*-plugin" packages/runtime-worker packages/common packages/features packages/ui app -g"*.ts*" -g"*.js"
   Expectation: The remaining hits should be limited to plugin-registry infrastructure or be flagged as disallowed. Record the disallowed list in this plan and TASKS.md.

2) Move IDE-GSM helpers from location-plugin to location-store and update imports.
   Files: packages/features/location-store/src (new modules as needed), plugins/location-plugin/src/services/ide-gsm/ideGsmCsv.ts, plugins/location-plugin/src/services/pointRepository.ts, plugins/location-plugin/src/services/index.ts, packages/runtime-worker/src/services/LocationMutationService.ts.
   Expectation: runtime-worker no longer imports @hierarchidb/location-plugin. location-plugin re-exports the helpers from location-store.

3) Create spreadsheet-store and update styler-store/spreadsheet-plugin.
   Files: packages/features/spreadsheet-store (new package.json, tsconfig, src/index.ts, src/SpreadsheetEntity.ts), plugins/spreadsheet-plugin/src/common/types/SpreadsheetEntity.ts (move definitions), plugins/spreadsheet-plugin/src/index.ts (re-export), packages/features/styler-store/src/StylerEntity.ts, packages/features/styler-store/package.json.
   Expectation: styler-store imports SpreadsheetEntity types from spreadsheet-store. spreadsheet-plugin re-exports them for plugin-side usage. No host code imports spreadsheet-plugin directly for these types.

4) Remove direct plugin dependencies from host package.json where possible.
   Files: app/package.json, packages/runtime-worker/package.json, packages/features/styler-store/package.json.
   Expectation: plugin-registry remains the only host-side dependency path to plugin packages.

5) Validate the dependency graph.
   Command: pnpm exec dependency-cruiser -c .dependency-cruiser.cjs packages app
   Expectation: any remaining host-to-plugin edges are mediated by plugin-registry. Record the output in TASKS.md and update this plan.

## Validation and Acceptance

Run the dependency-cruiser command above after updates. Acceptance is met when the output no longer lists host-side imports of plugin packages outside plugin-registry, and the grep inventory from step 1 is clean of disallowed imports.

If typecheck is feasible, run pnpm --filter @hierarchidb/runtime-worker typecheck and pnpm --filter @hierarchidb/app typecheck, and record any failures or skips in TASKS.md.

## Idempotence and Recovery

All steps are file edits and can be repeated safely. If a change causes a regression, revert the specific files listed in the Plan of Work. For package.json edits, revert those files and pnpm-lock.yaml to restore dependency resolution.

## Artifacts and Notes

Capture the dependency-cruiser output and any before/after grep output in TASKS.md under the active worklog entry for this task.

## Interfaces and Dependencies

This work introduces a new store package (packages/features/spreadsheet-store) with a public interface for SpreadsheetEntity types. Ensure these types are exported from spreadsheet-store and re-exported by spreadsheet-plugin. Location IDE-GSM helper signatures must remain identical to their current usage in runtime-worker to avoid behavioral changes; only their module location should change. runtime-worker should depend on @hierarchidb/location-store for these helpers, not on location-plugin.


Revision note: Initial plan drafted on 2025-12-28 to remove host-to-plugin dependencies outside plugin-registry and align store packages for shared types.
