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
    nodeId: NodeId;
    phase: SessionPhase;           // e.g. 'idle' | 'starting' | 'running' | 'pausing' | 'paused' | 'resuming' | 'finalizing' | 'completed' | 'failed'
    isActive: boolean;
    startedAt?: number;            // required after starting completes
    completedAt?: number;          // required for completed/failed
    stopReason?: string;           // e.g. 'user-pause' | 'failed' | 'completed' | 'route-leave'
    stageId?: StageId;             // current stage at time of event (undefined if no stage is active)
    inactiveMs?: number;           // cumulative session inactivity; absence means none recorded
    stageStartedAt?: number;       // required when stageId is present
    stageInactiveMs?: number;      // required when stageId is present
  };
};
```

**Timing contract**:

- `idle` and `starting` may omit session timing. Every later execution or terminal phase requires a finite, non-negative `startedAt`.
- `completed` and `failed` additionally require a finite, non-negative `completedAt`.
- When present, `inactiveMs` must be finite and non-negative. Its absence means that no session-level inactive interval was recorded; it is not a repair value supplied by the consumer.
- When both session endpoints are present, `completedAt - startedAt - inactiveMs` must be finite and non-negative. A violation throws.
- When `stageId` is present, `stageStartedAt` and `stageInactiveMs` are required and follow the stage timing contract below. When `stageId` is absent, both stage timing fields must also be absent.

**Normalized persistence boundary**:

- `buildSessionConfigs.startedAt` is the persisted session start endpoint.
- `buildSessionStatuses` owns session `status`, `completedAt`, `inactiveMs`, and `canResume`.
- A `buildStageStatuses` row owns the canonical `stage`, `startedAt`, and `inactiveMs` for that stage. Its optional stored `stageId` is an opaque persistence identifier and is never used as the event `stageId`; the event value is derived from the row's canonical `stage`.
- The compatibility read model derives `updatedAt` from the maximum persisted session, heartbeat, stage, and task timestamp. It never substitutes the read clock.
- Session reconstruction reads the normalized rows and tasks in a single database read transaction.
- Worker/API callers propagate persistence/query contract violations; only a successful `null` read means that no session exists. UI polling may report the error, but must not convert it into a missing-session result.
- A new stage row requires explicit `startedAt` and `inactiveMs`. A partial normalized session or missing stage timing is a contract violation; task-queue state and the current clock must not synthesize a replacement session.
- The current stage is the unique stage row with the greatest `startedAt`. Equal greatest timestamps are ambiguous persisted state and fail reconstruction instead of being resolved by stage order.

**UI-side effect**: Update `lifecycle.phase`, `lifecycle.isActive`, `lifecycle.startedAt`, `lifecycle.inactiveMs`, `lifecycle.completedAt`, and `lifecycleExtras.stopReason`. `stageId` drives the UI synchronization/selection signal. Per-stage timing is stored only from `stageSnapshotUpdated`, avoiding a second timing owner.

After `sessionStatusUpdated` selects a started stage and before the first authoritative
`stageSnapshotUpdated` for that stage arrives, the UI is in `ui-initializing`. The
status event still carries and validates `stageStartedAt` and `stageInactiveMs` as
required above, but those fields are not copied into the UI timing tree. Its
`stageId` updates the active-stage selection without advancing the stage UI sync
phase to `running`; only the corresponding stage snapshot completes that
handshake. The active-stage selection is valid during this interval, while
`stageTimingByStageAtom` does not yet own timing for the stage. Elapsed-time
consumers must therefore wait for the stage snapshot instead of requiring or
synthesizing timing in the UI tree. Once a stage snapshot is received, its explicit
timing is mandatory and is validated without fallback.

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
    nodeId: NodeId;
    heartbeatAt: number;           // timestamp (ms), must be finite
  };
};
```

**UI-side effect**: Update `lifecycleExtras.heartbeatAt` only. Must not trigger phase change or task list re-render.

**Constraint**: `heartbeatAt` must be a finite number. If not finite, throw — do not silently ignore.

---

### 3. `stageSnapshotUpdated`

Replaces: `taskSnapshotReceived`, `taskUpdated`, `taskDeleted`

