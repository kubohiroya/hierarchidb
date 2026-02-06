# Unify plugin download/auth usage and centralize BuildMonitor utilities

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This plan must be maintained in accordance with PLANS.md at repository root (PLANS.md).

## Purpose / Big Picture

After this change, plugin download/auth calls and BuildMonitor logic will be centralized and directly consumable from shared packages, eliminating plugin-specific wrapper modules that obscure intent. A developer can use the shared download registry APIs directly in shape/location/route, and BuildMonitor logic will live in packages/ui/monitoring with stable localStorage keys. The result is a simpler, more uniform API surface and less indirection when tracing behavior.

## Progress

- [x] (2025-12-29 09:45 JST) Created initial ExecPlan framework and confirmed target shared package for BuildMonitor.
- [x] (2025-12-29 10:05 JST) Added shared BuildMonitor utilities to packages/ui/monitoring and updated shape/route callers to use them directly; removed plugin-local buildMonitor modules.
- [x] (2025-12-29 10:15 JST) Replaced plugin-specific download/auth wrappers with direct calls to @hierarchidb/download, removed redundant registry modules/tests, and preserved Location strategy registry via a dedicated module.
- [ ] (pending) Validate with targeted tests and update TASKS.md with results and rollback steps.

## Surprises & Discoveries

- Observation: to be filled as implementation proceeds.
  Evidence: to be filled.

## Decision Log

- Decision: Place BuildMonitor shared implementation under packages/ui/monitoring and have shape/route import it directly, without plugin-local wrapper modules.
  Rationale: user request to avoid thin wrappers and prefer direct API usage; monitoring package already hosts UI monitoring utilities.
  Date/Author: 2025-12-29 / Codex

- Decision: Use existing @hierarchidb/download pluginDownloadRegistry APIs directly in plugins, rather than adding new wrapper helpers.
  Rationale: avoid additional indirection and keep API usage explicit at call sites.
  Date/Author: 2025-12-29 / Codex

- Decision: Preserve Location download strategy registry via plugins/location-plugin/src/services/download/strategyRegistry.ts after removing download/auth wrappers.
  Rationale: strategy registry provides non-wrapper behavior used by LocationBatchManager and cannot be dropped when removing wrapper modules.
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

- Pending. Update after implementation milestones complete.

## Context and Orientation

The download/auth registry lives in packages//src/pluginDownloadRegistry.ts and is exported via packages//src/index.ts as @hierarchidb/download. It already provides configurePluginDownloadDefaults, getPluginDownloadService, downloadArrayBuffer, downloadJson, postJson, registerPluginDownloadServiceFactory, registerPluginAuthNotifier, and notifyPluginAuthRequired.

Plugin-specific wrappers currently exist:

- Shape plugin wraps authFetch and download helpers in plugins/shape-plugin/src/services/utils/authFetch.ts and plugins/shape-plugin/src/services/utils/downloadService.ts.
- Location plugin wraps registry functions in plugins/location-plugin/src/services/download/registry.ts and uses it via plugins/location-plugin/src/services/utils/sharedNet.ts.
- Route plugin wraps registry functions in plugins/route-plugin/src/services/download/registry.ts and uses it via plugins/route-plugin/src/common/orchestrator/RouteSourceOrchestrator.ts.

BuildMonitor logic exists separately per plugin:

- Shape build monitor utilities live in plugins/shape-plugin/src/ui/utils/buildMonitor.ts and are consumed by Shape build steps and hooks (e.g. plugins/shape-plugin/src/ui/hooks/useBuildCrashInsight.ts and UI config sections).
- Route build monitor utilities live in plugins/route-plugin/src/ui/utils/buildMonitor.ts and are consumed by plugins/route-plugin/src/ui/hooks/useRouteBuildCrashInsight.ts and route build UI.

The plan is to centralize BuildMonitor logic in packages/ui/monitoring (a shared UI utility package) and to update plugin code to call @hierarchidb/download APIs directly, removing plugin-local wrapper modules and tests that only validate those wrappers.

## Plan of Work

Milestone 1: Add shared BuildMonitor utilities under packages/ui/monitoring and update shape/route to use them directly.

Create a new utility module at packages/ui/monitoring/src/utils/buildMonitor.ts. Port the common pieces from shape and route build monitor modules and make behavior configurable by a BuildMonitorConfig. The config should include at least: storagePrefix (string), keyMode (node-only or node-or-session), maxSamples, memoryPressureRatio, heapWarningRatio, and heapCriticalRatio. Provide functions that accept the config and required inputs directly, such as getBuildMonitorKey, loadBuildMonitor, saveBuildMonitor, recordBuildStart, recordBuildFinish, appendBuildSample, getMemorySnapshot, getCrashInsight, and getHeapPressureSnapshot. Keep localStorage key compatibility by preserving prefixes hdb:shape:build-monitor and hdb:route:build-monitor and by using the same key mode as before.

Update packages/ui/monitoring/src/index.ts to export the new utilities.

