# Shape 5-Stage Pure Function Catalog and Contracts

This document defines pure-function-first implementation contracts for the shape 5-stage pipeline.
It is a companion to `plans/shape-graph-5stage-pipeline-plan.md`.

## 1. Purpose

The 5-stage pipeline should maximize deterministic, side-effect-free logic to improve:

- unit-testability
- reproducibility
- stage-level fault isolation
- migration safety for stage-name-agnostic orchestration

All functions listed here are intended to be pure unless otherwise stated.

## 2. Shared Principles

- No I/O in pure functions (no DB/network/time/random/global mutation).
- Inputs must be explicit and complete.
- Outputs should be JSON-serializable where practical.
- Deterministic: same input => same output.
- Idempotent where applicable (especially key generation and plan derivation).
- Error output should be structured (`code`, `message`, `details`) instead of throw-by-default.

## 3. Shared Types (Contract Layer)

```ts
type NodeId = string;
type SessionId = string;
type StepId = string;
type Capability = 'io' | 'graph-index' | 'plan' | 'geometry' | 'tile-emit';

type PersistedStatus = 'idle' | 'startAccepted' | 'running' | 'completed' | 'failed';
type TaskState = 'queued' | 'running' | 'retrying' | 'completed' | 'failed' | 'skipped';

interface DeterministicError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: DeterministicError };
```

### 3.1 Standard Error Codes

- `E_CONFIG`: invalid input configuration, empty required set, duplicate/cyclic dependencies.
- `E_VALIDATION`: invalid domain payload/geometry contract violation.
- `E_DATA_CORRUPTION`: structurally broken payload that cannot be normalized.
- `E_RANGE`: numeric range violation (zoom, band, attempt, coordinate range).
- `E_STATE_TRANSITION`: illegal task state transition.

## 4. Function Contracts by Stage

## 4.1 Stage1 Fetch (planning/filter metadata domain)

### `deriveFetchTaskInputs`

Purpose: normalize selected country/adminLevel/source config into canonical fetch task inputs.

Signature:

```ts
function deriveFetchTaskInputs(input: {
  nodeId: NodeId;
  selectedCountries: readonly string[];
  adminLevels: readonly number[];
  sourceConfigHash: string;
}): Result<readonly {
  sourceKey: string;
  countryCode: string;
  adminLevel: number;
}[]>;
```

Input fields:

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `nodeId` | `NodeId` | yes | non-empty string |
| `selectedCountries` | `readonly string[]` | yes | each item ISO-like uppercase code after normalization; duplicates removed |
| `adminLevels` | `readonly number[]` | yes | integer set, allowed range `0..5` |
| `sourceConfigHash` | `string` | yes | non-empty deterministic hash string |

Output value fields (`ok=true`):

| Field | Type | Meaning |
| --- | --- | --- |
| `sourceKey` | `string` | deterministic key: `<countryCode>:<adminLevel>` |
| `countryCode` | `string` | normalized country code |
| `adminLevel` | `number` | validated admin level |

Failure (`ok=false`):

- `E_CONFIG`: `nodeId/sourceConfigHash` empty, empty cartesian product, all values invalid.
- `E_RANGE`: admin level out of accepted range.

Determinism:

- Sort order must be stable: country ascending, then admin level ascending.
- Input permutation must not affect output order.

Example success:

```json
{
  "ok": true,
  "value": [
    { "sourceKey": "JP:0", "countryCode": "JP", "adminLevel": 0 },
    { "sourceKey": "JP:1", "countryCode": "JP", "adminLevel": 1 }
  ]
}
```

Example failure:

```json
{
  "ok": false,
  "error": {
    "code": "E_CONFIG",
    "message": "No valid country/adminLevel combinations"
  }
}
```

### `buildFetchCacheKey`

Purpose: deterministic fetch cache key generation.

Signature:

```ts
function buildFetchCacheKey(input: {
  nodeId: NodeId;
  sourceKey: string;
  sourceConfigHash: string;
}): string;
```

Input constraints:

- all fields required and non-empty.
- function must be pure string composition/hash; no clock/random salt.

Output:

- canonical cache key string (recommended shape: `f:<nodeId>:<sourceKey>:<sourceConfigHash>`).

Failure policy:

- this function should not return `Result`; invalid input must be prevented by caller contracts.

Determinism/Idempotence:

- strict required.

## 4.2 Stage2 GraphIndex

### `normalizeGeometryCollection`

Purpose: normalize geometry payloads into canonical graph-ready feature set.

Signature:

```ts
function normalizeGeometryCollection(input: {
  features: readonly unknown[];
}): Result<readonly {
  featureId: string;
  geometry: unknown;
  properties: Record<string, unknown>;
}[]>;
```

Input constraints:

- `features` required; each item expected to be feature-like structure.

Output semantics:

- `featureId`: stable identifier derived from source id or deterministic fallback.
- `geometry`: normalized geometry object preserving topology-relevant content.
- `properties`: plain-object clone; no prototype-bearing objects.

Failure:

