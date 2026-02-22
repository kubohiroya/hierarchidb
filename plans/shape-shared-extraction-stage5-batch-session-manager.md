# Stage 5: Align Batch Session Managers on Shared Base

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, shape, location, and route batch session managers share a consistent base for lifecycle control (pause, resume, cancel, status, progress emission). This makes behavior predictable and reduces duplicate logic across plugins. The change is visible through consistent progress status behavior and by passing plugin typechecks and targeted tests.

## Progress

- [ ] (2025-12-26 10:55 JST) Draft plan created; implementation not started.

## Surprises & Discoveries

- Observation: Shape implements a fully custom session manager with persistent DB updates, while location uses a lighter in-memory approach and route has its own orchestration classes.
  Evidence: `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/location-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/route-plugin/src/services/RouteBatchSessionOrchestrator.ts`.

## Decision Log

- Decision: Use `packages/build-runtime-services/src/BaseBatchSessionManager.ts` as the shared base and align plugin managers to it.
  Rationale: The base already models session lifecycle and progress callbacks and is intended for shared batch behavior.
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

Pending. This section will summarize what was achieved and any remaining gaps after implementation.

## Context and Orientation

The batch session manager is the component that creates sessions, owns lifecycle controls, and emits progress events. Shape stores sessions in a Dexie-backed DB; location stores in an ephemeral DB; route uses orchestrator classes and worker bridge operations. The shared base class in `packages/build-runtime-services` already supports pause/resume/cancel/status and progress emission via `emitProgress`.

Key files:

- `packages/build-runtime-services/src/BaseBatchSessionManager.ts`
- `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`
- `plugins/location-plugin/src/services/batch/BatchSessionManager.ts`
- `plugins/route-plugin/src/services/RouteBatchSessionOrchestrator.ts`
- `plugins/shape-plugin/src/services/batch/ShapeBatchSession.ts`
- `plugins/location-plugin/src/services/batch/LocationBatchSession.ts`
- `plugins/route-plugin/src/services/RouteBatchSession.ts`

A “session manager” in this plan is a class that creates and registers batch sessions and exposes control APIs used by worker bridge or UI.

## Plan of Work

Refactor each plugin’s session manager to extend `BaseBatchSessionManager` and to register sessions via the shared `registerSession` method. The plugin-specific session classes (shape/location/route) should remain responsible for actual processing and progress updates, but should call a base method to emit progress. Any plugin-specific persistence (Dexie or ephemeral DB) should stay in the plugin layer and be invoked in lifecycle hooks. This stage should introduce minimal behavioral changes and focus on consolidating shared lifecycle and progress wiring.

## Concrete Steps

1) Review `BaseBatchSessionManager` and identify the minimal methods each plugin must implement: `startBatchSession`, plus any plugin-specific getters needed by UI or worker API.

2) Update shape’s `BatchSessionManager` to extend `BaseBatchSessionManager`:

   - Use `registerSession` to store the session and set up progress forwarding.
   - Replace manual `progressCallbacks` with `emitProgress`.
   - Keep Dexie persistence in place by updating session records when status changes.

3) Update location’s `BatchSessionManager` to extend `BaseBatchSessionManager`:

   - Adapt its `createSession` to `startBatchSession` and ensure it registers the session.
   - Preserve the ephemeral DB persistence in `EphemeralLocationDB`.

4) For route, decide whether `RouteBatchSessionOrchestrator` should be the session manager or if a new `RouteBatchSessionManager` should be created that extends the base and delegates to the orchestrator. Document the decision in the Decision Log and update the implementation accordingly.

5) Ensure progress events emitted by sessions are aligned with `BatchProgressEvent` so `BaseBatchSessionManager` can forward them consistently.

6) Update any worker API bindings or tests that depend on plugin-specific manager signatures.

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/build-runtime-services typecheck` and expect exit code 0.
- Run `pnpm --filter @hierarchidb/shape-plugin typecheck`, `pnpm --filter @hierarchidb/location-plugin typecheck`, and `pnpm --filter @hierarchidb/route-plugin typecheck` and expect exit code 0.
- If available, run any existing batch manager unit tests in the plugins to confirm progress events are still emitted.

## Idempotence and Recovery

The refactor can be iterated. To rollback, restore the original session manager implementations and remove any new base-class inheritance, then re-run the typechecks.

## Artifacts and Notes

Expected class outline after refactor:

  export class ShapeBatchSessionManager extends BaseBatchSessionManager {
    async startBatchSession(nodeId: NodeId): Promise<BatchSessionId> {
      // Create session, registerSession, persist, return id
    }
  }

## Interfaces and Dependencies

- Base class: `BaseBatchSessionManager` in `packages/build-runtime-services`.
- Session classes must implement progress listener registration for `registerSession` to hook into.
- Plugin-specific persistence and configuration remain in plugin packages.
