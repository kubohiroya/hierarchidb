# Build Session Worker→UI Event Design

## Purpose

This document defines the canonical set of events that flow from the Worker to the UI
for a build session. It is the single source of truth for event naming, payload shape,
and the UI-side atom structure that consumes them.

The previous implementation had six overlapping event types
(`runtimeSnapshotReceived`, `sessionRecordReceived`, `taskSnapshotReceived`,
`taskUpdated`, `taskDeleted`, `progressReceived`) with unclear boundaries and a
`lastAcceptedEventVersion` field that mixed unrelated version spaces. This design
replaces them with four well-defined events.

---

## Event Taxonomy

### 1. `stageSnapshotUpdated`

**Concept**: Full replacement of the task list for one stage, plus timing metadata for
that stage. Sent whenever the Worker has a new authoritative view of a stage's tasks
(initial load, resume, or any structural change). An empty `tasks` array means all
tasks for that stage have been removed.

**Replaces**: `taskSnapshotReceived` + `taskUpdated` + `taskDeleted`

**Payload**:

| Field | Type | Description |
|---|---|---|
| `stageId` | `StageId` | Target stage |
| `tasks` | `TaskSummary[]` | Full task list for the stage (empty = all removed) |
| `stageStartedAt` | `number` | Unix ms — first time this stage was started in the current session |
| `stageInactiveMs` | `number` | Cumulative paused/inactive duration for this stage (ms) |
| `stageCompletedAt` | `number \| undefined` | Unix ms of most recent completion; `undefined` while the stage is active |

**UI effect**: Replace `tasksById` / `taskOrder` for the stage atomically. Update
`stageTimingByStageAtom` for the stage.

The Worker initializes `stageStartedAt` and `stageInactiveMs = 0` when the stage
actually starts. Snapshot emission then reads those persisted fields and validates
them; it never manufactures missing values. `stageStartedAt` and `stageInactiveMs`
must be finite and non-negative. If `stageCompletedAt` exists, the completed duration
must also be finite and non-negative. Invalid timing aborts emission.

---

### 2. `taskProgressUpdated`

**Concept**: Progress value for a single task, emitted by a parallel worker. Sent
frequently; it carries task identity and per-task ordering metadata alongside the
progress value, but does not carry lifecycle state.

**Replaces**: `progressReceived`

**Payload**:

| Field | Type | Description |
|---|---|---|
| `taskId` | `string` | Task whose progress is being reported |
| `version` | `number` | Monotonically increasing version scoped to `taskId` |
| `stageId` | `StageId` | Stage the task belongs to |
| `value` | `number` | Progress 0–100 (finite; outside range is a contract violation) |
| `message` | `string \| undefined` | Optional human-readable label |
| `metadata` | `Record<string, unknown> \| undefined` | Optional opaque metadata |

The UI delivery layer accepts an event only when its `version` is greater than the
last accepted version for the same `taskId`. Events with an equal or lower version are
dropped. The state adapter receives only accepted events and does not retain `taskId`
or `version` in the state tree.

**Note**: `phase` is intentionally absent. It was erroneously included in the original design. Session phase is managed exclusively by `sessionStatusUpdated`.

---

### 3. `sessionStatusUpdated`

**Concept**: A change in the session's lifecycle state (phase, stop reason, timing).
Sent on every state transition. Subsumes both the runtime record snapshot and the
session record notification, which carried identical responsibilities and were
redundantly separated.

**Replaces**: `runtimeSnapshotReceived` + `sessionRecordReceived`

**Payload**:

| Field | Type | Description |
|---|---|---|
| `nodeId` | `string` | Node this session belongs to |
| `phase` | `SessionPhase` | New lifecycle phase |
| `isActive` | `boolean` | Whether the session is currently executing |
| `startedAt` | `number \| undefined` | Unix ms — required after `starting` completes |
| `completedAt` | `number \| undefined` | Unix ms — required for `completed` / `failed` |
| `stopReason` | `StopReason \| undefined` | Why the session stopped (terminal/paused states) |
| `stageId` | `StageId \| undefined` | Current stage at time of event |
| `inactiveMs` | `number \| undefined` | Cumulative session inactivity; absence means none recorded |
| `stageStartedAt` | `number \| undefined` | Unix ms — required when `stageId` is present |
| `stageInactiveMs` | `number \| undefined` | Required when `stageId` is present |

**UI effect**: Update `lifecycleAtom` (phase, isActive, startedAt, inactiveMs,
completedAt) and `lifecycleExtrasAtom` (stopReason). `stageId` drives the UI
synchronization/selection signal. Per-stage timing remains owned by the
`stageSnapshotUpdated` path and is not duplicated from this event.

**Note**: `heartbeatAt` is intentionally absent. Heartbeat timing is carried only by
the `heartbeat` event to avoid polluting this event with high-frequency data.

Session timing is validated at both emission and UI adapter boundaries. `idle` and
`starting` may omit timing; later phases require `startedAt`; terminal phases require `completedAt`; all supplied timing
values must be finite and non-negative. Any available interval must produce a finite,
non-negative duration. The UI uses the current clock only for `running`, the persisted
heartbeat for `paused`, and `completedAt` for terminal phases. Missing persisted
endpoints are contract violations, not reasons to fall back to `Date.now()`.

