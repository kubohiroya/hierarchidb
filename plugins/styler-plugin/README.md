# @hierarchidb/styler-plugin

Last updated: 2026-04-05

A plugin that provides data-driven styling and map visualization based on spreadsheet data. It imports CSV/Excel data, applies filtering and mapping key configuration, selects color classification algorithms, and generates MapLibre styles. Inherits from spreadsheet-plugin, delegating data import and storage to the parent plugin while focusing on style generation and visualization.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `styler` |
| extends | `spreadsheet` |
| category | `visualization` |
| priority | `700` |

styler-plugin inherits from spreadsheet-plugin. Since spreadsheet-plugin itself inherits from folder-plugin, the inheritance chain is `folder → spreadsheet → styler`. Data import and chunk storage are delegated to spreadsheet-plugin's `SpreadsheetTabularApiDriver` / `SpreadsheetStorePort`, while styler-plugin focuses on style definition, color mapping, and MapLibre style generation.

## UI Layer

### Dialogs

The styler-plugin UI uses the `PluginStepRegistry`-based step registration pattern. `steps-provider.tsx` registers a 6-step create/edit wizard for the `styler` nodeType:

1. **Data Source** — Select data source (file upload or URL). Reuses spreadsheet-plugin's `TabularDataSourceStep`
2. **Filtering** — Configure filtering rules on imported data
3. **Mapping Keys** — Specify key column, value column, and Feature ID property
4. **Apply Target** — Configure style type (choropleth/points/lines), target property, value type, and mapping mode
5. **Palette** — Select color classification algorithm (linear/quantile/jenks/equal) and adjust parameters
6. **Preview** — Preview styled results and final confirmation

### Components

| Component | Description |
| --- | --- |
| `StylerFilterStep` | Data filtering UI |
| `StylerMappingKeysStep` | Key/value column mapping configuration |
| `StylerTargetStep` | Style target configuration (styleType, targetProperty) |
| `StylerAlgorithmStep2` | Color classification algorithm selection and parameter adjustment |
| `StylerPreviewStep` | Style application preview |
| `GradientSwatch` | Color gradient swatch display |
| `StyleMappingTargetPanel` | Mapping target panel |

### Icon

```typescript
// Entry point: @hierarchidb/styler-plugin/icon
import { StylerPluginIcon } from '@hierarchidb/styler-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Palette` |
| Emoji | 🎨 |
| Color | `#dcbc50` |

## Worker Layer

### StylerEntityHandler

`StylerEntityHandler` wraps the spreadsheet-plugin's EntityHandler and adds style-specific fields (`config`, `mapping`, `styleKeyValues`, `generatedStyle`). CRUD operation flow:

- **Create**: Calls the parent `SpreadsheetEntityHandler.createEntity()`, then merges Styler-specific defaults (`StylerConfigDefault`, `StylerMappingDefault`) into the returned entity
- **Read**: Merges Styler-specific fields into the parent `getEntity()` result
- **Update**: After calling the parent `updateEntity()`, if mapping settings have changed, calls `StylerDataService.generateMapLibreStyle()` to auto-regenerate the MapLibre style
- **Delete**: Cleans up table references, then calls the parent `deleteEntity()`

### StylerDataService

Wraps `TabularDataApi` and provides the following capabilities:

- `importTabularDataFromFile()` / `importTabularDataFromUrl()` — Import tabular data from file or URL with automatic initial Styler configuration generation
- `getStyledPreview()` — Get filtered data preview with color styles applied
- `generateMapLibreStyle()` — Generate MapLibre style specification based on entity configuration
- `addTableReference()` / `removeTableReference()` — Manage table references
- `listStylerTables()` — List tables referenced by the Styler

### StylerExtensionHandler

