# Shape Cache Key and Input Hash Specification

## Status
- Draft
- Last updated: 2026-02-12

## 1. Purpose
This document defines how cache identity must be handled in the shape build pipeline (`fetch`, `transform`, `vt`).

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
  - `fetch`: `global`
  - `transform`: `node`
  - `vt`: `node`
10. A dedicated `countryMetadataCache` is out of scope and must not be introduced in this design.

## 3. Definitions
- `cacheKey`: stage-specific key string for indexed retrieval.
- `inputHash`: `sha256(canonical_json(payload))`, where payload contains only output-affecting inputs excluding `cacheKey` fields.
- `artifactHash`: hash of stage output artifact bytes/content identity.
- `pipelineVersion`: semantic version for stage logic affecting output bytes/geometry.
- `cacheNamespaceMode`: config value choosing key namespace scope (`node` or `global`).
- `namespacePrefix`:
  - `node` mode: `node:{nodeId}`
  - `global` mode: `global`

## 4. Canonicalization Rules for `inputHash`
- Object keys are sorted lexicographically.
- Arrays preserve original order (no sorting).
- ISO country codes are normalized to uppercase where applicable.
- Numbers are normalized to canonical JSON numeric form.
- Null/undefined policy:
  - Undefined fields are omitted.
  - Explicit null remains null.

## 5. Stage-Specific Key and Hash Definitions
All keys below are prefixed with `{namespacePrefix}:`.

### 5.1 Fetch Stage
#### `cacheKey`
`{namespacePrefix}:shape:fetch:v1:{dataSource}:{iso2}:adm{adminLevel}:{endpointId}`

- `endpointId` is a stable endpoint identifier (not raw query noise).

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

### 5.2 Transform Stage
#### `cacheKey`
`{namespacePrefix}:shape:transform:v1:{dataSource}:{iso2}:adm{adminLevel}:band{bandIndex}`

#### `inputHash` payload (exclude key fields)
- `fetchArtifactHash`
- `bandMinZoom`
- `bandMaxZoom`
- `zBase`
- `transformConfigAffectingOutput`
- `pipelineVersion`

### 5.3 VT Stage
#### `cacheKey`
`{namespacePrefix}:shape:vt:v1:{dataSource}:band{bandIndex}:z{z}:x{x}:y{y}`

#### `inputHash` payload (exclude key fields)
- `transformArtifactSetHash` (derived from ordered transform artifacts used for the tile)
- `vtConfigAffectingOutput`
- `layerSchema`
- `geometryEngine` (if output-relevant)
- `pipelineVersion`

## 6. Persistence Requirements
Each cacheable artifact record must store:
- `cacheKey` (indexed)
- `inputHash` (indexed)
- `artifactHash` (indexed)
- stage identity (`fetch` / `transform` / `vt`)
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

## 8. Lifecycle Behavior
- `Start`:
  - Tasks are newly generated.
  - Cache reuse is allowed via (`cacheKey`, `inputHash`) matching.
- `Resume`:
  - Continue existing tasks.
  - Same cache matching rule applies.
- `Reset`:
  - Remove runtime/task state only.
  - Cache artifacts and metadata remain.
- Explicit `Reload`:
  - Invalidate target cache domain and regenerate.

Legacy policy:
- Artifacts without `inputHash` are treated as invalid and must not be reused.
- They may be dropped eagerly during reset/reload or lazily on first key lookup.

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
