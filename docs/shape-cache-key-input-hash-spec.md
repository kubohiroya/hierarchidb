# Shape Cache Key and Input Hash Specification

## Status
- Normative
- Last updated: 2026-08-20

## 1. Purpose
This document defines how cache identity must be handled in the shape build pipeline (`source`, `geometry`, `tileEmit`).

The design uses two separate identifiers:
- `cacheKey`: coarse lookup key
- `inputHash`: strict equality token

`cacheKey` and `inputHash` must not be merged.

## 2. Core Rules (Normative)
1. `cacheKey` is used only for candidate lookup.
2. `inputHash` is used only for strict match validation.
3. Values used in `cacheKey` must not be part of `inputHash` payload.
4. `inputHash` is computed once when the task is created and persisted.
5. Cache hit check must not recompute `inputHash` from stored artifact payloads.
6. Reuse is allowed only when both `cacheKey` and `inputHash` match.
7. Cache namespace mode must be configurable:
  - `node`: isolate cache by node
  - `global`: share cache across nodes
8. Artifact persistence must use upsert-by-key semantics (overwrite on same key).
9. Recommended default namespace policy:
  - `source`: `global`
  - `geometry`: `node`
  - `tileEmit`: `node`
10. A dedicated `countryMetadataCache` is out of scope and must not be introduced in this design.
11. Every stage-specific required identity input must be present and valid before key construction. Missing inputs throw; they are not normalized to sentinel/default values.
12. A persisted identity is valid only when both `cacheKey` and `inputHash` are non-empty strings. A partial identity is a contract violation.
13. Unknown stages throw. A legacy/taskId-derived cache identity must not be generated.

## 3. Definitions
- `cacheKey`: stage-specific key string for indexed retrieval.
- `inputHash`: canonical JSON token used for strict equality. The field name is retained, but its current representation is not a cryptographic digest.
- `artifactHash`: SHA3-256 digest of stage output artifact bytes/content identity.
- `pipelineVersion`: semantic version for stage logic affecting output bytes/geometry.
- `cacheNamespaceMode`: config value choosing key namespace scope (`node` or `global`).
- `namespacePrefix`:
  - `node` mode: `node:{nodeId}`
  - `global` mode: `global`

## 4. Canonicalization Rules for `inputHash`
- Object keys are sorted lexicographically.
- Arrays of unordered sets (for example transform artifact sets) are normalized by sorting; ordered arrays preserve original order.
- ISO country codes are normalized to uppercase where applicable.
- Numbers are normalized to canonical JSON numeric form.
- Null/undefined policy:
  - Undefined may be omitted only for schema-declared optional fields.
  - A missing/null required field throws before canonicalization.
  - Explicit null remains null only for schema-declared nullable fields.
- Non-finite numbers throw. Integer/range-constrained fields are validated before serialization; they are not rounded or clamped.
- Empty strings throw for required string fields.
- Canonicalization must be schema-aware. It must not sort every primitive array because band/profile/config arrays are ordered inputs.

## 5. Stage-Specific Key and Hash Definitions
All keys below are prefixed with `{namespacePrefix}:`.

### 5.1 Source Stage
#### `cacheKey`
`{namespacePrefix}:shape:source:v1:{dataSource}:{sourceKey}:{endpointId}`

- `endpointId` is a stable endpoint identifier (not raw query noise).
- `dataSource`, canonical `sourceKey` (`{ISO2}:{adminLevel}`), and `endpointId` are required non-empty values.

#### `inputHash` payload (exclude key fields)
- `upstreamRevision` (e.g. ETag / Last-Modified / content digest)
- `fetchOutputShaping`:
  - `mergePolicy`
  - `filterZoom`
  - `omitDetailsConfig`
  - `excludePolygonAreaCoefficient`
  - `minRingVertices`
  - `geometryEngine`
- `pipelineVersion`

`upstreamRevision` is optional only when the upstream supplies no revision. When absent it is represented explicitly as `null`; a present empty string is invalid.

### 5.2 Geometry Stage
#### `cacheKey`
`{namespacePrefix}:shape:geometry:v1:{sourceKey}:band{bandIndex}`

