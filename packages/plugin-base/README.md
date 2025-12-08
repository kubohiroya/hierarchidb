# @hierarchidb/plugin-base

Headless orchestration utilities for plugin dialogs. Provides the shared step registry, dialog URL/view-state synchronization, and peer dialog persistence helpers used by hosts and plugins.

## Directory layout
```
atoms/       Draft atoms (advanced consumers/tests)
hooks/       Dialog URL/view-state hooks (`useDialogUrlSync`, `useDialogViewState`)
registry/    Step registries (`PluginStepRegistry`, `HostProfileRegistry`)
services/    Step composer utilities
utils/       Peer dialog persistence helpers (position/size/display mode)
index.ts     Public exports
```

## Key exports
- `PluginStepRegistry`, `PluginStepConfig`, `PluginStepProvider`, `StepComponentProps`, `StartBatchContext`, `StepData` — step registration and composition for plugin dialogs.
- `HostProfileRegistry` — host capabilities/profile registry.
- Hooks: `useDialogUrlSync`（sync `step`/`mode`/`map` with URL, namespaced states）、`useDialogViewState`.
- Persistence utils: `get/setPeerDialogPosition|Size|DisplayMode` for peer dialog windows.
- `composeStepConfigs` — merge host/plugin step definitions.
- Atoms: `draftAtoms`（advanced/host-level access）.

## Consumers / usage
- `@hierarchidb/plugin-ui-host` — dialog shell uses registries/hooks to drive navigation and URL sync.
- Feature plugins — register steps and capabilities via `PluginStepRegistry`.
- `app/src` treeconsole dialog routes — read `step`/`mode`/`map` query params synced by `useDialogUrlSync`.

## Build
```
pnpm --filter @hierarchidb/plugin-base build
```
