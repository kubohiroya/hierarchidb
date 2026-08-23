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
    pausedAt?: number;             // required only for paused
    stopReason?: string;           // 'route-leave' | 'user-pause' | 'auth-required' | 'failed' | 'completed' | 'unknown'
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
- `paused` additionally requires a finite, non-negative `pausedAt`; every other phase must omit it.
- When present, `inactiveMs` must be finite and non-negative. Its absence means that no session-level inactive interval was recorded; it is not a repair value supplied by the consumer.
- When both session endpoints are present, `completedAt - startedAt - inactiveMs` must be finite and non-negative. A violation throws.
- For `paused`, `pausedAt - startedAt - inactiveMs` must be finite and non-negative. A violation throws.
- When `stageId` is present, `stageStartedAt` and `stageInactiveMs` are required and follow the stage timing contract below. When `stageId` is absent, both stage timing fields must also be absent.

**Normalized persistence boundary**:

- `buildSessionConfigs.startedAt` is the persisted session start endpoint.
- `buildSessionStatuses` owns session `status`, `completedAt`, `inactiveMs`, and `canResume`.
- A `buildStageStatuses` row owns the canonical `stage`, `startedAt`, and `inactiveMs` for that stage. Its optional stored `stageId` is an opaque persistence identifier and is never used as the event `stageId`; the event value is derived from the row's canonical `stage`.
- The derived session read model computes `updatedAt` from the maximum persisted session, heartbeat, stage, and task timestamp. It never substitutes the read clock.
- Session reconstruction reads the normalized rows and tasks in a single database read transaction.
- Worker/API callers propagate persistence/query contract violations; only a successful `null` read means that no session exists. UI polling may report the error, but must not convert it into a missing-session result.
- A new stage row requires explicit `startedAt` and `inactiveMs`. A partial normalized session or missing stage timing is a contract violation; task-queue state and the current clock must not synthesize a replacement session.
- The current stage is the unique stage row with the greatest `startedAt`. Equal greatest timestamps are ambiguous persisted state and fail reconstruction instead of being resolved by stage order.

**Explicit recovery for legacy normalized rows**:

- A persisted stage row whose `inactiveMs` is absent remains a strict read failure. The persistence reader throws `ShapeBuildSessionContractError` with code `LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING`, the affected node, field path, stage-row id, and canonical stage.
- Because transport serialization does not preserve custom `Error` fields, `ShapeQueryAPI.probeBuildSession` returns a serializable discriminated result. It catches only the typed recoverable error; every other query/contract error is rethrown.
- The atom bridge runs this probe before requesting the runtime snapshot or subscribing. A recoverable result is converted into the UI-internal `criticalError` event with its recovery descriptor and terminates `ui-initializing` as `failed`. It does not add a fifth Worker event.
- Recovery requires an explicit user confirmation and the literal `RESET_LEGACY_BUILD_SESSION_AND_TASKS`. Cancellation sends no command and changes neither persistence nor the SSOT state tree.
- The Worker recovery command re-probes and compares the descriptor inside one read-write transaction, then deletes only the target node's `buildSessionConfigs`, `buildSessionHeartbeats`, `buildSessionStatuses`, `buildStageStatuses`, and `buildTasks` rows. A changed/missing error or invalid confirmation aborts without deletion.
- Source/geometry/tile caches, geometry errors, tile relations, artifacts, outputs, node data, and draft/config data are not transaction participants and are preserved.
- Only after the transaction succeeds does the UI reset the SSOT state tree and increment its recovery revision. The bridge depends on that revision so the same nodeId is probed and subscribed again.
- Supplying `0`, the current clock, a migration, or a compatibility fallback for missing stage inactivity is prohibited.

**UI-side effect**: Update `lifecycle.phase`, `lifecycle.isActive`, `lifecycle.startedAt`, `lifecycle.inactiveMs`, `lifecycle.completedAt`, and `lifecycleExtras.stopReason`. For `paused`, apply `pausedAt` as the session and active-stage elapsed endpoint in the same SSOT atom update that applies the phase; rendering paused must not depend on another event channel arriving first. `stageId` drives the UI synchronization/selection signal. Per-stage timing is stored only from `stageSnapshotUpdated`, avoiding a second timing owner.

**Shape cache/result count synchronization**:

- The Shape cache actions UI observes the canonical lifecycle atom. It must not keep a second lifecycle status in React state, poll the Worker for status, or use a count query as a lifecycle source.
- It loads counts once when a node is first observed. After that, it reloads exactly once for each newly observed `completed` or `failed` outcome and once when queued cancellation is represented by `idle` with `stopReason`.
- `paused` does not trigger a count reload. Any non-outcome phase re-arms outcome detection so consecutive sessions can each refresh; duplicate events and re-renders for the same outcome do not refresh again.
- A node switch or newer request invalidates an older count response. Both request generation and the currently rendered `nodeId` must match before count results or loading state are committed.
- Counts are read through the Shape query APIs and task-queue API boundary. UI-side direct Dexie access or a compatibility fallback is prohibited.

**Build input source synchronization**:

- Runtime start commands carry `inputSource: 'committed' | 'working-copy'`. The Worker reads only the corresponding `TreeNode.data` or `TreeNode.draftData` slot before invoking the plugin canonical build API.
- Runtime/session list records may expose `inputSource` so queue, resume, and auth-required restarts can reuse the original source within the same runtime. Consumers must not infer `working-copy` from UI context.
- Legacy persisted session records that predate `inputSource` do not have a recoverable source owner. Restarting such records must explicitly choose `committed`; it must not inspect `draftData` as a convenience fallback.
- Worker→UI event payloads do not carry the raw build payload. Payload validation and route selection resolution happen before task/session event emission.

**Canonical runtime record synchronization**:

- Runtime/session list records carry `nodeType` as well as `nodeId`. UI queue, auth host, and external runner consumers must treat the pair as the runtime identity.
- `revision` is monotonic per `nodeType + nodeId`. Consumers may use it to drop older snapshots for the same pair, but must not compare revisions across different node types.
- Unsupported node types and malformed runtime records are contract errors. Worker bridge consumers must not convert them to an empty list, `null`, or a successful unsubscribe-only subscription.
- `isActive` is derived from canonical runtime status, not from UI-local pending state. UI-local pending state can only drive control loading and duplicate-command prevention.

**Pause completion contract**:

- Shape accepts only its canonical stop-reason set. `auth-required` means source planning, the active pipeline, or the auth-dialog host required an authenticated request before processing could continue. Planning failures persist it before pipeline start; active-pipeline failures persist it only after confirmed drain. In both cases it is emitted as `paused / canResume=true`, and only the auth-dialog host resumes it after authentication succeeds. It is not converted to `route-leave`.
- A pause request emits `pausing` after abort has been requested, while the pipeline is still shutting down.
- `paused` may be emitted only after the session's pipeline Promise has settled, no worker/job remains live, and tasks interrupted by the confirmed abort have been re-queued.
- The same transaction that persists `paused` also persists the explicit pause-completion timestamp as `buildSessionHeartbeats.lastHeartbeatAt`. `sessionStatusUpdated(paused)` must carry that exact value as `pausedAt`; the Worker also emits the same value through `heartbeat`. The UI applies `phase=paused` and `pausedAt` atomically and never relies on cross-channel delivery order.
- A UI-local pending pause action may drive control loading and duplicate-command prevention only. It must not synthesize a paused lifecycle or select paused elapsed-time semantics before `sessionStatusUpdated(paused)` is accepted.
- Task rows must not be changed from `running` to `queued` before runtime shutdown is confirmed. A task-count query cannot prove shutdown after those rows have been rewritten.
- If shutdown confirmation exceeds the configured timeout, the Worker persists `failed` and rejects the pause command with a typed shutdown-timeout error. The UI command handler converts that rejection into the UI-internal `criticalError` event. The Worker must not emit a fifth canonical event, emit `paused`, set `canResume=true`, or continue cache/artifact writes for that run.
- A late completion from the timed-out run is stale and must not mutate task/session state or artifacts.
- A failed pause clears the Worker-internal pause flag before reporting `failed`; runtime probes must not observe a synthetic paused state after the failure.
- While an invalidated run remains unsettled, a replacement start must fail before planning, task reset, cache cleanup, session mutation, or event emission begins.
- Shape uses a 15-second Worker shutdown deadline, which is shorter than the UI command deadline. The rejected error is named `ShapeBuildPauseShutdownTimeoutError` and carries code `SHAPE_BUILD_PAUSE_SHUTDOWN_TIMEOUT`; transport consumers must preserve or inspect the error name rather than infer success from elapsed time.

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

