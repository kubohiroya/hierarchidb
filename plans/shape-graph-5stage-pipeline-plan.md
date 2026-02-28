# Shape 5-Stage Pipeline Specification (Pre-Implementation)

This document defines the implementation-ready specification for the shape 5-stage pipeline.
It must be maintained in accordance with `/PLANS.md`.

## Purpose / Big Picture

Current shape build flow is treated operationally as `fetch -> transform -> vt`, while internal responsibilities are already split across multiple modules. This spec fixes the execution contract as five explicit stages so implementers can add/modify code without making ad-hoc design decisions during implementation.

The user-visible objective is stable Step5 execution and predictable recovery behavior, with explicit stage boundaries and deterministic retry/fail-fast rules.

Pure-function-first implementation is mandatory for stage planning/derivation/validation logic. The detailed pure function catalog is defined in:

- `plans/shape-5stage-pure-function-spec.md`
- `plans/shape-stage-keyword-removal-backlog.md` (code migration backlog for removing stage-keyword-coupled control paths)

## Scope / Non-goals

### In scope

- Define execution stages as `Stage1..Stage5` with explicit contracts.
- Define lifecycle hooks around stages (`Stage0`, `Stage6`) as non-stage hooks.
- Define TaskQueue state transitions, error classification, retry policy, and UI mapping.
- Define rollout, feature-flag defaults, rollback, and validation matrix.

### Non-goals

- Route pipeline redesign (route remains on current 3-stage operational spec).
- Immediate code migration in this document itself.
- Backward-compat fallback implementation for old/new mixed stage contracts.
- Side-effect-heavy orchestration logic that bypasses pure planning/derivation layers.

## Stage Definitions (Stage0/6 are Non-stage Hooks)

### Lifecycle hooks (non-stage)

- `Stage0 MetadataWarmup`: session boot, metadata refresh/reuse decision, preflight checks.
- `Stage6 CleanupAndSyncGuard`: terminal consistency check, cleanup of stage-local temporary artifacts, final status sync.

These are lifecycle hooks and **not counted** in the 5 execution stages.

### Execution stages (counted)

- `Stage1 Fetch`
- `Stage2 GraphIndex`
- `Stage3 PlanTransform`
- `Stage4 GeometryTransform`
- `Stage5 VT`

Stage names in this document are scenario labels for shape UX/docs. In `vt-orchestrator`, execution must be descriptor-driven and must not depend on hard-coded domain stage keywords.

## Scenario-Driven Composition Guidelines (Stage-Name Agnostic)

### Design intent

- Keep orchestrator logic independent from domain stage words such as `fetch`, `transform`, and `vt`.
- Compose build sessions from scenario descriptors and capability contracts.
- Allow different node types/scenarios to reuse the same scheduler/executor without keyword-branch growth.
- Follow runtime-worker terminology SSOT before introducing any new term:
  - `packages/runtime-worker/docs/build-session-terminology-ssot.md`
  - `packages/runtime-worker/docs/build-session-orchestrator-state-transitions.md`

### Terminology and runtime contract alignment (required)

- Execution orchestrator term is `BuildSessionOrchestrator` only.
- Tab-level coordination term is `TabSessionCoordinator` and is not an execution controller.
- Keep state dimensions distinct:
  - `persistedStatus`: durable state in storage
  - `runtimeStatus`: live in-memory reflection state
  - `phase`: runtime lifecycle (`starting|running|pausing|...`)
  - `stageId`: diagnostic-only identifier, never a control-state key
- `Start` and `Resume` are UI labels; runtime path is a single semantic entry (`startBuildSession`), with incremental re-evaluation from persisted state.

### Prohibited implementation patterns

- Switching execution behavior by string comparisons like `if (stage === 'fetch')`.
- Branching retry/queue/persistence behavior directly on domain stage names.
- Encoding domain stage words into orchestrator-internal state keys where capability keys are sufficient.
- Introducing new `*Batch*` aliases on SharedWorker/build control surfaces.
- Using legacy "full vs incremental" mode-split branch paths.

### Recommended implementation patterns