- `E_VALIDATION`: unsupported or malformed geometry.
- `E_DATA_CORRUPTION`: missing mandatory structure where recovery is impossible.

### `deriveTileCountryCandidates`

Purpose: compute tile-to-country candidate index without side effects.

Signature:

```ts
function deriveTileCountryCandidates(input: {
  normalizedFeatures: readonly {
    featureId: string;
    geometry: unknown;
  }[];
  zoomBands: readonly { band: number; zMin: number; zMax: number }[];
}): Result<readonly {
  tileId: string;
  countryIds: readonly string[];
}[]>;
```

Input constraints:

- `zoomBands` must satisfy `zMin <= zMax` and no duplicated `band` index.

Output semantics:

- one row per tile candidate.
- `countryIds` unique and sorted.

Failure:

- `E_RANGE`: invalid zoom range.
- `E_CONFIG`: duplicated band index.
- `E_VALIDATION`: geometry cannot produce tile candidates.

### `buildAdjacencyFromCandidates`

Purpose: deterministic adjacency graph derivation.

Signature:

```ts
function buildAdjacencyFromCandidates(input: {
  candidates: readonly { tileId: string; countryIds: readonly string[] }[];
}): Result<readonly {
  countryId: string;
  adjacentCountryIds: readonly string[];
}[]>;
```

Output guarantees:

- no self-adjacency.
- symmetry required: if A adjacent B then B adjacent A.
- `adjacentCountryIds` sorted and unique.

Failure:

- `E_VALIDATION` if candidate rows are malformed.

## 4.3 Stage3 PlanTransform

### `deriveScenarioStepPlan`

Purpose: build descriptor-driven runnable step plan (no queue mutation).

Signature:

```ts
function deriveScenarioStepPlan(input: {
  nodeId: NodeId;
  sessionId: SessionId;
  stepDescriptors: readonly {
    stepId: StepId;
    capability: Capability;
    dependsOn: readonly StepId[];
    guardKey: string;
  }[];
  guardResults: Readonly<Record<string, boolean>>;
}): Result<readonly {
  stepId: StepId;
  capability: Capability;
  runnable: boolean;
  reason?: string;
}[]>;
```

Input constraints:

- unique `stepId`.
- `dependsOn` references existing `stepId` only.
- dependency graph must be acyclic.

Output semantics:

- output rows sorted topologically.
- `runnable=false` includes `reason` (e.g., guard false, unmet dependency).

Failure:

- `E_CONFIG`: duplicate step, missing dependency, cycle.

Example cycle failure:

```json
{
  "ok": false,
  "error": {
    "code": "E_CONFIG",
    "message": "Cyclic descriptor dependency",
    "details": { "cycle": ["shape:s2", "shape:s3", "shape:s2"] }
  }
}
```

### `deriveTransformTasks`

Purpose: expand country x band tasks deterministically.

Signature:

```ts
function deriveTransformTasks(input: {
  nodeId: NodeId;
  graphVersion: string;
  countries: readonly string[];
  bands: readonly number[];
  toleranceProfileHash: string;
}): Result<readonly {
  logicalTaskKey: string;
  countryCode: string;
  band: number;
}[]>;
```

Input constraints:

- `countries` unique after normalization.
- `bands` integers in accepted domain.

Output guarantees:

- stable sort by `countryCode`, then `band`.
- `logicalTaskKey` deterministic over `(nodeId, graphVersion, countryCode, band, toleranceProfileHash)`.

Failure:

- `E_CONFIG`: empty inputs or missing graphVersion/hash.
- `E_RANGE`: invalid band index.

## 4.4 Stage4 GeometryTransform

### `selectToleranceProfile`

Purpose: map attempt count to strict/medium/relax profile.

Signature:

```ts
function selectToleranceProfile(input: {
  attempt: number;
  policy: {
    strict: string;
    medium: string;
    relax: string;
  };
}): Result<string>;
```

Rules:

- `attempt=1` => `strict`
- `attempt=2` => `medium`
- `attempt>=3` => `relax`

Failure:

- `E_RANGE`: `attempt < 1`
- `E_CONFIG`: any policy field empty

### `validateGeometryTransformResult`

Purpose: pure validation of transformed geometry outputs.

Signature:

```ts
function validateGeometryTransformResult(input: {
  transformedFeatures: readonly unknown[];
}): Result<{
  featureCount: number;
  invalidCount: number;
  invalidFeatureIds: readonly string[];
}>;
```

Output semantics:

- `featureCount`: total transformed features scanned.
- `invalidCount`: validation failures.
- `invalidFeatureIds`: deterministic sorted ids.

Failure:

- `E_VALIDATION`: topology/geometry invalid according to policy.

### `buildTransformCacheKey`

Purpose: deterministic transform cache identity.

Signature:

```ts
function buildTransformCacheKey(input: {
  nodeId: NodeId;
  logicalTaskKey: string;
  toleranceProfile: string;
}): string;
```

Output:

- canonical key string (recommended: `t:<nodeId>:<logicalTaskKey>:<toleranceProfile>`).

## 4.5 Stage5 VT

### `deriveTileTaskInputs`

