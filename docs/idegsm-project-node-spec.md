# IDE-GSM Project Node Specification

This document defines the `idegsm-project` node contract for HierarchiDB.

The normative IDE-GSM server/GraphQL contract is `api-idegsm/docs/HIERARCHIDB_INTEGRATION_SPEC_ja.md` in the IDE-GSM repository. This document owns client materialization and UI behavior; it must not redefine server ordering, transfer, authorization, or task-log semantics differently.

The `idegsm-project` node represents an IDE-GSM server-side project directory as a server-authoritative sync root in the HierarchiDB tree. It is not a generic local folder and is not a direct filesystem mount. The server-side project remains the authoritative source; HierarchiDB materializes a browser-local, read-only projection for browsing, disconnected visualization, and connected server-authoritative editing.

## Current And Target Architecture

The current codebase contains a mounted IDE-GSM filesystem projection that reads remote entries on demand and exposes TreeNode-compatible values without materializing child nodes in CoreDB. That implementation may be incomplete and is scheduled for removal. It is historical implementation context, not the target behavior or a compatibility requirement.

The normative target is the `idegsm-project` synchronization model defined by this document. The user-facing project tree must consist of CoreDB / Dexie-backed synchronized nodes. The old mount adapter, mounted-node reference flow, mounted-tree UI route, legacy feature flags, and projection-specific composition must be removed after the synchronized replacement is available.

Reusable low-level parts may be extracted before removal when they have an independent contract, including authenticated GraphQL transport, DTO parsing, logical-path validation, and redaction. The old projection adapter itself must not remain as the synchronization engine or as an alternative user-facing project tree.

## Scope

In scope:

- `idegsm-project` node type as a special folder-like sync root.
- Initial and reconnect-time full hierarchy/metadata sync from an IDE-GSM server-side project directory.
- Local CoreDB materialization of read-only folder-like, YAML, and CSV-backed Tabular source nodes under the sync root.
- On-demand CSV content acquisition when a Styler source selects a CSV path, followed by tracked content synchronization for that CSV.
- Connected YAML editing through an IDE-GSM server write API.
- Project-level context menu commands under `ide-gsm`, initially `sim`, `calib`, and `check`.
- Server-authoritative run state subscription, progress log display, and cancellation request.
- Safe sync metadata that does not expose endpoint URLs, credentials, raw server paths, or raw CSV bodies.

Out of scope for the initial implementation:

- Offline write queue.
- Optimistic local writes.
- Local conflict merge UI.
- CSV / Tabular write support.
- Directory-open lazy sync.
- Remote / SSH / EC2 / rsync / container lifecycle commands unless separately specified.

## Packages

The implementation should be split as follows:

- `plugins/idegsm-project-plugin`: UI node plugin, context menu integration, YAML editor integration, run panel / notification UI.
- `packages/idegsm-project-api`: public types, sync metadata contract, service ports, command/run API contracts.
- `packages/ide-gsm-client`: reusable GraphQL client boundary, named-connection resolution contract, and health-check port for IDE-GSM server access.
- `packages/ui/ide-gsm-connection`: shared React Step 2 component and presentation/controller hooks used by both `idegsm-project` and `fdm` dialogs.
- `packages/build-api` and `packages/ui/build-sessions`: canonical external-session projection and shared AppBar Build Session presentation used for IDE-GSM tasks.
- `app/src/ide-gsm-connection/`: app-level runtime provider that owns raw host, port, endpoint, CORS proxy, and credential values.

`idegsm-project-plugin` owns the node type and TreeNode materialization behavior. FDM-specific dashboard and visualization code must not own `idegsm-project` sync identity.

## Node Icon

The canonical `idegsm-project` icon represents a special folder synchronized with an IDE-GSM server. The plugin must export an `IdeGsmProjectIcon` component that composes MUI `FolderSpecialOutlined` with a compact `CloudSync` marker. The permanent marker identifies the node kind; it does not represent the current connection or synchronization state.

The plugin manifest must declare `FolderSpecialOutlined` as the MUI fallback and the exported component as the preferred icon:

```ts
icon: {
  mui: 'FolderSpecialOutlined',
  component: {
    specifier: '@hierarchidb/idegsm-project-plugin/icon',
    exportName: 'IdeGsmProjectIcon',
  },
}
```

The same canonical node icon must be used in the tree, create menus, breadcrumbs, node dialogs, and node references. AppBar Build Session entries may add a command-specific glyph, but must retain the originating `idegsm-project` identity and must not substitute a generic local-folder icon.

Connection and synchronization state must be rendered separately by a shared status-adornment layer and must not replace or recolor the base icon. At minimum, the shared layer supports a success dot for a healthy synchronized connection, animated `Sync` for synchronization in progress, `CloudOff` for disconnected or stale server access, and `ErrorOutline` for synchronization failure. Status must not be conveyed by color alone; accessible labels or tooltips must expose its textual meaning. Base icon color inherits the active theme through `currentColor`; only the shared status affordance uses semantic status colors. Status adornments are derived from runtime/sync state and are not persisted as icon configuration in node data.

## Node Creation Entry Points

