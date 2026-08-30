# FDM Node And Dashboard Specification

This document defines the FDM-facing node, API, and dashboard responsibilities in HierarchiDB.

The FDM implementation uses IDE-GSM server data and synced Tabular snapshots, but it does not own the `idegsm-project` sync root. `idegsm-project` is responsible for remote project synchronization, server-authoritative YAML editing, and project command execution. FDM is responsible for FDM dashboard behavior, FDM space visualization, and FDM-specific API/data presentation.

## Scope

In scope:

- A new HierarchiDB TreeNode type with `nodeType: "fdm"`.
- FDM React dashboard compatible in appearance and behavior with the current IDE-GSM `dashboard.html` / `dashboard.js` implementation.
- FDM plugin UI under `plugins/fdm-plugin`.
- FDM API client package under `packages/fdm-api`.
- Connected access to IDE-GSM GraphQL APIs needed for FDM space and dashboard data.
- Read-only use of synced Tabular snapshots produced under an `idegsm-project` sync root.
- Disconnected visualization using locally synced read-only CSV / Tabular data.

Out of scope:

- Owning or materializing `idegsm-project` tree nodes.
- Editing server-side YAML files.
- Running `sim` / `calib` directly from FDM nodes unless delegated through the `idegsm-project` command contract.
- CSV / Tabular write support in the initial implementation.
- Persisting endpoint URLs, tokens, raw credentials, server absolute paths, original CSV text, or duplicated Tabular rows in TreeNode payloads or FDM dashboard state.

## Packages

The implementation should be split as follows:

- `plugins/fdm-plugin`: `fdm` TreeNode plugin, node create/edit UI, React dashboard UI, FDM visualization UI, dashboard-specific state and components.
- `packages/fdm-api`: public `fdm` node data types plus FDM-specific client services and DTOs for IDE-GSM GraphQL APIs.
- `packages/ide-gsm-client`: reusable low-level IDE-GSM GraphQL client, named-connection resolution contract, and health-check port.
- `packages/ui/ide-gsm-connection`: shared React Step 2 component and presentation/controller hooks used without duplication by both `fdm` and `idegsm-project` dialogs.
- `app/src/ide-gsm-connection/`: app-level runtime provider that owns raw host, port, endpoint, CORS proxy, and credential values.
- `plugins/idegsm-project-plugin` and `packages/idegsm-project-api`: separate owner of IDE-GSM project sync roots, YAML editing, command execution, run subscription, and cancellation.

`fdm-api` should depend on stable client contracts rather than duplicating synchronization identity logic from `idegsm-project-api`.

## Node Icon

The canonical `fdm` icon is MUI `ViewInArOutlined`. It represents the FDM lattice and required 3D visualization while remaining distinguishable from folder, YAML, and Tabular node icons. The plugin manifest must declare it as both the preferred MUI icon and the fallback for surfaces that do not load a plugin-specific component:

```ts
icon: {
  mui: 'ViewInArOutlined',
  component: {
    specifier: '@hierarchidb/fdm-plugin/icon',
    exportName: 'FdmPluginIcon',
  },
}
```

`FdmPluginIcon` must preserve the `ViewInArOutlined` silhouette rather than introducing an unrelated dashboard or spreadsheet glyph. The same canonical icon must be used in the tree, create menus, breadcrumbs, node dialogs, and node references.

Connection and synchronization state must be rendered by the same shared status-adornment layer used by `idegsm-project`; it must not replace or recolor the base icon. At minimum, the shared layer supports a success dot for a healthy synchronized connection, animated `Sync` while an automatic synchronization is in progress, `CloudOff` for disconnected or stale server access, and `ErrorOutline` for synchronization failure. Status must not be conveyed by color alone; accessible labels or tooltips must expose its textual meaning. Base icon color inherits the active theme through `currentColor`; only the shared status affordance uses semantic status colors. Status adornments are ephemeral and must not be persisted in `FdmNodeData`.

## Node Creation Entry Points