- Use `ScenarioStepDescriptor` as the unit of execution planning.
- Resolve executors by capability (`io`, `graph-index`, `plan`, `geometry`, `tile-emit`) instead of domain stage names.
- Keep `TaskQueue` semantics generic (`queued/running/retrying/...`) and map them to UI labels outside the orchestrator boundary.
- Keep public control API names aligned with runtime-worker docs:
  - `startBuildSession`
  - `getBuildSessionStatus`
  - `pauseBuildSession`
  - `cancelQueuedBuildSession`
  - `getBuildTasks`
  - `subscribeBuildTasks`
  - `subscribeBuildProgress`

### Descriptor contract (target shape)

Use the following implementation contract for session composition:

```ts
type ScenarioStepId = string; // stable id, e.g. \"shape:s1\"

type StepCapability =
  | 'io'
  | 'graph-index'
  | 'plan'
  | 'geometry'
  | 'tile-emit';

interface ScenarioStepDescriptor {
  stepId: ScenarioStepId;
  label: string; // UI/document label, not orchestration key
  capability: StepCapability;
  dependsOn: ScenarioStepId[];
  guard: string; // logical expression or guard key
  retryProfile: 'none' | 'standard' | 'geometry-strict-relax';
  artifactsIn: string[];
  artifactsOut: string[];
}
```

This contract is prescriptive for implementation design docs and code reviews. Equivalent structures are allowed, but capability-based dispatch and dependency-driven assembly are mandatory.

### Legacy keyword migration map

| Legacy stage keyword | New orchestration basis | Notes |
| --- | --- | --- |
| `fetch` | capability=`io` | covers remote/local source materialization |
| `transform` (planning aspects) | capability=`plan` | task expansion and scheduling preparation |
| `transform` (geometry aspects) | capability=`geometry` | simplification/validation/reconstruction |
| `vt` | capability=`tile-emit` | tile assembly/encoding/persistence |
| `graph-index` (new explicit stage) | capability=`graph-index` | shared topology/index preparation |

### Boundary rule

- `vt-orchestrator` owns: descriptor scheduling, generic task lifecycle, retry execution, dependency ordering.
- Scenario/domain modules own: descriptor definitions, guard semantics, artifact schema interpretation, UI stage labels.
- UI components must map descriptor progression to stage labels; orchestrator must not import UI label constants.
- Snapshot/progress stream behavior must remain SSOT-compatible:
  - `snapshot` initializes state transfer
  - `progress` carries incremental updates
  - terminal task states must not be overwritten by non-terminal late events

### Transition strategy against current runtime state model

The runtime-worker docs currently define persisted/runtime `stage` values with domain words (`fetch|transform|vt|idle|undefined`).
Under this specification, stage-name-agnostic orchestration is authoritative:

1. Use `stepId + capability + persistedStatus/runtimeStatus/phase` as the execution truth source.
2. Do not derive or depend on compatibility stage projection in new code paths.
3. Do not use domain stage words as dispatch keys.
4. If legacy `sessions.stage` fields still exist in storage schemas, treat them as non-authoritative legacy fields and keep them out of orchestration decisions.

### Implementation playbook (prescriptive)

1. Define scenario descriptor registry (scenario/plugin layer):
   - list of `ScenarioStepDescriptor`
   - dependency DAG validation
   - guard key binding
2. Compile runtime session plan at `startBuildSession(nodeId)`:
   - load persisted artifacts/state
   - evaluate guards
   - emit runnable `stageTaskId` set
3. Dispatch by capability in orchestrator:
   - `io` -> source/materialization handlers
   - `graph-index` -> topology/index handlers
   - `plan` -> planning handlers
   - `geometry` -> geometry transform handlers
   - `tile-emit` -> tile writer handlers
4. Persist generic task lifecycle:
   - store `stepId`, `capability`, attempt, terminal reason
   - emit snapshot/progress streams
5. UI mapping:
   - map `stepId/capability` to scenario labels (`Fetch`, `GraphIndex`, ...)
   - do not consume orchestrator-internal dispatch identifiers directly

## Interfaces and Data Contracts