The Shape producer connects its stage-snapshot subscription to the authoritative task
queue. It records only the last emitted canonical task status and stage as
delivery-deduplication metadata; the task queue remains the source of truth. A
queued/running/completed/failed/recycled transition, or deletion of a known task,
schedules a serialized full snapshot using start and inactive timing from the latest
valid snapshot for that stage. Updates that do not change task status do not trigger
another full snapshot. If no valid timing has been observed, the producer waits for
the required initial/stage-start snapshot instead of inventing timing values. When
every task in a non-empty authoritative snapshot is terminal, `stageCompletedAt` is
the greatest persisted task `completedAt`. Active and empty snapshots keep it absent;
missing or invalid terminal-task completion timing is a contract violation.

An initial-subscription read or a serialized status-triggered snapshot failure is
published on the Worker log channel with its stage context. Detached subscription
Promises must not turn this failure into an unhandled rejection.

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
- Each persisted task version must be a positive integer and each task status/display kind must be supported. The producer validates the stored row before summary mapping; legacy version normalization is not part of the canonical event boundary.
- Each full task summary preserves the persisted optional `display` and `message` fields. In particular, `status='completed'` with `display.kind='skip'` remains a skipped outcome in the UI and must not be reclassified as ordinary completed work.
- `stageStartedAt` and `stageInactiveMs` are required finite, non-negative numbers.
- When `stageCompletedAt` is present, it must be finite and non-negative, and `stageCompletedAt - stageStartedAt - stageInactiveMs` must be non-negative.
- Missing or invalid timing throws immediately. It must not be replaced with `Date.now()` / `0`, clamped, or silently skipped.
- `Date.now()` is allowed only as the actual current clock for a running duration, as the explicit timestamp recorded when a stage starts, or as the explicit heartbeat endpoint emitted immediately before persisting a confirmed `paused` session.

**Stage elapsed time derivation (UI-side)**:

Completed durations in `stageDurationMsByStageAtom` are derived directly from `stageTimingByStageAtom`. The active stage duration is derived in the build-session progress hook using the current clock while running, or the persisted heartbeat/completion endpoint after execution stops:

```
end = stageCompletedAt when present
    | current clock while running
    | persisted heartbeat after pausing/stopping
duration = end - stageStartedAt - stageInactiveMs
assert finite(duration) and duration >= 0
```

Because `sessionStatusUpdated(paused)` carries `pausedAt`, the UI can apply the paused phase and its elapsed endpoint in one SSOT update. The separate `heartbeat` event may still arrive, but it must carry the same persisted endpoint and is not required for the paused render to avoid a missing end timestamp. The UI must not substitute the current clock or invent a heartbeat.

An unstarted stage has `timing === null` and contributes `0`; no timing sentinel is generated. A started stage with missing or invalid timing throws instead of contributing `0`.

Session elapsed time uses the same fail-fast rule. `running` uses the current clock, `paused` requires the persisted pause-completion heartbeat endpoint emitted by the Worker after the active pipeline has settled and before the `paused` session status is emitted, and `completed` / `failed` require `completedAt`. The consumer never substitutes the current clock, an earlier periodic heartbeat, or any invented endpoint for a missing pause-completion endpoint.

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

## Canonical UI Consumption Boundary

- `@hierarchidb/ui-build-sessions` consumes only the four canonical channels:
  `sessionStatusUpdated`, `stageSnapshotUpdated`, `taskProgressUpdated`, and
  `heartbeat`. Shape and Route select the explicit
  `BuildWorkerBridge.subscribeAll` transport. Location currently executes its
  canonical manager in the UI realm and selects the explicit same-realm
  `unconditionalEventStreamer` transport. The kernel never falls back from one
  transport to the other.
- Shape, Route, and Location worker modules nevertheless register the same exact
  `canonicalBuildAPI` export for SharedWorker dispatch. Registration establishes the
  common command/query/subscription contract; moving the current Route and Location
  UI-owned execution path to that transport is a separate migration. Runtime bootstrap
  never resolves a plugin-specific build API name or listener fallback.
