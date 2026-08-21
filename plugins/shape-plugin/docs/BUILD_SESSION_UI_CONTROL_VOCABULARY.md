# Shape Build Session UI Control Vocabulary

This note defines UI control vocabulary for Shape Build Step.
It is aligned with runtime-worker SSOT documents:

- `packages/runtime-worker/docs/build-session-terminology-ssot.md`
- `packages/runtime-worker/docs/build-session-orchestrator-state-transitions.md`

## Canonical control commands (runtime API)

- `startBuildSession`
- `pauseBuildSession`
- `cancelQueuedBuildSession`

## UI wording policy

- `Start` and `Resume` are the same runtime command path (`startBuildSession`).
- `Pause` and `Cancel` are different user intentions and must be shown as separate actions.
- `retry` is not a control command in this context.

## UI intent state

The build progress UI tracks requested control intent as:

- `none`
- `start`
- `pause`
- `cancel`

This intent is UI-only metadata for rendering and must not redefine runtime semantics.

## Mapping notes

- `Pause` action maps to `pauseBuildSession`.
- `Cancel` action maps to:
  - `cancelQueuedBuildSession` when queued.
  - Runtime fallback behavior for running sessions is defined by orchestrator contract.

## Non-goals

- Do not introduce additional control aliases.
- Do not add independent `retry` command without SSOT update.

## Progress update handling

- Task/session progress visibility is driven by canonical
  `stageSnapshotUpdated` + `taskProgressUpdated` events.
- `progress=100%` does not define task or session terminal status. Terminal task
  status is owned by the authoritative stage snapshot.
- Progress ordering uses a positive integer `version` scoped to each `taskId`.
  Equal or lower versions are discarded; there is no global event sequence.
