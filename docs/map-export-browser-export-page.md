# Map Export Browser Export Page

## Scope

The browser export surface is an internal route for CLI-driven image generation. It keeps Playwright outside the application: the driver opens the page, submits a normalized manifest job through a window API, waits for a typed state transition, and screenshots one fixed DOM target.

## Route

- Path: `/map-export`
- Screenshot selector: `[data-map-export-screenshot-target="true"]`
- Public browser API: `window.__HDB_MAP_EXPORT__`
- Shared constants and types: `@hierarchidb/map-export`

The route is machine-facing and must not depend on normal dialog navigation.

## Browser API

```ts
type MapExportBrowserApi = {
  getState: () => MapExportBrowserState;
  submitJob: (job: MapExportJob) => Promise<MapExportBrowserState>;
};
```

`submitJob` accepts `MapExportBrowserJob`, a normalized browser job derived from the parsed manifest job. The CLI driver must add `target.treeId` and `target.parentId` before submitting the job because the manifest format does not define the committed tree location for generated nodes.

Contract violations fail immediately with `invalid_job`; the page must not coerce invalid dimensions, bbox values, node payloads, missing jobs, or missing target tree information.

## State Contract

- `idle`: the page is mounted and the API is available.
- `initializing`: the job was accepted and runtime-worker initialization is in progress.
- `ready`: the screenshot target is safe to capture.
- `failed`: the job cannot produce a screenshot; `error.code` identifies the failure class.

Typed error codes currently emitted by the page:

- `invalid_job`
- `job_already_running`
- `runtime_worker_unavailable`
- `node_commit_failed`
- `build_failed`
- `build_timeout`
- `maplibre_not_ready`

## Node and Build Flow

For each `MapExportBrowserJob.nodes[]` entry, the page:

1. creates a node under `target.treeId` / `target.parentId` through `TreeMutationAPI.createNode`.
2. commits the manifest node `data` payload through `TreeNodeUpdaterAPI.updateTreeNode`.
3. starts canonical build with `startBuildSession(nodeType, nodeId, 'committed')`.
4. polls `getBuildSessionStatus` until `completed`, `failed`, or timeout.

Manifest `nodeId` values are logical IDs used by `layers[]`. The browser page resolves those IDs to newly created committed node IDs and exposes the result in `MapExportBrowserState.nodes`.

After build completion, the page loads map layers from `target.parentId` through the existing folder-layer resolution path and filters the result to the committed node IDs selected by `layers[]`. If `layers[]` is empty, every committed manifest node is treated as visible. A visible committed node that cannot be resolved to a renderable MapLibre vector layer keeps the job from reaching `ready` and eventually fails with `maplibre_not_ready`; the page must not silently omit requested layers.

When multiple jobs are submitted to the same mounted browser page, layer resolution must refresh for each accepted job even if `target.parentId` is unchanged. Newly committed manifest nodes are part of the render contract and must not depend on a full page reload to become visible to the map layer resolver.

## Readiness Requirements

The page may return `ready` only after all of the following are true:

1. runtime-worker initialization has completed through the existing `WorkerProvider` / `ensureWorkerAPI()` path.
2. Every manifest node has been created under the explicit `target.treeId` / `target.parentId` with committed `data` payloads.
3. Canonical build has completed successfully for every requested node.
4. MapLibre has applied the requested viewport and bbox.
5. MapLibre has reached idle after all requested layers are attached.
6. The screenshot canvas is nonblank.

The browser page renders shape and route vector-tile layers through `ResourceLayerMap` and location nodes through the existing viewport-query GeoJSON layer hook with normal map export controls disabled. A visible committed node that does not resolve to either vector-tile layers or location GeoJSON layers fails with `maplibre_not_ready` instead of producing a partial screenshot.

## Rollback

Remove the `/map-export` route registration and the `MapExportPage` module. The route is internal and unlinked from normal user navigation, so rollback does not affect existing app routes.
