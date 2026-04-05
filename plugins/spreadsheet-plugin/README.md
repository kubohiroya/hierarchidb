# @hierarchidb/spreadsheet-plugin

Last updated: 2026-04-05

A next-generation spreadsheet plugin built on the shared tabular ingestion stack. Provides CSV/TSV/Excel file upload and URL download capabilities for tabular data ingestion, filtering, and management.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `spreadsheet` |
| extends | `folder` |
| category | `data` / `tabular` |
| priority | `600` |

spreadsheet-plugin inherits from folder-plugin, adding tabular data source management on top of the folder's base capabilities (name, description, tags, etc.). The schema inherits folder fields and adds `spreadsheetMetadataId`, `dataSource`, and `filters`.

## UI Layer

### Dialog Steps

The spreadsheet-plugin UI uses the `PluginStepRegistry`-based step registration pattern. Steps are registered in `src/ui/components/steps-provider.tsx`:

1. **Data Source** — Local file upload or URL download for data ingestion
2. **Filtering** — Filter rule configuration for ingested tabular data (optional step)

> Basic info (name/description/tags) is provided by `@hierarchidb/ui-plugin-basic-info` and is not part of the spreadsheet-plugin steps.

### Components

| Component | Description |
| --- | --- |
| `TabularDataSourceStep` | File upload / URL download toggle + processing options |
| `TabularDataFilterStep` | Filter rule configuration + preview display |
| `ValueHistogram` | Value distribution histogram |
| `KeyValueSourcePanel` | Key-value column selection panel |
| `TabularFilterSections` | Filter sections UI |
| `TabularKeyValuePanels` | Key-value pair statistics panels |

### Icon

```typescript
// Entry point: @hierarchidb/spreadsheet-plugin/icon
import { SpreadsheetPluginIcon } from '@hierarchidb/spreadsheet-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Assessment` |
| Emoji | 📈 |
| Color | `#dcbc50` |

## Worker Layer

The spreadsheet-plugin Worker layer adopts a minimal design. `registerSpreadsheetWorkerStores` is registered as a `preload` entry, but the current implementation performs no actual operations (PeerStore has been removed).

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerSpreadsheetWorkerStores'],
}
```

Data ingestion and persistence are handled directly on the main thread by the service layer (`SpreadsheetTabularApiDriver`), not through the Worker.

### Data Ingestion Flow

1. Acquire data via file upload or URL download
2. Parse with `TabularService` (`@hierarchidb/tabular-source`)
3. Write through `SpreadsheetStorePort` to `TabularWriter` (`@hierarchidb/tabular-store`)
4. Row data is persisted in chunks to the shared `RowStoreDB`
5. Metadata is managed by `SpreadsheetMetadataManager`

## Database Schema

spreadsheet-plugin does not have a dedicated Dexie database. It uses the shared tabular store infrastructure.

### Metadata Store

`SpreadsheetMetadataManager` extends `TabularDatabaseManager` and manages metadata under the DB name `spreadsheet-metadata`.

```typescript
// SpreadsheetMetadataManager extends TabularDatabaseManager
const manager = new SpreadsheetMetadataManager();
// DB name: 'spreadsheet-metadata' (via getDBName)
```

### Row Data Store

Row data is stored in the shared `RowStoreDB` from `@hierarchidb/tabular-store`. A compound index `[pluginId+tableId]` isolates data per plugin.

### Entity Structure

```typescript
// SpreadsheetEntity (re-exported from @hierarchidb/spreadsheet-store)
interface SpreadsheetEntity {
  spreadsheetMetadataId?: string;
  dataSource?: {
    type: 'file' | 'url';
    source?: string;
    filename?: string;
    sizeBytes?: number;
    contentHash?: string;
  };
  tabularTableMetadata?: TabularTableMetadata;
  tabularProcessingConfig?: TabularProcessingConfig;
  file?: {
    name: string;
    sizeBytes: number;
    type?: string;
    lastModifiedAt?: number;
  };
  filters?: TabularFilterRule[];
  lastPreview?: TabularDataResult;
}
```

### Data Source Types

```typescript
const DATA_SOURCE_TYPES = {
  FILE: 'file',  // local file upload
  URL: 'url',    // remote URL download
} as const;
```

## Plugin Dependencies

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

spreadsheet-plugin depends on folder-plugin. It inherits the folder node type and uses its container functionality as the foundation within the tree structure.

## Configuration

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,  // no child nodes
  canBeRoot: false,        // cannot be a root node
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
    { name: 'spreadsheetMetadataId', type: 'string', required: false },
    { name: 'dataSource', type: 'object', required: false },
    { name: 'filters', type: 'array', required: false },
  ],
}
```

