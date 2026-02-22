# Remove wrapper/adapter indirection and use shared code directly in plugins

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This plan must be maintained in accordance with PLANS.md at repository root (PLANS.md).

## Purpose / Big Picture

After this change, shape/location/route plugins will call shared packages directly instead of going through thin wrappers or pass-through adapters that only rename or re-export shared APIs. Developers will be able to follow call paths without detouring through redundant modules, and shared packages will expose the small missing APIs needed to allow direct use. The result is clearer ownership, fewer files to maintain, and less indirection when debugging or extending plugin behavior.

## Progress

- [x] (2025-12-29 10:19 JST) Created ExecPlan skeleton and recorded the direct-use policy requested by the user.
- [x] (2025-12-29 10:30 JST) Inventoried wrapper candidates and removed thin pass-through modules (location sharedNet, shape RuntimeTileClient, route download type aliases, shape auth wrapper) by updating call sites to direct shared API usage.
- [x] (2025-12-29 10:45 JST) Replaced LocationVectorTileService with shared tile helpers, updated UI call sites, and moved unit coverage to common/tiles.
- [x] (2025-12-29 11:05 JST) Removed route createRouteBatchManager wrappers and RuntimeWorkerClient facade, and updated route UI/orchestrator to construct managers directly.
- [ ] (pending) Validate with targeted tests and update TASKS.md with results and rollback steps.

## Surprises & Discoveries

- Observation: to be filled as implementation proceeds.
  Evidence: to be filled.

## Decision Log

- Decision: Treat a module as a removable wrapper if it only forwards calls, renames exports, or sets trivial defaults without adding substantial behavior.
  Rationale: such modules add indirection without meaningful encapsulation and reduce maintainability.
  Date/Author: 2025-12-29 / Codex

- Decision: Move LocationBatchManager network helpers into class methods and delete plugins/location-plugin/src/services/utils/sharedNet.ts.
  Rationale: the module was a thin facade over @hierarchidb/download and added indirection without unique behavior.
  Date/Author: 2025-12-29 / Codex

- Decision: Remove plugins/shape-plugin/src/services/tiles/RuntimeTileClient.ts and call getShapeRuntimeWorkerClient directly in UI hooks.
  Rationale: the module only forwarded calls and was unnecessary once direct usage was allowed.
  Date/Author: 2025-12-29 / Codex

- Decision: Remove plugins/route-plugin/src/services/download/factory.ts and use DownloadServiceBundle directly in tests.
  Rationale: the file only re-exported types from @hierarchidb/download and was a pass-through wrapper.
  Date/Author: 2025-12-29 / Codex

- Decision: Remove plugins/shape-plugin/src/services/auth/index.ts due to unused, thin compatibility wrapper.
  Rationale: it was unreferenced and only forwarded AuthRecoveryService access.
  Date/Author: 2025-12-29 / Codex

- Decision: Replace LocationVectorTileService with common tile helper functions under plugins/location-plugin/src/common/tiles.
  Rationale: the service class only wrapped batch/session/DB calls; direct helpers reduce indirection and make call sites explicit.
  Date/Author: 2025-12-29 / Codex

- Decision: Remove route-plugin createRouteBatchManager wrappers (both in services/ and orchestrator file) and construct RouteBatchSessionOrchestrator + engines directly in UI.
  Rationale: these were convenience wrappers that obscured direct shared engine/manager usage and added indirection without behavior.
  Date/Author: 2025-12-29 / Codex

- Decision: Remove unused RouteRuntimeWorkerClient wrapper file.
  Rationale: it was an unreferenced facade over @hierarchidb/runtime-worker with no added behavior.
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

- Pending. Update after implementation milestones complete.

## Context and Orientation

The primary targets are shape/location/route plugins under plugins/*-plugin/src. Shared packages live under packages/ and include @hierarchidb/download, @hierarchidb/ui-monitoring, @hierarchidb/ui-build-progress, @hierarchidb/ui-worker-client, and other shared utilities.

Wrapper/adapter modules in this context refer to plugin-local files that only re-export or lightly wrap shared APIs (for example, adding constant pluginId or naming aliases) without meaningful behavior. If a module contains logic that is truly plugin-specific (e.g., translating domain objects or enforcing plugin rules), it is not removed, but should still call shared APIs directly when available.

## Plan of Work

Milestone 1: Inventory and classify wrappers/adapters.

Search for plugin-local modules in shape/location/route that primarily import a shared API and re-export or forward to it. Use search terms such as registry, adapter, wrapper, bridge, shared, facade, or helper. For each candidate, inspect the file and classify it as one of: thin wrapper (remove), behaviorful adapter (retain but refactor to direct shared usage), or public facade (retain only if it is part of the plugin’s documented API).

Record the inventory and decisions in TASKS.md and in this ExecPlan’s Surprises & Discoveries section as needed.

Milestone 2: Replace wrappers with direct shared usage.

For each thin wrapper identified, update all call sites to import and call the shared package directly. Remove the wrapper module and any tests that only validate the wrapper’s pass-through behavior. If a shared API is missing a small affordance needed by multiple plugins (e.g., an export from a shared package), add it to the shared package rather than keeping a wrapper.

Ensure each plugin’s package.json includes any new shared dependencies required by direct imports.

Milestone 3: Validate and document.

Run the most relevant plugin-level tests and typechecks. Update TASKS.md with the changes, the validation commands run, and the rollback steps.

## Concrete Steps

Work in repository root /Users/hiroya/WebstormProjects/hierarchidb.

1) Inventory candidates.
   - rg -n "registry|adapter|wrapper|bridge|shared|facade" plugins/shape-plugin plugins/location-plugin plugins/route-plugin
   - Inspect candidate files and list which are thin wrappers vs. behaviorful adapters.

2) Remove thin wrappers and update imports.
   - Update call sites to use shared packages directly (e.g., @hierarchidb/download, @hierarchidb/ui-monitoring).
   - Remove the wrapper modules and their wrapper-only tests.

3) Update shared packages if needed.
   - Add missing exports or minimal utilities to shared packages to support direct imports.

4) Update package.json peer/dev deps where new direct imports are introduced.

5) Update TASKS.md and ExecPlan Progress with outcomes.

## Validation and Acceptance

Run targeted checks from repository root:

- pnpm --filter @hierarchidb/shape-plugin test
- pnpm --filter @hierarchidb/location-plugin test
- pnpm --filter @hierarchidb/route-plugin test
- pnpm --filter @hierarchidb/ui-monitoring typecheck (if modified)

Acceptance criteria:

- All identified thin wrappers are removed or replaced by direct shared API usage.
- Plugins compile and tests pass, or any remaining failures are documented with follow-up tasks.
- The shared packages expose any required exports without adding new wrapper layers.

## Idempotence and Recovery

The steps are safe to repeat. If a removal breaks behavior, revert the affected files and reintroduce the wrapper module, then document why it was necessary. Keep localStorage keys and external API contracts stable when refactoring.

## Artifacts and Notes

Capture short diffs and test outputs here as implementation proceeds.

Plan change note (2025-12-29): Updated Progress and Decision Log to reflect wrapper removals and direct shared API usage in location/shape/route.

## Interfaces and Dependencies

Plugins should import shared utilities directly from packages/* (e.g., @hierarchidb/download, @hierarchidb/ui-monitoring). Any new shared utility required by multiple plugins should be added to the shared package rather than wrapped by plugin-specific modules.

Plan change note: This plan enforces direct shared usage per the user’s instruction to avoid wrapper/adapter indirection even when it requires edits in both plugin and shared code.