Manages Styler configuration as folder extension data. Provides `onCreate` / `onUpdate` / `onDelete` lifecycle hooks for configuration validation, persistence, and cleanup.

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerStylerWorkerStores'],
}
```

## Database Schema

### StylerDB (Dexie)

The `StylerDB` class provided by `@hierarchidb/styler-store` manages the Dexie database.

```typescript
// Database name: getDBName('style')
// Version: 1
this.version(1).stores({
  styles: '&nodeId, targetProperty, updatedAt',
});
```

| Table | Primary Key | Indexes | Description |
| --- | --- | --- | --- |
| `styles` | `nodeId` (unique) | `targetProperty`, `updatedAt` | Style records (`StyleRecord`) |

### StyleRecord Structure

```typescript
interface StyleRecord {
  nodeId: NodeId;
  keyColumn: string;
  valueColumn: string;
  targetProperty: string;
  styleType: StyleType;           // 'choropleth' | 'points' | 'lines'
  valueType: StyleValueType;      // 'color' | 'number'
  paintExpression: unknown;       // MapLibre paint expression
  colorMapping?: Record<string, string>;
  updatedAt: number;
  keyValues?: StyleKeyValueEntry[];
}
```

### StylerMetadataManager

Extends `TabularDatabaseManager` and manages tabular data metadata under `getDBName('styler')`. Uses the same chunk-based tabular data storage infrastructure as spreadsheet-plugin.

## Plugin Dependencies

```typescript
// PluginManifest.dependencies
dependencies: ['@hierarchidb/spreadsheet-plugin']
```

styler-plugin depends on spreadsheet-plugin. It inherits data import, chunk storage, and tabular data management capabilities from spreadsheet-plugin and adds style generation functionality.

## Configuration

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,  // child nodes not allowed
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
    { name: 'csvData', type: 'string', required: true },
    { name: 'mappingConfig', type: 'object', required: true },
  ],
}
```

### Style Map Categories

styler-plugin supports the following style map categories:

| Category | Description |
| --- | --- |
| `choropleth` | Color-coded areas based on data values |
| `symbol` | Point symbols representing data |
| `heatmap` | Density visualization using color gradients |
| `cluster` | Grouped point visualization |
| `graduated` | Symbols scaled by data values |
| `categorized` | Different styles for different categories |
| `terrain` | Topographic and elevation data |
| `network` | Connected lines and nodes |
| `flow` | Movement and flow visualization |
| `custom` | User-defined styling |

### Color Classification Algorithms

| Algorithm | Description |
| --- | --- |
| `linear` | Linear interpolation for continuous color mapping |
| `quantile` | Quantile-based classification (robust against data skew) |
| `jenks` | Jenks Natural Breaks clustering |
| `equal` | Equal interval classification |

### i18n

| Field | Value |
| --- | --- |
| namespace | `styler-plugin` |
| Locales | `en`, `ja` (dynamically registered via glob import) |

## Map Preview

styler-plugin generates MapLibre style specifications to support data visualization on maps. `StylerDataService.generateMapLibreStyle()` performs the following:

1. Determines layer type (`fill` / `line` / `circle`) from the entity's `mapping` configuration
2. Builds paint expressions based on `valueType` and `mappingMode`
3. When numeric-to-color interpolation is needed, fetches data values and generates color mappings via `valueToColor()`
4. Returns a MapLibre Style Specification-compliant style object

Generated styles are persisted in the `StylerDB.styles` table and can be applied as map layers by basemap-plugin and other map consumers.

## Usage Examples

### Referencing the PluginManifest

```typescript
import { StylerPluginManifest } from '@hierarchidb/styler-plugin';

console.log(StylerPluginManifest.nodeType);  // 'styler'
console.log(StylerPluginManifest.extends);   // 'spreadsheet'
console.log(StylerPluginManifest.capabilities.canHaveChildren); // false
```

### Using StylerPluginIcon

```tsx
import { StylerPluginIcon } from '@hierarchidb/styler-plugin/icon';

<StylerPluginIcon />
```

### Using StylerEntityHandler

```typescript
import { StylerEntityHandler, StylerDataService } from '@hierarchidb/styler-plugin';

// Create handler with spreadsheet base handler and data service
const handler = new StylerEntityHandler(spreadsheetHandler, dataService);

// Create a new styler entity
const result = await handler.createEntity(nodeId, {
  keyColumn: 'region_id',
  valueColumn: 'population',
  config: {
    algorithm: 'linear',
    colorSpace: 'hsv',
    min: 0,
    max: 100,
    outputMin: 1,
    outputMax: 8,
    hueStart: 0,
    hueEnd: 120,
    saturation: 0.8,
    brightness: 0.9,
  },
});
```

### Using Color Utilities