`fdm` must be registered as a normal creatable plugin node type in the TreeConsole creation menu model. In every TreeConsole context where its parent and plugin capabilities permit creation, it must appear alongside the other available node types in both of these entry points:

- the TreeConsole bottom-right `DynamicSpeedDial`; and
- the `Create` submenu opened from a TreeConsole node's right-click context menu.

Both entry points must be generated from the same installed-plugin manifest and menu-builder data. They must therefore use the same label, `FdmPluginIcon`, menu grouping/order, visibility rule, and creation eligibility, and must not maintain separate hard-coded entries.

Selecting either entry starts the standard `fdm` plugin create flow for the resolved parent node, beginning with the normal Step 1 basic-information step and continuing to the shared Step 2 `Connection` step. The two entry points must invoke the same creation action and draft/commit path and must not create duplicate nodes or bypass dialog validation. When creation is unavailable for the current parent or TreeConsole context, both entry points must apply the same hidden or disabled state and expose a consistent reason where the common menu UI supports one.

## FDM TreeNode Contract

HierarchiDB must introduce `nodeType: "fdm"` as a first-class TreeNode type. An `fdm` node is a local, editable dashboard configuration and reference to one IDE-GSM server-side FDM space. It is not a folder, filesystem mount, synchronized project root, or copy of the server-side FDM workspace.

Committed node data must use a versioned contract equivalent to:

```ts
interface FdmNodeData {
  version: 1;
  connectionName: string;
  spaceId: string;
  idegsmProjectNodeId?: NodeId;
  selectedStateDir?: string;
  viewMode: 'lattice-3d' | 'matrix-2d' | 'map';
  filters: {
    profiles: string[];
    datasets: string[];
    computes: string[];
    checkpoints: string[];
  };
  axisMap: {
    xOuter: 'profile' | 'dataset' | 'checkpoint' | 'compute';
    xInner: 'profile' | 'dataset' | 'checkpoint' | 'compute';
    y: 'profile' | 'dataset' | 'checkpoint' | 'compute';
    z: 'profile' | 'dataset' | 'checkpoint' | 'compute';
  };
  tabularSnapshotRefs: string[];
}
```

Step 2 promotion must construct a complete `FdmNodeData`; Step 3 must never receive a partial object. For fields not selected in Step 1 or Step 2, version 1 uses these exact creation defaults:

```ts
const FDM_NODE_DATA_V1_DEFAULTS = {
  version: 1,
  viewMode: 'lattice-3d',
  filters: {
    profiles: [],
    datasets: [],
    computes: [],
    checkpoints: [],
  },
  axisMap: {
    xOuter: 'profile',
    xInner: 'dataset',
    y: 'checkpoint',
    z: 'compute',
  },
  tabularSnapshotRefs: [],
} as const;
```

An empty filter array means that no restriction is applied for that dimension; it does not mean that the dashboard has zero values. Optional `idegsmProjectNodeId` and `selectedStateDir` properties are absent until explicitly selected and validated. Edit promotion preserves existing valid presentation values and applies no default replacement. Missing or invalid required fields in an existing version 1 committed node are contract errors, not candidates for default backfill.

The four `axisMap` values must be a permutation of `profile`, `dataset`, `checkpoint`, and `compute`. Invalid or duplicated axes are rejected before commit. `connectionName` is an opaque lookup key for the app-level runtime provider and is the only connection value persisted by the node. `spaceId` identifies the server-side FDM space and is required for a connected dashboard. `idegsmProjectNodeId` is an optional local reference used to resolve the owning `idegsm-project` for project commands and synchronized result snapshots; it does not transfer project ownership to the FDM plugin.

The `fdm` TreeNode owns only safe local presentation settings and references. IDE-GSM remains authoritative for FDM space metadata, state, cells, logs, runtime events, workspace contents, and execution results. Endpoint and credentials are resolved at runtime through the app-level authenticated client provider.

Creating an `fdm` node must allow selection of an accessible existing FDM space. Creating a new server-side FDM space is a connected server operation through `fdmSpaceCreate`; the local node is committed only after the server returns the canonical `spaceId`. Deleting the local `fdm` TreeNode does not delete or archive the server-side FDM space. Server archive or deletion requires a separate explicit FDM space action with the server's authorization, confirmation, and dry-run rules.