#### `inputHash` payload (exclude key fields)
- `sourceArtifactHash`
- `sourceBaseTolerance`
- `sourceVertexLimit` (must be `6553`)
- `bandMinZoom`
- `bandMaxZoom`
- `geometryConfigSignature`
- `pipelineVersion`

All fields above are required. `sourceBaseTolerance`, band values, and profile/config values are validated by the tolerance contract before token construction.

### 5.3 TileEmit Stage
#### `cacheKey`
`{namespacePrefix}:shape:tileEmit:v1:band{bandIndex}:z{zBase}:tile{tileId}`

#### `inputHash` payload (exclude key fields)
- `transformArtifactSet` (sorted, duplicate-free `bufferIds` set)
- `bandMinZoom`
- `bandMaxZoom`
- `tileEmitConfigSignature`
- `pipelineVersion`

`bufferIds` is a required array. An explicit empty array is the canonical empty-tile case; a missing array or any empty/non-string member is a contract violation.

## 6. Persistence Requirements
Each cacheable artifact record must store:
- `cacheKey` (indexed)
- `inputHash` (indexed)
- `artifactHash` (indexed)
- stage identity (`source` / `geometry` / `tileEmit`)
- produced output metadata (size/count/timestamps)

Recommended uniqueness:
- unique(`stage`, `cacheKey`)

When writing a new artifact with the same (`stage`, `cacheKey`), the record must be overwritten.

## 7. Cache Hit Algorithm (No Recalculation Mode)
1. Build task payload.
2. Compute and persist task-side:
  - `task.cacheKey`
  - `task.inputHash`
3. Lookup artifacts by `stage + cacheKey`.
4. Select first artifact where `artifact.inputHash === task.inputHash`.
5. If found: reuse artifact.
6. If not found: execute task and persist new artifact with same `cacheKey` and computed `inputHash`.

Important:
- Step 4 is direct string comparison only.
- No recomputation of `inputHash` from stored artifacts during hit check.
- A missing/partial task or artifact identity fails the task. It is not treated as a cache miss.

## 8. Lifecycle Behavior
- `Start`:
  - Tasks are newly generated.
  - Cache reuse is allowed via (`cacheKey`, `inputHash`) matching.
- Start of a resumable session:
  - `startBuildSession` continues existing tasks according to persisted session state.
  - Same cache matching rule applies.
- `Reset`:
  - Remove runtime/task state only.
  - Cache artifacts and metadata remain.
- Explicit `Reload`:
  - Invalidate target cache domain and regenerate.

Invalid persisted identity policy:
- Artifacts without `inputHash` are treated as invalid and must not be reused.
- Artifacts with a missing/empty `cacheKey`, partial identity, unknown stage, or invalid lineage are also invalid.
- Invalid artifacts are removed through the explicit lineage cleanup/invalidation path. Runtime lookup does not derive a compatibility identity.

## 9. Non-Goals
- This spec does not define storage TTL/LRU policy details.
- This spec does not define UI progress behavior.
- This spec does not define a standalone country metadata cache layer.

## 10. Test Requirements (for TDD)
Minimum required tests:
1. Same `cacheKey`, different `inputHash` -> miss.
2. Same `cacheKey`, same `inputHash` -> hit.
3. Different `cacheKey`, same `inputHash` -> miss.
4. `inputHash` is persisted at task creation and reused without recomputation.
5. Stage-specific payload changes that affect output cause `inputHash` change.
6. Fields used only by lookup key do not affect `inputHash`.
7. Same (`stage`, `cacheKey`) write overwrites previous artifact record.
8. Namespace mode switch (`node` / `global`) changes key space as expected.
9. Missing/empty source identity fields throw; no `unknown`, `XX`, `:0`, empty endpoint, or taskId-derived key is produced.
10. Invalid/non-finite band, zoom, tile, tolerance, or config values throw; they are not rounded, clamped, sorted into range, or defaulted.
11. Ordered config arrays with the same members in a different order produce different `inputHash` values.
12. Unordered `bufferIds` sets produce the same token after sorting and deduplication; missing/invalid members throw.
13. Partial persisted `cacheKey` / `inputHash` pairs and unknown stages throw.
