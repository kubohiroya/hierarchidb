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
dropped. Shape's plugin-owned adapter receives only accepted events and does not
retain the delivery key. The shared UI bridge retains `taskId` and the greatest
accepted task version in its state tree so a delayed lower-version snapshot cannot
lower the progress gate. The delayed snapshot still owns task membership, ordering,
and status; the newer accepted progress value, message, metadata, and version remain.

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

The interval between selecting a started stage and receiving its first
`stageSnapshotUpdated` event is represented by `ui-initializing`. During that
interval, `sessionStatusUpdated` still carries and validates its required stage
timing fields. Its `stageId` updates selection but does not advance UI sync to
`running`; only the matching stage snapshot completes that handshake. The
selection therefore exists without copying the status event timing into the UI
timing tree, and elapsed-time calculation stays pending. The consumer must not
manufacture stage timing from the current clock or from session timing. After the
snapshot arrives, its explicit timing becomes the only input to stage elapsed-time
calculation.

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
events derive their canonical `stageId` from the row's `stage` field. The derived
session read model computes `updatedAt` as the maximum of persisted session, heartbeat, stage,
and task timestamps, without consulting the read clock. A partial normalized session
or orphan heartbeat/stage row fails at the persistence/query boundary, as does missing
timing for a started stage. The current stage is the unique row with the greatest
`startedAt`; a tie at that greatest timestamp is an ambiguous persisted state and
fails reconstruction. Session reconstruction reads its normalized rows and tasks
in one database transaction; the task queue and current clock do not synthesize a
replacement record.

Legacy normalized rows that predate the required stage `inactiveMs` field use an
explicit recovery path rather than a compatibility read. The strict reader throws
`ShapeBuildSessionContractError` with a serializable details object, while
`ShapeQueryAPI.probeBuildSession` exposes that object as a discriminated result for
transport. The probe catches only `LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING`; unrelated
contract violations remain rejected calls.

The atom bridge probes before loading the runtime record or opening subscriptions.
When recovery is available, it dispatches the UI-internal `criticalError` with the
exact descriptor and stops initialization. The confirmation dialog is presentation
state only. Cancelling it does not mutate the session atom tree and does not call the
Worker. Confirming passes the descriptor and
`RESET_LEGACY_BUILD_SESSION_AND_TASKS` to the Worker mutation API.

The mutation API re-probes inside the same Dexie read-write transaction that deletes
the target node's four normalized session tables plus `buildTasks`. It compares every
descriptor field before deleting. Cache, error, relation, artifact, output, node, and
draft/config stores are outside that transaction and remain untouched. The UI resets
the SSOT atom tree only after command success, then increments a recovery revision;
the atom bridge includes that revision in its effect dependencies so the unchanged
nodeId is initialized again. No missing timing value is repaired or synthesized.

Failure persistence is secondary to the originating execution error. If persisting
a startup failure also fails, the persistence error is logged while the original
startup error remains the rejected value. Terminal-state finalization errors are
reported separately and are never reclassified as pipeline failures.

Country-selection invalidation uses the same fail-fast ownership at the UI command
boundary. Its artifact cleanup runs before draft persistence and obsolete session
deletion. A rejection dispatches the UI-internal `criticalError`, forces the SSOT
lifecycle to `failed`, and leaves the previous selection baseline unchanged so a
later selection change can retry the same idempotent cleanup. Only complete command
success advances that baseline. This remains UI-internal and does not extend the four
canonical Worker events.