Replace all imports of plugins/shape-plugin/src/ui/utils/buildMonitor.ts and plugins/route-plugin/src/ui/utils/buildMonitor.ts with direct imports from @hierarchidb/ui-monitoring (packages/ui/monitoring). Avoid creating new plugin-specific wrapper modules; use the shared functions directly in each calling module. Inline the plugin-specific configuration (prefix, keyMode, thresholds) where used, with a small shared constant only if it removes duplication without hiding the shared API.

Delete the obsolete buildMonitor modules under plugins/shape-plugin/src/ui/utils/buildMonitor.ts and plugins/route-plugin/src/ui/utils/buildMonitor.ts after callers are updated.

Milestone 2: Replace plugin-specific download/auth wrappers with direct usage of @hierarchidb/download APIs.

Remove plugins/shape-plugin/src/services/utils/authFetch.ts and plugins/shape-plugin/src/services/utils/downloadService.ts. Update all call sites to use @hierarchidb/download directly: authFetch('shape', url, init), downloadArrayBuffer('shape', url, prefix, retry, signal), downloadJson('shape', ...), postJson('shape', ...), configurePluginDownloadDefaults('shape', ...), and notifyPluginAuthRequired('shape', ...). Keep the configuration explicit at the call site. Do not introduce new wrapper helpers.

Remove plugins/location-plugin/src/services/download/registry.ts and plugins/route-plugin/src/services/download/registry.ts, and update all imports that depended on them to import directly from @hierarchidb/download. For location sharedNet (plugins/location-plugin/src/services/utils/sharedNet.ts), replace the dynamic registry import with direct imports: getPluginDownloadService('location'), notifyPluginAuthRequired('location', info), and postJson('location', ...). For route orchestrator (plugins/route-plugin/src/common/orchestrator/RouteSourceOrchestrator.ts), replace getRouteDownloadService and notifyAuthRequired with getPluginDownloadService('route') and notifyPluginAuthRequired('route', info).

Remove plugin-specific download registry tests that only validate thin wrappers. If coverage is needed, add or rely on existing tests in packages/ for registry behavior. Ensure no public re-exports of removed wrapper functions remain (for example, remove getRouteDownloadService export from plugins/route-plugin/src/index.ts).

## Concrete Steps

Work in repository root /Users/hiroya/WebstormProjects/hierarchidb.

1) Inspect BuildMonitor usages and apply shared import updates.
   - rg -n "buildMonitor" plugins/shape-plugin plugins/route-plugin
   - Update imports to @hierarchidb/ui-monitoring and replace local util usage.
   - Remove obsolete buildMonitor.ts files in plugin utils.

2) Add shared BuildMonitor utility module and export it.
   - Edit packages/ui/monitoring/src/utils/buildMonitor.ts
   - Edit packages/ui/monitoring/src/index.ts to export the new utilities.

3) Replace download/auth wrapper usage.
   - rg -n "authFetch|downloadService|registry" plugins/shape-plugin plugins/location-plugin plugins/route-plugin
   - Update code to import from @hierarchidb/download directly.
   - Delete wrapper modules and wrapper-only tests; update plugin index exports if needed.

4) Update TASKS.md logs with progress and decisions.

## Validation and Acceptance

Run targeted checks from repository root:

- pnpm --filter @hierarchidb/ui-monitoring typecheck
- pnpm --filter @hierarchidb/shape-plugin test
- pnpm --filter @hierarchidb/location-plugin test
- pnpm --filter @hierarchidb/route-plugin test

Acceptance criteria:

- BuildMonitor behavior remains intact: existing localStorage keys hdb:shape:build-monitor and hdb:route:build-monitor are read and written, and crash insight calculations are unchanged for the same stored data.
- Plugins use @hierarchidb/download APIs directly, with no plugin-specific wrapper modules remaining for download/auth.
- Code references to removed wrapper modules are eliminated, and tests pass or have documented adjustments.

## Idempotence and Recovery

All steps are safe to repeat. If any change introduces regressions, revert the modified files and restore the deleted wrapper modules. If a deletion is discovered to be needed elsewhere, reintroduce it explicitly and document the dependency in TASKS.md.

## Artifacts and Notes

Capture short diffs and test outputs here as implementation proceeds.

## Interfaces and Dependencies

The shared BuildMonitor utilities must live in packages/ui/monitoring/src/utils/buildMonitor.ts and be exported in packages/ui/monitoring/src/index.ts. Plugins must import them as @hierarchidb/ui-monitoring.

The download/auth registry APIs are provided by @hierarchidb/download (packages//src/pluginDownloadRegistry.ts). Plugins must call configurePluginDownloadDefaults, getPluginDownloadService, downloadArrayBuffer, downloadJson, postJson, authFetch, registerPluginAuthNotifier, and notifyPluginAuthRequired directly without plugin-local wrapper modules.

Plan change note: Initial survey proposed a new createPluginDownloadRegistry helper, but the user required eliminating thin wrapper layers. This plan therefore uses existing shared APIs directly and removes plugin-local wrappers instead.

Plan change note (2025-12-29): Updated Progress and Decision Log to reflect completed BuildMonitor migration, direct download/auth usage, and the new Location strategy registry module introduced to preserve behavior.
