# Build Session State Tree Spec (Common: Shape/Route)

## Scope

This spec defines the shared UI state-tree contract used by build-session UIs
for both shape and route plugins.

## SSOT Policy

- Keep only factual state in the root tree.
- Do not persist derivable values in the root.
- UI reads via selector/derived atoms.
- State updates are accepted only through a single write atom (`dispatch`).

## Root State (Stored)

```ts
type BuildSessionStateTree<StageId extends string> = {
  nodeId: string;
  stageIds: StageId[];
  session: {
    phase: SessionPhase;
    isActive: boolean;
    error?: string;
  };
  tasks: {
    byId: Record<string, TaskItem<StageId>>;
    orderedIdsByStage: Record<StageId, string[]>;
  };
  timing: {
    byStage: Record<StageId, {
      startedAtUtime?: number;
      pausedTotalMs?: number;
      completedAtUtime?: number;
    }>;
  };
  ui: {
    activeStageId: StageId;
    byStage: Record<StageId, StageUiState>;
  };
  meta: {
    lastAcceptedEventVersion: number;
  };
};
```

### Task status contract

```ts
type TaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'recycled'
  | 'skipped';
```

## Not Stored in Root

- `heartbeatAtUtime`
- legacy session elapsed fields (not used by UI state tree)
- `totalElapsedMs`
- stage counters (`counts`)

These are represented as derived atoms only.

## Derived Atoms (Selectors)

- `stageTasksAtomFamily(stageId)`
- `stageCountsAtomFamily(stageId)`
- `overallCountsAtom`
- `stageElapsedMsAtomFamily(stageId)`
- `totalElapsedMsAtom`
- `activeStageUiAtom`
- `activeStageTasksAtom`
- `activeStageCountsAtom`
- `nowUtimeAtom` (ticker source for elapsed calculations)

## Event Ordering

- Versioned events are applied only when:
  - `eventVersion > lastAcceptedEventVersion`
- Otherwise discarded.
- UI-local events (for view state only) are not version-gated.

## UI Sync Substate (per stage)

This state tree keeps worker lifecycle phase in `session.phase`, and tracks
UI synchronization readiness separately per stage:

- `uiSyncPhase='ui-initializing'`
  - Stage transition detected, but stage task snapshot is not yet accepted by UI.
  - Incoming progress events for that stage are buffered and not applied to display state yet.
- `uiSyncPhase='running'`
  - Stage snapshot is accepted.
  - Buffered progress is flushed on `requestAnimationFrame`, then subsequent progress is also applied by rAF batches.

Design intent:

- `ui-initializing` is **not** a session lifecycle phase.
- `session.phase` can remain `running` while `uiSyncPhase` toggles
  `ui-initializing -> running` multiple times across stage transitions.

## Timing Rule

Elapsed time must be derived from:

- `startedAtUtime`
- `pausedTotalMs`
- `completedAtUtime` (if completed)
- current time (`nowUtimeAtom`) otherwise

Formula:

- completed stage:
  - `elapsed = completedAtUtime - startedAtUtime - pausedTotalMs`
- running/paused stage:
  - `elapsed = nowUtime - startedAtUtime - pausedTotalMs`

Clamp lower-bound to `0`.

## Validation Rule

- `task.progress` must stay within `0..100`.
- Out-of-range values are rejected with explicit error.
- No normalization/fallback to conceal contract violations.
