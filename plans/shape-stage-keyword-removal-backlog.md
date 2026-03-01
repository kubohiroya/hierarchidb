# Stage-Keyword Removal Backlog (Shape 5-Stage / Descriptor-Capability Migration)

This backlog tracks concrete code-level migration work to remove hard-coded stage keyword coupling (`fetch|transform|vt`) from orchestration-critical paths.

## 1. Objective

- Enforce descriptor/capability-driven orchestration.
- Keep runtime truth source as `stepId + capability + persistedStatus/runtimeStatus/phase`.
- Prevent re-introducing stage-keyword dispatch as implementation proceeds.

## 1.1 Stage-Key Migration Policy (Fixed)

- UI wording migration (`Fetch/Transform/VT` -> `Source/Geometry/TileEmit`) is allowed independently.
- Storage/API keys (`fetch|transform|vt`) remain stable during #655 for compatibility and scope control.
- New canonical identifiers (`source-stage|geometry-stage|tile-emit-stage`) must be accepted at adapter boundaries.
- Control truth must not depend on legacy display words; normalization adapters are boundary-only.
- Full key rename of persisted/API stage fields is a separate, explicit breaking-change task.
- Feature flags are prohibited for this migration; integration must be done by contract-first module replacement.

## 2. Scan Basis

Scan command used (2026-02-28 JST):

```sh
rg -n "\b(fetch|transform|vt)\b" packages/vt-orchestrator packages/runtime-worker plugins/shape-plugin app \
  --glob '!**/__tests__/**' --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/docs/**'
```

Notes:

- This backlog excludes tests and docs by default.
- UI labels/i18n copy are not first-class migration blockers unless they leak into dispatch/control decisions.

## 3. Priority Buckets

## P0 (must fix first: orchestration/control truth)

- `packages/vt-orchestrator/src/task/taskQueue.ts`
- `packages/vt-orchestrator/src/index.ts`
- `packages/vt-orchestrator/src/compareTaskOrder.ts`
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler/execute.ts`
- `packages/vt-orchestrator/src/vt/misc.ts`
- `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineFetchStage.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineTransformStage.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineVtStage.ts`
- `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`
- `plugins/shape-plugin/src/services/vt/shapeTaskCacheIdentity.ts`

Exit criteria:

- No dispatch/control branch depends on string comparison against `fetch|transform|vt`.
- Task lifecycle uses `stepId/capability` in execution logic.

## P1 (must follow P0: runtime/session mapping and API edge)

- `packages/runtime-worker/src/services/ShapeQueryService.ts`
- `packages/runtime-worker/src/services/ShapeMutationService.ts`
- `plugins/shape-plugin/src/services/build/shapeSessionMappers.ts`
- `plugins/shape-plugin/src/services/build/ShapeBuildAPIClient.ts`
- `plugins/shape-plugin/src/worker/api/api-internal-execution-core.ts`
- `plugins/shape-plugin/src/worker/api/api-internal-execution-metrics.ts`

Exit criteria:

- Runtime/session summaries do not require stage-keyword truth for control decisions.
- Any persisted legacy stage field is treated non-authoritatively.

## P2 (UI/control adapters and cache operations)

- `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel/.../useShapeBuildProgressPanelControllerBaseStateDataCore.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/shapeBuildProgressMapping.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/TaskItemCard.tsx`
- `plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/TaskItemDetailWindow.tsx`
- `plugins/shape-plugin/src/ui/hooks/useShapeBuildCacheActions/useShapeBuildCacheActions.helpers.ts`
- `plugins/shape-plugin/src/ui/hooks/useShapeBuildCacheActions/useShapeBuildCacheActions.handlers.ts`
- `plugins/shape-plugin/src/ui/components/country-selection/internal/selectionInvalidate.ts`

Exit criteria:

- UI-level display labels may keep human stage words.
- Control behavior must map from `stepId/capability` or normalized model, not hard-coded stage strings.

## P3 (cleanup / naming consistency)

- Remaining utility files with stage keyword literals where used only for display/reporting.
- Package-level config/story/test fixture drift.

Exit criteria:

- No keyword-coupled behavior remains outside pure display vocabulary.

## 4. Work Sequence

1. P0 orchestration truth removal.
2. P1 runtime/session projection cleanup.
3. P2 UI/control mapping alignment.
4. P3 cleanup and naming consistency.

## 5. Acceptance Checklist

- [ ] P0 files no longer use `fetch|transform|vt` for dispatch/control branching.
- [ ] Task queue records and scheduler logic remain deterministic under `stepId/capability` truth.
- [ ] Runtime/session contracts remain aligned with `build-session-terminology-ssot.md`.
- [ ] No compatibility projection function is introduced for `sessions.stage` in new logic.
- [ ] Regression tests cover descriptor/capability-driven execution path in at least one end-to-end shape session flow.

## 6. References

- `plans/shape-graph-5stage-pipeline-plan.md`
- `plans/shape-5stage-pure-function-spec.md`
- `plans/stage-rename-risk-audit-source-geometry-tileemit.md`
- `packages/runtime-worker/docs/build-session-terminology-ssot.md`
- `packages/runtime-worker/docs/build-session-orchestrator-state-transitions.md`

## 7. Revision Note

- 2026-02-28: Initial backlog created from keyword scan to guide staged migration away from stage-word-coupled control logic.
