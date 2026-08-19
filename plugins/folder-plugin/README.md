# @hierarchidb/folder-plugin

Last updated: 2026-08-20

A plugin that provides the fundamental container node for HierarchiDB's tree structure. Folder nodes act as containers that semantically organize and consolidate various types of nodes in a hierarchy.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `folder` |
| extends | None (base plugin) |
| category | `core` |
| priority | `1000` |

folder-plugin is the base plugin of the HierarchiDB plugin system. Other plugins (spreadsheet-plugin, styler-plugin, etc.) inherit from this node type. folder-plugin itself has no plugin dependencies.

## UI Layer

### Dialogs

The folder-plugin UI uses the `PluginStepRegistry`-based step registration pattern. `FolderDialogHost` is deprecated and currently returns null.

Step registration is handled in `src/ui/components/steps-provider.tsx`, providing steps for two nodeTypes:

- **`folder`**: Empty step array (basic info is provided by `@hierarchidb/ui-plugin-basic-info`)
- **`folder-export`**: 5-step export wizard (see below)

### Components

| Component | Description |
| --- | --- |
| `FolderIcon` | Switches between `Folder` / `FolderOpen` icons based on open/closed state |
| `TagInput` | Tag input UI component |
| `CategorySelector` | Category selection UI component |

### Folder Export Wizard

A 5-step export flow accessible from the folder context menu:

1. **Purpose** — Select export purpose (`continuity` / `distribution`)
2. **Target Nodes** — Select target scope (`all` / `shapeOnly`)
3. **Output Format** — Choose format (continuity: `json` fixed, distribution: `pbf.zip` / `mvf`)
4. **Options** — Distribution mode options (`minZoom`, `maxZoom`, `maxTileBytes`)
5. **Review** — Confirm settings and trigger export

### Icon

```typescript
// Entry point: @hierarchidb/folder-plugin/icon
import { FolderPluginIcon } from '@hierarchidb/folder-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Folder` |
| Emoji | 📁 |
| Color | `#c0eeff` |

## Worker Layer

folder-plugin adopts a **Worker-less design**. Folder node data is stored directly in CoreDB `TreeNode` payload/draft, with no dedicated Worker database or EntityHandler.

The Worker `preload` configuration registers `registerFolderWorkerStores`, which only registers the payload peer store.

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerFolderWorkerStores'],
}
```

### Lifecycle

Folder CRUD operations are performed through the CoreDB TreeNode API:

- **Create**: Create a TreeNode + store name/description in payload/draft
- **Update**: Update TreeNode metadata
- **Delete**: Delete TreeNode (with child existence check)
- **Move/Copy**: TreeNode tree operations

## Database Schema

folder-plugin **does not have a dedicated Dexie database**.

> A `FolderDatabase` (`hdb-folder-entities-db`) existed in the past but has been removed. Folder data is now stored exclusively in CoreDB `TreeNode` payload/draft as the single source of truth.

### Data Structure

Folder nodes are defined as an alias for `TreeNode`:

```typescript
// FolderEntity is an alias for Core TreeNode
type FolderEntity = TreeNode;

// Peer data stored in TreeNode payload
interface FolderPeerData {
  schemaVersion: 1;
  domain: Record<string, unknown>;
}
```

## Plugin Dependencies

```typescript
// PluginManifest.dependencies
dependencies: []
```

folder-plugin has no plugin dependencies. Conversely, many plugins inherit from folder-plugin as their base.

## Configuration

### Capabilities

```typescript
capabilities: {
  canHaveChildren: true,   // child nodes allowed
  canBeRoot: true,         // can be a root node
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: true,
}
```

### Schema

```typescript
schema: {
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'string', required: false },
  ],
}
```

### Validation Constants

| Constant | Value | Description |
| --- | --- | --- |
| `NAME_MIN_LENGTH` | 1 | Minimum name length |
| `NAME_MAX_LENGTH` | 255 | Maximum name length |
| `DESCRIPTION_MAX_LENGTH` | 1000 | Maximum description length |
| `MAX_TAGS` | 10 | Maximum number of tags |
| `MAX_TAG_LENGTH` | 50 | Maximum tag length |
| `MAX_DEPTH` | 20 | Maximum hierarchy depth |
| `MAX_CHILDREN_DEFAULT` | 1000 | Default maximum child node count |

### i18n

| Field | Value |
| --- | --- |
| namespace | `folder-plugin` |
| Locales | `en`, `ja` |

## Usage Examples

### Referencing the PluginManifest

```typescript
import { FolderPluginManifest } from '@hierarchidb/folder-plugin';

