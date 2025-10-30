# ADR: Plugin Dialog Layering Finalisation

- **Status**: Accepted (2025-10-30)
- **Context**: The plugin dialog stack was split across `@hierarchidb/plugin-ui-sdk`, `packages/ui/plugin-dialog`, and ad-hoc helpers. Host apps (`@hierarchidb/app`) consumed multiple packages directly, making layering enforcement and dependency hygiene difficult. The new `@hierarchidb/plugin-base` package collects headless utilities, but UI logic and presentation helpers were still mixed across packages.

## Decision

1. Treat `@hierarchidb/plugin-base` as the single source for headless orchestration (registries, WorkingCopy bridge, dialog URL sync, capability evaluation). UI dependencies are forbidden here.
2. Move presentation helpers (icon lookup, manifest-backed labels) into a dedicated package `@hierarchidb/plugin-presentation` and expose a façade component `PluginDialogHost` that wraps `PluginDialogShell` plus icon prefetch.
3. Require host apps to consume plugin dialogs only through `@hierarchidb/plugin-ui-host`. A dep-fence guard prohibits direct imports from `@hierarchidb/plugin-base` or `@hierarchidb/plugin-service-{api,sdk}` inside `@hierarchidb/app`.
4. Ensure plugin authors continue to rely on `@hierarchidb/plugin-ui-sdk`, which now re-exports the public types from `plugin-base` without exposing UI-layer internals.

## Consequences

- Layer boundaries are explicit: Base (headless) → Service API/SDK (contract/helpers) → UI Host (presentation) → App.
- Apps gain a single integration point (`PluginDialogHost`), simplifying future migrations (e.g., alternate hosts).
- Presentation helpers remain available via `@hierarchidb/plugin-presentation` for menus と UI ホスト双方から利用でき、headless パッケージが UI 依存を抱えない。
- Dep-fence will fail CI if new direct imports violate this layering.

## Implementation

- Migrate presentation utilities (`getPresentation`, `getIconComponent`, `prefetchAllIcons`) and tests from host/app側へ集約し、`@hierarchidb/plugin-presentation` で共有化。
- Introduce `PluginDialogHost` façade that prefetches icons and delegates to `PluginDialogShell`.
- Update `@hierarchidb/app` routes to consume `PluginDialogHost`.
- Adjust `dep-fence.config.mjs` with an `app-plugin-dialog-layering` rule banning direct imports from base/service packages in the app.
- Refresh package dependencies to drop UI libs from `plugin-base` and expose presentation helpers from `plugin-ui-host`.

## Rollback

Revert the façade and utility migration patches, restore presentation helpers to `plugin-base`, and delete the dep-fence policy. `PluginDialogRoute` can import `PluginDialogShell` directly again. No data migrations are involved.
