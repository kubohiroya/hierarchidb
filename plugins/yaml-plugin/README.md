# @hierarchidb/yaml-plugin

Last updated: 2026-08-20

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

The current implementation registers `registerYamlWorkerStores` as a `preload` entry and initializes the legacy YamlDB v1 singleton from `@hierarchidb/yaml-store`.

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerYamlWorkerStores'],
}
```

This preload is a temporary legacy runtime path, not the YAML storage authority. Follow-up issues will inventory and recover legacy rows before removing the runtime path. Existing YamlDB mutation helpers are legacy-only; canonical dialog, ZIP, simulation, and Step 4 paths must not call them. The current [folder YAML import](../folder-plugin/README.md#legacy-yaml-snapshot-boundary) remains non-canonical and blocked from cutover. New CRUD callers, YamlDB writes, dual-write, and fallback reads must not be added.

## Storage Authority

The canonical contract is [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md):

- committed filename and payload state is stored in CoreDB `TreeNode.metadata/data`;
- draft filename and payload state is stored in CoreDB `TreeNode.draftMetadata/draftData`;
- the filename is stored only in the corresponding metadata `name`;
- the canonical payload is `{ subtype, schemaId, content }`;
- YamlDB v1 is a frozen, non-authoritative legacy recovery source, not a cache or dual-write destination.

CoreDB migration and YamlDB inventory/recovery are separate atomic boundaries because they are separate IndexedDB databases. Missing names, empty schema IDs, unknown tuples, and conflicts are errors; the plugin must not infer or supply them.

### Current Legacy Entity Shape

The source still uses the following legacy type until the coordinated canonical writer and CoreDB migration issues cut over all consumers. This documents current code and does not supersede the canonical storage contract.

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

The canonical writer must move `name` to the matching metadata slot, add an explicit registry-validated `subtype`, and reject incomplete or mismatched records before saving.

### Dormant Canonical Writer

The independent `@hierarchidb/yaml-plugin/canonical-writer` subpath validates an exact dialog-write input and emits one atomic-shaped request to a caller-injected write port. It delegates filename and payload validation exclusively to `@hierarchidb/yaml-api/validation`, writes the filename only to `draftMetadata.name`, and writes the validated `{ subtype, schemaId, content }` value to `draftData`. The request fixes `onNameConflict` to `error`; validation and port failures do not retry, auto-rename, overwrite, or fall back to the legacy writer.

This entry point is dormant. The package root, UI, worker, production dialog, TreeNode updater, CoreDB, YamlDB, and plugin preload do not import or invoke it. The existing three-step UI, legacy draft shape, manifest, and ten-template runtime selector remain unchanged until the single activation change. See the [canonical Step 4 contract](../../docs/yaml-plugin-ide-gsm-step4-spec.md#dormant-canonical-dialog-writer).

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
├── canonical-writer/
│   ├── index.ts                              # Dormant writer entry point
│   ├── writeYamlCanonicalDialogDraft.ts      # Strict validation and one port call
│   └── yamlCanonicalDialogWriterTypes.ts     # Public input/request/result types
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
| `@hierarchidb/yaml-plugin/canonical-writer` | Dormant strict canonical dialog writer |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/core-types`](../../packages/core-types/) — Shared type definitions (NodeType, etc.)
- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — PluginManifest, PluginStepRegistry
- [`@hierarchidb/yaml-api`](../../packages/yaml-api/) — YamlFileNodeData type definitions
- [`@hierarchidb/yaml-store`](../../packages/yaml-store/) — legacy YamlDB v1 recovery boundary; not the authoritative runtime store
- [`Canonical storage contract`](../../docs/yaml-plugin-ide-gsm-step4-spec.md) — CoreDB authority, migration, recovery, and rollback rules

### Parent Plugin

- [`folder-plugin`](../folder-plugin/) — Base container node

## License

MIT