## Dialog Step 2: Connection (`接続先`)

Step 1 follows the normal HierarchiDB basic-information contract. Step 2 for both create and edit dialogs must be the shared `Connection` (`接続先`) step. The `fdm` plugin must use the same `IdeGsmConnectionStep` component, validation, runtime-provider contract, and external-service health state model as the `idegsm-project` plugin; it must not fork or copy this code. The health state/check lifecycle is the generic `@hierarchidb/ui-external-service-health` contract described in `docs/external-service-health-spec.md`, not an IDE-GSM-owned model.

The step provides either:

- a `Connection name` (`接続先名`) selector backed by the app-level named-connection registry; or
- `Server hostname or IP address` (`サーバーのホスト名/IPアドレス`) and `Port` (`ポート番号`) inputs when manual target editing is enabled.

The normal direct-connection configuration is supplied by the application and is read-only in the dialog. In development it normally resolves to `localhost`; in production it normally resolves to the origin from which HierarchiDB is served, including a GitHub Pages deployment when that is the configured origin. These are runtime-provider defaults, not plugin defaults.

The step includes a `Connect through cors-proxy` (`cors-proxyを介しての接続`) checkbox. While it is off, the provider-supplied host and port are displayed but disabled. Turning it on enables the hostname/IP and port inputs and routes HTTP and GraphQL WebSocket access through the configured HierarchiDB CORS proxy boundary. The proxy base URL, resolved target URL, GraphQL URL, WebSocket URL, credentials, and raw hostname/port values remain app-level runtime-provider data.

Only `connectionName` is written to committed `data` or editing `draftData`. The CORS proxy checkbox and manually entered target values must be resolved to a named runtime connection before node commit. They must not be copied into TreeNode metadata, IndexedDB, localStorage, URL parameters, public errors, or logs. Resolving an unknown or unavailable name fails closed with a stable error such as `CONNECTION_UNAVAILABLE`.

After the connection input is complete, the shared step performs a debounced health check through the runtime provider and shows a health area with at least `incomplete`, `checking`, `healthy`, `unhealthy`, `authentication-required`, and `incompatible` states plus the last checked time where available. Raw endpoint values, credentials, provider exception text, and server response bodies must not appear in the health UI or logs. Stale or out-of-order health responses must not replace the result for the latest connection input.

Below the shared connection controls, the `fdm` plugin adds an FDM space selector backed by `fdmSpaces` for the healthy named connection. The user may select an accessible existing space or explicitly create a new server-side space through `fdmSpaceCreate`. A canonical `spaceId` must be available before Step 2 can complete. Space selection/creation is plugin-specific UI composed around the shared `IdeGsmConnectionStep`; it must not fork the shared connection implementation. The selected space must not be deferred to Step 3 or any later step.

Step 2 has no `Sync now`, refresh, or resync control. When the latest connection state becomes healthy, `fdmSpaces` is loaded automatically; catalog loading is connection-form data acquisition and does not synchronize an FDM dashboard or owning project tree. FDM metadata/dashboard synchronization is triggered only by successful node creation/promotion, reconnection, or a relevant authenticated server notification. Any owning `idegsm-project` reconciliation is triggered by that project's own creation/reconnect/server-notification contract, not by the FDM dialog. Health status, last health-check time, catalog loading state, and in-flight state are ephemeral UI/runtime state and are not persisted in the node.

## Step 2 Completion And Node Promotion

Step 3 and later FDM operations must receive a committed, non-draft `fdm` node with a canonical server `spaceId`. Pressing `Next` after Step 2 has changed, or while creating a node that has not yet been committed, starts a staged node-promotion operation. It must not expose partially prepared FDM metadata or dashboard snapshots as ready state.