- Runtime list/control surfaces use the node-type keyed
  `CanonicalBuildRuntimeAdapter` registry. `BuildSessionRuntimeRecord.nodeType` is
  required and must match the adapter key. Unsupported node types and contract-invalid
  records are surfaced as typed runtime errors; consumers must not convert them to
  empty queues or missing sessions.
- Route canonical progress and commands use the Worker-owned canonical API. Location
  command ownership remains separate while its build manager is UI-realm owned.
- Shape Worker diagnostics remain outside the canonical state tree and are subscribed
  independently through `BuildWorkerBridge.subscribeWorkerLog`.
- The same-realm streamer is live-only and does not buffer or replay events. A
  same-realm UI consumer must establish its subscription before starting the local
  build session. Late mounting must not be treated as an empty or idle session.
- A `sessionStatusUpdated` event updates lifecycle state only. It never creates an
  aggregate progress record with zero task counts.
- `isActive` must match the lifecycle phase defined by `build-session-spec.md`;
  inconsistent phase/activity pairs fail at the UI event boundary.
- UI progress remains absent until both an authoritative session status and the
  matching active-stage `stageSnapshotUpdated` event have arrived. An explicit
  empty snapshot is the only canonical representation of a started stage with zero
  tasks.
- A task progress event received before its stage snapshot is buffered. After the
  snapshot arrives, the UI applies only versions greater than the task version in
  the authoritative snapshot or the last accepted progress event.
- Progress timestamps are derived from explicit persisted session, heartbeat, and
  stage timing endpoints. Missing timing is never replaced with `Date.now()`, zero,
  clamping, or an aggregate-progress compatibility payload.
- Derived task counts come from the authoritative snapshot for the active stage only.
  Completed snapshots from earlier stages do not remain in the current stage's
  denominator. `recycled` tasks are excluded because they consume no processing time.
- The legacy UI aggregate hooks and mappers
  (`useBuildProgressState`, `usePluginBuildProgress`,
  `useUnifiedBuildSessionProgress`, and `buildSessionStatusMapper`) are not part
  of the public UI package surface.

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

## Non-Worker Events (UI-internal)

These events are dispatched internally by the UI and are not part of the Worker→UI contract:

| Event | Purpose |
|---|---|
| `taskStreamConnectionChanged` | WebSocket/SharedWorker connection state |
| `viewSelectionChanged` | Active stage tab / selected task |
| `uiSyncPhaseChanged` | UI initialization handshake per stage |
| `criticalError` | Critical UI-command or contract failure, including selection-triggered artifact cleanup failure; optionally carries a serializable legacy-session recovery descriptor |
| `reset` | Full state reset on nodeId change or after a successful explicit recovery |

The optional `criticalError.payload.recovery` is the exact descriptor returned by
`probeBuildSession`. It is stored in `lifecycleExtras.criticalError.recovery`; the UI
must not reconstruct it from an error message. A successful recovery uses the
dedicated completion write atom to reset session state and increment the recovery
revision atomically from the UI's perspective. A plain `reset` does not increment
that revision.

Selection-triggered artifact invalidation is a UI command path, not a fifth Worker
event. If its strict cleanup coordinator rejects, the UI dispatches `criticalError`,
sets the SSOT lifecycle to `failed`, and keeps the previous selection baseline. The
baseline advances only after cleanup, draft persistence, and obsolete build-session
deletion all succeed. Startup or pipeline cleanup failures instead follow the Worker
failure-persistence path and become the canonical failed `sessionStatusUpdated` state.

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

`resetBuildSessionStateAtom` must also reset `stageTimingByStageAtom` to its initial value (`{ source: null, geometry: null, tileEmit: null }`). The successful-recovery write atom invokes that reset and then increments `buildSessionRecoveryRevisionAtom`; cancellation invokes neither operation.

When reset produces `phase=idle` and an empty authoritative task tree, the UI must
exclude any React-retained task snapshot in that same render. Deferred effect cleanup
may release the retained snapshot afterward, but it must not temporarily reconstruct a
terminal display status against the reset session timing.

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

The canonical method for subscribing to task progress events is
**`subscribeTaskProgress`**. It carries `TaskProgressUpdatedEvent` values and does not
provide an aggregate progress subscription surface.

`WorkerAPI` must expose `subscribeTaskProgress` with the following signature:

```typescript
subscribeTaskProgress(
  nodeType: NodeType,
  nodeId: NodeId,
  callback: (event: TaskProgressUpdatedEvent) => void
): Promise<() => void>;
```

No compatibility subscription alias is exposed by `WorkerAPI`.

---

## Adapter Responsibilities

The `BuildSessionWorkerEventAdapter` translates raw Worker wire events into the 4 canonical UI events above. It is responsible for:

1. Filtering events by `nodeId` — events for other nodes are silently dropped.
2. Validating required numeric fields — non-finite values throw immediately (no fallback).
3. Mapping Worker-side status strings to `SessionPhase` — unknown values throw.
4. Splitting a multi-stage task snapshot into per-stage `stageSnapshotUpdated` events.

The runtime command layer, before invoking this adapter, owns pause shutdown. Its
AbortController and pipeline Promise belong to the nodeId entry in the build-session
SSOT state tree. The adapter must never synthesize `paused` from elapsed time or task
row counts.

The Shape-specific `BuildSessionWorkerEventAdapter` does **not** store versions or
perform deduplication. Its `UIEventBufferManager` applies the per-`taskId` gate before
the adapter. The shared `useBuildSessionStateTreeBridge` instead stores `taskId` and
the greatest accepted task version in its state tree; this also lets it drain progress
that raced ahead of the first snapshot. If a later full snapshot carries a lower task
version, the snapshot still owns membership, ordering, and task status, while the
newer accepted progress value, message, metadata, and version remain. Both paths
implement the same per-task ordering contract and neither uses a global event-version
counter.

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
- plugin-agnostic canonical emitters:
  - `emitSessionStatusUpdated(payload)`
  - `emitStageSnapshotUpdated(nodeId, payload)`
  - `emitTaskProgressUpdated(nodeId, taskId, version, stageId, value, message?, metadata?)`
  - `emitHeartbeat(nodeId, heartbeatAt)`
- `CanonicalBuildSessionManager` — shared manager that emits the four events above from a canonical event source registered through `registerSession`. It emits session status only when the payload changes, emits each changed stage snapshot as a full replacement of authoritative task state, suppresses byte-equivalent snapshot payloads per stage, and emits heartbeat only while the session is active.

`AbstractBuildSession` notifies its manager through a payload-free
`addSessionUpdateListener` callback. This callback is an in-runtime invalidation
signal, not a fifth event and not an aggregate progress payload. On every signal,
`BaseBuildSessionManager` invokes `onSessionUpdated`, and
`CanonicalBuildSessionManager` rereads `getState()`, the authoritative stage
snapshot, and pending per-task progress from `CanonicalBuildSessionEventSource`.
No aggregate progress event is created or forwarded along this path.
`AbstractBuildSession.updateProgress` accepts task-count updates but not an explicit
`percentage`; percentage is derived from validated integer counts, and an explicit
value is a contract violation rather than an override or compatibility input.

### `plugins/shape-plugin`

- `src/worker/api/eventBuffering.ts` — re-exports from `@hierarchidb/build-runtime-services`
- `src/worker/api/eventEmission.ts` — shape-plugin-specific emitters (depend on `ShapeBuildSessionRecord` / `VtTaskQueueDb`):
  - `emitSessionStatusUpdated(nodeId, sessionRecord)`
  - `emitStageSnapshotUpdated(nodeId, stage, stageStartedAt, stageInactiveMs, stageCompletedAt?)`
  - re-exports `emitTaskProgressUpdated` and `emitHeartbeat` from `@hierarchidb/build-runtime-services`
- `src/common/types/session-events.ts` — re-exports all canonical types from `@hierarchidb/build-api`

### `plugins/route-plugin` / `plugins/location-plugin`

- Each build session implements `CanonicalBuildSessionEventSource` and supplies the shared manager with explicit timing for started stages, authoritative full task snapshots, and monotonically increasing per-task versions.
- The manager or orchestrator extends `CanonicalBuildSessionManager` and registers each session before execution starts.
- Route emits the `source`, `geometry`, and `tileEmit` stages. Location emits the `source` stage owned by its current pipeline. Neither emits snapshots for unstarted stages.
- Aggregate progress values are not generated by the session/manager layer and are not converted into task progress. The legacy aggregate type, callback, adapter, and hook surfaces have been removed.
