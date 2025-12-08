# @hierarchidb/plugin-ui-host

Headless dialog host for plugin UIs. Provides the shell (header/footer/stepper), controller, and headless components to drive MultiStep dialogs; leaves field/draft logic to `@hierarchidb/plugin-ui-sdk` and plugins.

## Directory layout
```
headless/   Shell components and controller (`PluginDialogShell`, Header/Footer, Stepper, usePluginDialogController)
examples/   Example host wiring
tests/      Unit tests for headless components
PluginDialogHost.tsx  Convenience host wrapper
index.ts    Public exports
```

## Key exports
- Components: `PluginDialogShell`, `PluginDialogHeader`, `PluginDialogFooter`, `PluginDialogStepper`, `StepStatusIcon` (headless MUI-based shell).
- Controller: `usePluginDialogController` — orchestrates step navigation, validation, capabilities (committable, cancellable), peer dialog handling; integrates with `PluginStepRegistry`.
- Helpers: `cancelDraftPolicy`, headless `PluginDialogHost` wrapper.

## Boundaries
- Shell/navigation only; draft/data normalization lives in `@hierarchidb/plugin-ui-sdk`.
- Presentation data (labels/icons) comes from `@hierarchidb/plugin-presentation` or app-level registries.
- Plugin-specific form components should remain in each plugin package.

## Consumers / usage
- `app/src` dialog routes and TreeConsole hosts embed `PluginDialogHost` / headless components.
- Feature plugins supply step components and use this host to render MultiStep dialogs (basemap, shape, route, spreadsheet, location, timeline, resolver, styler, etc.).
- Works with `@hierarchidb/plugin-base` step registry and URL/view-state hooks.
