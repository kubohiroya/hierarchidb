# Stabilize Shape Build Session Startup and Build a Test Pyramid

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained in accordance with `PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, a user can clear IndexedDB, re-authenticate, start a Shape build from Step 5, and see startup transition into task processing without getting stuck in `awaiting-first-task` and timing out at 45 seconds. The system will also have stronger automated coverage: unit tests for startup signal detection, integration-level hook coverage for task subscription behavior, and a reproducible E2E path for UX validation.

## Progress

- [x] (2026-02-13 08:56 JST) Created GitHub Issue #238 and moved it to Project `hierarchidb` status `In Progress`.
- [x] (2026-02-13 08:56 JST) Created branch `codex/fix/shape/build-session-comprehensive-stability` and updated `TASKS.md`.
- [x] (2026-02-13 09:10 JST) Identified startup-risk points: `awaiting-first-task` signal criteria and `requestAnimationFrame`-only flush path in task sync.
- [x] (2026-02-13 09:17 JST) Implemented task flush fallback timer in `useShapeBuildTaskSync.ts`.
- [x] (2026-02-13 09:20 JST) Implemented broader first-task signal handling in `useShapeBuildStep.ts`.
- [x] (2026-02-13 09:23 JST) Added/updated unit tests for first-task signal and flush fallback.
- [x] (2026-02-13 11:20 JST) Added decision-function unit tests and stale-subscriber race tests; ran target shape-plugin tests (24 passed).
- [ ] Run target package typecheck/build and collect evidence.
- [x] (2026-02-13 11:20 JST) Added integration harness around build start transition and first-task observation.
- [x] (2026-02-13 12:00 JST) Validated Create Shape Step5 startup path with Chrome DevTools MCP (`localhost:4200`) and captured payload evidence.
- [x] (2026-02-13 12:14 JST) Ran Playwright E2E with explicit auth seed (`E2E_AUTH_ACCESS_TOKEN`) and `/auth/verify` precheck; scenario passed without startup timeout.
- [x] (2026-02-13 12:50 JST) Added `pnpm e2e:shape-startup` wrapper and local auth-seed file support (`e2e/.auth/shape-startup-auth.json`), including fail-fast checks for missing seed.
- [x] (2026-02-13 15:20 JST) Added `task stream ready` gating so `awaiting-first-task` does not finalize on uninitialized `taskCount` (undefined), and updated unit/integration coverage.
- [ ] Update this plan with final outcomes and retrospective.

## Surprises & Discoveries

- Observation: Startup timeout detection depends on UI-observable task/progress signals, not only worker session start response.
  Evidence: `useShapeBuildStep.ts` transitions to `awaiting-first-task` after successful `session-start-request` and times out if no qualifying signal appears.

- Observation: Task UI commit used `requestAnimationFrame` only, which can delay or suppress state propagation under frame throttling.
  Evidence: `useShapeBuildTaskSync.ts` had no timeout fallback path before this change.

- Observation: Playwright isolated context does not reuse the already-authenticated local browser session in this environment.
  Evidence: `e2e/shape/shape-build-startup-first-task.spec.ts` failed at startup with `Authentication required`, while the same scenario in MCP real browser succeeded.

- Observation: Playwright can validate the startup path reliably when a real session token is injected explicitly.
  Evidence: Running the E2E with `E2E_AUTH_ACCESS_TOKEN` + `/auth/verify` precheck passed and confirmed no `awaiting-first-task` timeout.

- Observation: Raw token copy/paste is error-prone (character corruption), which can produce false `401` failures.
  Evidence: A malformed copied token failed `/auth/verify`; switching to base64 seed fields removed transfer errors.

## Decision Log

- Decision: Treat queued-task visibility and progress meta (`progressTaskId` or `total > 0`) as valid “first task observed” signals.
  Rationale: Prevent false startup timeout when worker has already created/queued tasks but no running/completed task has arrived yet.
  Date/Author: 2026-02-13 / Codex

- Decision: Add timeout fallback to task flush scheduling in addition to `requestAnimationFrame`.
  Rationale: Ensure task updates reach React state even when frame callbacks are throttled or paused.
  Date/Author: 2026-02-13 / Codex

## Outcomes & Retrospective

- Startup decision logic for `awaiting-first-task` is now testable as a pure function and covered by unit tests.
- Subscription race cases (node mismatch and stale subscriber after node switch) are now covered by unit tests.
- MCP real-browser verification on `localhost:4200` confirmed one run with no `awaiting-first-task` timeout:
  - `start session response` reported `running`.
  - `awaiting-first-task` finished with `success` (`completed-without-generating-tasks`, 48ms).
  - No `build session transition timeout` log in that run.
- Remaining risk: automated Playwright E2E cannot yet assert the same path due to auth isolation (`Authentication required`).
- Remaining risk: local/CI environments need explicit auth-seed provisioning (`E2E_AUTH_ACCESS_TOKEN`, optional userinfo/id token) because browser-session reuse is unavailable by default.
- Remaining risk: auth seeds can expire; tests now fail fast with explicit messages when seed is missing/invalid.

## Context and Orientation

The startup and progress path is split across three layers.

`plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts` controls startup transition phases such as lock acquisition, worker initialization, session start request, and `awaiting-first-task` timeout logic.

`plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTasks.ts` subscribes to worker task events and periodically reconciles snapshots.

`plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts` normalizes, merges, and commits task updates into UI state.

Worker task subscriptions are provided by `plugins/shape-plugin/src/worker/api.ts` via `subscribeToTasks`, which emits an initial snapshot and then update/delete events.

## Plan of Work

Keep startup resilient by changing only two behavior pivots. First, broaden first-task observation rules so startup exits `awaiting-first-task` when the build queue is demonstrably alive (queued task or progress task metadata), not only when running/completed tasks appear. Second, make task-state commit independent from frame cadence by adding a timer fallback to the existing frame-based batching.

Then lock these behaviors with tests:

1. A pure unit test for startup-signal detection logic.
2. A hook test proving updates still surface when `requestAnimationFrame` callbacks do not run.
3. Existing task-subscription tests remain green.

Finally, keep state-transition documentation synchronized with test reality by marking arrows with `✅/❌/❓` and updating status as new tests are added.

## Concrete Steps

Run from repository root (`/Users/hiroya/WebstormProjects/hierarchidb`):

    pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/awaitingFirstTaskSignal.unit.test.ts src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx
    pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin --filter @hierarchidb/app
    pnpm -w turbo run build --filter @hierarchidb/shape-plugin --filter @hierarchidb/app

E2E path (after adding/refreshing spec):

    pnpm -w turbo run e2e --filter @hierarchidb/app -- --grep "Shape Step5 startup"

## Validation and Acceptance

Acceptance is behavior-first:

1. Startup no longer fails with `Build did not start task processing (awaiting-first-task, 45s)` under the repro path.
2. Progress panel receives task/progress signals and stays in processing flow.
3. New unit tests pass and prevent regression of startup-signal and task-flush behavior.
4. State transition document reflects tested/untested edges with `✅/❌/❓`.

## Idempotence and Recovery

All code changes are additive and safe to re-run tests repeatedly. If regressions appear, revert the focused files below:

- `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/awaitingFirstTaskSignal.ts`
- related test files

Rollback restores prior startup behavior while preserving issue-level traceability.

## Artifacts and Notes

Current implementation files changed in this milestone:

- `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/awaitingFirstTaskSignal.ts`
- `plugins/shape-plugin/src/ui/__tests__/hooks/unit/awaitingFirstTaskSignal.unit.test.ts`
- `plugins/shape-plugin/src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx`
- `plugins/shape-plugin/docs/DIALOG_FLOW_AND_STATE_TRANSITIONS.md`

## Interfaces and Dependencies

`hasAwaitingFirstTaskSignal` now acts as the startup-signal policy boundary for `awaiting-first-task` handling.

Task flush scheduling in `useShapeBuildTaskSync.ts` now uses both frame and timer channels. Frame path remains primary for smooth batching; timer path guarantees forward progress when frame callbacks are unavailable.

No external API contract changes are introduced in worker bridge or worker API.

---
Revision note (2026-02-13, Codex): Created initial ExecPlan and synchronized it with the first implementation milestone (startup-signal broadening and flush fallback).
