# @hierarchidb/build-session-ports

Layer-0 contract package for cross-plugin batch/session orchestration.

This package contains only types and interfaces. It does not contain runtime implementations
such as Dexie access, Comlink transport, worker startup logic, or UI behavior.

## Why this package exists

Shape/Route/Location build flows share the same orchestration concepts:

- stage controls (`start`, `pause`, `resume`, `cancel` queued)
- task registry abstraction
- artifact storage abstraction
- minimal progress shape
- build-session control contract (subscribe/build/next stage controls)

Keeping these contracts in one package prevents each plugin from redefining similar types.

## Exported contracts

- `StageControls`
- `TaskRegistryPort`
- `ArtifactStorePort`
- `ProgressInfoBase`
- `BuildSessionControlPort` and related session-state types

## Boundaries

- Allowed dependencies: foundational types only (for example `@hierarchidb/core-types`)
- Forbidden in this package:
  - database implementations
  - worker lifecycle orchestration implementations
  - plugin-specific business rules

For runtime behavior and state-transition specification, refer to:
`packages/runtime-worker/docs/build-session-orchestrator-state-transitions.md`
