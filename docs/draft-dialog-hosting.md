# Draft Dialog Hosting: Current Contract

## Default hosting flow

- TreeConsole creates a working-copy node and navigates to `/d/<treeId>/<parentId>/<wcNodeId>/<nodeType>/create`.
- The app route renders the shared `PluginDialogHost`. The host renders the dialog shell and drives `useTreeNodeUpdater`.
- The host writes Basic Info (`name`, `description`, `tags`) to `draftMetadata` and plugin-specific persistent fields to `draftData`.
- A plugin provides step components, validators, and capabilities through `PluginStepRegistry`. A plugin-specific dialog host is not required by the default route.
- Legacy `NodeDialogExtension` step-state hosting is deprecated.

## Awaited forward-transition capability

The shared host must support an optional asynchronous `beforeNavigateNext` capability on `PluginStepConfig`. It is reserved for a step boundary that must prepare and commit a canonical node before the next operational step can run.

The capability receives the latest merged draft data, dialog mode, working-copy/canonical node identity, current committed node version when present, current and target step IDs, UI state, and an `AbortSignal`. It returns an explicit `advance` result with the committed node identity/version and canonical data, or a `stay` result with a stable public reason. Throwing or rejecting is a failed transition and also remains on the current step.

Navigation ordering is normative:

1. Flush local step edits into the in-memory merged draft.
2. Run normal validation and `canProceedToNext`.
3. Open the host-owned blocking progress dialog and await `beforeNavigateNext` when configured.
4. On success, replace the host's canonical node/draft baseline with the returned committed result.
5. Only then update the active step, URL step, and persisted dialog progress.

The host must not advance in a `finally` block. `save-draft`, guard, commit, cancellation, or revert failure is visible and blocks navigation. The host owns the modal, pending-action exclusion, and abort controller; the plugin capability owns domain preparation/promotion through an injected service. Cancellation is idempotent and waits for plugin revert/cleanup before restoring the current step. A plugin must mark its short publication transaction as non-cancellable, at which point the host disables `Cancel` until the result is known.

Direct navigation that would cross the guarded boundary must execute the same capability or be rejected; URL edits and step-header clicks cannot bypass it. Backward navigation does not undo an already committed promotion. Tests must cover success ordering, rejected validation, guard failure, save failure, cancellation/revert, stale completion suppression, direct-navigation bypass prevention, and edit-version conflict.

Some packages export plugin-specific dialog components through `./ui`, but their presence does not make the default app route select them automatically. A custom host requires an explicit app routing/registry contract; it must not be inferred from an export name.

## YAML plugin

YAML create/edit uses the shared `PluginDialogHost` and registered YAML steps. It must not add a separate `YamlDialog` for IDE-GSM Step 4.

- filename is Basic Info metadata and belongs to `draftMetadata`;
- subtype, schema ID, and YAML content belong to `draftData`;
- selected command, task ID, task status, result, and error are UI-only state;
- endpoint and JWT stay inside the app-level executor/provider and are not written to either draft area.
- YAML create navigates from the exact temporary placeholder without calling the split draft metadata or draft data mutation methods.
- Save and save-draft send the host's exact `mode`, `draftMetadata`, `draftData`, and `dialogUIState` request through the canonical YAML connector; the connector persists all accepted fields in one updater operation.

The normative subtype, command, synchronization, and feature-flag rules are defined in [YAML plugin IDE-GSM Step 4 contract](./yaml-plugin-ide-gsm-step4-spec.md).

## Plugin registry generation

- `pnpm tools:gen-plugin-registry` scans plugin manifests and generates `packages/plugin-registry/generated/registry.ts` and related artifacts.
- Vite uses the generated registry to load plugin UI entrypoints and their registration side effects.
- When a plugin UI entry or manifest changes, regenerate the registry and verify that the step provider is reachable.
- Do not add an app-level `nodeType` switch solely to host a plugin step.
