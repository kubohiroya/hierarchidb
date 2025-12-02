# WorkingCopy Dialog Hosting: Current Notes

- Creation flow (TreeConsole): `create:<nodeType>` → create working copy node → navigate to `/t/<treeId>/<parentId>/<wcNodeId>/<nodeType>/create`. The dialog UI is resolved from the plugin registry entry (UI export) at runtime.
- Responsibilities:
  - App/host: renders the dialog shell (HeadlessMultiStepDialog) and drives `useTreeNodeUpdater` so Basic Info is written to `draftMetadata` and plugin-specific data to `draftData`.
  - Plugin: exposes UI entry (via plugin registry) and provides step components/validators. Legacy NodeDialogExtension (step-state only) is deprecated; new hosts use `useTreeNodeUpdater` directly.
- Current state:
  - Basemap/Route/Location/Resolver: host lives in app; legacy NodeDialogExtension is不要。
  - Spreadsheet/Styler: plugin-side dialog hosts (`SpreadsheetDialog`, `StylerDialog`) are exported via `./ui`; registry-driven resolution loads them.
- Next steps to align:
  - Ensure plugin UI entries export the dialog host component used at runtime.
  - Regenerate plugin registry if needed (`pnpm tools:gen-plugin-registry`).
  - Avoid duplicating app-specific hosts; rely on registry-driven loading per nodeType.

## Plugin Registry Generation and Consumption
- Generation: `pnpm tools:gen-plugin-registry` scans plugins and emits `packages/plugin-registry/generated/registry.ts` (and related artifacts), listing UI/Worker/Icon entrypoints based on each plugin’s `hierarchidb.plugin` metadata.
- Consumption: Vite dev/build imports the generated registry to resolve UI components dynamically for create/edit dialogs and other plugin assets. The app does not hardcode nodeType→component mappings; it uses the generated registry to locate UI entry exports.
- To ensure a plugin dialog is loadable:
  - Plugin side: expose the dialog host (HeadlessMultiStepDialog + `useTreeNodeUpdater`) via the standard `./ui` export in `package.json` (`"exports": { "./ui": { "types": "./dist/ui/index.d.ts", "import": "./dist/ui/index.js" } }`).
  - App side: relies on plugin-registry resolving that `./ui` entry; no nodeType→component hardcoding.
  - Regenerate the registry when UI entries change (`pnpm tools:gen-plugin-registry`).
  - Vite dev/build will pick up the generated registry and load the UI entry at runtime based on nodeType.