### i18n

| Field | Value |
| --- | --- |
| namespace | `spreadsheet-plugin` |
| Locales | `en`, `ja` |

## Service Layer

spreadsheet-plugin provides a service layer that implements the `TabularDataApi` interface.

### SpreadsheetTabularApiDriver

The primary implementation of `TabularDataApi`. Provides file upload, URL download, filtering, and table management.

| Method | Description |
| --- | --- |
| `uploadTabularFile` | Parse a file and ingest it into the shared store |
| `downloadTabularFromUrl` | Download data from a URL and ingest it |
| `getFilteredPreview` | Retrieve filtered preview data |
| `getFilteredData` | Retrieve all filtered data |
| `listTables` | List registered tables |
| `deleteTable` | Delete a table and its row data |
| `addTableReference` | Add a plugin reference to a table |
| `removeTableReference` | Remove a plugin reference from a table |

### SpreadsheetStorePort

Implementation of `TabularStorePort`. Manages ingest sessions (begin, write chunks, commit, abort) and performs column type inference (number/boolean/date/string).

### Factory Functions

```typescript
// Create a standard spreadsheet API driver
const api = createSpreadsheetTabularApi('my-plugin-id');

// Create a plugin-specific driver with CORS proxy support
const api = createPluginTabularApi({
  pluginId: 'my-plugin',
  metadataManager: myManager,
  enableCorsProxy: true,
});
```

## Usage Examples

### Referencing the PluginManifest

```typescript
import { SpreadsheetPluginManifest } from '@hierarchidb/spreadsheet-plugin';

console.log(SpreadsheetPluginManifest.nodeType); // 'spreadsheet'
console.log(SpreadsheetPluginManifest.extends);   // 'folder'
console.log(SpreadsheetPluginManifest.dependencies); // ['folder']
```

### Uploading a CSV File

```typescript
import { createSpreadsheetTabularApi } from '@hierarchidb/spreadsheet-plugin';

const api = createSpreadsheetTabularApi();
const file = new File(['name,age\nAlice,30\nBob,25'], 'data.csv', {
  type: 'text/csv',
});

const metadata = await api.uploadTabularFile(file, {
  delimiter: ',',
  hasHeader: true,
});
console.log('Table ID:', metadata.id);
console.log('Total rows:', metadata.totalRows);
```

### Downloading Data from a URL

```typescript
import { createSpreadsheetTabularApi } from '@hierarchidb/spreadsheet-plugin';

const api = createSpreadsheetTabularApi();
const metadata = await api.downloadTabularFromUrl(
  'https://example.com/data.csv',
  { delimiter: ',', hasHeader: true },
);
console.log('Downloaded table:', metadata.filename);
```

### Retrieving Filtered Data

```typescript
import { createSpreadsheetTabularApi } from '@hierarchidb/spreadsheet-plugin';

const api = createSpreadsheetTabularApi();
const result = await api.getFilteredPreview(tableId, [
  { column: 'age', operator: 'greater_than', value: 20, enabled: true },
], 100);
console.log('Filtered rows:', result.rows.length);
console.log('Total matches:', result.totalRows);
```

### Using UI Step Components

```tsx
import { TabularDataSourceStep, TabularDataFilterStep } from '@hierarchidb/spreadsheet-plugin/ui';

// Embed the data source step in a custom dialog
<TabularDataSourceStep
  data={draftData}
  onDataChange={handleDataChange}
/>

// Embed the filter step
<TabularDataFilterStep
  data={draftData}
  onDataChange={handleDataChange}
  translationNamespace="spreadsheet-plugin"
/>
```

## Directory Structure

