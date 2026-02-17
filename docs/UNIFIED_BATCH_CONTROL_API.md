# Unified Build Control API (Runtime Worker / UI)

This document defines the canonical Build-session API used across Runtime Worker and UI.
Runtime-level `Batch*` compatibility aliases are removed; only canonical `Build*` names are part of the active contract.

## 1. Scope

- Node types: shape, location, route (and future plugins)
- Execution host: SharedWorker runtime
- Session semantics: start/resume share one incremental execution path

## 2. Canonical API Names

```ts
startBuildSession(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>
getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>
pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>
resumeBuildSession(nodeType: NodeType, nodeId: NodeId): Promise<void>
cancelQueuedBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>
getBuildTasks(nodeType: NodeType, nodeId: NodeId): Promise<BuildTaskSummary[]>
subscribeBuildTasks(
  nodeType: NodeType,
  nodeId: NodeId,
  callback: (event: BuildTaskUpdateEvent) => void,
): Promise<() => void>
subscribeBuildProgress(
  nodeType: NodeType,
  nodeId: NodeId,
  callback: (event: BuildProgressEvent) => void,
): Promise<() => void>
```

## 3. Compatibility Policy

- `Batch*` API names are retained only as historical references in migration material.
- New code must call `Build*` APIs.
- Compatibility at runtime should not introduce new `Batch*` usage.

## 4. Event Vocabulary

- `stage`: `fetch | transform | vt` (plus diagnostic values where required)
- `phase`: queued/running/paused/completed/failed progression
- `payload`: stage/task totals and contextual metadata

## 5. Runtime Rules

- `start` and `resume` are the same incremental pipeline path.
- `cancelQueuedBuildSession`:
  - If target is queued: remove from queue.
  - If target is already running: treat as stop/pause semantics.
- Session queue policy is global FIFO across node/plugin boundaries.

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
  - `resumeBuildSession`
  - `cancelQueuedBuildSession`
  - `getBuildTasks`
  - `subscribeBuildTasks`
  - `subscribeBuildProgress`
- Canonical type/view:
  - `BuildWorkerAPI<T>`
  - `BuildWorkerBridge`
  - `getBuildWorkerBridge()` (returns canonical bridge view)