Pause uses the same strict ownership. The runtime first emits `pausing`, aborts the
nodeId session through the AbortController stored in the SSOT state-tree entry, and
awaits the actual pipeline Promise. Only after that Promise has settled and no live
worker/job remains may interrupted tasks be re-queued and `paused` be emitted. On
timeout, the Worker persists `failed` and rejects the pause command with a typed
shutdown-timeout error. The UI command handler translates that rejection into the
UI-internal `criticalError` event; `criticalError` is not a fifth Worker event. A
timeout is never a pseudo-`paused` state.
Rewriting `running` task rows before shutdown confirmation is prohibited because it
would make a task-count poll falsely report that execution drained. Late work from a
timed-out run is stale and cannot update tasks, session state, cache, or artifacts.
The Shape implementation retains exactly one active `{ promise, abortController,
runId }` tuple per node. Its Worker deadline is 15 seconds and rejects with
`ShapeBuildPauseShutdownTimeoutError` (`SHAPE_BUILD_PAUSE_SHUTDOWN_TIMEOUT`), while
the UI command deadline remains longer so the typed Worker failure wins the race.
The tuple remains owned through the terminal pause-state write, preventing a
replacement run from entering between pipeline settlement and `paused` persistence.
After timeout, the invalidated tuple remains reserved until its real Promise settles.
The runtime clears the internal pause flag before publishing the failed state, and a
replacement start fails before planning or any task/cache/session mutation while the
invalidated tuple remains reserved.

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

## Shared UI Bridge

`useBuildSessionStateTreeBridge` subscribes to the four canonical channels as a single
lifecycle-owned subscription. Shape selects the Worker bridge transport. Route and
Location currently run their canonical managers in the UI realm and explicitly select
the same-realm event-streamer transport. There is no implicit fallback between these
transports. The same-realm streamer remains live-only, so its UI subscription must be
mounted before the local session starts. The bridge does not call the legacy aggregate
progress hook or reconstruct task counts from `sessionStatusUpdated`.

The bridge keeps lifecycle readiness and per-stage snapshot readiness distinct.
Receiving a session status selects the active stage but leaves progress absent until
that stage's authoritative snapshot arrives. A snapshot with an empty task array is
therefore distinguishable from a stage whose snapshot has not arrived.

Task progress may race ahead of the first stage snapshot. The bridge validates and
buffers such events, applies them after the full replacement snapshot, and rejects
equal or older task-scoped versions. Contract-invalid phase timing, stage timing,
task versions, or progress values fail at the event boundary.

The UI-facing progress snapshot is a derived read model. Its task counts come only
from the authoritative task state for the active stage, so starting a later stage does
not retain completed earlier-stage tasks in the denominator. Its timestamp is the
maximum available persisted session, heartbeat, or stage endpoint. The bridge never
creates a current clock timestamp or zero-count compatibility payload for missing
canonical data.

Route and Location UI consumers use this derived snapshot directly. Shape UI keeps
its plugin-owned SSOT state tree but no longer converts
`BuildUnifiedProgressInfo` through the removed aggregate mappers. The removed
aggregate hooks are not exported by `@hierarchidb/ui-build-sessions`.

The shared Route progress hook is a read-only same-realm consumer. It does not reuse
the Worker command hook for pause or resume because those commands would target a
different session owner. Route pipeline controls must be provided by the UI-realm
owner when that command contract is implemented.

Shape subscribes to Worker diagnostics separately with
`BuildWorkerBridge.subscribeWorkerLog`. Worker log events remain outside the four
canonical channels and are never reduced into the build-session SSOT state tree.

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

`taskProgressUpdated` uses `version` only as a per-`taskId` ordering key. An event is
accepted when its version is greater than the last accepted version for that task;
equal or lower versions are dropped. Shape's `UIEventBufferManager` runs this gate
before `BuildSessionWorkerEventAdapter`. The shared UI bridge compares against the
greatest task version retained in its authoritative state tree and buffers events that
arrive before the first snapshot. A delayed lower-version snapshot updates membership,
ordering, and status without lowering that retained progress version or its associated
progress fields. Neither path uses a global event-version value.

`sessionStatusUpdated` and `stageSnapshotUpdated` are applied unconditionally in FIFO
arrival order. `heartbeat` is applied immediately on receipt.

---

## Non-Goals

- This document does not define the Worker-side emission logic or transport layer.
- This document does not define the `BuildSessionStateTreeAtoms` internal structure.
- Backward compatibility shims are explicitly out of scope; the old event names are
  deleted, not aliased.