`idegsm-project` must be registered as a normal creatable plugin node type in the TreeConsole creation menu model. In every TreeConsole context where its parent and plugin capabilities permit creation, it must appear alongside the other available node types in both of these entry points:

- the TreeConsole bottom-right `DynamicSpeedDial`; and
- the `Create` submenu opened from a TreeConsole node's right-click context menu.

Both entry points must be generated from the same installed-plugin manifest and menu-builder data. They must therefore use the same label, `IdeGsmProjectIcon`, menu grouping/order, visibility rule, and creation eligibility, and must not maintain separate hard-coded entries. The node must appear as an `idegsm-project` choice in the ordinary node-type list rather than under the project command-only `ide-gsm` submenu.

Selecting either entry starts the standard `idegsm-project` plugin create flow for the resolved parent node, beginning with the normal Step 1 basic-information step and continuing to the shared Step 2 `Connection` step. The two entry points must invoke the same creation action and draft/commit path and must not create duplicate nodes or bypass dialog validation. When creation is unavailable for the current parent or TreeConsole context, both entry points must apply the same hidden or disabled state and expose a consistent reason where the common menu UI supports one.

## Dialog Step 2: Connection (`接続先`)

Step 1 follows the normal HierarchiDB basic-information contract. Step 2 for both create and edit dialogs must be the shared `Connection` (`接続先`) step. The `idegsm-project` plugin must use the same `IdeGsmConnectionStep` component, validation, runtime-provider contract, and external-service health state model as the `fdm` plugin; it must not fork or copy this code. The health state/check lifecycle is the generic `@hierarchidb/ui-external-service-health` contract described in `docs/external-service-health-spec.md`, not an IDE-GSM-owned model.

The step provides either:

- a `Connection name` (`接続先名`) selector backed by the app-level named-connection registry; or
- `Server hostname or IP address` (`サーバーのホスト名/IPアドレス`) and `Port` (`ポート番号`) inputs when manual target editing is enabled.

The normal direct-connection configuration is supplied by the application and is read-only in the dialog. In development it normally resolves to `localhost`; in production it normally resolves to the origin from which HierarchiDB is served, including a GitHub Pages deployment when that is the configured origin. These are defaults supplied by the runtime provider, not values embedded in plugin code.

The step includes a `Connect through cors-proxy` (`cors-proxyを介しての接続`) checkbox. While it is off, the provider-supplied host and port are displayed but disabled. Turning it on enables the hostname/IP and port inputs and routes HTTP and GraphQL WebSocket access through the configured HierarchiDB CORS proxy boundary. The proxy base URL, resolved target URL, GraphQL URL, WebSocket URL, credentials, and raw hostname/port values remain app-level runtime-provider data.

The node's committed `data` and editing `draftData` store only the following connection-related field:

```ts
{
  connectionName: string;
}
```

The CORS proxy checkbox and manually entered target values must be resolved to a named runtime connection before node commit. They must not be copied into `data`, `draftData`, TreeNode metadata, IndexedDB, localStorage, URL parameters, public errors, or logs. Resolving an unknown or unavailable `connectionName` fails closed with a stable error such as `CONNECTION_UNAVAILABLE`.

After the connection input is complete, the shared step performs a debounced health check through the runtime provider and shows a health area with at least `incomplete`, `checking`, `healthy`, `unhealthy`, `authentication-required`, and `incompatible` states plus the last checked time where available. Raw endpoint values, credentials, provider exception text, and server response bodies must not appear in the health UI or logs. Stale or out-of-order health responses must not replace the result for the latest connection input.

The health port uses IDE-GSM `ideGsmServerInfo` for network liveness, contract version, required capabilities, and advertised limits, then performs authenticated access checks. It must distinguish `authentication-required` and `incompatible` from generic network failure. A connection is not `healthy` until both HTTP GraphQL and `graphql-transport-ws` subscription transport work; a cors-proxy configuration that cannot proxy WebSocket traffic fails health validation.

Below the shared connection controls, the `idegsm-project` plugin adds a project selector backed by authenticated `accessibleIdeGsmProjects` for the healthy named connection. It must not use `buildAt`, command-style `list`, or an unrestricted filesystem listing as the catalog. The selector stores the project's validated logical `projectRelativePath`; it does not store a server absolute path or an unrelated opaque server ID. The compound project identity is the pair `(connectionName, projectRelativePath)`, so the same relative path on two named connections denotes two different projects. Both values must be selected before Step 2 can complete. Project selection is plugin-specific UI composed around the shared `IdeGsmConnectionStep`; it must not fork the shared connection implementation. Step 3 is an operational command screen, so project selection must not be deferred to Step 3 or any later step.

Step 2 has no `Sync now`, refresh, or resync control. When the latest connection state becomes healthy, the project selector catalog is loaded automatically; catalog loading is connection-form data acquisition and does not synchronize a project tree. Project synchronization is triggered only by successful node creation/promotion, reconnection, or a relevant authenticated server notification. Health status, last health-check time, catalog loading state, and synchronization in-flight state are ephemeral UI/runtime state and are not persisted in the node.