The normalized persistence boundary follows the same ownership rules. The session
config row owns `startedAt`; the session status row owns `status`, `completedAt`,
`inactiveMs`, and `canResume`; and each stage status row owns its canonical `stage`, `startedAt`, and
`inactiveMs`. The optional persisted stage-row `stageId` remains opaque. Worker/UI
events derive their canonical `stageId` from the row's `stage` field. The compatibility
read model derives `updatedAt` as the maximum of persisted session, heartbeat, stage,
and task timestamps, without consulting the read clock. A partial normalized session
or orphan heartbeat/stage row fails at the persistence/query boundary, as does missing
timing for a started stage. The current stage is the unique row with the greatest
`startedAt`; a tie at that greatest timestamp is an ambiguous persisted state and
fails reconstruction. Session reconstruction reads its normalized rows and tasks
in one database transaction; the task queue and current clock do not synthesize a
replacement record.

Failure persistence is secondary to the originating execution error. If persisting
a startup failure also fails, the persistence error is logged while the original
startup error remains the rejected value. Terminal-state finalization errors are
reported separately and are never reclassified as pipeline failures.

---

### 4. `heartbeat`

**Concept**: Periodic liveness signal from the Worker. Sent frequently (≈1 s). Must
carry only the minimum information needed to confirm the Worker is alive and update
the last-seen timestamp.

**Replaces**: `onHeartbeat` callback (previously tunnelled through
`runtimeSnapshotReceived`, which was wasteful)

**Payload**:

| Field | Type | Description |
|---|---|---|
| `heartbeatAt` | `number` | Unix ms — timestamp of this heartbeat |

**UI effect**: Update `heartbeatAt` in `lifecycleExtrasAtom` only. Must not trigger
any phase or task recalculation.

---

## Removed Concepts

| Removed | Reason |
|---|---|
| `taskUpdated` | Merged into `stageSnapshotUpdated` (single-task array) |
| `taskDeleted` | Merged into `stageSnapshotUpdated` (empty array) |
| `lastAcceptedEventVersion` in `meta` | Mixed unrelated version spaces; removed from state shape |
| `Received` suffix on event names | Receiver-perspective naming; replaced with past-tense verb phrases |

---

## UI-Side Atom Changes (shape-plugin)

### New base atom: `stageTimingByStageAtom`

```
stageTimingByStageAtom: Record<ShapeStageId, StageTiming | null>
```

Updated by `stageSnapshotUpdated`. Holds the raw timing fields from the event payload.

```typescript
type StageTiming = {
  stageStartedAt: number;
  stageInactiveMs: number;
  stageCompletedAt: number | undefined;
};
```

### New derived atom: `stageDurationMsByStageAtom`

Derived from `stageTimingByStageAtom`. No React state or ref.

Calculation per stage:

- Unstarted or active (`timing === null` or `stageCompletedAt === undefined`): `0`
- Completed: `stageCompletedAt - stageStartedAt - stageInactiveMs`

The completed duration must be finite and non-negative or the atom throws. The active
stage duration is calculated by the build-session progress hook from the same persisted
stage timing plus the current clock (`running`) or persisted endpoint (`paused` /
terminal). It is not stored in React state or a ref.

### Updated call site: `useShapeBuildStepLogic.impl.ts`

```typescript
// Before
sessionStageDurationByStageSnapshot: null,

// After
sessionStageDurationByStageSnapshot: useAtomValue(stageDurationMsByStageAtom),
```

---

## Task Classification

These definitions are used when computing progress counters and remaining-time
estimates.

| Term | Definition |
|---|---|
| `recycled` | `sourceCacheMeta` has a stale record AND `sourceCache` has a valid record → processing was skipped, result reused. Excluded from active task counts via `isExcludedTask`. |
| `skipped` | `sourceCacheMeta` has a fresh record AND `sourceCache` has no valid record → processing ran but produced no output. Counted as `done` (not an error). |
| `done` | `completed` + `skipped` tasks. Used as the numerator in progress and remaining-time calculations. |

### Remaining-time estimate

```
averageMs = elapsedMs / (done - recycled)
remainingMs = averageMs × (total - done - recycled)
```

`recycled` tasks are excluded from both the elapsed-time denominator and the
remaining-count numerator because no processing time was spent on them.

`done` = `completed` + `failed` + `skipped`. Failed tasks are counted as done because processing time was spent on them and they will not be retried in the current session.

---

## Event Version Ordering

There is no global or cross-stream `eventVersion` counter.

`taskProgressUpdated` uses `version` only as a per-`taskId` ordering key in the UI
delivery layer. An event is accepted when its version is greater than the last accepted
version for that task; equal or lower versions are dropped. This gate runs before
`BuildSessionWorkerEventAdapter`, so the adapter itself stores no version state.

`sessionStatusUpdated` and `stageSnapshotUpdated` are applied unconditionally in FIFO
arrival order. `heartbeat` is applied immediately on receipt.

---

## Non-Goals

- This document does not define the Worker-side emission logic or transport layer.
- This document does not define the `BuildSessionStateTreeAtoms` internal structure.
- Backward compatibility shims are explicitly out of scope; the old event names are
  deleted, not aliased.