```text
src/
├── index.ts                  # Root entry point (types + manifest + services)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── constants.ts          # DATA_SOURCE_TYPES, STEP_LABELS
│   └── types/
│       └── SpreadsheetEntity.ts  # Entity type re-exports from spreadsheet-store
├── icon/
│   └── index.ts              # SpreadsheetPluginIcon (MUI Assessment)
├── services/
│   ├── index.ts              # Service exports
│   ├── SpreadsheetTabularApiDriver.ts  # TabularDataApi implementation
│   ├── SpreadsheetMetadataManager.ts   # Metadata DB manager
│   ├── SpreadsheetStorePort.ts         # TabularStorePort implementation
│   ├── spreadsheetTabularApiFactory.ts # Factory functions
│   └── utils/
│       ├── filtering.ts      # Filter matching logic
│       └── hash.ts           # File content hashing
├── ui/
│   ├── index.ts              # UI entry point
│   ├── i18n.ts               # i18n resource loading
│   ├── locales/              # i18n resources (en, ja)
│   ├── components/
│   │   ├── steps-provider.tsx          # PluginStepRegistry registration
│   │   ├── steps/
│   │   │   ├── TabularDataSourceStep.tsx   # Data source step
│   │   │   ├── TabularDataFilterStep.tsx   # Filter step
│   │   │   └── useTabularDataFilterStepView.ts
│   │   ├── KeyValueSourcePanel.tsx
│   │   ├── TabularFilterSections.tsx
│   │   ├── TabularKeyValuePanels.tsx
│   │   ├── ValueHistogram.tsx
│   │   └── useValueHistogram.ts
│   ├── hooks/
│   │   ├── useTabularDataFilter.ts
│   │   ├── useTabularDataFilterStep.ts
│   │   ├── useTabularDataSource.ts
│   │   └── useTabularKeyValueState.ts
│   └── state/
│       ├── tabularKeyValueAtoms.ts     # Jotai atoms for key-value state
│       └── tabularStatisticsUtils.ts   # Statistics calculation utilities
└── worker/
    ├── index.ts              # Worker entry point
    └── factory/
        └── registerSpreadsheetWorkerStores.ts  # Worker store registration (no-op)
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/spreadsheet-plugin` | Type definitions, PluginManifest, service layer, constants |
| `@hierarchidb/spreadsheet-plugin/ui` | UI components (step registration, data source, filtering) |
| `@hierarchidb/spreadsheet-plugin/icon` | SpreadsheetPluginIcon |
| `@hierarchidb/spreadsheet-plugin/worker` | Worker store registration |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../../packages/core-types/) — Shared type definitions (NodeId, NodeType, etc.)
- [`@hierarchidb/tabular-source`](../../packages/tabular-source/) — Tabular data parsing and ingestion service
- [`@hierarchidb/tabular-store`](../../packages/tabular-store/) — Tabular data persistence (TabularWriter, RowStoreDB)
- [`@hierarchidb/spreadsheet-store`](../../packages/spreadsheet-store/) — SpreadsheetEntity type definitions
- [`@hierarchidb/chunk-store`](../../packages/chunk-store/) — Chunk-based data store
- [`@hierarchidb/download`](../../packages/download/) — Network download (FetchNetworkPort)
- [`@hierarchidb/auth-api`](../../packages/auth-api/) — Authentication scope definitions
- [`@hierarchidb/util`](../../packages/util/) — Utilities (getDBName, etc.)
- [`@hierarchidb/plugin-ui-sdk`](../../packages/plugin-ui-sdk/) — Plugin UI SDK
- [`@hierarchidb/plugin-service-api`](../../packages/plugin-service-api/) — Plugin service API
- [`@hierarchidb/runtime-worker`](../../packages/runtime-worker/) — Worker runtime
- [`@hierarchidb/ui-tabular`](../../packages/ui/tabular-extract/) — Tabular data UI (TabularDataApi type definitions)
- [`@hierarchidb/ui-dialog`](../../packages/ui/dialog/) — Dialog base
- [`@hierarchidb/ui-modal-select`](../../packages/ui/modal-select/) — Modal select UI
- [`@hierarchidb/ui-plugin-basic-info`](../../packages/ui/plugin-basic-info/) — Plugin basic info step
- [`@hierarchidb/ui-worker-provider`](../../packages/ui/worker-provider/) — Worker provider
- [`@hierarchidb/ui-i18n`](../../packages/ui/i18n/) — Internationalization

### Parent Plugin

- [`folder-plugin`](../folder-plugin/) — Base container node (inherited by spreadsheet)

### Plugins Inheriting from spreadsheet-plugin

- [`styler-plugin`](../styler-plugin/) — Style definitions and map style application (reuses spreadsheet's data source functionality)

## License

MIT
