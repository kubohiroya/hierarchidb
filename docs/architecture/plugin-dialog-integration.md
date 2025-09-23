# Plugin dialog integration audit

This memo captures the current implementation that discovers HierarchiDB plugins, surfaces their metadata to the UI, and wires plugin-provided dialog flows to the shared worker runtime. The goal is to document what exists today before attempting any simplification work.

## Build-time plugin discovery

* `scripts/generate-plugin-loader.mjs` parses `app/package.json` to locate dependencies that match `@hierarchidb/plugins-*-plugin`, resolves each package’s `exports`, and builds two generated modules: `src/generated/loader.ts` for worker-side entity database overrides and `src/generated/ui-loader.ts` for eager UI imports in dependency order.【F:scripts/generate-plugin-loader.mjs†L1-L229】【F:scripts/generate-plugin-loader.mjs†L200-L229】
* The `hierarchiDBMultiModulePreset` in `@hierarchidb/tools-vite-plugin-package-reader` contributes several virtual modules (`plugin-definitions`, `plugin-map`, `plugin-map-worker`, `plugin-types`) by scanning workspace packages, deriving per-plugin configuration, and emitting dynamic `import()` wrappers that prefer dedicated worker and UI entry points when present.【F:packages/tools/vite-plugin-package-reader/src/presets/hierarchidb.ts†L16-L335】
* `app/vite.config.ts` registers the preset alongside local helpers: `vite-plugin-plugin-registry` (to expose `virtual:plugin-registry-ui` / `-worker`) and `vite-plugin-plugin-services` (to expose `virtual:plugin-registry-services`). This ensures both static builds and the dev server see the same plugin inventory.【F:app/vite.config.ts†L87-L153】【F:app/vite-plugin-registry.ts†L1-L105】【F:app/vite-plugin-plugin-services.ts†L1-L94】

## Runtime metadata wiring in the app shell

* At startup, `root.tsx` registers `useWorkerClient` as the shared worker hook, runs `registerAllUIPlugins()` (leveraging the generated UI loader), prefetches menu builders, and loads the `virtual:plugin-definitions` module into the `window.__HDB_PLUGIN_DEFS__` global for downstream consumers such as the dialog runtime.【F:app/src/root.tsx†L1-L162】【F:app/src/root.tsx†L58-L119】
* `app/src/services/plugin-presentation.ts` consumes the virtual definitions (falling back to the global) to normalize labels, MUI icons, emoji, and priorities; `menu-builders.ts` then uses that presentation data when constructing speed-dial menus while still retaining a fallback for missing definitions.【F:app/src/services/plugin-presentation.ts†L1-L155】【F:app/src/plugins/menu-builders.ts†L1-L176】
* `app/src/services/plugin-services.ts` lazily imports `virtual:plugin-registry-services` so features can request per-plugin service bundles (e.g., database helpers) without eagerly importing every plugin module.【F:app/src/services/plugin-services.ts†L1-L68】

## Dialog composition flow

* Plugin UI code registers step factories via the singleton `PluginStepRegistry`. Config-based providers supply typed `componentFactory` callbacks, while legacy providers can continue to yield `DialogStep` records.【F:packages/runtime-ui/plugin-dialog/src/registry/PluginStepRegistry.ts†L1-L200】
* Hosts supply baseline steps (and optional submission guards) through `HostProfileRegistry`. The host lookup resolves `extends` / `base` values from the injected plugin definitions so a plugin such as Spreadsheet can inherit the Folder host profile.【F:packages/runtime-ui/plugin-dialog/src/registry/HostProfileRegistry.ts†L1-L70】
* `composeStepConfigs` merges host and plugin contributions, letting plugin-provided step IDs override host defaults while still falling back to the standard Basic Info step when nothing else is registered.【F:packages/runtime-ui/plugin-dialog/src/services/StepComposer.ts†L1-L40】
* Concrete examples: the basemap plugin registers `map-style`, `viewport`, and `display-options` step factories, while the folder host publishes a host-level `basic-info` component via the same registry system.【F:packages/plugins/basemap-plugin/src/ui/steps-provider.tsx†L1-L73】【F:packages/plugins/folder-plugin/src/ui/folder-host.tsx†L1-L45】

## Worker access and dialog runtime

* `WorkerAPIClient` holds the singleton Comlink proxy to the worker and exposes `initialize()`, `getSingleton()`, and `reset()` helpers. It promotes to the `initialized` state only after a successful ping or after the app observes the `INIT_COMPLETE` flag.【F:app/src/WorkerAPIClient.ts†L1-L172】
* `WorkerProvider` owns the actual boot sequence in React, coordinating the initialization channel, reporting progress, and publishing `{ client, isInitialized, error }` through context. The provider now gates its children behind React Suspense so that consumers only render once the `WorkerClientRef` is ready while continuing to surface progress and error overlays via the fallback components.【F:app/src/contexts/WorkerProvider.tsx†L20-L248】
* `@hierarchidb/runtime-worker-bootstrap` provides `registerWorkerClientHook` / `getWorkerClientHook`. `root.tsx` registers the app’s `useWorkerAPIClient` hook, making it discoverable for all plugin packages at runtime.【F:packages/runtime-worker/worker-bootstrap/src/ui/workerClientHook.ts†L1-L18】【F:app/src/root.tsx†L58-L79】
* `PluginDialogRoute` acquires the hook result, tolerating either a direct `WorkerAPI` proxy or an object with a `client` property, and passes the resolved client into the headless dialog shell.【F:packages/runtime-ui/plugin-dialog/src/components/PluginDialogRoute.tsx†L22-L120】
* Inside the shell, `usePluginDialogController` rehydrates persisted dialog frame state, calls the worker for metadata (tags, working copies), merges host + plugin steps, and renders `StepAdapter` components that bridge `componentFactory` callbacks to actual dialog steps while keeping validation wired up.【F:packages/runtime-ui/plugin-dialog/src/headless/usePluginDialogController.tsx†L101-L231】
* The controller now evaluates plugin-provided step capabilities (`canNavigateTo`, `canProceedToNext`, `canSave`, `canStartBatch`) on every state change to produce the `enabledStepIndices` array and Save/Batch flags consumed by `PluginDialogFooter`, ensuring the Next and Save buttons reflect the plugin’s service logic rather than local heuristics.【F:packages/runtime-ui/plugin-dialog/src/headless/usePluginDialogController.tsx†L36-L205】【F:packages/runtime-ui/plugin-dialog/src/headless/components/PluginDialogFooter.tsx†L1-L129】
* `useWorkingCopy` encapsulates the worker interactions needed for draft management (create-from-node, draft creation, commit, discard), operating against the worker API proxy provided by the host component.【F:packages/runtime-ui/plugin-dialog/src/hooks/useWorkingCopy.ts†L1-L200】

