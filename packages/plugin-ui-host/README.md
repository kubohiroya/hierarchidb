# @hierarchidb/plugin-ui-host

## Purpose (Host layer)
- Provides the **shell** for plugin dialogs (HeadlessMultiStepDialog wrapper, header/footer/shell components, controller hooks).
- Manages dialog lifecycle and step navigation; does **not** own form logic or draft state handling.

## Boundaries
- Host is about the outer container. Shared form logic, draft handling, and field normalization live in `@hierarchidb/plugin-ui-sdk`.
- Presentation data (icons/labels) is consumed from `@hierarchidb/plugin-presentation`; host should not become a grab-bag of utilities.

## When to use
- Building a plugin dialog host (e.g., `BasemapDialogHost`, `ShapeDialogHost`) that wraps steps provided by the plugin.
- Reusing the headless components (`PluginDialogShell`, `PluginDialogFooter/Header`, controller hooks) for custom shells.

## Avoid
- Putting draft/data normalizationやステップの中身のロジック here — place those in `plugin-ui-sdk`.
- Adding plugin-specific form components; keep this package focused on shell and navigation concerns.
