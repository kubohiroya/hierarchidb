# Build Session Worker→UI Event Specification

## Purpose

This document defines the canonical set of events flowing from the SharedWorker to the UI layer for build session state management. It serves as the single source of truth for event design, payload contracts, and UI-side atom update rules.

## Background and Motivation

The current implementation uses six event types (`runtimeSnapshotReceived`, `sessionRecordReceived`, `taskSnapshotReceived`, `taskUpdated`, `taskDeleted`, `progressReceived`) with overlapping responsibilities and a shared `lastAcceptedEventVersion` counter that conflates version spaces across unrelated event streams. This causes:

- `runtimeSnapshotReceived` and `sessionRecordReceived` carry identical semantic responsibility (session lifecycle phase change) but are handled separately, creating dual code paths with no meaningful distinction.
- `taskUpdated` and `taskDeleted` are redundant: the Worker always has the authoritative full task list for a stage, so incremental mutations are unnecessary complexity. A full replacement snapshot is always correct and simpler.
- `lastAcceptedEventVersion` is a single monotonic counter shared across all event types. Because different event streams (heartbeat, task snapshot, progress) use different version spaces (e.g., `heartbeatAt` timestamp vs. task `version` field), comparing them against a single counter produces incorrect deduplication.
- `heartbeat` is sent at 1-second intervals and must not carry session phase or task data, as doing so causes unnecessary re-renders and serialization overhead.

## Canonical Event Set (4 types)

### 1. `sessionStatusUpdated`

Replaces: `runtimeSnapshotReceived`, `sessionRecordReceived`

**When emitted**: Any time the session lifecycle phase changes, or when the initial runtime snapshot is loaded on subscription start.

**Payload**:

```typescript
type SessionStatusUpdatedEvent = {
  type: 'sessionStatusUpdated';
  payload: {
    nodeId: string;
    phase: SessionPhase;           // e.g. 'idle' | 'starting' | 'running' | 'pausing' | 'paused' | 'resuming' | 'finalizing' | 'completed' | 'failed'
    isActive: boolean;
    startedAt?: number;            // session start timestamp (ms)
    completedAt?: number;          // session end timestamp (ms, terminal states only)
    stopReason?: string;           // e.g. 'user-pause' | 'failed' | 'completed' | 'route-leave'
  };
};
```

**UI-side effect**: Update `lifecycle.phase`, `lifecycle.isActive`, `lifecycle.startedAt`, `lifecycle.completedAt`, `lifecycleExtras.stopReason`.

**Deduplication**: None. Every emission is applied unconditionally. The caller (adapter) is responsible for not emitting duplicate events.

---

### 2. `heartbeat`

Replaces: `onHeartbeat` (previously tunneled through `runtimeSnapshotReceived`)

**When emitted**: Every ~1 second while the session is active.

**Payload**:

```typescript
type HeartbeatEvent = {
  type: 'heartbeat';
  payload: {
    nodeId: string;
    heartbeatAt: number;           // timestamp (ms), must be finite
  };
};
```

**UI-side effect**: Update `lifecycleExtras.heartbeatAt` only. Must not trigger phase change or task list re-render.

**Constraint**: `heartbeatAt` must be a finite number. If not finite, throw — do not silently ignore.

---

### 3. `stageSnapshotUpdated`

Replaces: `taskSnapshotReceived`, `taskUpdated`, `taskDeleted`

**When emitted**: Whenever the Worker has a new authoritative task list for a stage. This includes:
- Initial snapshot on subscription start
- After any task status change (the Worker sends the full updated list)
- When all tasks for a stage are removed (empty array)

**Payload**:

```typescript
type StageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated';
  payload: {
    stageId: StageId;
    tasks: TaskSummary[];          // full replacement — empty array means zero tasks
    stageStartedAt: number;        // timestamp when this stage first started (ms)
    stageInactiveMs: number;       // cumulative inactive (paused) duration for this stage (ms)
    stageCompletedAt?: number;     // timestamp when this stage last completed (ms); undefined if currently active
  };
};
```

**UI-side effect**:
- Replace the entire task list for `stageId` (full replacement, not merge).
- Update `stageTimingByStageAtom[stageId]` with `{ stageStartedAt, stageInactiveMs, stageCompletedAt }`.

**Constraint**: All `task.progress` values must be finite numbers in `[0, 100]`. Violation throws immediately.

**Stage elapsed time derivation (UI-side)**:

`stageDurationMsByStageAtom` is a derived atom computed from `stageTimingByStageAtom` and `elapsedTickMsAtom`:

```
if stageCompletedAt is defined:
  duration = stageCompletedAt - stageStartedAt - stageInactiveMs
else (stage is active):
  duration = now - stageStartedAt - stageInactiveMs
```

This replaces the previous `sessionStageDurationByStageSnapshot` prop (which was always `null`) and the `completedStageDurationMsByStage` React state in `useShapeBuildStepProgressState`.

