# Stage Rename Risk Audit: `Fetch/Transform/VT` -> `Source/Geometry/TileEmit`

## 1. Purpose

This document fixes the preconditions and guardrails for renaming stage vocabulary in shape/route build flows.

Target rename:

- `Fetch` -> `Source`
- `Transform` -> `Geometry`
- `VT` -> `TileEmit`

Goal:

- avoid semantic collisions with already-established meanings of `source` and `geometry`
- keep orchestrator logic descriptor/capability-driven
- make rename work executable without local interpretation differences

## 2. Scan Scope and Method

Date: 2026-03-01 JST

Primary scan commands:

```sh
rg -n --glob '!**/{__tests__,docs,dist}/**' --glob '!**/*.{test,spec}.*' "\b(fetch|transform|vt)\b" \
  packages/vt-orchestrator plugins/shape-plugin packages/runtime-worker app/src

rg -n --glob '!**/{__tests__,docs,dist}/**' --glob '!**/*.{test,spec}.*' "\bsource\b" \
  packages/vt-orchestrator plugins/shape-plugin packages/runtime-worker app/src

rg -n --glob '!**/{__tests__,docs,dist}/**' --glob '!**/*.{test,spec}.*' "\bgeometry\b" \
  packages/vt-orchestrator plugins/shape-plugin packages/runtime-worker app/src

rg -n --glob '!**/{__tests__,docs,dist}/**' --glob '!**/*.{test,spec}.*' "\b(tileEmit|tile-emit|tileemit|TileEmit)\b" \
  packages/vt-orchestrator plugins/shape-plugin packages/runtime-worker app/src
```

Observed counts (same command set):

- `fetch|transform|vt`: 813
- `source`: 257
- `geometry`: 486
- `tileEmit|tile-emit|tileemit|TileEmit`: 0

## 3. Collision Findings

### 3.1 `Source` rename risk: High

`source` is already widely used with different meanings:

- data-source domain value (`dataSource`, strategy selection, validation errors)
- map rendering source ids (`resource-source-*`)
- event/message origin markers (`source: 'worker' | 'event' | 'snapshot'`)
- tree operation source node semantics (copy/move/import)

Representative paths:

- `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`
- `plugins/shape-plugin/src/worker/api/api-internal-execution-core.ts`
- `app/src/router/routes/map/MapPage.tsx`
- `app/src/router/routes/map/useFolderLayers.ts`
- `app/src/worker-runtime/client.ts`

### 3.2 `Geometry` rename risk: High

`geometry` is already a core GeoJSON domain term in orchestrator and plugin logic:

- `Feature<Geometry>` type contracts
- geometry validity/simplify/filter/snap utility names
- geometry metrics and diagnostics

Representative paths:

- `packages/vt-orchestrator/src/transform/geometry/*.ts`
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler/execute.ts`
- `plugins/shape-plugin/src/services/vt/fetchGeometryFilters.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts`

### 3.3 `TileEmit` rename risk: Low

`TileEmit` is currently unused in code paths (0 matches in scan scope), so it is the safest new stage token.

## 4. Fixed Naming Policy (Mandatory)

To avoid ambiguity, stage rename must use distinct identifiers for machine keys and labels.

### 4.1 Machine-level identifiers

Use stage ids with explicit suffix:

- `source-stage`
- `geometry-stage`
- `tile-emit-stage`

Do not use bare `source` or bare `geometry` as stage discriminator keys in control logic.

### 4.2 UI/document labels

Use human labels:

- `Source`
- `Geometry`
- `TileEmit`

UI labels are presentation only and must not be used as dispatch keys.

### 4.3 Capability mapping (control truth)

Control truth remains capability-driven:

- `source-stage` -> `io`
- `geometry-stage` -> `geometry`
- `tile-emit-stage` -> `tile-emit`

No branch may dispatch directly on legacy or UI stage words.

## 5. Forbidden and Required Patterns

### 5.1 Forbidden

- `if (stage === 'source') { ... }`
- `if (stage === 'geometry') { ... }`
- Reusing existing domain fields named `source` (data/map/event) as stage fields
- Introducing compatibility fallback aliases not explicitly approved

### 5.2 Required

- Stage control key is `stageId` (`*-stage`) + `capability`
- Domain fields keep domain names:
  - data source remains `dataSource`
  - map source remains `sourceId`/layer source concept
  - GeoJSON remains `geometry`
- At API boundaries, map stage key to UI label explicitly via mapper function

## 6. Implementation Order (for smooth execution)

1. Introduce canonical stage ids (`source-stage|geometry-stage|tile-emit-stage`) in shared contracts.
2. Migrate orchestrator dispatch and queue grouping to stageId/capability first.
3. Migrate runtime-worker and shape plugin mappers next.
4. Apply UI label rename after control-path migration is stable.
5. Remove remaining legacy `fetch|transform|vt` checks from control paths.

## 7. Acceptance Criteria for Rename Safety

- No control-logic branch compares stage with bare `source` or bare `geometry`.
- Existing domain meanings of `source` and `geometry` remain unchanged and unambiguous.
- Stage dispatch is capability-based in orchestrator paths.
- UI uses `Source/Geometry/TileEmit` labels without leaking them into execution keys.
- `rg` confirms no new ambiguous stage fields named only `source` or `geometry`.

## 8. References

- `plans/shape-graph-5stage-pipeline-plan.md`
- `plans/shape-stage-keyword-removal-backlog.md`
- `plans/shape-5stage-pure-function-spec.md`
- `packages/runtime-worker/docs/build-session-terminology-ssot.md`
- `packages/runtime-worker/docs/build-session-orchestrator-state-transitions.md`

## 9. Revision Note

- 2026-03-01: Initial collision audit and naming guardrails added before stage-vocabulary migration.
