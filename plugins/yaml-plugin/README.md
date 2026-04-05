# @hierarchidb/yaml-plugin

Last updated: 2026-04-05

A YAML file node plugin for HierarchiDB. Manages YAML configuration files as tree nodes for IDE-GSM integration. Provides JSON Schema-based schema selection and a validated editor for structured YAML content editing.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `yaml-file` |
| extends | `folder` |
| category | `yaml` (menuGroup: `yaml`, createOrder: `500`) |
| priority | `500` |

yaml-plugin inherits from folder-plugin and adds YAML file management capabilities.

## UI Layer

### Dialog Steps

Provides a 3-step wizard via `PluginStepRegistry`:

| Step | ID | Component | Description | Validation |
| --- | --- | --- | --- | --- |
| 1 | `basic-info` | `YamlBasicInfoStep` | Name input | `name` must be non-empty |
| 2 | `schema-selection` | `YamlSchemaSelectionStep` | Schema ID selection | `schemaId` must be selected |
| 3 | `schema-editor` | `YamlSchemaEditorStep` | JSON Schema Form content editor | Always valid (save enabled) |

The schema editor uses `@rjsf/core` + `@rjsf/mui` to dynamically generate a form UI based on the selected schema.

### Icon

```typescript
// Entry point: @hierarchidb/yaml-plugin/icon
import { YamlPluginIcon } from '@hierarchidb/yaml-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Description` |
| Emoji | 📄 |
| Color | `#4caf50` |

## Worker Layer

`registerYamlWorkerStores` is registered as a `preload` entry and initializes the `YamlDB` singleton from `@hierarchidb/yaml-store`.

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerYamlWorkerStores'],
}
```

CRUD operations are performed through the `@hierarchidb/yaml-store` API.

## Database Schema

yaml-plugin uses the Dexie-based `YamlDB` provided by `@hierarchidb/yaml-store`. The database definition resides in the yaml-store package.

### Entity Structure

```typescript
// YamlFileNodeData (from @hierarchidb/yaml-api)
interface YamlFileNodeData {
  name: string;
  schemaId: string;
  content: string;  // YAML content as string
}

// Draft type for create/edit
type YamlDraft = Partial<YamlFileNodeData>;
```

## Plugin Dependencies

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

## Configuration

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,
  canBeRoot: false,
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: true,
}
```

### Schema

```typescript
schema: {
  inherits: 'folder',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'schemaId', type: 'string', required: true },
    { name: 'content', type: 'string', required: false },
  ],
}
```

### i18n

| Field | Value |
| --- | --- |
| namespace | `yaml-plugin` |

## Usage Examples

### Referencing the PluginManifest

```typescript
import { YamlPluginManifest, YAML_NODE_TYPE } from '@hierarchidb/yaml-plugin';

console.log(YamlPluginManifest.nodeType); // 'yaml-file'
console.log(YamlPluginManifest.extends);  // 'folder'
console.log(YAML_NODE_TYPE);              // 'yaml-file'
```

### Using YamlPluginIcon

```tsx
import { YamlPluginIcon } from '@hierarchidb/yaml-plugin/icon';

<YamlPluginIcon sx={{ color: '#4caf50' }} />
```

## Directory Structure

```text
src/
├── index.ts                  # Root entry point (manifest + constants)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── constants.ts          # YAML_NODE_TYPE re-export
│   └── types/
│       └── YamlEntity.ts     # YamlDraft type
├── icon/
│   ├── index.ts              # Icon entry point
│   └── YamlPluginIcon.tsx    # MUI Description icon
├── ui/
│   ├── index.ts              # UI entry point (step exports)
│   └── components/
│       ├── steps-provider.tsx # PluginStepRegistry registration (3 steps)
│       └── steps/
│           ├── YamlBasicInfoStep.tsx       # Basic info step
│           ├── YamlSchemaSelectionStep.tsx # Schema selection step
│           └── YamlSchemaEditorStep.tsx    # Schema editor step (RJSF)
└── worker/
    ├── index.ts                        # Worker entry point
    └── registerYamlWorkerStores.ts     # YamlDB singleton initialization
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/yaml-plugin` | PluginManifest, YAML_NODE_TYPE, YAML_PLUGIN_ID |
| `@hierarchidb/yaml-plugin/ui` | UI components (3 steps) |
| `@hierarchidb/yaml-plugin/icon` | YamlPluginIcon |
| `@hierarchidb/yaml-plugin/worker` | registerYamlWorkerStores |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/core-types`](../../packages/core-types/) — Shared type definitions (NodeType, etc.)
- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — PluginManifest, PluginStepRegistry
- [`@hierarchidb/yaml-api`](../../packages/yaml-api/) — YamlFileNodeData type definitions
- [`@hierarchidb/yaml-store`](../../packages/yaml-store/) — YamlDB (Dexie data store)

### Parent Plugin

- [`folder-plugin`](../folder-plugin/) — Base container node

## License

MIT