---

### 4. `taskProgressUpdated`

Replaces: `progressReceived`

**When emitted**: When a parallel worker reports progress on a single task (0–100 value).

**Payload**:

```typescript
type TaskProgressUpdatedEvent = {
  type: 'taskProgressUpdated';
  payload: {
    stageId: StageId;
    value: number;                 // finite, 0..100 — violation throws
    message?: string;
    metadata?: Record<string, unknown>;
  };
};
```

**UI-side effect**: Update `stageProgressAtom[stageId].value` and `.message` / `.metadata`.

**Removed from payload**: `phase` (was previously included in `progressReceived`). Session phase is managed exclusively by `sessionStatusUpdated`. Mixing phase into progress events was the source of redundant phase updates.

---

## Removed Events

| Removed event | Reason |
|---|---|
| `runtimeSnapshotReceived` | Merged into `sessionStatusUpdated` |
| `sessionRecordReceived` | Merged into `sessionStatusUpdated` |
| `taskSnapshotReceived` | Replaced by `stageSnapshotUpdated` |
| `taskUpdated` | Replaced by `stageSnapshotUpdated` (full replacement) |
| `taskDeleted` | Replaced by `stageSnapshotUpdated` (empty array = full delete) |
| `progressReceived` | Renamed to `taskProgressUpdated`; `phase` field removed |

---

## Removed State

| Removed field | Reason |
|---|---|
| `meta.lastAcceptedEventVersion` | Single counter across unrelated version spaces is semantically incorrect. Each event stream has its own ordering guarantee; cross-stream deduplication is not needed. |

---

## Non-Worker Events (UI-internal, unchanged)

These events are dispatched internally by the UI and are not part of the Worker→UI contract:

| Event | Purpose |
|---|---|
| `taskStreamConnectionChanged` | WebSocket/SharedWorker connection state |
| `viewSelectionChanged` | Active stage tab / selected task |
| `uiSyncPhaseChanged` | UI initialization handshake per stage |
| `criticalError` | Contract violation detected in UI layer |
| `reset` | Full state reset on nodeId change |

---

## UI Atom Changes Required

### New atoms

```typescript
// Base atom: updated by stageSnapshotUpdated
type StageTiming = {
  stageStartedAt: number;
  stageInactiveMs: number;
  stageCompletedAt?: number;
};
const stageTimingByStageAtom = atom<Record<ShapeStageId, StageTiming | null>>({
  source: null,
  geometry: null,
  tileEmit: null,
});

// Derived atom: computed from stageTimingByStageAtom + elapsedTickMsAtom
const stageDurationMsByStageAtom = atom<Record<ShapeStageId, number>>((get) => {
  const timing = get(stageTimingByStageAtom);
  const now = get(elapsedTickMsAtom);
  return {
    source: computeStageDuration(timing.source, now),
    geometry: computeStageDuration(timing.geometry, now),
    tileEmit: computeStageDuration(timing.tileEmit, now),
  };
});

const computeStageDuration = (timing: StageTiming | null, now: number): number => {
  if (!timing) return 0;
  const end = timing.stageCompletedAt ?? now;
  return Math.max(0, end - timing.stageStartedAt - timing.stageInactiveMs);
};
```

### Changed call site

In `useShapeBuildStepLogic.impl.ts`, replace:

```typescript
sessionStageDurationByStageSnapshot: null,
```

with:

```typescript
sessionStageDurationByStageSnapshot: useAtomValue(stageDurationMsByStageAtom),
```

### Reset

`resetBuildSessionStateAtom` must also reset `stageTimingByStageAtom` to its initial value (`{ source: null, geometry: null, tileEmit: null }`).

---

## Task Status Definitions

| Status | Meaning |
|---|---|
| `queued` | Waiting to be processed |
| `running` | Currently being processed |
| `completed` | Processed successfully with a result artifact |
| `failed` | Processed with an error |
| `skipped` | Processed but produced no result artifact (not an error); counted in `done` |
| `recycled` | Not processed because a valid cached artifact already exists; excluded from elapsed time calculation |

**Remaining time estimation**: When computing average time-per-task for remaining time estimation, `recycled` tasks are excluded from the denominator. `skipped` tasks are included in `done` count.

---

## Adapter Responsibilities

The `BuildSessionWorkerEventAdapter` translates raw Worker wire events into the 4 canonical UI events above. It is responsible for:

1. Filtering events by `nodeId` — events for other nodes are silently dropped.
2. Validating required numeric fields — non-finite values throw immediately (no fallback).
3. Mapping Worker-side status strings to `SessionPhase` — unknown values throw.
4. Splitting a multi-stage task snapshot into per-stage `stageSnapshotUpdated` events.

The adapter does **not** perform deduplication or version gating. That responsibility is removed.