## Step 2 Completion And Node Promotion

Step 3 may perform server operations and therefore must receive a committed, non-draft `idegsm-project` node. Pressing `Next` after Step 2 has changed, or while creating a node that has not yet been committed, starts a staged node-promotion operation. It must not expose a partially prepared node as ready and must not run a command against draft identity.

The shared `PluginDialogHost` must support an asynchronous forward-transition guard for this boundary. A Step 2 provider registers a `beforeNavigateNext` capability that receives the latest merged draft, current committed node/version when present, target step, and an `AbortSignal`. The host must await its result before changing the active step, URL step, or persisted dialog progress. A rejected, canceled, or failed guard remains on Step 2. A `save-draft` or promotion persistence failure must be surfaced as a blocking error and must not be reduced to a warning followed by navigation.

While the guard runs, the host presents a foreground modal message dialog titled `Creating node` (`ノード作成が進行中`) or `Updating node` (`ノード更新が進行中`). The modal cannot be dismissed by Escape or backdrop interaction. It displays the current phase and provides a `Cancel` action during cancellable preparation phases. The host owns modal/navigation orchestration and the abort controller; `idegsm-project-api` owns the typed promotion coordinator and durable recovery contract; `idegsm-project-plugin` adapts Step 2 data to that coordinator.

Promotion follows this state model:

```text
draft -> preparing -> committing -> ready
                    -> canceling -> reverting -> draft
                    -> failed
```

Preparation must:

1. Validate the latest draft, named connection, credentials, health result, and selected logical `projectRelativePath`.
2. Capture the existing committed node/version for an edit operation.
3. Perform the required project lookup and initial full hierarchy/metadata synchronization into staging storage that is not yet exposed as the committed node state. CSV entries are staged as metadata-only source nodes; their file bodies and normalized rows are not fetched.
4. Validate the staged folder/YAML/CSV-source materialization and forbidden-field boundaries.
5. Publish the staged generation through the durable promotion protocol below.

For create, cancellation or failure before the commit boundary removes staged local node/snapshot records and returns to the editable draft. For edit, the existing committed node and snapshots remain authoritative until promotion succeeds; cancellation or failure removes only the staged replacement. In both cases the user's Step 2 draft values remain available for correction or retry unless the user separately cancels the outer node dialog.

`Cancel` is idempotent and aborts cancellable client work before discarding staging data. The short CoreDB publication transaction in the `committing` phase is a non-interruptible boundary; the cancel control is disabled once that transaction starts. Stale completion callbacks from a canceled or superseded promotion operation must not publish data. A failed operation keeps the modal open with a stable error and provides `Retry` and `Revert`; `Revert` discards staged local effects and returns to Step 2 only after cleanup has settled.

Revert applies to HierarchiDB node and snapshot preparation. It must not implicitly delete, roll back, or mutate an existing server-side IDE-GSM project. Any future server-side provisioning operation requires an explicit idempotent compensation contract before it may participate in automatic revert.

After successful publication, the modal closes automatically and the dialog advances to Step 3. If Step 2 is unchanged and the existing committed node is already healthy, synchronized, and ready, `Next` may advance directly without repeating promotion. Once Step 3 has been reached, closing the node dialog does not revert or delete the committed node.

### Durable cross-database promotion

CoreDB, Tabular metadata storage, and Tabular row storage are separate Dexie/IndexedDB databases and cannot participate in one atomic transaction. Promotion therefore uses a recoverable generation protocol, not a claimed cross-database transaction:

1. Create unique `operationId` and `generationId` values and persist a CoreDB promotion journal in `preparing` state without changing the active generation.
2. Write required non-CoreDB snapshots and rows as hidden staging artifacts tagged with `generationId`. Initial project creation writes no CSV rows; later reconciliation writes content only for CSV sources already marked `tracked`. Normal readers must resolve only artifacts referenced by the active committed generation.
3. Validate a complete generation manifest, including expected child entries and, only for tracked content, snapshot references, row counts, and content digests, then mark the journal `prepared`.
4. In one CoreDB transaction, verify the captured node version and prepared manifest, write the committed root data and synchronized child-node graph, set the single active-generation commit marker, and mark the journal `committed`. This CoreDB marker is the logical visibility boundary.
5. After publication, remove superseded generation artifacts and the completed journal asynchronously. Cleanup failure is diagnostic and retryable; it does not roll back the active generation.

Before the CoreDB publication transaction, readers continue using the previous committed generation; a create flow exposes no ready node. Startup and reconnect recovery inspect promotion journals before normal sync begins. A journal without an active commit marker is reverted by deleting only its staging generation. A committed journal is finalized only after its manifest and referenced artifacts validate; missing or inconsistent committed artifacts fail closed with a stable recovery error and must not silently fall back to a partial generation. Operation/generation IDs, journal states, manifest digests, and commit markers are internal synchronization records, not plugin draft fields or remote project identifiers.

## Dialog Step 3: IDE-GSM Commands

Step 3 is an operational screen for the committed `idegsm-project` node. The initial UI provides two command buttons:

- `Run sim`, which starts the IDE-GSM `sim` command with server-default parameters.
- `Run calib`, which starts the IDE-GSM `calib` command with server-default parameters.

The initial Step 3 does not provide command parameter editors. Future versions may add parameter selection, history, presets, and additional commands without changing the command service or Build Session ownership defined here.

Both buttons use the same `idegsm-project` command service as the node context menu and any FDM shortcut. Step 3 must not implement a separate mutation, status store, progress model, or cancellation path. Starting either command registers the task through the canonical external Build Session adapter; detailed progress, virtualized logs, reconnect state, and cancellation are presented through the AppBar Build Session flow.

The buttons are enabled only when the promoted node is committed and ready, the named connection is healthy and authenticated, the selected project exists and is synchronized, the command is authorized, and no active IDE-GSM command exists for the same project. Both buttons are disabled while a start request is in flight or a project task is active. One activation sends at most one command request. Starting a command does not modify node `data` or `draftData`, and closing Step 3 does not cancel the server task.

## Feature Flags

Use startup-fixed flags:

- `VITE_IDEGSM_PROJECT_SYNC_ENABLED`
- `VITE_IDEGSM_PROJECT_COMMAND_UI_ENABLED`

Both default to `false`.

The older `VITE_MOUNTED_IDE_GSM_COMMAND_UI_ENABLED` flag belongs to the projection implementation and must be removed with that implementation. It is not a canonical flag or a long-term alias for the synchronized node UI.

## Sync Model

The `idegsm-project` node is a server-authoritative sync root.

Initial sync reads the full server-side project hierarchy and safe entry metadata through the authenticated IDE-GSM GraphQL client boundary using logical relative paths. Reconnect-time sync also reconciles the full hierarchy and metadata. Neither operation fetches every CSV body. The initial implementation does not perform content sync merely because a directory is opened.

Full sync uses `beginProjectReconciliation`, ordered `projectReconciliationPage` calls, and idempotent `closeProjectReconciliation`. The client validates every page, entry count, unique path, kind, and digest before publishing one complete local generation. A missing page, limit error, malformed entry, or count mismatch leaves the previous committed generation visible and stale; it never publishes a partially assembled hierarchy.

The server `baseSequence` and project change sequence are the ordering authority. `serverUpdatedAt` is display/diagnostic metadata and must not be treated as a monotonic version. A completed full reconciliation replaces the local generation even when a current server file has an older timestamp, and a newer sequence is applied even when its timestamp moves backward. Digest equality may avoid rebuilding unchanged content.

After a create/update notification, the client calls authenticated `projectEntryVersion(projectRelativePath, relativePath)` and applies only a response whose `observedSequence` covers the triggering notification. YAML content and digest come from the same observed bytes. CSV remains metadata-only unless it is already tracked, in which case a changed digest starts the immutable paged transfer. Queued events newer than `observedSequence` are then applied in order; missing continuity forces full reconciliation.

Synchronization triggers are limited to:

- Successful node creation/promotion.
- GraphQL health check recovery.
- Authentication recovery.
- WebSocket / subscription recovery.
- A relevant authenticated server-side project-change notification.

There is no user-triggered full refresh/resync action in the initial UI or service contract. Server notifications must identify enough connection/project scope to schedule the affected project reconciliation; malformed, unauthorized, or unrelated notifications are rejected. The sync runner debounces duplicate reconnect/notification triggers and prevents concurrent full syncs for the same `idegsm-project`.

Server entries are materialized as local read-only nodes:

- Directory / child project: folder-like read-only node. A nested project is not implicitly promoted to another sync root or command target.
- `*.yml` / `*.yaml`: read-only YAML node with connected write-through support.
- `*.csv`: read-only Tabular source node whose initial content state is `metadata-only` and has no local row snapshot.
- Other file kinds: unsupported placeholder or hidden until separately specified.

The implementation must not infer unsupported files as YAML or Tabular data.

## Node Data And Identity

The committed sync-root payload uses this versioned contract:

```ts
interface IdeGsmProjectNodeData {
  version: 1;
  connectionName: string;
  projectRelativePath: string;
  activeSyncGenerationId: string;
  syncState:
    | 'synced'
    | 'stale'
    | 'syncing'
    | 'missing-on-server'
    | 'partial-sync-failed'
    | 'sync-failed';
  syncedAt: number;
}
```

Step 2 promotion must populate every field. `projectRelativePath` is normalized and validated as a non-empty logical relative path before persistence. `activeSyncGenerationId` and `syncedAt` come from the successfully published initial synchronization and must not be invented before that synchronization completes.

The term `projectId` in UI/domain discussion means the compound logical identity `(connectionName, projectRelativePath)`. It is compared as a tuple and is not persisted as a second scalar field, concatenated string, server absolute path, or server-issued opaque identifier. GraphQL calls already select a connection-specific client, so their project argument is `projectRelativePath` only.

Local `TreeNode.id` values are created through the normal CoreDB / TreeNode creation path. They are not deterministic IDs derived from the compound project identity or entry path.

Each synchronized child stores sync metadata separate from the root node payload:

