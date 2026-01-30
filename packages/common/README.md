# @hierarchidb/common

Shared type and API definitions for HierarchiDB. These packages define the UI↔Worker contract, brand IDs, and auth notification primitives consumed across the monorepo.

## Packages
- `api/` — Worker/UI API contracts (Comlink boundary types)
- `auth/` — Auth notification system (events, factories, registry)
- `types/` — Brand IDs and shared entities for tree, node, tags, validation, progress

## Directory layout
```
api/     RPC interfaces and exports (ImportExportAPI, PluginDialogAPI, TreeTableExpandedAPI, BatchControlAPI)
auth/    AuthNotificationSystem (types, guards, registry, helpers)
types/   Brand IDs (TreeId, TreeNodeId, SessionId...), tree/node entities, handlers, validation/progress primitives
README.md
```

## Key exports (per package)
- `api`:
  - `ImportExportAPI`, `BatchControlAPI`, `TreeTableExpandedAPI`
  - Dialog contracts: `PluginDialogAPI`, `DialogStateAPI`, `StepCapabilities`
  - Wiring: `PluginRuntimeWiring`
- `auth`:
  - `AuthNotificationRegistry`, `AuthNotificationFactory`, `AuthNotificationGuards`
  - Types: `AuthNotification`, `AuthRequiredNotification`, `AuthSuccessNotification`, `AuthCancelledNotification`, `AuthSource`, `PluginType`
- `types`:
  - IDs: `TreeId`, `TreeNodeId`, `NodeId`, `SessionId`, `SubscriptionId`
  - Entities: `TreeNode`, `TreeNodeMetadata`, `TreeRootState`, `TreeViewState`
  - Draft/commit: `CommitDraftOptions`, `DraftState`, `UndoStateEvent`
  - Validation/progress: `ValidationResult`, `ValidationWarning`, `ProgressStatus`, `ProgressEvent`
  - Tag: `TagEntity`, `TagType`, `TagHandler`

## Consumers / usage
- Worker side: `@hierarchidb/runtime-worker`, `@hierarchidb/plugin-service-sdk`, plugins’ worker services implement `WorkerAPI` / tree APIs (now in `@hierarchidb/worker-api` / `@hierarchidb/tree-api`).
- UI side: `@hierarchidb/plugin-ui-sdk`（draft handling）, `@hierarchidb/plugin-ui-host`（dialog shell）, `app/src` dialog routes.
- Cross-cutting: Feature plugins（basemap, shape, route, spreadsheet など）が `types` / `api` を介してエンティティ契約を共有。`packages/ui/auth` が `auth` を利用。

## Notes
- Pure TypeScript; no runtime dependencies inside `types`/`auth`/`api`.
- Add interfaces first, then implement in worker/UI layers. Favor brand IDs and explicit payload shapes over `any`.
