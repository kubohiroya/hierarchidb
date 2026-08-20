# Build Session Terminology SSOT

## 1. Purpose

This document is the single source of truth (SSOT) for build-session terminology
used across runtime, worker API, UI, and plugin implementations.

## 2. Canonical Terms

### 2.1 Runtime Roles

- `BuildSessionOrchestrator`
  - Canonical name for the SharedWorker-side execution controller.
  - Responsibilities: queue arbitration, stage transitions, and stage-worker lifecycle.
- `TabSessionCoordinator`
  - Canonical role name for tab-level coordination only (lock/heartbeat/broadcast).
  - Current package name remains `@hierarchidb/session-coordinator` for compatibility.
  - It is not the execution orchestrator.

### 2.2 State Dimensions

- `persistedStatus`
  - Durable session state in storage (`buildSessionStatuses.status`).
- `runtimeStatus`
  - In-memory live runtime state for UI/runtime reflection.
- `stage`
  - Canonical build pipeline stage: `source | geometry | tileEmit`.
  - Legacy names such as `fetch | transform | vt` may describe historical artifacts,
    but must not be emitted as task or build-session event stages.
- `phase`
  - Progress lifecycle phase: `starting | running | pausing | paused | ...`.
- `taskType`
  - UI-facing aggregation key for task grouping/summaries.
- `stageId`
  - Canonical event stage identity: `source | geometry | tileEmit`.
  - It must agree with the canonical task `stage` when both fields are present.
  - Not a standalone orchestrator control-state key.

### 2.3 UI State Vocabulary

- `uiReady`
  - UI-side readiness after subscription negotiation is completed.
- `idle`
  - Session-side non-running state (do not overload with UI readiness meaning).
- `sessionRunning`
  - Session execution is active.
- `taskRunning`
  - At least one task item is executing.

### 2.4 Status Label Conventions

- Persisted value: `startAccepted` (DB/runtime data).
- UI label: `StartAccepted` (display term).
- Both terms must be used with this distinction.

## 3. API Naming Policy

### 3.1 Canonical Build API Names

- `startBuildSession`
- `pauseBuildSession`
- `cancelQueuedBuildSession`
- `subscribeStageSnapshots`
- `subscribeTaskProgress`
- `subscribeSessionState`
- `subscribeSessionHeartbeat`

Compatibility note:

- New UI/runtime code must use `startBuildSession` for both Start/Resume semantics.
- `resumeBuildSession` is removed from active build-session control interfaces.

### 3.2 Legacy Batch Aliases

- Legacy `*Batch*` identifiers are removed from the SharedWorker/build control surface.
- New code must call canonical `*Build*` names.
- New runtime/bridge/workflow code must not introduce temporary migration aliases.

## 4. Execution Semantics

- `Start` and `Resume` are a single execution path.
- There is no legacy "full vs incremental" mode split.
- Runtime behavior is always incremental re-evaluation from persisted state.

### 4.1 Control Vocabulary Constraints

- Canonical UI control intents are `start`, `pause`, and `cancel`.
- `Start` and `Resume` labels both map to `startBuildSession`.
- `Pause` and `Cancel` are distinct UI actions:
  - `Pause` -> `pauseBuildSession`
  - `Cancel` -> `cancelQueuedBuildSession` (runtime may treat running case as pause fallback).
- `retry` is not a build-session control command in this context.

### 4.2 Progress Stream Contract

- Build progress uses authoritative `stageSnapshotUpdated` full replacements plus
  `taskProgressUpdated` events as the UI SSOT.
- Task terminal status is owned by the authoritative stage snapshot. A progress value
  of `100` does not carry session phase or replace a terminal task status.
- `taskProgressUpdated.version` is monotonic per `taskId`; equal or lower versions are
  dropped. There is no global or cross-stream event sequence.

## 5. Migration Status (Current)

- `SessionManager` (doc term) -> `BuildSessionOrchestrator`: **adopted in build-session docs**.
- `SessionCoordinator` role -> `TabSessionCoordinator`: **export aliases adopted (`createTabSessionCoordinator`, `TabSessionCoordinator*`)**.
- `Batch*` -> `Build*`: **adopted for canonical references**. Shared runtime API exposes `*Build*` names only; new code should not add compatibility aliases.
- UI lock/runner arbitration by `session-coordinator`: **removed from shape build-step normal start/stop/progress path**.

## 6. Rules for New Changes

- Add new terminology only if it is required by distinct responsibility or state dimension.
- Update this document first, then update runtime/API/UI docs and code.
- Avoid introducing synonyms for already canonical terms.