The shared `PluginDialogHost` uses the same awaited `beforeNavigateNext` capability defined for `idegsm-project`. It supplies the latest merged draft, current committed node/version when present, target step, and an `AbortSignal`, and it must not change the active step, URL step, or persisted dialog progress until the capability succeeds. Rejection, cancellation, promotion failure, or `save-draft` failure remains on Step 2 and is shown as a blocking error rather than a warning followed by navigation.

While the capability runs, the host presents a foreground modal message dialog titled `Creating node` (`ノード作成が進行中`) or `Updating node` (`ノード更新が進行中`). The modal cannot be dismissed by Escape or backdrop interaction. It displays the current phase and provides a `Cancel` action during cancellable preparation phases. The shared host owns modal/navigation orchestration and cancellation; `fdm-api` owns the typed preparation contract; `fdm-plugin` adapts Step 2 data and performs the canonical node commit through normal node services.

Promotion follows this state model:

```text
draft -> preparing -> committing -> ready
                    -> canceling -> reverting -> draft
                    -> failed
```

Preparation must:

1. Validate the latest draft, named connection, credentials, health result, and canonical `spaceId`.
2. Capture the existing committed node/version for an edit operation.
3. Load and validate authoritative FDM space metadata and the initial dashboard response in operation-local memory that is not exposed as committed node state.
4. Resolve any owning `idegsm-project` and safe Tabular snapshot references without duplicating project synchronization or Tabular rows.
5. Fill the complete version 1 payload with the exact defaults above, then commit `FdmNodeData` through one canonical CoreDB node transaction with an expected-node-version condition.

FDM promotion does not copy the dashboard response or Tabular rows into a second FDM-owned database. `tabularSnapshotRefs` may refer only to already committed snapshots owned by the synchronized project/Tabular data path. Consequently, the FDM publication boundary is the single CoreDB transaction above; it does not claim cross-database atomicity. If a future version must create FDM-owned artifacts in another database, it must adopt the durable generation/journal/commit-marker protocol from the `idegsm-project` specification before doing so.

For create, cancellation or failure before the commit boundary discards operation-local preparation and returns to the editable draft. For edit, the existing committed node remains authoritative until promotion succeeds. In both cases the user's Step 2 draft values remain available for correction or retry unless the user separately cancels the outer node dialog.

`Cancel` is idempotent and aborts cancellable client work before discarding operation-local preparation. The short CoreDB `committing` phase is a non-interruptible boundary; the cancel control is disabled while that transaction completes. Stale completion callbacks from a canceled or superseded promotion operation must not commit data. A failed operation keeps the modal open with a stable error and provides `Retry` and `Revert`; `Revert` discards local preparation and returns to Step 2 only after cleanup has settled.

Revert applies to HierarchiDB node, metadata, and snapshot preparation. It must never implicitly delete or archive an existing server-side FDM space. If Step 2 created a new server-side FDM space before local promotion was canceled or failed, that space remains on the server and the UI must identify it as created but not bound to the local node. Automatic server cleanup requires a future explicit, idempotent provisioning/compensation contract and must not be inferred from local cancel.

After a successful CoreDB commit, the modal closes automatically and the dialog advances to Step 3. If Step 2 is unchanged and the existing committed node is already healthy and ready, `Next` may advance directly without repeating promotion. Once Step 3 has been reached, closing the node dialog does not revert or delete the committed node or the server-side FDM space.

## Dialog Step 3 Entry Contract

Step 3 is an operational/configuration screen for the ready committed `fdm` node. Its dashboard controls are governed by the Dashboard Compatibility and Connected Operation sections below. Step 3 must not execute against draft identity or an uncommitted `spaceId`.

Any Step 3 shortcut for `sim` or `calib` must resolve and delegate to the owning committed `idegsm-project` command service. It must not create an FDM-owned command mutation, Build Session, status authority, or cancellation path. Closing Step 3 does not cancel a delegated server task.

## Dashboard Compatibility

The FDM dashboard should be ported as a React app while preserving the user-visible behavior and layout of the existing IDE-GSM dashboard resources:

- `api-idegsm/src/main/resources/META-INF/resources/dashboard.html`
- `api-idegsm/src/main/resources/META-INF/resources/dashboard.js`
- related dashboard runtime/feed/scene utility scripts where applicable

