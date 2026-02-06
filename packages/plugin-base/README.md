# @hierarchidb/plugin-base

Headless orchestration utilities for plugin dialogs. Provides the shared step registry and peer dialog persistence helpers used by hosts and plugins.

## Directory layout
```
atoms/       Draft atoms (advanced consumers/tests)
registry/    Step registries (`PluginStepRegistry`, `HostProfileRegistry`)
services/    Step composer utilities
utils/       Peer dialog persistence helpers (position/size/display mode)
index.ts     Public exports
```

## Key exports
- `PluginStepRegistry`, `PluginStepConfig`, `PluginStepProvider`, `PluginStepProps`, `StartBatchContext`, `StepData` — step registration and composition for plugin dialogs.
- `HostProfileRegistry` — host capabilities/profile registry.
- Persistence utils: `get/setPeerDialogPosition|Size|DisplayMode` for peer dialog windows.
- `composeStepConfigs` — merge host/plugin step definitions.
- Atoms: `draftAtoms`（advanced/host-level access）.

## Consumers / usage
- `@hierarchidb/plugin-ui-host` — dialog shell uses registries to drive navigation.
- Feature plugins — register steps and capabilities via `PluginStepRegistry`.
- `app/src` treeconsole dialog routes — read `step`/`mode` from path segments (`.../:action/:mode/:step`).

## Build
```
pnpm --filter @hierarchidb/plugin-base build
```