```ts
interface IdeGsmProjectEntrySyncMetadata {
  version: 1;
  projectNodeId: NodeId;
  generationId: string;
  relativePath: string;
  entryKind: 'directory' | 'yaml' | 'tabular' | 'unsupported';
  syncedAt: number;
  contentDigest?: string;
  serverUpdatedAt?: number;
  readOnly: true;
  syncState: 'synced' | 'stale' | 'missing-on-server' | 'sync-failed';
  schemaSummary?: YamlSchemaSummary | TabularSchemaSummary;
  rowCount?: number;
  byteCount?: number;
  tabularContent?:
    | {
        policy: 'metadata-only';
      }
    | {
        policy: 'tracked';
        snapshotId: string;
        contentGenerationId: string;
      };
}
```

`tabularContent` is present only when `entryKind === 'tabular'`. Initial discovery sets `{ policy: 'metadata-only' }`; this variant must not contain a `snapshotId`, content generation, parsed rows, or raw CSV. Successful on-demand materialization changes it to `tracked` and records the committed Tabular snapshot identity. Once tracked, it remains a content-sync participant even if the Styler that first selected it is later edited or deleted; an explicit retention/untrack policy is deferred.

The child resolves its remote project through `projectNodeId`, whose committed root data supplies `connectionName` and `projectRelativePath`. The former `mountKind`, `mountId`, `sourceKind`, and scalar `projectId` fields are removed from the target data model and must be rejected by new-node validators rather than copied forward. This separates local identity from server identity and allows local tree movement, resync, missing-source display, and conflict handling without changing TreeNode identity semantics.

## On-Demand CSV Content Synchronization

Project creation synchronizes CSV paths and safe metadata only. It must not download CSV bodies, parse rows, allocate Tabular row stores, or create placeholder snapshots for every discovered CSV.

The Styler source picker may browse CSV source nodes under an `idegsm-project`. Selecting one supplies the local `projectNodeId` and validated logical `relativePath` to the project synchronization service. The service resolves `connectionName` and `projectRelativePath` from the committed root, verifies that the selected current child is a CSV source below that root, and rejects absolute paths, traversal, stale identities, non-CSV entries, and direct endpoint/credential input before network access.

For a `metadata-only` CSV, selection while connected performs this sequence:

1. Open an authenticated immutable CSV transfer session and fetch its content in ordered pages whose decoded raw payload is at most 16 KiB.
2. Stream-parse and validate the header/schema and normalized rows across page, UTF-8 code-point, and CSV-record boundaries without exposing raw content to node or Styler payloads.
3. Stage the Tabular snapshot/rows under a new content generation.
4. Publish the snapshot reference and the child's `tabularContent.policy: 'tracked'` through the durable generation protocol.
5. Return the committed `snapshotId` to the Styler source-selection flow; only then may the Styler persist its source reference and complete selection.

If acquisition, parsing, storage, or publication fails, the Styler selection is not committed and the child remains `metadata-only` unless an earlier tracked snapshot already exists. A disconnected `metadata-only` CSV cannot be selected as a usable Styler source because no local content exists. A previously `tracked` CSV may be selected and read while disconnected from its last committed snapshot, with stale/missing state shown.

After first successful acquisition, reconnect reconciliation and relevant authenticated server notifications compare/fetch content for tracked CSV entries and publish a replacement snapshot only when required. Metadata-only CSV entries continue to receive hierarchy/metadata reconciliation but their bodies remain unfetched. Duplicate Styler selections of the same current CSV reuse the committed snapshot or one in-flight acquisition; they must not duplicate normalized rows or launch overlapping fetches.

## Sync States

Supported sync states include:

- `synced`
- `stale`
- `missing-on-server`
- `syncing`
- `partial-sync-failed`
- `sync-failed`
- `write-pending`
- `write-failed`

If full hierarchy reconciliation fails, the previous complete generation remains usable and is marked stale or `sync-failed`; no subset of the new hierarchy is published. `partial-sync-failed` is reserved for work after a complete hierarchy publication, such as an independently tracked CSV refresh failure where the previous committed Tabular snapshot remains usable.

Server-side delete or missing source detection must not automatically delete local nodes. Initial UI behavior keeps the local node visible with a warning affordance. Remaining CSV / Tabular snapshots may still be used for disconnected visualization, but missing nodes must not be treated as valid server write targets, command targets, or refresh sources.

## Disconnected Behavior

When the IDE-GSM server is disconnected, synced YAML and previously materialized tracked Tabular nodes are usable for read-only browsing and visualization. Metadata-only CSV nodes remain visible in the tree but have no local rows to open or visualize.

Allowed:

- View synced YAML content.
- View materialized tracked Tabular data.
- Use synced Tabular snapshots in map visualization, Styler, and Resolver.

Unavailable and fail-closed:

- Edit / save.
- User-triggered refresh / resync.
- Delete remote source.
- Verify / fill / compare / clean / diagnose when server operations are required.
- `sim`, `calib`, `check`, cancel, and run subscription operations.

No disconnected editor draft may be persisted as an offline write queue.

## YAML Editing

YAML nodes under an `idegsm-project` may use the same user-facing editor experience as ordinary YAML nodes, but save handling is separate.

