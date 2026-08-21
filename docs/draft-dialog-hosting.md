# Draft Dialog Hosting: Current Contract

## Default hosting flow

- TreeConsole creates a working-copy node and navigates to `/d/<treeId>/<parentId>/<wcNodeId>/<nodeType>/create`.
- The app route renders the shared `PluginDialogHost`. The host renders the dialog shell and drives `useTreeNodeUpdater`.
- The host writes Basic Info (`name`, `description`, `tags`) to `draftMetadata` and plugin-specific persistent fields to `draftData`.
- A plugin provides step components, validators, and capabilities through `PluginStepRegistry`. A plugin-specific dialog host is not required by the default route.
- Legacy `NodeDialogExtension` step-state hosting is deprecated.

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
