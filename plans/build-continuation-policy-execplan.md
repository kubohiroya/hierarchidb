# Wire build continuation policy into Shape batch execution

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

Users can choose a build continuation policy in the TreeConsole settings (finish all stages, finish stage then stop, or stop on first error). After this change, that policy affects the Shape build pipeline so failures no longer always stop the run immediately. Success is observable by running a Shape build with each policy and seeing the stage behavior match the selection.

## Progress

- [x] (2026-01-17 20:00 JST) Confirm where buildContinuationPolicy is stored and where batch execution is triggered.
- [x] Extend Worker API start/resume calls to carry buildContinuationPolicy.
- [x] Update Shape batch worker to accept the policy and apply it to pipeline execution.
- [x] Apply policy to stage failure handling and stage-to-stage continuation logic.
- [x] Run pnpm typecheck and capture results in TASKS.md.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: N/A.

## Decision Log

- Decision: Map finish_all_stages to failureHandling=continue and allow progression even with failed tasks.
  Rationale: The policy name implies all stages should run regardless of errors.
  Date/Author: 2026-01-17 / Codex.

- Decision: Map finish_stage_then_stop to failureHandling=continue, but halt before the next stage if any failures occurred.
  Rationale: Allows a full stage run while preventing later stages from running on bad inputs.
  Date/Author: 2026-01-17 / Codex.

- Decision: Map stop_on_first_error to failureHandling=stop and halt the pipeline when a failure is recorded.
  Rationale: Matches the existing "stop" failure handling semantics.
  Date/Author: 2026-01-17 / Codex.

## Outcomes & Retrospective

- Completed policy wiring from TreeConsole settings through Worker API into Shape pipeline.
- `pnpm typecheck` exit 0 (tsdown define warnings noted in TASKS.md).

## Context and Orientation

TreeConsole settings persist buildContinuationPolicy in localStorage and the toolbar exposes a selector. Shape build sessions are started through the Worker API and executed in the Shape worker pipeline (`runShapePipeline`). The pipeline uses `runStageTasks` with a `failureHandling` flag but currently always passes `stop` and always continues to the next stage. This plan wires the policy from UI to Worker and uses it to decide `failureHandling` and whether to proceed to the next stage.

Key files to modify:

- `packages/common/api/src/WorkerAPI.ts` for start/resume signatures.
- `packages/ui/worker-client/src/workerBridge.ts` for forwarding the policy.
- `app/src/worker-runtime/worker.ts` for passing policy into shape batch API.
- `plugins/shape-plugin/src/ui/components/step5/useBatchSessionActions.ts` for retrieving the policy and calling Worker API.
- `plugins/shape-plugin/src/worker/api.ts` for accepting the policy and passing it to `runShapePipeline`.
- `plugins/shape-plugin/src/services/vt/shapePipeline.ts` and `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts` for applying failure handling and stage continuation.

## Plan of Work

First, extend the Worker API and worker bridge functions to accept an optional BuildContinuationPolicy parameter. Then, when the Shape build UI starts or resumes a batch session, load the current TreeConsole setting and include it in the Worker API call. Next, adjust the Shape worker’s startBatchProcess and resume pipeline to pass the policy into `runShapePipeline`. Finally, in the pipeline, map the policy to `failureHandling` and add explicit logic to stop before the next stage when failures are present and the policy demands it.

## Concrete Steps

Run these commands from the repository root:

  rg -n "buildContinuationPolicy" app packages plugins

Edit the files listed in Context and Orientation to pass policy end-to-end. After code changes, run:

  pnpm typecheck

Record exit code and warnings in TASKS.md under task 2242.

## Validation and Acceptance

- With finish_all_stages, a Transform failure should still allow the VT stage to be scheduled if tasks exist.
- With finish_stage_then_stop, a Transform failure stops before VT, but Transform tasks complete to the end of the queue.
- With stop_on_first_error, a Transform failure stops the stage early and halts the pipeline.
- `pnpm typecheck` exits 0.

## Idempotence and Recovery

Edits are source-only and safe to repeat. If compilation fails, revert the impacted file and re-apply the change in smaller steps. Rollback is a single revert of the change set.

## Artifacts and Notes

- Capture a short log snippet for each policy showing the stage progression.
- Capture the `pnpm typecheck` exit 0 summary line.

## Interfaces and Dependencies

Use existing BuildContinuationPolicy from `@hierarchidb/build-api` and FailureHandling from `@hierarchidb/vt-orchestrator`. Do not introduce new dependencies or new settings storage.

---

Plan change log: 2026-01-17 created initial ExecPlan for wiring build continuation policy into Shape execution.
