# Canonical Build Session UI Kernel and State Tree Specification

## Scope

This specification defines the node-type-neutral UI boundary shared by Shape,
Route, and Location build sessions. The common boundary owns canonical event
validation, subscription lifecycle, pre-snapshot progress buffering, subscription
readiness, and canonical command state. It does not own plugin labels, recovery UI,
task-detail presentation, or plugin-specific atom trees.

The canonical event contract remains authoritative in
`docs/build-session-worker-ui-event-spec.md`.

## SSOT Policy

- A build-session UI has exactly one state tree for a node in a browser tab.
- Only factual Worker/runtime state is stored. Counts, percentages, elapsed time,
  and other derivable values remain selectors.
- Event application enters a state tree through its single dispatch boundary.
- The common kernel may call a plugin-owned dispatch boundary; it must not create a
  second state tree for Shape or copy session state into React state/ref.
- Runtime handles such as unsubscribe functions are lifecycle resources, not a
  second representation of session state.

## Canonical Event Boundary

The kernel accepts exactly four Worker-to-UI events:

- `sessionStatusUpdated`
- `stageSnapshotUpdated`
- `taskProgressUpdated`
- `heartbeat`

All event envelopes and payload fields are validated before dispatch. Invalid
event types, phase/activity pairs, node IDs, stage IDs, timing, task versions, task
status values, or progress values fail immediately. Values are not clamped,
defaulted, inferred, or accepted through compatibility aliases.

The stage vocabulary is supplied by each consumer through an explicit `stageIds`
configuration and `resolveStageId` validator. The common kernel contains no Shape,
Route, or Location node type or stage identifier.

## Subscription Transports

The transport is selected explicitly:

- `worker`: initialize `BuildWorkerBridge`, then acquire its atomic `subscribeAll`
  subscription for the four canonical channels.
- `same-realm`: subscribe to the four canonical channels from
  `unconditionalEventStreamer`.

There is no fallback between transports. The same-realm streamer is live-only, so
its subscription must be ready before the owning runtime starts a session.

`subscriptionReady` becomes `true` only after all four subscriptions have been
installed. A setup failure is exposed as `subscriptionError`. Disposing the kernel
invalidates callbacks, clears buffered progress, and releases every acquired
subscription exactly once.

## Event Ordering and Buffering

- `sessionStatusUpdated` and `stageSnapshotUpdated` are applied in FIFO arrival
  order without a cross-stream version gate.
- `heartbeat` is applied immediately after validation.
- `taskProgressUpdated.version` is a positive integer ordered independently for
  each `taskId`.
- Progress received before the first authoritative snapshot for its stage is
  buffered.
- After the snapshot arrives, buffered progress is applied through the state-tree
  dispatch. Equal or lower task versions are discarded; newer progress is retained
  even if a later authoritative snapshot contains a lower version for that task.
- A snapshot owns stage membership, task ordering, task status, and removal. A
  progress event never creates an unknown task.

Entering a new `starting` phase or observing a different explicit session
`startedAt` resets snapshot readiness, buffered progress, and state-tree contents.

## Shared Route/Location State Tree

Route and Location currently consume the common kernel through
`useBuildSessionStateTreeBridge`. Its stored state is:

```ts
type BuildSessionStateTree<StageId extends string> = {
  nodeId: string;
  stageIds: StageId[];
  session: {
    phase: SessionPhase;
    isActive: boolean;
    hasAuthoritativeStatus: boolean;
    startedAt?: number;
    inactiveMs?: number;
    completedAt?: number;
    lastHeartbeatAt?: number;
    error?: string;
  };
  tasks: {
    byId: Record<string, TaskItem<StageId>>;
    orderedIdsByStage: Record<StageId, string[]>;
  };
  timing: {
    byStage: Record<StageId, {
      snapshotReceived: boolean;
      startedAtUtime?: number;
      pausedTotalMs?: number;
      completedAtUtime?: number;
    }>;
  };
  ui: {
    activeStageId: StageId;
    byStage: Record<StageId, StageUiState>;
  };
};
```

There is no global `lastAcceptedEventVersion`. The greatest accepted version is
stored on each task.

### Task Status Contract

```ts
type TaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'recycled'
  | 'skipped';
```

## Snapshot Readiness

Lifecycle readiness and stage-snapshot readiness are different facts.

- A valid `sessionStatusUpdated` establishes authoritative lifecycle state and may
  select an active stage.
- Progress remains absent until an authoritative `stageSnapshotUpdated` has been
  received for that active stage.
- An explicit snapshot with `tasks: []` represents a started stage with zero tasks.
- A missing snapshot is not treated as an empty or idle stage.

## Timing Contract

- `heartbeatAt`, session timing, and stage timing are persisted factual state.
- An unstarted stage has `snapshotReceived=false` and contributes `0` elapsed time.
- A started stage requires finite, non-negative `startedAtUtime` and
  `pausedTotalMs`.
- A completed stage uses
  `completedAtUtime - startedAtUtime - pausedTotalMs`.
- An active stage may use the current clock only while the authoritative session is
  active.
- A paused or otherwise inactive non-terminal stage requires a persisted heartbeat
  or completion endpoint.
- A missing endpoint, non-finite result, or negative duration is a contract error.
  The consumer must not clamp it to zero or substitute the read clock.

## Derived State

The state tree exposes selectors including:

- `stageTasksAtomFamily(stageId)`
- `stageCountsAtomFamily(stageId)`
- `overallCountsAtom`
- `stageElapsedMsAtomFamily(stageId)`
- `totalElapsedMsAtom`
- `activeStageUiAtom`
- `activeStageTasksAtom`
- `activeStageCountsAtom`
- `nowUtimeAtom`

`recycled` tasks are excluded from active progress totals. Percentages and current
stage counts are derived only from the active stage snapshot.

## Canonical Control Kernel

The control boundary exposes node-type-neutral command state for:

- start/resume intent -> `startBuildSession`
- pause intent -> `pauseBuildSession`
- queued cancel intent -> `cancelQueuedBuildSession`

Start/resume is unavailable until the canonical subscription is ready and the
explicit command transport has completed initialization. All commands reject
before command readiness. Initialization or command rejection is exposed as a
mutation error and is never converted into a successful local state transition.
The common control boundary does not synthesize pause, resume, or cancellation
state; canonical events remain the lifecycle SSOT.

## Plugin Boundaries

- Route uses Worker transport and the shared state-tree consumer.
- Location currently uses the explicit same-realm transport and the shared
  state-tree consumer.
- Shape uses Worker transport and keeps its single plugin-owned Jotai state tree.
  Its later adapter may consume the same kernel callbacks, but the common package
  must not instantiate another Shape state tree.
- Shape recovery, Worker logs, task detail, cache controls, Location auth notices,
  and plugin-specific presentation remain outside this kernel.
