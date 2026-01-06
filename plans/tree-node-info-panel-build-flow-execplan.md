# Add Build Flow from TreeNodeInfoPanel

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md lives at `PLANS.md` from the repository root. This plan must be maintained in accordance with that file.

## Purpose / Big Picture

Users should be able to initiate a build (or URL-driven download treated as a build) directly from the TreeNodeInfoPanel, without manually stepping through dialog screens. After pressing Build, the dialog should open at the appropriate step, auto-start the build/download via `?build=1`, and return to the original page when finished. For folder nodes, a batch run should traverse ancestor and descendant nodes and execute their build/download steps sequentially, returning to the original page when all are done. The behavior should be observable by navigating in the UI and watching the dialog open, auto-start, and then return to the original tree page.

## Progress

- [x] (2026-01-06 07:53 JST) Create a build flow plan and capture the design decisions for step selection, auto-start, and auto-return.
- [x] (2026-01-11 17:40 JST) Implement Build button visibility and navigation in `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx` and `app/src/router/pages/tree/console/useTreeNodeInfoPanel.ts`.
- [x] (2026-01-11 17:40 JST) Implement auto-start and auto-return coordination in `app/src/router/routes/tree/PluginDialogRoute.tsx` and `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`.
- [x] (2026-01-11 17:40 JST) Implement auto-download for tabular data sources in `packages/ui/tabular-extract/src/components/TabularDataImport.tsx`.
- [ ] Validate the flow manually for shape/location/route/styler/folder nodes and record outcomes.

## Surprises & Discoveries

