# Shape Step4 Anomaly Guard Controls and Transform Retry Diagnostics

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained under `PLANS.md` requirements in the repository root.

## Purpose / Big Picture

After this change, users can explicitly configure and observe how Step4 transform simplification is executed (`topojson` or `geojson`), detect anomalous geometry outputs (triangle-like distortions), and automatically retry with safer simplification parameters. The behavior is visible through structured logs and new Step4 cards for Fetch, Transform, and VT.

## Progress

- [x] (2026-02-16 08:45 JST) Created issue #318, set Project status to In Progress, and created branch `codex/feat/shape/step4-anomaly-guard-controls`.
- [x] (2026-02-16 08:46 JST) Created this ExecPlan and aligned scope with approved DoD.
- [x] (2026-02-16 08:51 JST) Implemented build-config type extensions for Fetch/Transform/VT guard settings in `packages/gis-sdk/src/config.ts` and defaults in `packages/shape-api/src/defaults.ts`.
- [x] (2026-02-16 08:52 JST) Implemented Step4 UI cards for Fetch/Transform/VT and algorithm-specific control toggles.
- [x] (2026-02-16 08:54 JST) Added transform execution tracing logs and path classification (`resolveSimplifyExecutionPath`).
- [x] (2026-02-16 08:54 JST) Added anomaly scoring and auto-retry/fallback selection in transform handler, with route-like profiles skipping polygon repair.
- [x] (2026-02-16 08:55 JST) Added/updated tests and ran build/typecheck plus targeted vitest commands successfully.
- [x] (2026-02-16 08:55 JST) Updated `TASKS.md` operation log with success and blocked evidence.

## Surprises & Discoveries

- Observation: `createTransformByBandHandler.ts` already has extensive diagnostics, simplify retry for vertex limits, and post-simplify self-intersection repair.
  Evidence: file inspection around `simplify-only` section and vertex-limit retry block.
- Observation: workspace-wide `pnpm -w turbo run test --filter @hierarchidb/vt-orchestrator --filter @hierarchidb/shape-plugin` currently fails due unrelated pre-existing shape-plugin tests (`db.delete is not a function`).
  Evidence: failures in `shapeFetchStage.unit.test.ts` and `shapePipeline*` helper tests, while newly added targeted tests pass.

## Decision Log

- Decision: Extend the existing transform diagnostics path instead of introducing a separate transform pipeline.
  Rationale: Keeps risk low, preserves current behavior, and localizes changes to one stage handler.
  Date/Author: 2026-02-16 / Codex

## Outcomes & Retrospective

The implementation now provides Step4 controls and runtime observability for simplification path diagnosis, plus anomaly scoring and deterministic retry fallback in transform. The key user-visible gain is immediate path discrimination in logs between topojson and geojson routes and configurable anomaly suppression behavior. A remaining gap is unrelated legacy test instability in parts of shape-plugin test suite; targeted tests around the new behavior are green.

## Context and Orientation

`plugins/shape-plugin/src/ui/components/build-config/ShapeBuildConfigStep.tsx` composes Step4 cards in the order Fetch → Transform → VT. `TransformConfigSection.tsx` currently exposes algorithm selection but not anomaly controls. Runtime transform behavior is implemented in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, and build-config types are defined in `packages/gis-sdk/src/config.ts` with defaults in `packages/shape-api/src/defaults.ts`.

In this plan, “anomaly” means an output geometry that deviates beyond configured thresholds (for example, edge-length jump ratio, area drift, or unexpected self-intersections). “Auto-retry” means rerunning simplify with reduced tolerance and selecting a safer candidate by deterministic policy.

## Plan of Work

First, extend shared config types for three new control groups: Fetch intake guard, Transform anomaly detection/retry/logging, and VT output quality guard. Then, wire Step4 UI cards to these fields while preserving backward compatibility via defaults.

Next, add structured transform execution logs that always include algorithm, stage, tolerance, preserve-topology flag, and in/out counts. The logs must clearly indicate path differences (`topojson decode simplify + geojson simplify skip` vs `topojson decode only + geojson simplify run`).

Then, implement anomaly scoring on simplified results and auto-retry orchestration with configurable retries, tolerance scaling, and fallback mode. Keep shape/route shared in one path but apply polygon-only checks to shape-like geometries and line-focused checks to route-like geometries.

Finally, add targeted tests in `packages/vt-orchestrator` and `plugins/shape-plugin`, run required commands, and record outcomes.

## Concrete Steps

From repository root `/Users/hiroya/WebstormProjects/hierarchidb`:

1. Edit config/types/defaults.
2. Edit Step4 UI card components and step composition.
3. Edit transform handler and tests.
4. Run:
   pnpm -w turbo run build --filter @hierarchidb/gis-sdk --filter @hierarchidb/shape-api --filter @hierarchidb/vt-orchestrator --filter @hierarchidb/shape-plugin
   pnpm -w turbo run typecheck --filter @hierarchidb/gis-sdk --filter @hierarchidb/shape-api --filter @hierarchidb/vt-orchestrator --filter @hierarchidb/shape-plugin
   pnpm -w turbo run test --filter @hierarchidb/vt-orchestrator --filter @hierarchidb/shape-plugin

Expected: all commands exit 0.

## Validation and Acceptance

1. In Step4, selecting `topojson` and `geojson` changes visible controls as designed and persists after reload.
2. Running a transform task emits structured logs that explicitly show algorithm path and whether geojson simplify was skipped.
3. With anomaly detection and retry enabled, logs show retry attempts and final candidate selection reason.
4. Route-like input runs shared simplify path but skips polygon-only anomaly checks.

## Idempotence and Recovery

All changes are additive and can be reverted by commit revert. If retries cause regressions, set retry enabled to false in Step4 and rebuild to return to baseline behavior.

## Artifacts and Notes

- Issue: https://github.com/kubohiroya/hierarchidb/issues/318
- Branch: `codex/feat/shape/step4-anomaly-guard-controls`

## Interfaces and Dependencies

- Type definitions: `packages/gis-sdk/src/config.ts`
- Defaults: `packages/shape-api/src/defaults.ts`
- UI cards: `plugins/shape-plugin/src/ui/components/build-config/*`
- Runtime transform: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- Tests: `packages/vt-orchestrator/src/transform/__tests__/*`, `plugins/shape-plugin/src/__tests__/unit/*`

Revision note (2026-02-16 08:46 JST): Initial plan created from approved DoD and current codebase reconnaissance.
Revision note (2026-02-16 08:55 JST): Updated progress, discoveries, and outcomes after implementation and verification runs.