Compatibility means:

- Same dashboard views and controls, including state/live summary, FDM space and state selection, filters, matrix, cell detail, log tail, runtime feed, directory browser, and supported FDM actions.
- Same simulation/result inspection workflows where the server API supports them.
- A required Three.js 3D lattice compatible with the current dashboard scene; 3D is not deferred or optional.
- The same `profile x dataset x checkpoint x compute` four-axis model, configurable axis mapping, cell placement, status colors, current/next/blocking emphasis, hover, pin/select, camera rotation, pan, zoom, reset, and runtime-event scene feedback.
- A 2D matrix view and map/result visualization alongside the 3D lattice.
- Comparable error and loading states.
- No reliance on raw server filesystem paths from the browser.

The 3D implementation may be reorganized into React hooks and components, but its observable interactions and state meanings must remain compatible with the existing `dashboard-scene-core.js` and dashboard scene logic. Removal or simplification of the 3D lattice is a specification change and requires a separate decision.

React components should follow existing HierarchiDB plugin UI patterns and should avoid introducing a separate dashboard architecture unless the existing plugin boundaries require it.

## FDM Data Sources

The FDM dashboard may read from two source classes.

Connected sources:

- IDE-GSM GraphQL FDM space APIs.
- IDE-GSM GraphQL dashboard, runtime, directory, and result metadata APIs.
- Server-side run/status/log APIs when showing live execution-related information.

Disconnected sources:

- Read-only Tabular snapshots materialized on demand after a Styler selected an `idegsm-project` CSV path.
- Styler / Resolver references to synced Tabular snapshots.

Disconnected sources are local snapshots, not proof of remote freshness. The dashboard must show stale or missing-source state when sync metadata indicates it.

## FDM Space And Node Responsibility

An `fdm` node represents FDM dashboard and FDM space usage, not a remote IDE-GSM project mount.

An FDM node may reference:

- FDM space identifier.
- Safe logical source identifiers.
- Local Tabular snapshot references.
- Visualization configuration.
- Dashboard view state that is safe to persist.

An FDM node must not store:

- GraphQL endpoint URL.
- JWT, token, API key, or raw credential.
- IDE-GSM server absolute path.
- original CSV text or duplicated Tabular rows.
- SSH / EC2 / rsync / container lifecycle configuration.

If an FDM workflow needs project-level IDE-GSM operations, it should link to or delegate to the owning `idegsm-project` sync root rather than duplicating command execution or remote project identity.

## Disconnected Operation

When the IDE-GSM server is disconnected, the FDM dashboard may continue to visualize previously materialized tracked local data. A metadata-only CSV discovered during project creation is not a disconnected data source.

Allowed:

- Load local read-only Tabular snapshots.
- Render maps and charts from synced result CSV data.
- Use Styler / Resolver bindings that reference synced Tabular snapshots.
- Display sync freshness, stale, or missing-source warnings from metadata.

Unavailable:

- Refresh server data.
- Start `sim` / `calib`.
- Cancel active server runs.
- Subscribe to live server logs or progress.
- Edit YAML or CSV on the server.

Disconnected mode must not queue writes or command requests for later replay.

## Connected Operation

When connected, `fdm-api` may use IDE-GSM GraphQL APIs to load FDM dashboard data and FDM space information.

The FDM dashboard may display live status and logs when server APIs provide run identifiers or subscriptions. The server remains the SSOT for run state. FDM UI may hold ephemeral display state, but it must not persist authoritative run state or log bodies in CoreDB / TreeNode / IndexedDB.

Project-level commands such as `sim` and `calib` are owned by the `idegsm-project` command contract. If FDM UI offers a shortcut to start or inspect these commands, the action must resolve the owning `idegsm-project` sync root and use the same command/run/cancel API path.

Any asynchronous IDE-GSM command started through an FDM shortcut must register the same AppBar Build Session projection owned by the resolved `idegsm-project`. FDM must not create a duplicate `fdm`-owned session for the same server task. Selecting the AppBar item opens the shared IDE-GSM progress screen, and cancellation from that screen uses `cancelTask(taskId)` through the owning project command service.