### Pure function contract reference (required)

- All stage planning/derivation logic must follow:
  - `plans/shape-5stage-pure-function-spec.md`
- The orchestrator integration layer may perform I/O, but it must call pure functions for:
  - task input derivation
  - key generation
  - guard/plan evaluation
  - error classification and state transition derivation

### Stage I/O contract

| Stage | Input | Output | Persistence | Primary key | Idempotency rule | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- |
| Stage1 Fetch | country/adminLevel selection + data source config + nodeId/sessionId | fetch cache + feature metadata | `ephemeral fetch cache` + metadata tables | `cacheKey = nodeId + sourceKey + fetchConfigHash` | same input MUST regenerate same `cacheKey` | retriable for transient network errors; fail-fast for schema/validation errors |
| Stage2 GraphIndex | Stage1 outputs + graph config | tile-country index + adjacency + arc IDs + graphVersion | graph index tables in ephemeral/shared store | `graphKey = nodeId + sessionId + graphConfigHash` | same input MUST regenerate same graph index set | fail-fast on corruption/geometry topology hard-fail |
| Stage3 PlanTransform | Stage2 outputs + build config | transform task plan (`country x band` task set) | task planning records in TaskQueue metadata | `planKey = nodeId + graphVersion + transformConfigHash` | same input MUST regenerate equivalent plan | fail-fast on invalid config; no partial implicit fallback |
| Stage4 GeometryTransform | Stage3 tasks + Stage1 cache + Stage2 graph artifacts | transform cache artifacts | transform cache tables | `transformCacheKey = nodeId + taskIdentity + toleranceProfile` | same task identity + same inputs MUST produce same cache identity | retry on transient compute/resource; fail-fast on `ValidationError`/`DataCorruptionError` |
| Stage5 VT | Stage4 transform cache + vt config | vector tiles + stage metadata | tile store + stage metadata store | `tileKey = nodeId + z + x + y + band + vtConfigHash` | same inputs MUST upsert identical tile key space | retry on transient writer errors; fail-fast on missing required upstream cache |

### Identity/key design

- `nodeId`: immutable target node identity.
- `sessionId`: immutable build session identity.
- `stageTaskId`: `sessionId + stage + logicalTaskKey`.
- `cacheKey`: deterministic hash of `nodeId + logical source identity + stage config snapshot`.

Determinism requirement:

- Re-running with unchanged `nodeId`, selection/config snapshots, and data source signatures must regenerate identical key spaces (`stageTaskId`, `cacheKey`, `tileKey`).

### Session assembly rule

- A build session is assembled from ordered `ScenarioStepDescriptor` entries plus dependency graph validation.
- Invalid descriptor graphs (cycle, missing dependency, duplicate `stepId`) must fail-fast with `E_CONFIG`.
- Scenario-specific stage labels are resolved after planning and are not used as orchestrator dispatch keys.

### Canonical references (existing paths)

