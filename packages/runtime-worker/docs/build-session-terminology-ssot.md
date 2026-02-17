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
  - Durable session state in storage (`sessions.status`).
- `runtimeStatus`
  - In-memory live runtime state for UI/runtime reflection.
- `stage`
  - Build pipeline stage: `fetch | transform | vt | idle | undefined`.
- `phase`
  - Progress lifecycle phase: `starting | running | pausing | paused | ...`.
- `taskType`
  - UI-facing aggregation key for task grouping/summaries.
- `stageId`
  - Diagnostic identifier only (trace/log category), not a control-state key.

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
- `resumeBuildSession`
- `cancelQueuedBuildSession`
- `subscribeBuildProgress`

### 3.2 Legacy Batch Aliases

- `*Batch*` method names are compatibility aliases.
- New code must call canonical `*Build*` names.
- Aliases can stay temporarily but should be marked deprecated in API definitions.

## 4. Execution Semantics

- `Start` and `Resume` are a single execution path.
- There is no `resumeMode: full|incremental`.
- Runtime behavior is always incremental re-evaluation from persisted state.

## 5. Migration Status (Current)

- `SessionManager` (doc term) -> `BuildSessionOrchestrator`: **adopted in build-session docs**.
- `SessionCoordinator` role -> `TabSessionCoordinator`: **concept adopted, package rename not done**.
- `Batch*` -> `Build*`: **in progress** (canonical aliases exist; many legacy names remain).
- UI lock/runner arbitration by `session-coordinator`: **being reduced; remaining usages are phased out incrementally**.

## 6. Rules for New Changes

- Add new terminology only if it is required by distinct responsibility or state dimension.
- Update this document first, then update runtime/API/UI docs and code.
- Avoid introducing synonyms for already canonical terms.