The standalone normative Build Session contract is [ide-gsm-build-session-spec.md](./ide-gsm-build-session-spec.md).

The connected 3D lattice reads its authoritative cell dimensions and state from `fdmDashboardStatus`, cell inspection from `fdmCellDetail`, live cell log updates from `subscribeFdmCellLog`, and scene/runtime feedback from `subscribeFdmRuntimeEvents`. It must resynchronize from `fdmDashboardStatus` after reconnect and after runtime events that indicate an authoritative snapshot change.

## Tabular And Styler Integration

FDM result CSV data may be referenced as read-only Tabular snapshots only after the Styler path-selection flow has materialized the selected `idegsm-project` CSV. Creating the project node does not download every result CSV. FDM does not introduce a second acquisition path and cannot treat a metadata-only CSV node as a snapshot.

Styler / Resolver source references should use a safe synced source shape such as:

- local snapshot identifier
- origin `idegsm-project` node identifier
- committed content generation identifier
- origin logical `relativePath`
- `syncedAt`
- content digest

Parsed and normalized CSV-derived rows are persisted in the dedicated Dexie-backed Tabular store only after on-demand materialization for disconnected use. Subsequent reconnect/notification synchronization is owned by the tracked CSV entry under `idegsm-project`. FDM dashboard and Styler / Resolver payloads must not duplicate the original CSV text or normalized rows; they read the snapshot through the Tabular storage/service boundary using its reference identifier.

## API Client

`packages/fdm-api` should provide FDM-specific service interfaces around IDE-GSM GraphQL access.

Responsibilities:

- Fetch FDM space metadata.
- Fetch dashboard runtime/feed data needed by the React dashboard.
- Fetch result metadata and safe logical CSV references.
- Expose typed DTOs for FDM dashboard components.
- Surface stable public error codes for UI handling.

### Required IDE-GSM GraphQL Surface

`packages/fdm-api` must expose typed methods for the following IDE-GSM GraphQL operations. Any operation or field missing from the supported IDE-GSM server revision must be added server-side before the corresponding FDM UI capability is enabled. Server changes must be additive so the existing fallback dashboard continues to work during migration.

Queries:

- `fdmSpaces`: accessible spaces and default-space metadata.
- `fdmDashboardStatus`: state/live summaries, dimensions, cells, selected state, and data required by both 2D and 3D rendering.
- `fdmCellDetail`: selected-cell timestamps, ETA, status, and bounded recent log lines.
- `fdmRuntimeDiagnostics`: startup and recovered runtime state.
- `fdmDirectoryTree` and `fdmDirectoryInfo`: logical FDM space directory browsing without absolute paths.
- `getTaskStatus`: authoritative task-state recovery when a subscription is unavailable or reconnects.
- `activeProjectTasks`: current-user active task discovery used to restore IDE-GSM AppBar Build Sessions after browser reload.

Mutations:

- `fdmSpaceCreate`, `fdmSpaceUpdate`, and `fdmSpaceDelete`: explicit FDM space lifecycle operations.
- `fdmVerify`, `fdmFill`, `fdmCompare`, `fdmDiagnose`, and `fdmClean`: dashboard workspace actions.
- `fdmDirectoryRemove`: explicit FDM directory removal with dry-run/apply semantics.
- `importProject` and `exportProject`: project snapshot workflow bridge where exposed by the FDM workflow.
- `cancelTask(taskId)`: cancellation request for a server task.
- Existing `sim`, `calib`, and `check` command mutations through the owning `idegsm-project` command service, not a second FDM-specific command implementation.

Subscriptions:

- `subscribeFdmCellLog`: bounded live log snapshots for the selected cell.
- `subscribeFdmRuntimeEvents`: progress and phase events used by panels and 3D scene feedback.
- `subscribeTaskOnFrontend` or the canonical execution subscription: authoritative lifecycle for launched tasks.