Save must:

1. Verify the node belongs to an `idegsm-project` sync root.
2. Resolve and validate the owning root's `connectionName` and `projectRelativePath`, the child's logical `relativePath`, sync state, credential availability, and server connectivity.
3. Send the editor's base content digest as the required `expectedDigest` conditional-update parameter. A server `updatedAt` value may be sent as an additional condition but must not replace content-digest validation.
4. Have the IDE-GSM server atomically compare `expectedDigest` with the current file content and full-replace the file only when they match.
5. Reject save with a stable conflict result and require reload if the conditional update reports that the server-side file changed during editing.
6. Reread only the saved YAML file from the server.
7. Reflect the reread content, digest, and updated timestamp into the local snapshot.

The UI may return to `synced` only after the server write succeeds and the updated server content is reflected locally.

The IDE-GSM GraphQL write contract must extend the existing YAML write operation with a required `expectedDigest` parameter, perform comparison and replacement atomically on the server, and return a stable conflict result such as `CONTENT_CONFLICT` without overwriting the file. A client-side read-compare-write sequence is insufficient because it leaves a time-of-check/time-of-use race.

If validation, credentials, or connection fail before server write, the local snapshot remains unchanged. If server write succeeds but reread or local reflection fails, the local snapshot must not be marked as successful; it becomes `sync-failed` or `stale` until a reconnect or relevant server notification triggers reconciliation.

Initial write support is YAML full replace only. CSV / Tabular write support is deferred to a separate issue because encoding, quoting, newline, row order, large diffs, and schema validation require a separate contract.

## Project Commands

The command UI is available only on the `idegsm-project` sync root node itself. Synced child folder, YAML, and Tabular nodes do not show the `ide-gsm` command submenu.

Right-clicking the sync root may show:

- `ide-gsm > sim`
- `ide-gsm > calib`
- `ide-gsm > check`

The target must satisfy all of these checks before any network request:

- `nodeType === "idegsm-project"`
- `IdeGsmProjectNodeData.version === 1`
- valid named `connectionName`
- valid logical `projectRelativePath`
- a committed `activeSyncGenerationId` in a ready sync state
- no absolute path or `..` traversal
- no forbidden public fields such as endpoint, token, JWT, raw content, or absolute server path

Command execution uses the IDE-GSM client command contract:

- canonical `sim` calls `simulate` with required `projectRelativePath` and server-default optional parameters;
- canonical `calib` calls `calibrate` with required `projectRelativePath` and server-default optional parameters;
- canonical `check` calls `checkProject` with required `projectRelativePath`.

Every start request carries an ephemeral UUID `clientRequestId`. The server deduplicates `(owner, projectRelativePath, clientRequestId)` within the current process and rejects a different request while another `sim`, `calib`, or `check` task for the same owner/project is active. `clientRequestId` is runtime launch data and is not persisted in node data.

```ts
{
  id: commandId,
  input: {
    projectRelativePath: node.data.projectRelativePath
  }
}
```

`sim` and `calib` request server-side execution start. `check` is server-side project validation. None of these commands is a local refresh/resync action.

Command execution must not directly mutate local YAML or Tabular snapshots. Project file changes caused by server-side execution are reflected through a relevant authenticated server notification, including a scoped runtime event when it satisfies that notification contract, or reconnect synchronization.

## Run State And Cancellation

IDE-GSM server is the SSOT for `sim` / `calib` run state, progress, log, result, and cancellation state.

HierarchiDB client responsibilities:

- Start `sim` / `calib` through the command API.
- Receive a run identifier or command status handle.
- Subscribe to run state, progress, log, completion, failure, and cancellation state.
- Display live-only progress logs through a runtime-only client buffer; missed disconnected intervals are not replayed.
- Request cancellation for an active run.

The client must not persist authoritative job state or log bodies to CoreDB, TreeNode, or IndexedDB. Detailed logs should be read from a server-side run log API or subscription.

Cancellation is not a client-side abort. It is a server request through the existing IDE-GSM GraphQL `cancelTask(taskId)` mutation, using the task identifier returned by `sim` or `calib`. The Boolean mutation result only reports whether the cancellation request was accepted; authoritative terminal state remains the task subscription or polling result. Final states such as `CANCELED`, `FINISHED`, and `FAILED` are displayed from that server state.

## AppBar Build Session Integration

Standalone normative specification: [ide-gsm-build-session-spec.md](./ide-gsm-build-session-spec.md).

Every asynchronous IDE-GSM command launched from an `idegsm-project`, including `sim`, `calib`, and `check`, must appear in the HierarchiDB AppBar as a Build Session item. The integration must extend the existing `BuildSessionQueuePanel` and canonical Build Session runtime surface rather than introducing a separate IDE-GSM-only global progress indicator.

The IDE-GSM integration is an external Build Session adapter. IDE-GSM remains the SSOT; the adapter projects server task events into the common UI model. Starting a command must:

1. Receive the IDE-GSM `taskId` from the command mutation.
2. Register an AppBar Build Session projection associated with the originating `idegsm-project` node and command ID.
3. Subscribe through `subscribeTaskOnFrontend(taskId)` and any command/runtime progress subscription required for detailed progress and logs.
4. Update the AppBar item and progress screen from server events until a terminal status is observed.

The initial adapter supports at most one active IDE-GSM command for one `idegsm-project` node. A second `sim`, `calib`, `check`, or other asynchronous project command is rejected before a network request while that node has an active server task. This preserves the existing canonical Build Session identity based on `nodeType + nodeId` and prevents one task from overwriting another task's AppBar projection.

Server task status maps to the common session display as follows:

| IDE-GSM status | Build Session status |
| --- | --- |
| `REGISTERED`, `READY` | `starting` |
| `LEASED` | `running` |
| cancellation requested and awaiting server terminal state | `canceling` |
| `FINISHED` | `completed` |
| `CANCELED` | `canceled` |
| `FAILED`, unsupported `DELETED` | `failed` |

`packages/build-api` and the AppBar session components must add canonical `canceling` and `canceled` runtime statuses rather than mapping cancellation to pause or failure. These additions must remain compatible with existing local build adapters.

The AppBar item displays at least the originating node name/path, IDE-GSM command name, server-derived status, progress percentage when available, elapsed time, and current phase/message. Selecting the item opens the IDE-GSM Build Session progress screen without restarting the command. That screen displays command/project identity, live-only runtime-buffered logs, timestamps, reconnect/subscription state, terminal result or stable error, and a cancellation control.

The cancellation control is enabled only for a cancellable active server status and while no cancellation request is in flight. It calls the existing `cancelTask(taskId)` operation exactly once per user request, changes the local display to `canceling`, and waits for the server to publish `CANCELED`, `FINISHED`, or `FAILED`. Closing the progress screen, navigating to another node, or dismissing the AppBar menu must not cancel the server task or stop its app-level subscription.

The adapter may keep `taskId`, command ID, subscription handle, live-log buffer/connection epochs/search state, and the projected Build Session record in app-level runtime memory. It must not persist authoritative task status, task ID, progress events, buffered rows, search state, or log bodies in TreeNode data, CoreDB, plugin stores, or IndexedDB. A browser reload therefore requires server-side task discovery to restore an unknown active task, while the log buffer restarts empty.

IDE-GSM must add an authenticated `activeProjectTasks(projectRelativePath)` GraphQL query, or an equivalently named typed operation, scoped to the current user and logical project path. Each result must provide at least task ID, command ID, task status, progress when available, and server timestamps required to rebuild the AppBar projection. `packages/ide-gsm-client` must expose typed `activeProjectTasks`, `getTaskStatus`, `subscribeTaskOnFrontend`, live-only `subscribeTaskLog`, and `cancelTask` methods. The server does not replay, page, or search task logs for this initial contract. Reconnect starts a fresh live-log epoch and the client searches only its current runtime buffer. `getTaskStatus(taskId)` alone supports reconnect only while the runtime still knows the task ID and is not sufficient for browser-reload discovery.

## Required CSV Content API

`packages/ide-gsm-client` must expose authenticated typed operations for an immutable, paged CSV transfer. A transfer consists of begin, ordered page, and explicit close operations equivalent to:

```graphql
mutation BeginProjectFileContentTransfer(
  $projectRelativePath: String!
  $relativePath: String!
) {
  beginProjectFileContentTransfer(
    projectRelativePath: $projectRelativePath
    relativePath: $relativePath
  ) {
    transferId
    contentDigest
    updatedAt
    byteCount
    chunkSizeBytes
    expiresAt
  }
}

query ProjectFileContentPage($transferId: String!, $cursor: String) {
  projectFileContentPage(transferId: $transferId, cursor: $cursor) {
    contentChunkBase64
    rawByteCount
    nextCursor
    hasNext
  }
}

mutation CloseProjectFileContentTransfer($transferId: String!) {
  closeProjectFileContentTransfer(transferId: $transferId)
}
```

`chunkSizeBytes` is exactly 16,384 and each page's decoded `rawByteCount` is in `0..16384`; JSON and Base64 transport overhead is not included in this raw-byte limit. The cursor is opaque, scoped to the transfer, and advances monotonically. Pages may split a UTF-8 code point, quoted field, or CSV record, so `packages/ide-gsm-client` must decode and parse them as one ordered byte stream rather than independently parsing page strings.

The server validates the authenticated user's project access and both logical relative paths, rejects absolute/traversal paths, symlinks, non-file targets, and non-CSV targets, and creates a short-lived immutable transfer snapshot while streaming the source rather than loading it into memory. It then performs a second streaming source digest verification and accepts the transfer only when source identity, size, `updatedAt`, and both full-byte digests agree. Otherwise begin removes the temporary snapshot and fails with `CONTENT_CHANGED_DURING_TRANSFER`. The returned digest is SHA-256 over the exact immutable raw bytes and every page comes from that same transfer snapshot.

