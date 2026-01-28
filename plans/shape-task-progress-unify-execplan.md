# Unify shape task progress model and sequence ordering

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with PLANS.md at the repository root.

## Purpose / Big Picture

This change removes drift between task progress stored in the database, progress events emitted by the worker, and progress displayed in the UI. After this change, all progress updates are normalized into a single status vocabulary and ordered by `sequence` rather than timestamps, eliminating the “completed↔running” flicker. A user can see stable task summaries and consistent ordering during long running builds. Success is visible through stable task lists and passing tests.

## Progress

- [x] (2026-01-27 00:40 JST) Read PLANS.md and locate existing task progress handling paths.
- [x] (2026-01-29 00:52 JST) Add sequence-first task ordering helper and apply it for lastActivity/lastProcessed; add unit test coverage.
- [ ] Define the canonical status/phase set and sequence ordering rules.
- [x] (2026-01-29 00:58 JST) Update progress summary to use effective task status and sequence-based ordering helpers.
- [ ] Update UI consumers to interpret the canonical model consistently.
- [ ] Add/adjust tests for ordering and status normalization.
- [x] (2026-01-29 01:02 JST) Run tests: pnpm --filter @hierarchidb/shape-plugin test (6 files, 9 passed, 1 skipped).

## Surprises & Discoveries

- Observation: shape-plugin test run failed due to geoboundaries.org ENOTFOUND in the full-flow headless spec.
  Evidence: pnpm --filter @hierarchidb/shape-plugin test (fetch failed in smartFetch).

## Decision Log

- Decision: Use `sequence` as the sole ordering field for task updates, even when timestamps are present.
  Rationale: UpdatedAt is only millisecond resolution and has caused regressions in ordering and UI flicker.
  Date/Author: 2026-01-27 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

Task progress originates from worker task execution in `@hierarchidb/vt-orchestrator`, is persisted in a task queue DB, and is surfaced in the UI via shape-plugin hooks (`plugins/shape-plugin/src/ui/components/step5` and related). Past issues include out-of-order updates when `updatedAt` is used for ordering, and transient UI flicker when a task appears to move backward. This plan unifies the status vocabulary and ordering rules used in worker emission, DB persistence, and UI consumers.

## Plan of Work

First, locate the canonical task record type in the worker and DB. Identify the existing status strings and where they are converted to UI phases. Then define a single set of statuses and phases (e.g., queued/running/completed/failed/skipped) and a mapping to UI display states. Adjust the worker emission so that every update includes a monotonically increasing `sequence`. Update database writes to preserve the `sequence` and stop using `updatedAt` for ordering or filtering. Update the UI to sort and apply updates by `sequence` only. Finally, add or update tests to cover ordering and ensure no regressions.

## Concrete Steps

1) Locate task record types and update emission points.

   Review files:
     - plugins/shape-plugin/src/services/** (task queue updates, worker stage handlers)
     - packages/vt-orchestrator/src/** (task queue schema and event emission)
     - plugins/shape-plugin/src/ui/components/step5/** (task list and summary)

2) Define the canonical status/phase mapping in a shared module within shape-plugin or a shared package if already used.

3) Update worker emission and DB persistence to set and preserve `sequence` and canonical status fields.

4) Update UI sorting and state reconciliation to use `sequence` only. Remove any fallback to `updatedAt`.

5) Update tests that assert ordering or status behavior. Add a test that feeds out-of-order `updatedAt` but ordered `sequence` and ensures UI ordering is stable.

6) Run checks.

   Working directory: repository root
   Commands:
     pnpm --filter @hierarchidb/shape-plugin typecheck
     pnpm --filter @hierarchidb/shape-plugin test

   Expected result:
     Exit code 0; task ordering tests pass.

7) Update TASKS.md with start/update/done and include command outcomes.

## Validation and Acceptance

Acceptance is satisfied when task ordering is stable under rapid updates, task statuses do not regress, and tests for ordering pass. A human can verify by running a build and observing that completed tasks do not flip back to running during progress updates.

## Idempotence and Recovery

All steps are code refactors that are safe to repeat. If an update breaks task ordering, revert the changes in the shared status/ordering module and restore previous sorting logic.

## Artifacts and Notes

- Expect to update worker emission, DB persistence, and UI ordering in tandem.
- Example verification:
  pnpm --filter @hierarchidb/shape-plugin test
  ...exit 0...

## Interfaces and Dependencies

- Task update payloads must include `sequence` and canonical `status`.
- UI sorting and reconciliation must use `sequence` as the primary key for ordering.
- No new dependencies are required.

Revision note: Initial plan created to unify task progress model and sequence ordering.