- Observation: The plugin dialog step number is encoded in the route path and not in query params. `useDialogFrameState` reads the `/.../:mode/:step` segments and rewrites them, while leaving other query params intact.
  Evidence: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`.

## Decision Log

- Decision: Use step IDs (`build` or `data-source`) to compute the numeric step index via `composeStepConfigs`, then navigate using the numeric step in the URL path. This avoids changing the routing scheme.
  Rationale: The dialog frame state logic expects numeric steps in the path and already rewrites the path; using the existing mechanism reduces risk.
  Date/Author: 2026-01-11 / Codex

- Decision: Use `?build=1` to trigger auto-start and pass `returnTo`/`buildQueue` via query params, coordinating auto-return from the dialog host.
  Rationale: The URL-based control is explicitly required and survives the dialog path rewriting.
  Date/Author: 2026-01-11 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

TreeNodeInfoPanel lives at `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx` and uses `useTreeNodeInfoPanel` for state/labels. Plugin dialogs are routed through `app/src/router/routes/tree/PluginDialogRoute.tsx`, which renders `PluginDialogHost` from `packages/plugin-ui-host`. The plugin dialog host uses `usePluginDialogController` to manage step state, and `useDialogFrameState` in `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts` to sync the dialog step into the URL path. The plugin step registry is built via `composeStepConfigs` in `packages/plugin-base/src/services/StepComposer.ts`, which lists step configs for each node type and mode. For tabular downloads (styler/spreadsheet), the `TabularDataImport` component in `packages/ui/tabular-extract/src/components/TabularDataImport.tsx` owns the URL download action.

In this plan, “build step” means a plugin step whose ID is `build` and which exposes `capabilities.startBatch`. “Download step” means a plugin step whose ID is `data-source` that supports URL-based import via `TabularDataImport`. “Auto-start” means starting the batch/download on dialog open when `?build=1` is present. “Auto-return” means closing the dialog and navigating back to the original tree page or the next queued build URL.

## Plan of Work

First, add a Build button to the info panel. In `useTreeNodeInfoPanel`, compute whether the current node is buildable. Use `loadUIPlugin` to ensure the plugin’s step configs are registered, then call `composeStepConfigs(nodeType, 'edit', mergedData)` to inspect steps. If the configs include `build`, choose that as the target step; otherwise, if they include `data-source`, treat it as the build/download step. Compute the numeric step index based on whether the host supplies a base step (`hasHostBase`), following the same offset logic used in `resolvePreviewGuardState`. Wire TreeNodeInfoPanel so the Build button appears for buildable nodes and for folder nodes. The click handler should navigate to `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType/edit/normal/:step?build=1&returnTo=<encoded-path>`. For folder nodes, query `TreeQueryAPI.listAncestors` and `TreeQueryAPI.listDescendants`, filter to nodes that have a build/download step, deduplicate by node ID, compute each URL, store them in session storage as a queue, and navigate to the first URL with `build=1` and a `buildQueue` key in query params.

Next, wire the dialog host to auto-start and auto-return. In `PluginDialogRoute`, parse the search params for `build`, `returnTo`, and `buildQueue`, and pass an `autoBuild` option into `PluginDialogHost`. In `usePluginDialogController`, add optional `autoBuild` options to `PluginDialogControllerOptions`. If `autoBuild.enabled` is true, automatically call the `startBatch` capability once the dialog is open and the active step config provides `startBatch` and `canStartBatch` is true. Track whether auto-start was triggered to avoid repeated starts. Determine completion using the dialog data: for node types with batch builds (shape/location/route), treat `processingStatus === 'completed'` or `buildFinishedAt` as completion; for tabular download types (styler/spreadsheet), treat `spreadsheetMetadataId` or `dataSource.sizeBytes > 0` as completion. When completion is detected and `autoBuild` is enabled, invoke a callback provided by `PluginDialogRoute` that reads the queue from session storage; if a next URL remains, navigate to it; otherwise navigate to the `returnTo` path. Ensure the callback clears the queue when done.

Finally, implement auto-download for the tabular data source step. In `TabularDataImport`, add a boolean prop such as `autoStartDownload` and trigger `handleUrlDownload` on mount when `autoStartDownload` is true, the import method is `url`, a URL is present, and `importSucceeded` is false. Use a ref to ensure it fires once per mount. Then, in `useTabularDataSource`, set `autoStartDownload` based on `window.location.search` containing `build=1`.

## Concrete Steps

1) Update `app/src/router/pages/tree/console/useTreeNodeInfoPanel.ts` to compute buildable step info (step ID + numeric index), add a new handler for Build, and return build-related flags/handlers to the component.
2) Update `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx` to render the Build button between Edit and Preview and wire it to the new handler.
3) Create a small session storage helper in `app/src/router/pages/tree/console` (or a nearby utility module) to store and pop build queues by key.
4) Update `app/src/router/routes/tree/PluginDialogRoute.tsx` to read search params and pass `autoBuild` options into `PluginDialogHost`, including a callback that pops the build queue and navigates accordingly.
5) Update `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx` to accept `autoBuild` options, auto-start batch when applicable, and invoke the auto-return callback on completion.
6) Update `packages/ui/tabular-extract/src/components/TabularDataImport.tsx` (and its calling hook) to auto-start URL downloads when `?build=1` is present.

Commands to run (from repo root):

  pnpm --filter @hierarchidb/app typecheck
  pnpm --filter @hierarchidb/plugin-ui-host typecheck
  pnpm --filter @hierarchidb/ui-tabular-extract typecheck

## Validation and Acceptance

- Open a shape/location/route node, click Build in TreeNodeInfoPanel, confirm the dialog opens to the build step, auto-starts, and returns to the original page when complete.
- Open a styler node, click Build, confirm the dialog opens to the Data Source step, auto-starts the URL download (if configured), and returns after the download completes.
- Open a folder node, click Build, observe sequential navigation through child/ancestor build dialogs, and return to the folder page when finished.
- Run the typecheck commands listed above and confirm they pass.

## Idempotence and Recovery

- The Build queue is stored in session storage and can be safely overwritten on each new Build request. If navigation fails mid-sequence, re-run Build from the folder node to regenerate the queue.
- If auto-start misbehaves, remove the `?build=1` parameter to disable it and use the existing manual flow.

## Artifacts and Notes

- Expected example build URL:
  /t/r/r:root/shape-node-1/shape/edit/normal/4?build=1&returnTo=%2Ft%2Fr%2Fr%3Aroot

## Interfaces and Dependencies

- `composeStepConfigs(nodeType, 'edit', mergedData)` from `packages/plugin-base/src/services/StepComposer.ts` to resolve step IDs and offsets.
- `TreeQueryAPI.listAncestors` / `TreeQueryAPI.listDescendants` from `packages/common/api/src/TreeQueryAPI.ts` to build the folder sequence.
- `PluginDialogControllerOptions` in `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx` extended with optional `autoBuild` settings.
- `TabularDataImportProps` in `packages/ui/tabular-extract/src/components/TabularDataImport.tsx` extended with `autoStartDownload` and used by spreadsheet/styler data source steps.

Plan revision note: initial ExecPlan created to cover Build button, auto-start, and auto-return flows in response to the TreeNodeInfoPanel request.
