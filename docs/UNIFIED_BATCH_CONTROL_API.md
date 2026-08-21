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
- `subscribeBuildTasks` is removed from `WorkerAPI` and `BuildWorkerBridge`; task delivery
  uses `subscribeStageSnapshots` and `subscribeTaskProgress` only.
- No aggregate progress subscription method is exposed. Task progress uses
  `subscribeTaskProgress` exclusively.

## 4. Event Vocabulary

- `stage`: `source | geometry | tileEmit`
- `BuildProgress.stage` is absent until a stage has authoritatively started. Runtime
  adapters must not synthesize `source` for a session with no current stage.
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

## 7. Plugin Worker Registration Contract

Every build-capable worker module exposes its bootstrap-resolved build entry under the
exact name `canonicalBuildAPI`. Shape, Route, and Location implement the same
`CanonicalPluginBuildAPI` surface:

- `startBuildSession({ nodeId, draftData })`
- `getBuildSessionStatus`
- `pauseBuildSession`
- `cancelQueuedBuildSession`
- `getBuildTasks`
- `subscribeStageSnapshots`
- `subscribeTaskProgress`
- `subscribeSessionState`
- `subscribeSessionHeartbeat`
- `subscribeWorkerLog`

The runtime bootstrap resolves only the exact `canonicalBuildAPI` export. It does not
probe plugin-specific names, nested plugin objects, legacy listener APIs, or aggregate
progress providers. An export that is present but lacks any required method is a
startup contract error. A start request always obtains `draftData` from the canonical
tree node and passes it unchanged to the plugin; the plugin owns strict validation of
its required configuration and input data. Missing required data is rejected and is
never replaced with defaults or a no-op session.

Route derives one direct route input from the persisted `buildConfig`,
`startLocationId`, `endLocationId`, and the first and last coordinates of
`lineGeometry`. Location derives its search configuration from the persisted
`dataSource`, `selectedArrayByCountries`, and `concurrentDownloads`. Neither adapter
accepts a synthetic nested `routes` or Location `buildConfig` field that is absent from
the corresponding entity payload.

Route and Location pause completes only after the active run has received abort and its
pipeline promise has settled. Shutdown confirmation has a 15-second deadline; timeout
fails the session and rejects the command, and a replacement start remains forbidden
until the original run actually settles. A terminal or paused session remains queryable
until a replacement session for the same node is registered. `getBuildTasks` is
operational for all three plugin registrations; an adapter must not satisfy the method
structurally by always rejecting it.

Shape preview payload generation is not part of this build dispatch contract. It is
exposed separately as the exact `shapeBuildExtensions` worker export; bootstrap does
not discover it through `shapeBuildAPI`, `shapePluginAPI`, or nested plugin objects.

## 8. WorkerAPI / WorkerBridge Naming Contract

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