**When emitted**: Whenever the Worker has a new authoritative task list for a stage that has already started. This includes:
- Initial snapshot on subscription start (only for stages that have started)
- After any task status change (the Worker sends the full updated list)
- When all tasks for a stage are removed (empty array)

**Not emitted**: For stages that have not yet started. A stage that has not started has no `stageStartedAt` and no tasks; emitting a snapshot for it would require a sentinel value, which is a contract violation.

**Payload**:

```typescript
type StageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated';
  payload: {
    stageId: StageId;
    tasks: TaskSummary[];          // full replacement — empty array means zero tasks
    stageStartedAt: number;        // timestamp when this stage first started (ms); required — only emitted after stage has started
    stageInactiveMs: number;       // cumulative inactive (paused) duration for this stage (ms)
    stageCompletedAt?: number;     // timestamp when this stage last completed (ms); undefined if currently active
  };
};
```

**UI-side effect**:
- Replace the entire task list for `stageId` (full replacement, not merge).
- Update `stageTimingByStageAtom[stageId]` with `{ stageStartedAt, stageInactiveMs, stageCompletedAt }`.

**Constraints**:

- All `task.progress` values must be finite numbers in `[0, 100]`.
- `stageStartedAt` and `stageInactiveMs` are required finite, non-negative numbers.
- When `stageCompletedAt` is present, it must be finite and non-negative, and `stageCompletedAt - stageStartedAt - stageInactiveMs` must be non-negative.
- Missing or invalid timing throws immediately. It must not be replaced with `Date.now()` / `0`, clamped, or silently skipped.
- `Date.now()` is allowed only as the actual current clock for a running duration, or as the explicit timestamp recorded when a stage starts.

**Stage elapsed time derivation (UI-side)**:

Completed durations in `stageDurationMsByStageAtom` are derived directly from `stageTimingByStageAtom`. The active stage duration is derived in the build-session progress hook using the current clock while running, or the persisted heartbeat/completion endpoint after execution stops:

```
end = stageCompletedAt when present
    | current clock while running
    | persisted heartbeat after pausing/stopping
duration = end - stageStartedAt - stageInactiveMs
assert finite(duration) and duration >= 0
```

An unstarted stage has `timing === null` and contributes `0`; no timing sentinel is generated. A started stage with missing or invalid timing throws instead of contributing `0`.

Session elapsed time uses the same fail-fast rule. `running` uses the current clock, `paused` requires the persisted heartbeat endpoint, and `completed` / `failed` require `completedAt`. The consumer never substitutes the current clock for a missing persisted endpoint.

---

### 4. `taskProgressUpdated`

Replaces: `progressReceived`

**When emitted**: When a parallel worker reports progress on a single task (0–100 value).

**Payload**:

```typescript
type TaskProgressUpdatedEvent = {
  type: 'taskProgressUpdated';
  payload: {
    taskId: string;                // identifies the specific task reporting progress
    version: number;               // monotonically increasing per taskId — used for per-task deduplication
    stageId: StageId;
    value: number;                 // finite, 0..100 — violation throws
    message?: string;
    metadata?: Record<string, unknown>;
  };
};
```

**UI-side effect**: Update `stageProgressAtom[stageId]` for the given `taskId`. Per-task deduplication: if a `taskProgressUpdated` event arrives with a `version` ≤ the last applied `version` for that `taskId`, it is dropped. Only the latest version per `taskId` is applied.

**Deduplication rule (per taskId)**:
- `version > lastAppliedVersion[taskId]` → accept and apply
- `version === lastAppliedVersion[taskId]` → drop (duplicate)
- `version < lastAppliedVersion[taskId]` → drop (stale, out-of-order delivery)

**Removed from payload**: `phase` (was previously included in `progressReceived` and erroneously retained in the design doc). Session phase is managed exclusively by `sessionStatusUpdated`. Mixing phase into progress events is the source of redundant phase updates.

**Design rationale**: The previous `lastAcceptedEventVersion` was a single monotonic counter shared across all event types, which incorrectly compared heartbeat timestamps against task versions. The correct fix is per-taskId version tracking, not removal of versioning entirely.

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

// Derived atom: completed durations only; active duration is computed by the UI hook.
const stageDurationMsByStageAtom = atom<Record<ShapeStageId, number>>((get) => {
  const timing = get(stageTimingByStageAtom);
  return {
    source: computeCompletedStageDuration(timing.source),
    geometry: computeCompletedStageDuration(timing.geometry),
    tileEmit: computeCompletedStageDuration(timing.tileEmit),
  };
});