```typescript
import {
  valueToColor,
  hexToRgb,
  rgbToHex,
  generateColorGradient,
  createColorVariations,
} from '@hierarchidb/styler-plugin';

// Convert a data value to a color based on mapping and config
const colorResult = valueToColor(75, mapping, config);
console.log(colorResult.color); // '#rrggbb'

// Generate a color gradient
const gradient = generateColorGradient(10, config);
```

## Directory Structure

```text
src/
├── index.ts                  # Root entry point (types, manifest, handler, utilities)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── __tests__/            # Unit / integration tests
│   ├── extension/
│   │   └── StylerExtensionHandler.ts  # Folder extension handler
│   ├── handlers/
│   │   └── StylerEntityHandler.ts     # Entity CRUD handler
│   ├── types/
│   │   ├── STYLEMAP_CATEGORY_CONFIGS.ts  # Style map category definitions
│   │   ├── StylerEntity.ts               # Re-export from @hierarchidb/styler-store
│   │   └── StylerMetadata.ts             # Plugin metadata
│   └── utils/
│       ├── colorUtils.ts     # Color conversion, classification algorithms
│       ├── dataAnalysis.ts   # Data statistics and algorithm recommendation
│       └── detectFileType.ts # File type detection
├── icon/
│   └── index.ts              # StylerPluginIcon (re-export of MUI Palette)
├── services/
│   ├── index.ts              # Service exports
│   ├── StylerDataService.ts  # Data import, preview, MapLibre style generation
│   └── StylerMetadataManager.ts  # Tabular metadata manager
└── ui/
    ├── i18n.ts               # i18n resource registration
    ├── index.ts              # UI entry point (step registration)
    ├── components/
    │   ├── steps-provider.tsx          # PluginStepRegistry registration (6 steps)
    │   ├── StylerFilterStep.tsx        # Filtering step
    │   ├── StylerMappingKeysStep.tsx   # Mapping keys step
    │   ├── StylerTargetStep.tsx        # Target property step
    │   ├── StylerAlgorithmStep2.tsx    # Algorithm selection step
    │   ├── StylerPreviewStep.tsx       # Preview step
    │   ├── GradientSwatch.tsx          # Gradient swatch component
    │   ├── StyleMappingTargetPanel.tsx # Mapping target panel
    │   └── hooks/                      # Component-specific hooks
    ├── hooks/
    │   └── useTabularFilterWorker.ts   # Web Worker for tabular filtering
    ├── utils/
    │   └── tabularFilters.ts           # Filter utility functions
    └── workers/
        └── tabularFilter.worker.ts     # Tabular filter Web Worker
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/styler-plugin` | Type definitions, PluginManifest, EntityHandler, DataService, color utilities |
| `@hierarchidb/styler-plugin/ui` | UI components (step registration, i18n) |
| `@hierarchidb/styler-plugin/icon` | StylerPluginIcon |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../../packages/core-types/) — Shared type definitions (NodeId, NodeType, etc.)
- [`@hierarchidb/styler-store`](../../packages/styler-store/) — StylerDB, StylerEntity type definitions
- [`@hierarchidb/style-api`](../../packages/style-api/) — StyleRecord, StyleDescriptor type definitions
- [`@hierarchidb/spreadsheet-store`](../../packages/spreadsheet-store/) — Spreadsheet data store
- [`@hierarchidb/tabular-store`](../../packages/tabular-store/) — Tabular data store and metadata management
- [`@hierarchidb/plugin-ui-sdk`](../../packages/plugin-ui-sdk/) — Plugin UI SDK
- [`@hierarchidb/ui-dialog`](../../packages/ui/dialog/) — Dialog base
- [`@hierarchidb/ui-map`](../../packages/ui/map/) — MapLibreStyle type definitions
- `@hierarchidb/ui-tabular` — TabularDataApi, filtering types
- `@hierarchidb/ui-grid` — Data grid UI
- [`@hierarchidb/ui-i18n`](../../packages/ui/i18n/) — Internationalization base
- [`@hierarchidb/util`](../../packages/util/) — Utilities (getDBName, SingletonMixin, etc.)

### Parent Plugins

- [`spreadsheet-plugin`](../spreadsheet-plugin/) — Data import, chunk storage, tabular data management (direct parent)
- [`folder-plugin`](../folder-plugin/) — Tree container base (root of inheritance chain)

### Related Plugins

- [`basemap-plugin`](../basemap-plugin/) — Target for applying generated MapLibre styles as map layers

## License

MIT
