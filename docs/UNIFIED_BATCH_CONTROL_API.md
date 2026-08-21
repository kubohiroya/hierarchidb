# Unified Build Control API (Runtime Worker / UI)

This document defines the canonical Build-session API used across Runtime Worker and UI.
Runtime-level `Batch*` compatibility aliases are removed; only canonical `Build*` names are part of the active contract.

## 1. Scope

- Node types: shape, location, route (and future plugins)
- Execution host: SharedWorker runtime
- Session semantics: `startBuildSession` is the single incremental execution entry

## 2. Canonical API Names

```ts
startBuildSession(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>
getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>
pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>
cancelQueuedBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>
getBuildTasks(nodeType: NodeType, nodeId: NodeId): Promise<BuildTaskSummary[]>
subscribeStageSnapshots(
  nodeType: NodeType,
  nodeId: NodeId,
  callback: (event: StageSnapshotUpdatedEvent) => void,
): Promise<() => void>
subscribeTaskProgress(
  nodeType: NodeType,
  nodeId: NodeId,
  callback: (event: TaskProgressUpdatedEvent) => void,
): Promise<() => void>
subscribeSessionState(nodeType: NodeType, nodeId: NodeId, callback: SessionStateCallback): Promise<() => void>
subscribeSessionHeartbeat(nodeType: NodeType, nodeId: NodeId, callback: HeartbeatCallback): Promise<() => void>
subscribeWorkerLog(nodeType: NodeType, nodeId: NodeId, callback: WorkerLogCallback): Promise<() => void>
```

## 3. Compatibility Policy

- `Batch*` API names are retained only as historical references in migration material.
- New code must call `Build*` APIs.
- Compatibility at runtime should not introduce new `Batch*` usage.
- New code must use `startBuildSession` for Start semantics (including prior Resume-labeled UI actions).
- `subscribeBuildTasks` remains only as a compatibility surface. Shape runtime returns a
  no-op unsubscribe, so new UI code must use `subscribeStageSnapshots` and
  `subscribeTaskProgress` instead.
- No aggregate progress subscription method is exposed. Task progress uses
  `subscribeTaskProgress` exclusively.

## 4. Event Vocabulary

- `stage`: `source | geometry | tileEmit`
- session phase: `idle | starting | running | pausing | paused | resuming | finalizing | completed | failed`
- task status: `queued | running | completed | failed | recycled`
- stage task lists are full replacements delivered by `stageSnapshotUpdated`.
- task progress is delivered by `taskProgressUpdated` and ordered by a version scoped
  to each `taskId`.

## 5. Runtime Rules

- `startBuildSession` is the single incremental pipeline path.
- `cancelQueuedBuildSession`:
  - If target is queued: remove from queue.
  - If target is already running: treat as stop/pause semantics.
- Session queue policy is global FIFO across node/plugin boundaries.
- `BuildWorkerBridge.subscribeAll` establishes the subscription bundle atomically. If
  any channel subscription rejects, it disposes every already-acquired or
  later-resolving channel and propagates the original error. It must not retain a
  partial bundle, retry, or fall back to another subscription contract.

## 6. Migration Status

- Worker API and UI bridge expose canonical `Build*` methods.
- Core abstractions use `Build*` as canonical names:
  - `AbstractBuildSession`
  - `BaseBuildSessionManager`
  - `UnifiedBuildManagerBase`
- Route/Location service-layer managers now expose `Build*` as primary exports.
- Runtime-level `Batch*` aliases are removed from build control contracts.

## 7. WorkerAPI / WorkerBridge Naming Contract

- Canonical methods:
  - `startBuildSession`
  - `getBuildSessionStatus`
  - `pauseBuildSession`
  - `cancelQueuedBuildSession`
  - `getBuildTasks`
  - `subscribeStageSnapshots`
  - `subscribeTaskProgress`
  - `subscribeSessionState`
  - `subscribeSessionHeartbeat`
  - `subscribeWorkerLog`
- Canonical type/view:
  - `BuildWorkerAPI<T>`
  - `BuildWorkerBridge`
  - `getBuildWorkerBridge()` (returns canonical bridge view)