console.log(FolderPluginManifest.nodeType); // 'folder'
console.log(FolderPluginManifest.capabilities.canHaveChildren); // true
```

### Using FolderIcon

```tsx
import { FolderIcon } from '@hierarchidb/folder-plugin/ui';

// Closed folder
<FolderIcon />

// Open folder
<FolderIcon open={true} />
```

## Legacy YAML snapshot boundary

The current `exportYamlNodesToSnapshot` and `importYamlNodesFromSnapshot` helpers are a legacy, non-canonical implementation. Export still reads `data.name`; import writes sequential YamlDB-only rows with an empty schema ID and does not create authoritative CoreDB `TreeNode` records. A later write failure can therefore leave partial YamlDB rows.

Do not use these helpers as the canonical IDE-GSM snapshot path or a Step 4 runtime dependency. Their cutover is blocked until CoreDB migration succeeds, after which a separate issue must implement all-entry preflight and one CoreDB transaction for node and parent updates. See the [canonical YAML storage contract](../../docs/yaml-plugin-ide-gsm-step4-spec.md) and the [legacy YamlDB boundary](../../packages/yaml-store/README.md).

## Directory Structure

```text
src/
├── index.ts                  # Root entry point (types + manifest + YAML utilities)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── locales/              # i18n resources (en, ja)
│   ├── shared/
│   │   ├── folderValidation.ts   # Name/data validation
│   │   ├── yamlFolderExport.ts   # YAML snapshot export
│   │   └── yamlFolderImport.ts   # YAML snapshot import
│   └── types/
│       ├── constants.ts      # Validation/display constants
│       ├── FolderEntity.ts   # FolderEntity type (TreeNode alias)
│       ├── metadata.ts       # Plugin metadata
│       └── types.ts          # CreateFolderData, UpdateFolderData, FolderPeerData
├── icon/
│   └── index.ts              # FolderPluginIcon (re-export of MUI Folder)
└── ui/
    ├── FolderDialogHost.tsx   # Deprecated dialog host (returns null)
    ├── index.ts               # UI entry point
    └── components/
        ├── CategorySelector.tsx
        ├── FolderIcon.tsx     # Open/closed folder icon
        ├── TagInput.tsx
        ├── steps-provider.tsx # PluginStepRegistry registration
        └── folder-export/    # 5-step export wizard components
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/folder-plugin` | Type definitions, PluginManifest, YAML utilities |
| `@hierarchidb/folder-plugin/ui` | UI components (FolderDialogHost, step registration) |
| `@hierarchidb/folder-plugin/icon` | FolderPluginIcon |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../../packages/core-types/) — Shared type definitions (NodeId, NodeType, etc.)
- [`@hierarchidb/tree-api`](../../packages/tree-api/) — TreeNode type definitions
- [`@hierarchidb/tag-api`](../../packages/tag-api/) — TagId, TagSuggestion types
- [`@hierarchidb/yaml-api`](../../packages/yaml-api/) — YAML node type definitions
- [`@hierarchidb/yaml-store`](../../packages/yaml-store/) — Legacy YamlDB recovery boundary
- [`@hierarchidb/util`](../../packages/util/) — Utilities (generateId, etc.)
- [`@hierarchidb/plugin-ui-sdk`](../../packages/plugin-ui-sdk/) — Plugin UI SDK
- [`@hierarchidb/plugin-service-api`](../../packages/plugin-service-api/) — Plugin service API
- [`@hierarchidb/components`](../../packages/components/) — Shared UI components (notify, etc.)
- [`@hierarchidb/ui-dialog`](../../packages/ui/dialog/) — Dialog base
- [`@hierarchidb/ui-plugin-basic-info`](../../packages/ui/plugin-basic-info/) — Plugin basic info step

### Plugins Inheriting from folder-plugin

- [`spreadsheet-plugin`](../spreadsheet-plugin/) — CSV/TSV/Excel source management
- [`styler-plugin`](../styler-plugin/) — Style definitions and map style application
- [`linker-plugin`](../linker-plugin/) — Project domain management

## License

MIT
