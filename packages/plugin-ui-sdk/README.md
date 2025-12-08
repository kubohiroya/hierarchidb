# @hierarchidb/plugin-ui-sdk

Dialog-internal utilities shared by plugin UIs: draft wiring, TreeNodeUpdater helpers, and headless dialog scaffolding used inside steps.

## Directory layout
```
hooks/    Dialog hooks (`useTreeNodeUpdater`, `useSingleSourceDialogAtom`, `useTreeNodeDialog`)
dialog/   Step helpers (`wrapDialogStepComponent`, Basic Info step props)
types/    Shared dialog types
index.ts  Public exports
```

## Key exports
- `useTreeNodeUpdater` / `createTreeNodeUpdaterActions` — bridge to worker draft APIs (commit/discard, metadata/draftData updates, capability flags).
- `useSingleSourceDialogAtom` — jotai-based single-source draft/metadata atoms with shallow equality guards to prevent update loops; returns `store`, `draftAtom`, `metadataAtom`, `commit`, `discard`.
- `useTreeNodeDialog` — helper to wire dialog steps with the updater and host-provided step configs.
- `wrapDialogStepComponent` — HOC to adapt step components to the dialog host contract.
- Types: `PluginDialogData`, `UseTreeNodeUpdaterResult`, `DialogStepConfig`, `DialogStepFactoryArgs`, `BasicInfoStepProps`.

## When to use
- Implementing plugin dialogs/steps that need TreeNodeUpdater integration, draft/metadata synchronization, or reusable form helpers.
- Converging tabular/location/timeline/basemap dialogs on a single draft source with jotai guardrails (`useSingleSourceDialogAtom`).

## Boundaries
- Shell / navigation / header/footer live in `@hierarchidb/plugin-ui-host` (do not add shell logic here).
- Presentation (icons/labels) belongs to `@hierarchidb/plugin-presentation` or app layer.
- Plugin-specific one-off components should live in the plugin package, not here.

## Consumers / usage
- Feature plugins (basemap, shape, route, spreadsheet, location, timeline, resolver, styler, etc.) use these hooks inside dialog steps.
- `@hierarchidb/plugin-ui-host` pairs with this package: host provides shell/navigation, sdk provides draft wiring and step helpers.