## Worker client shape divergence

### (A) Direct `WorkerAPI` proxy

* `PluginDialogRoute` and `usePluginDialogController` unwrap the registered hook value into a bare `WorkerAPI` remote, expecting every consumer to speak directly to Comlink-exposed methods such as `getQueryAPI()` and `getWorkingCopyAPI()`.【F:packages/runtime-ui/plugin-dialog/src/components/PluginDialogRoute.tsx†L22-L98】【F:packages/runtime-ui/plugin-dialog/src/headless/usePluginDialogController.tsx†L119-L137】
* Hooks like `useWorkingCopy` require that proxy up front; if the hook returns `null` (for example while initialization is still in flight), saving throws `Error('Worker client not initialized')`, which matches the "WorkerAPI not available" failure currently observed in the UI.【F:packages/runtime-ui/plugin-dialog/src/hooks/useWorkingCopy.ts†L71-L137】
* **Pros:** minimal surface area, no additional wrapper objects, easy to stub with the integration mocks already used by the headless dialog tests.
* **Cons:** no room to expose initialization state, retry controls, or legacy helpers; every caller must guard for `null` manually; incompatible with plugins that still expect a `getAPI()` facade.

### (B) `WorkerProvider` client holder for the headless dialog shell

* The application already centralizes boot progress inside `WorkerProvider`, which publishes `{ client, isInitialized, initProgress, error }` via React context. A hook such as `useWorkerClient` exposes that bundle to UI code and can be registered through `registerWorkerClientHook` so that the headless shell receives a richer client object instead of a naked proxy.【F:app/src/contexts/WorkerProvider.tsx†L171-L259】【F:app/src/contexts/WorkerProvider.tsx†L368-L397】【F:packages/runtime-worker/worker-bootstrap/src/ui/workerClientHook.ts†L1-L18】
* The same context sits on top of `WorkerAPIClient`, so it still provides the initialized `Remote<WorkerAPI>` under the `client` field while preserving lifecycle helpers such as `initialize()`, `reset()`, and readiness checks.【F:app/src/WorkerAPIClient.ts†L12-L172】【F:app/src/contexts/WorkerProvider.tsx†L188-L258】
* **Pros:** consistently surfaces readiness/error metadata for React components, makes it trivial to show overlays while the worker connects, and keeps the direct proxy accessible through the `client` property for shell internals.
* **Cons:** existing plugin hooks like the folder and shape integrations still assume the hook returns an object with `getAPI()`, so adopting the context holder requires either adding a thin adapter or extending the shared shape to provide that legacy method.【F:packages/plugins/folder-plugin/src/ui/hooks/useWorkingCopy.ts†L1-L22】【F:packages/plugins/shape-plugin/src/ui/hooks/useShapeAPI.ts†L15-L74】

### Recommendation

Standardize on the `WorkerProvider` client holder (B) and augment that shared shape with a backwards-compatible `getAPI()` accessor that simply returns the exposed `client`. That lets the headless dialog continue dereferencing `client` directly, gives React callers reliable progress/error state, and unblocks existing plugins that still call `getAPI()` without forcing them to spawn their own worker proxies. Once the adapter is in place we can deprecate the direct-proxy-only path and prevent further "WorkerAPI not available" errors caused by null proxies leaking out of the initialization window. *(Update: the runtime now exposes a shared `WorkerClientRef` via `getWorkerClientHook()` and plugin packages have been migrated to rely on it.)*

## Notable gaps and inconsistencies

* Plugin helpers now receive a uniform `WorkerClientRef` with `client`, `getAPI()`, and lifecycle helpers so they no longer need to guard against raw `WorkerAPI` proxies leaking through the initialization window.【F:packages/plugins/shape-plugin/src/ui/hooks/useShapeAPI.ts†L15-L61】【F:packages/plugins/folder-plugin/src/ui/hooks/useWorkingCopy.ts†L1-L23】【F:packages/ui/core/src/hooks/useWorkingCopy.ts†L1-L41】
* The dialog package included an unused `WorkerBridge` scaffold with stubbed batching for validation and capability evaluation. It has now been removed in favor of wiring every consumer through the shared worker client hook.

These findings should help prioritize cleanup work: deciding on a single worker-client shape for plugins, hardening the step registry/host merging, and either removing or completing the legacy bridge components.