Purpose: deterministic tile task expansion from transform artifacts.

Signature:

```ts
function deriveTileTaskInputs(input: {
  nodeId: NodeId;
  bands: readonly number[];
  transformArtifactRefs: readonly {
    band: number;
    artifactId: string;
    tileIds: readonly string[];
  }[];
}): Result<readonly {
  band: number;
  tileId: string;
  artifactIds: readonly string[];
}[]>;
```

Input constraints:

- each `artifactId` non-empty.
- `tileIds` unique per artifact row.

Output semantics:

- grouped by `(band, tileId)`.
- `artifactIds` sorted unique.

Failure:

- `E_CONFIG`: missing artifact id or empty tile sets where not allowed.
- `E_RANGE`: band not in declared `bands` set.

### `buildTileKey`

Purpose: deterministic tile storage key generation.

Signature:

```ts
function buildTileKey(input: {
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  band: number;
  vtConfigHash: string;
}): string;
```

Input constraints:

- `z >= 0`, `x >= 0`, `y >= 0`, integers.
- `band >= 0`, integer.
- `vtConfigHash` non-empty.

Output:

- canonical key string (recommended: `v:<nodeId>:<band>:<z>:<x>:<y>:<vtConfigHash>`).

## 5. Orchestrator-Shared Pure Functions

### `classifyBuildError`

Purpose: deterministic mapping from raw error payload to runtime error class and code.

Signature:

```ts
function classifyBuildError(input: {
  raw: unknown;
}): {
  className:
    | 'TransientIOError'
    | 'TransientComputeError'
    | 'ValidationError'
    | 'DataCorruptionError'
    | 'ConfigError';
  code: string;
  retriable: boolean;
};
```

Contract:

- same `raw` structural payload must map to same result.
- `retriable` must be consistent with className policy.

### `deriveNextTaskState`

Purpose: pure state transition derivation for task lifecycle.

Signature:

```ts
function deriveNextTaskState(input: {
  current: TaskState;
  event:
    | 'acquired'
    | 'succeeded'
    | 'retryableFailed'
    | 'nonRetryableFailed'
    | 'skippedByGuard';
  attempt: number;
  maxAttempts: number;
}): Result<{ next: TaskState; attempt: number }>;
```

Transition rules:

- `queued + acquired` => `running`
- `running + succeeded` => `completed`
- `running + retryableFailed` and `attempt < maxAttempts` => `retrying` with attempt+1
- `running + retryableFailed` and `attempt >= maxAttempts` => `failed`
- `queued + skippedByGuard` => `skipped`
- any transition from terminal (`completed|failed|skipped`) => `E_STATE_TRANSITION`

### `deriveBootstrapNormalization`

Purpose: no-auto-resume normalization on bootstrap.

Signature:

```ts
function deriveBootstrapNormalization(input: {
  persistedStatus: PersistedStatus;
  persistedStage?: string;
}): {
  normalizedStatus: 'idle' | 'completed' | 'failed';
  changed: boolean;
  reason?: 'abnormal-residue' | 'already-normal';
};
```

Rules:

- `startAccepted|running` => normalize to `idle`, `changed=true`, reason=`abnormal-residue`.
- `idle|completed|failed` => keep semantic status, `changed` accordingly.
- `persistedStage` is accepted only for legacy bootstrap diagnostics; it must not influence execution planning or dispatch.

## 6. Function-Level Test Matrix

### 6.1 Core cases required for each pure function

- happy path
- empty/min boundary
- ordering determinism (same set, different input order)
- invalid input contract
- error classification determinism

### 6.2 Additional mandatory cases

- Stage3 descriptor cycle detection (`E_CONFIG`)
- Stage4 tolerance profile mapping for attempt 1/2/3/exceed
- state transition terminal immutability (`completed/failed/skipped` cannot transition back)
- bootstrap normalization (`startAccepted/running -> idle`)

## 7. Acceptance Criteria for This Catalog

- Every listed function has explicit signature, input/output field semantics, and deterministic behavior note.
- Capability/descriptor truth is clearly separated from legacy persisted fields.
- No function contract requires direct dependency on stage keyword dispatch.
- Test matrix can be implemented as unit tests without DB/network/worker boot.
- For each `Result<T>` function, at least one success and one failure payload example can be derived directly from this document.
- The catalog introduces no new compatibility projection requirement for `sessions.stage`.

## 8. References

- `plans/shape-graph-5stage-pipeline-plan.md`
- `packages/runtime-worker/docs/build-session-terminology-ssot.md`
- `packages/runtime-worker/docs/build-session-orchestrator-state-transitions.md`

## 9. Revision Note

- 2026-02-28: Initial catalog created to define pure-function-first contracts before implementing 5-stage runtime behavior.
- 2026-02-28: Expanded with detailed argument/return contracts, field-level constraints, deterministic rules, transition tables, and structured success/failure examples to make the spec implementation-complete.
- 2026-02-28: Removed compatibility projection function (`projectSessionStageForCompatibility`) and updated bootstrap normalization contract to avoid stage-keyword coupling in new execution paths.