The GraphQL DTOs must expose stable logical identifiers and all fields needed by the current dashboard semantics, including `spaceId`, `stateDir`, `profile`, `dataset`, `compute`, `checkpoint`, raw/normalized status, current/next/blocking markers, timestamps, progress, and task ID. They must not expose server absolute paths as client-owned identity. Existing response fields may not be removed, reinterpreted, or made newly required during the migration; incompatible evolution requires additive versioned fields.

Read operations require at least the server's FDM viewer permission. Run/fill/verify operations require runner permission, clean/remove/metadata updates require maintainer permission, and archive or physical deletion requires owner permission. The client must use server authorization results as authoritative and must not infer permissions from locally stored node data.

Non-responsibilities of `packages/fdm-api`:

- Persist credentials.
- Materialize TreeNodes; creation and persistence of the `fdm` node belong to `plugins/fdm-plugin` through normal HierarchiDB node services.
- Own `idegsm-project` sync state.
- Own `sim` / `calib` command SSOT.
- Write server-side YAML or CSV.

Credential and endpoint resolution should happen through app-level providers or shared authenticated client boundaries, not through persisted FDM node payloads.

## Acceptance Criteria

- `nodeType: "fdm"` is registered as a first-class HierarchiDB TreeNode type and persists the versioned safe node contract.
- The canonical node icon is `ViewInArOutlined`, with connection and automatic synchronization state shown through the shared accessible status-adornment layer.
- `fdm` appears alongside other creatable node types in both the TreeConsole bottom-right `DynamicSpeedDial` and the node right-click `Create` submenu, and both entries launch the same standard plugin create flow for the resolved parent.
- Step 2 uses the shared connection component, persists only `connectionName` as connection data, displays debounced server health, requires selection or creation of a canonical FDM space, and exposes no manual sync/refresh control.
- FDM metadata/dashboard synchronization runs only on successful creation/promotion, reconnection, or a relevant authenticated server notification.
- Pressing Step 2 `Next` after a change runs the host's awaited `beforeNavigateNext` guard behind a foreground progress modal and commits one complete default-filled version 1 payload before Step 3; cancellation or failure stays on Step 2 without changing the existing committed node or implicitly deleting the server-side FDM space.
- New nodes use the exact version 1 defaults for view, filters, axis mapping, and snapshot references; existing invalid records are not silently backfilled.
- FDM promotion commits only CoreDB node data and references already committed Tabular snapshots, so it does not claim cross-database atomicity or duplicate dashboard/Tabular data.
- Step 3 receives only a ready committed `fdm` node; any project command shortcut delegates to the owning committed `idegsm-project` command and Build Session services.
- Creating an `fdm` node can bind an existing accessible FDM space or create a server space first and then store its canonical `spaceId`.
- Local FDM node deletion never implicitly deletes or archives the server-side FDM space.
- FDM dashboard React UI reproduces the current IDE-GSM dashboard's views and interactions.
- The Three.js 3D lattice is migrated with the four-axis layout, axis remapping, status/emphasis semantics, cell interaction, camera controls, and runtime-event feedback.
- `packages/fdm-api` exposes typed FDM-facing client services without persisting endpoint or credential material.
- All required queries, mutations, and subscriptions are available through `packages/fdm-api`; missing server operations are added additively to IDE-GSM.
- Connected dashboard mode loads FDM space/dashboard data through IDE-GSM GraphQL APIs.
- Disconnected dashboard mode can visualize synced read-only Tabular snapshots.
- Project creation does not fetch CSV bodies; disconnected FDM use is limited to CSV sources already materialized and tracked through Styler selection.
- FDM node state does not contain original CSV text, duplicated Tabular rows, server absolute paths, endpoint URLs, or credentials.
- FDM UI does not duplicate `idegsm-project` sync root ownership.
- Any shortcut to `sim` / `calib` delegates to the `idegsm-project` command/run contract.
- IDE-GSM commands launched from FDM shortcuts appear once in the AppBar Build Session list under the owning `idegsm-project`, with progress-screen navigation and cancellation support.