- `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineFetchStage.ts`
- `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineTransformStage.ts`
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler/execute.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineVtStage.ts`
- `packages/vt-orchestrator/src/vt/vtStageHandler.ts`

## TaskQueue State Machine

### States

- `queued`
- `running`
- `retrying`
- `completed`
- `failed`
- `skipped`

### Transitions

- `queued -> running`: scheduler acquires task.
- `running -> completed`: stage handler returns success.
- `running -> retrying -> queued`: retriable error and `attempt < maxAttempts`.
- `running -> failed`: non-retriable error OR attempts exhausted.
- `queued -> skipped`: stage guard decides task is no-op for current session state.

### Transition trigger constraints

- `retrying -> queued` MUST increment attempt count.
- `failed` and `completed` are terminal per `stageTaskId` for the current `sessionId`.
- `skipped` MUST include machine-readable reason code.
- Task records MUST store `stepId` and `capability`; storing only human-readable stage labels is forbidden.
- Queue arbitration is FIFO at orchestrator level across accepted sessions.

## Failure Model and Retry Policy

### Error classification

| Error class | Retry | Notes | Terminal errorCode |
| --- | --- | --- | --- |
| `TransientIOError` | yes | network timeout, temporary storage busy | `E_TRANSIENT_EXHAUSTED` when max attempts exceeded |
| `TransientComputeError` | yes | worker interruption, temporary resource pressure | `E_COMPUTE_EXHAUSTED` when max attempts exceeded |
| `ValidationError` | no | invalid geometry/contract violation requiring input/config fix | `E_VALIDATION` |
| `DataCorruptionError` | no | broken cache/index payload or impossible decode | `E_DATA_CORRUPTION` |
| `ConfigError` | no | invalid or missing required config | `E_CONFIG` |

### Retry parameters (fixed defaults)

- `maxAttempts = 3`
- backoff: exponential (`250ms`, `500ms`, `1000ms`) with jitter.
- Stage4 strict-to-relax fallback:
  1. attempt 1: strict profile
  2. attempt 2: medium relax profile
  3. attempt 3: relax profile
- If stage4 still fails after attempt 3, task becomes `failed` with `E_VALIDATION` or `E_COMPUTE_EXHAUSTED` depending on final classification.

### Guard conditions (logical form)

- Stage1 start: `Stage0.preflightOk == true`
- Stage2 start: `Stage1.completedCount > 0`
- Stage3 start: `Stage2.completedCount > 0 AND graphVersion == activeGraphVersion`
- Stage4 start: `Stage3.completedCount > 0 AND plannedTaskCount > 0`
- Stage5 start: `Stage4.failedCount == 0 AND transformCacheCount > 0`

### Session normalization policy (bootstrap)

- On bootstrap, if persisted session is `startAccepted` or `running`, normalize to non-running state before accepting new execution requests.
- No auto-resume after abnormal termination (all tabs closed, crash, worker restart).
- Execution restarts only via explicit user action mapped to `startBuildSession`.

## Execution Flow (Mermaid + Conditions)

```mermaid
flowchart TD
  A[Stage0 MetadataWarmup (non-stage)] --> B[Stage1 Fetch]
  B --> C[Stage2 GraphIndex]
  C --> D[Stage3 PlanTransform]
  D --> E[Stage4 GeometryTransform]
  E --> F[Stage5 VT]
  F --> G[Stage6 CleanupAndSyncGuard (non-stage)]
  G --> H[Done]

  U[UI Progress] --> B
  U --> C
  U --> D
  U --> E
  U --> F
