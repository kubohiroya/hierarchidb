# @hierarchidb/plugin-ui-host

Last updated: 2026-04-05

Host-side UI components for HierarchiDB plugin dialogs. `PluginDialogHost` provides an integrated host for plugin multi-step dialogs, while `PluginDialogShell`, `PluginDialogHeader`, and `PluginDialogFooter` provide the dialog structure.

## Key Features

- `PluginDialogHost` — Integrated host component for plugin dialogs
- `PluginDialogShell` — Dialog shell (header + content + footer)
- `PluginDialogHeader` — Dialog header (title, step indicator)
- `PluginDialogFooter` — Dialog footer (navigation, save button)

## Public API

```typescript
import {
  PluginDialogHost,
  PluginDialogShell,
  PluginDialogHeader,
  PluginDialogFooter,
} from '@hierarchidb/plugin-ui-host';
```

| Component | Description |
| --- | --- |
| `PluginDialogHost` | Retrieves steps from `PluginStepRegistry` by plugin nodeType and renders a multi-step dialog |
| `PluginDialogShell` | Dialog outer frame (header, content, footer layout) |
| `PluginDialogHeader` | Step title and step indicator display |
| `PluginDialogFooter` | Previous/Next/Save buttons with validation-aware enable/disable |

## Dependencies

| Package | Purpose |
| --- | --- |
| `@hierarchidb/plugin-base` | PluginStepRegistry, PluginManifest |
| `@hierarchidb/plugin-ui-sdk` | Plugin UI SDK |
| `@hierarchidb/plugin-presentation` | Presentation layer |
| `@hierarchidb/ui-dialog` | Dialog base |
| `@hierarchidb/ui-plugin-basic-info` | Basic info step |
| `@hierarchidb/components` | Shared UI components |
| `jotai` | State management |

## Related Packages

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginStepRegistry
- [`@hierarchidb/plugin-ui-sdk`](../plugin-ui-sdk/) — Plugin UI SDK
- [`@hierarchidb/ui-dialog`](../ui/dialog/) — Dialog base

## License

MIT