const computeCompletedStageDuration = (timing: StageTiming | null): number => {
  if (!timing || timing.stageCompletedAt === undefined) return 0;
  const duration = timing.stageCompletedAt - timing.stageStartedAt - timing.stageInactiveMs;
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error('stage duration contract violation');
  }
  return duration;
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

## Worker API Subscription Interface

The canonical method name for subscribing to task progress events is **`subscribeTaskProgress`**. The legacy name `subscribeBuildProgress` is removed; it was misleading because:

- `BuildProgressEvent` is a legacy type that predates the 4-event canonical set.
- The actual payload delivered is `TaskProgressUpdatedEvent` (`type: 'taskProgressUpdated'`), not `BuildProgressEvent`.
- Using `subscribeBuildProgress` as the method name implied a broader "build progress" concept inconsistent with the single-task-progress semantics of this channel.

`WorkerAPI` must expose `subscribeTaskProgress` with the following signature:

```typescript
subscribeTaskProgress(
  nodeType: NodeType,
  nodeId: NodeId,
  callback: (event: TaskProgressUpdatedEvent) => void
): Promise<() => void>;
```

`subscribeBuildProgress` must be removed from `WorkerAPI`. Any call site that previously used `subscribeBuildProgress` must be updated to `subscribeTaskProgress`.

---

## Adapter Responsibilities

The `BuildSessionWorkerEventAdapter` translates raw Worker wire events into the 4 canonical UI events above. It is responsible for:

1. Filtering events by `nodeId` — events for other nodes are silently dropped.
2. Validating required numeric fields — non-finite values throw immediately (no fallback).
3. Mapping Worker-side status strings to `SessionPhase` — unknown values throw.
4. Splitting a multi-stage task snapshot into per-stage `stageSnapshotUpdated` events.

The state adapter itself does **not** store versions or perform deduplication. Before a
`taskProgressUpdated` event reaches the adapter, the UI delivery layer applies the
per-`taskId` version gate defined above through `UIEventBufferManager`. Accepted events
are then mapped into state; `taskId` and `version` are delivery metadata and are not
stored in the state tree.

`sessionStatusUpdated` and `stageSnapshotUpdated` are applied unconditionally in FIFO
arrival order. `heartbeat` is applied immediately. No global or cross-stream version
counter is used.

---

## Package Location of Event Types and Emitters

As of Issue #1143, the canonical event types and plugin-agnostic emitters have been lifted to shared packages:

### `@hierarchidb/build-api`

- `session-event-types.ts` — canonical type definitions:
  - `SessionPhase`, `SessionStatusUpdatedEvent`, `TaskSummary`, `StageSnapshotUpdatedEvent`, `HeartbeatEvent`, `WorkerLogEvent`, `CriticalErrorEvent`, `CanonicalSessionEvent`
- `progress-types.ts` — `TaskProgressUpdatedEvent` (includes `taskId` and `version` fields)

### `@hierarchidb/build-runtime-services`

- `eventStreamer.ts` — `UnconditionalEventStreamer` class and `unconditionalEventStreamer` singleton
- `eventEmission.ts` — plugin-agnostic emitters:
  - `emitTaskProgressUpdated(nodeId, taskId, version, stageId, value, message?, metadata?)`
  - `emitHeartbeat(nodeId, heartbeatAt)`

### `plugins/shape-plugin`

- `src/worker/api/eventBuffering.ts` — re-exports from `@hierarchidb/build-runtime-services`
- `src/worker/api/eventEmission.ts` — shape-plugin-specific emitters (depend on `ShapeBuildSessionRecord` / `VtTaskQueueDb`):
  - `emitSessionStatusUpdated(nodeId, sessionRecord)`
  - `emitStageSnapshotUpdated(nodeId, stage, stageStartedAt, stageInactiveMs, stageCompletedAt?)`
  - re-exports `emitTaskProgressUpdated` and `emitHeartbeat` from `@hierarchidb/build-runtime-services`
- `src/common/types/session-events.ts` — re-exports all canonical types from `@hierarchidb/build-api`
