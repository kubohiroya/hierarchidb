# @hierarchidb/plugin-presentation

Last updated: 2026-04-05

Shared presentation metadata helpers for HierarchiDB plugins. Manages plugin display information (icons, labels, colors, etc.) in a global store accessible from UI components.

## Key Features

- `getGlobalPluginPresentationStore` — Retrieve the global plugin presentation metadata store
- `normalizeMuiIconName` — Normalize MUI icon names
- `normalizeLabelText` / `sanitizeLabel` — Normalize and sanitize label text

## Public API

```typescript
import {
  getGlobalPluginPresentationStore,
  normalizeMuiIconName,
  normalizeLabelText,
  sanitizeLabel,
} from '@hierarchidb/plugin-presentation';
```

### Type Definitions

```typescript
interface PluginPresentationManifest {
  nodeType: string;
  displayName: string;
  icon: PluginPresentationManifestIcon;
}

interface PluginPresentation {
  nodeType: string;
  displayName: string;
  icon: PluginPresentationIconConfig;
  color?: string;
}
```

## Dependencies

| Package | Type | Purpose |
| --- | --- | --- |
| `@hierarchidb/components` | peer | Shared UI components |

## Related Packages

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginManifest (source of presentation data)
- [`@hierarchidb/plugin-ui-host`](../plugin-ui-host/) — Dialog host (consumes presentation data)

## License

MIT