`transferId` and cursors are unguessable, bound to the initiating principal/project/path, and unusable after close or `expiresAt`. Retrying the same valid cursor returns the same page. The final page remains retryable until explicit close or expiry, close is idempotent, and stateless HTTP disconnect is not an immediate cleanup signal. Explicit close, expiry, and server startup recovery remove only transfer-temporary artifacts, never the source CSV. Per-user concurrent-transfer and temporary-spool quotas fail with stable errors rather than allowing unbounded memory or disk use.

The Base64 chunk is transient parser input and must not enter TreeNode, Styler/Resolver/FDM payloads, logs, public errors, URLs, analytics, IndexedDB, or localStorage. The client closes the transfer after success or failure and never accumulates a second raw full-file copy merely to join page strings.

The project-change notification/subscription contract must include the resolved project scope plus changed logical paths and available digest/update metadata. A notification does not itself carry raw CSV content. The client fetches content only when the changed path currently has `tabularContent.policy === 'tracked'`; metadata-only CSV paths update metadata without a content request.

Terminal sessions may remain in the AppBar's recent-session list until explicitly dismissed according to the common Build Session retention behavior. Dismissing a terminal item removes only the local UI projection and must not call `removeTask` or delete server history unless a separate explicit server-history action is defined.

## Security

The following values must not be stored in YAML nodes, Styler payloads, Resolver payloads, TreeNode payloads, dashboard state, localStorage, URLs, or logs:

- endpoint URL
- GraphQL URL
- JWT
- token
- raw credential
- IDE-GSM server absolute path
- original raw CSV text or duplicated raw CSV body

Parsed and normalized Tabular snapshot data derived from an on-demand tracked CSV must be persisted in the dedicated Dexie-backed Tabular store so that disconnected visualization works. Metadata-only CSV nodes have no such rows. TreeNode, FDM, Styler, and Resolver payloads store only snapshot references and safe metadata; they must not duplicate the original CSV text or normalized row data.

Credential failures should surface stable public error codes such as `CREDENTIALS_UNAVAILABLE`. Provider exception messages and credential details must not be shown in public UI or logs.

## Acceptance Criteria

- Creating an `idegsm-project` sync root materializes the full server hierarchy as read-only local nodes without downloading CSV bodies.
- The canonical node icon is `IdeGsmProjectIcon` (`FolderSpecialOutlined` plus a `CloudSync` marker), with connection and synchronization state shown through the shared accessible status-adornment layer.
- `idegsm-project` appears alongside other creatable node types in both the TreeConsole bottom-right `DynamicSpeedDial` and the node right-click `Create` submenu, and both entries launch the same standard plugin create flow for the resolved parent.
- Step 2 uses the shared connection component, persists only `connectionName` as connection data, displays debounced server health, requires project selection, and exposes no manual sync/refresh control.
- Project synchronization runs only on successful creation/promotion, reconnection, or a relevant authenticated server notification.
- CSV entries begin metadata-only; selecting a CSV path from Styler acquires and publishes its first Tabular snapshot, marks it tracked, and only then commits the Styler source reference.
- Reconnect/notification synchronization fetches CSV content only for tracked entries; metadata-only entries continue to synchronize metadata without rows.
- Pressing Step 2 `Next` after a change runs the host's awaited `beforeNavigateNext` promotion guard behind a foreground progress modal; a durable generation is published before Step 3, while cancellation or failure stays on Step 2 and removes staging without changing the existing committed generation or deleting the server project.
- The root persists the exact versioned `IdeGsmProjectNodeData` contract; child sync metadata references `projectNodeId` and contains no legacy `mountKind`, `mountId`, `sourceKind`, or scalar `projectId` fields.
- The compound project identity is `(connectionName, projectRelativePath)` and GraphQL operations pass only the validated `projectRelativePath` through the already resolved named connection.
- Cross-database promotion uses a staged generation, durable journal, validated manifest, and CoreDB active-generation commit marker with startup recovery; it does not claim a cross-Dexie atomic transaction.
- Step 3 initially provides default-parameter `Run sim` and `Run calib` buttons for the ready committed node and delegates execution, progress, logs, and cancellation to the canonical project command and Build Session services.
- Reconnect triggers perform a full project sync with debounce and in-flight guard.
- Partial sync failure preserves successfully synced snapshots.
- Disconnected mode allows read-only YAML / Tabular browsing and map visualization from synced Tabular snapshots.
- YAML save writes server first, rejects stale edits, rereads the saved file, and only then updates local state.
- YAML save uses an atomic server-side `expectedDigest` condition and never overwrites a conflicting server version.
- CSV / Tabular write is not implemented in the initial scope.
- Context menu commands appear only on the `idegsm-project` root.
- `sim` / `calib` state is subscribed from the server and cancellation is sent to the server.
- Asynchronous IDE-GSM commands appear in the AppBar Build Session list, open a shared progress screen, and support server-side cancellation from that screen.
- IDE-GSM `CANCELED` is represented as `canceled`, not `failed` or `paused`, in the common Build Session model.
- Normalized CSV-derived rows are persisted only in the dedicated Tabular store; no forbidden endpoint, credential, absolute path, original CSV text, or duplicated row data is persisted elsewhere.
- The old mounted filesystem projection implementation and its UI/flag integration are removed after the synchronized replacement is available.