```

Condition notes:

- Stage0 and Stage6 are lifecycle hooks; only Stage1..Stage5 are counted execution stages.
- Any stage fail-fast error stops downstream stages for the same session.
- Resume behavior follows guard checks and may re-enter from Stage4 when Stage1-3 artifacts are valid.

## Validation and Acceptance

### Document DoD

1. Zero broken file references in this document.
2. Stage0/6 treated consistently as non-stage hooks.
3. All five execution stages have I/O contract entries.
4. Retry vs fail-fast boundary is explicit per error class.
5. Rollback section defines actor, target, and order.
6. Implementer can start coding without unresolved design questions.
7. Revision note exists at the end.

### Test matrix to include in implementation phase

| Scenario | Expected |
| --- | --- |
| Happy path | Stage1..Stage5 complete, VT saved, session completed |
| Stage4 strict failure then relax retry | retries follow profile order, final state deterministic |
| Resume after Stage3 completion | Stage1/2/3 are reused (not recomputed), re-entry at Stage4 |
| Cache reuse with same input | Stage1/2 recomputation suppressed, deterministic keys reused |
| Partial task failures | session-level policy explicitly applied and UI reflects terminal status |

## Rollout / Feature Flag / Rollback

### Rollout defaults

- Feature flag default: `OFF`.
- Enablement scope: shape pipeline only.
- Route pipeline: unaffected and out of scope.

### Compatibility policy

- No compatibility fallback between old/new stage contracts unless explicitly agreed beforehand.
- Mixed contract acceptance (union-like compatibility branches) is out of scope.
- During migration, legacy stage words may remain in UI copy, but orchestrator dispatch must be capability/descriptor-based.
- Build-session terminology conflicts must be resolved in favor of `build-session-terminology-ssot.md`.

### Rollback procedure

Actor: implementer/releaser for shape pipeline change.

Order:

1. Turn feature flag OFF.
2. Stop new sessions using 5-stage path.
3. Revert pipeline wiring commits affecting Stage1..5 execution.
4. Remove/clear newly introduced 5-stage temporary artifacts if incompatible.
5. Run smoke validation on 3-stage baseline behavior.

## Idempotence and Recovery

- Stage key spaces (`stageTaskId`, `cacheKey`, `tileKey`) are deterministic by design.
- Re-running the same session input is safe and expected to upsert same logical artifacts.
- Recovery rule: after interruption, resume from highest valid completed stage based on guard conditions; never silently bypass failed validation.

## Progress

- [x] (2026-02-28 JST) Reframed document from concept memo to implementation-ready specification.
- [x] (2026-02-28 JST) Fixed non-existing path references and aligned canonical file list.
- [x] (2026-02-28 JST) Added explicit contracts, state machine, retry model, rollout and rollback.
- [x] (2026-02-28 JST) Added validation matrix and document-level DoD.

## Decision Log

- Decision: Treat Stage0/Stage6 as non-stage lifecycle hooks.
  Rationale: Preserve operational hooks while keeping execution stage count exactly five.
  Date/Author: 2026-02-28 / Codex

- Decision: Rename stage roles to responsibility-based names (`PlanTransform`, `GeometryTransform`) in this spec.
  Rationale: Reduce implementation ambiguity from ordinal names (`Transform1/2`).
  Date/Author: 2026-02-28 / Codex

- Decision: Set default retry limit to `maxAttempts = 3` with strict->medium->relax profile for Stage4.
  Rationale: Keep behavior deterministic and bounded while allowing practical recovery from borderline geometry issues.
  Date/Author: 2026-02-28 / Codex

- Decision: Feature flag default remains OFF and route remains out of scope.
  Rationale: Limit blast radius and keep rollout reversible.
  Date/Author: 2026-02-28 / Codex

- Decision: Keep stage words (`Fetch`, `PlanTransform`, `GeometryTransform`, `VT`) as documentation/UI labels only, and enforce capability-based orchestration keys.
  Rationale: Preserve product readability while preventing keyword-coupled orchestrator design.
  Date/Author: 2026-02-28 / Codex

- Decision: Align orchestration and vocabulary constraints to runtime-worker build-session SSOT docs and treat `startBuildSession` as the single semantic execution entry.
  Rationale: Prevent drift between pipeline design doc and canonical runtime session contract.
  Date/Author: 2026-02-28 / Codex

- Decision: Define and maintain a separate pure function catalog as a required pre-implementation contract.
  Rationale: Ensure stage logic remains unit-testable, deterministic, and decoupled from side-effectful orchestrator code.
  Date/Author: 2026-02-28 / Codex

- Decision: Remove compatibility stage projection as a design requirement and standardize on descriptor/capability/state dimensions only.
  Rationale: Compatibility projection re-introduces stage-keyword coupling and weakens the stage-name-agnostic architecture goal.
  Date/Author: 2026-02-28 / Codex

## Revision Note

- 2026-02-28: Full replacement of the previous diagram-centric draft with a decision-complete pre-implementation specification. Reason: remove ambiguity and enforce implementation/rollback/validation contracts before coding.
- 2026-02-28: Added scenario-driven, stage-name-agnostic implementation guidelines to align with vt-orchestrator refactoring direction and prevent keyword-coupled dispatch logic.
- 2026-02-28: Added explicit alignment rules with runtime-worker build-session SSOT/state-transition docs (terminology, single-entry execution semantics, bootstrap normalization, snapshot/progress consistency).
- 2026-02-28: Added mandatory reference to pure-function catalog (`plans/shape-5stage-pure-function-spec.md`) and codified pure-function-first implementation boundary.
- 2026-02-28: Removed compatibility stage projection requirement (`sessions.stage` projection) and standardized the execution truth source to descriptor/capability + persisted/runtime status dimensions.
