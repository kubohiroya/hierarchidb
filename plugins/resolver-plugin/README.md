# @hierarchidb/resolver-plugin

Last updated: 2026-04-05

A plugin that maps properties between different data schemas, transforming them into a unified structure so downstream plugins read consistent attributes. Features automatic schema detection, validation, duplicate resolution, and compilation optimization.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `resolver` |
| extends | `folder` |
| category | `data` |
| priority | `60` |

resolver-plugin inherits from folder-plugin and provides property mapping between heterogeneous schemas. When used with the Styler plugin, it enables unified styling of datasets with different property names.

## UI Layer

### Dialogs

The resolver-plugin UI uses the `PluginStepRegistry`-based step registration pattern. `getDialogComponent()` is deprecated and currently returns null.

Step registration is handled in `src/ui/components/steps-provider.tsx`, providing 6 steps for nodeType `resolver`:

1. **Schema Selection** — Define or auto-detect source and target schemas
2. **Property Mapping** — Define source-to-target property mapping rules
3. **Validation Rules** — Configure validations such as required checks, type checks, range checks, and pattern matching
4. **Duplicate Resolution** — Set duplicate data handling strategy (ignore / overwrite / merge / skip / custom)
5. **Build** — Compile and optimize mappings (optional)
6. **Preview / Test** — Preview mapping results and run tests

### Components

| Component | Description |
| --- | --- |
| `ResolverPanel` | Overview display of Resolver configuration, statistics, and action panel |
| `SchemaSelectionStep` | Schema selection step |
| `PropertyMappingStep` | Property mapping step |
| `ValidationConfigStep` | Validation configuration step |
| `DuplicateResolutionStep` | Duplicate resolution step |
| `ResolverBuildStep` | Build (compilation) step |
| `PreviewTestStep` | Preview and test step |

### Icon

```typescript
// Entry point: @hierarchidb/resolver-plugin/icon
import { ResolverPluginIcon } from '@hierarchidb/resolver-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Extension` |
| Emoji | 🧩 |
| Color | `#ffb3c1` |

## Worker Layer

### ResolverEntityService

`ResolverEntityService` performs CRUD operations on Resolver entities through CoreDB `TreeNode` payload/draft.

The Worker `preload` configuration registers `registerResolverWorkerStores`.

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerResolverWorkerStores'],
}
```

### Lifecycle

- **Create**: Create a TreeNode + store schema and mapping rules in payload/draft
- **Update**: Update mapping rules, validation rules, and duplicate resolution strategy
- **Delete**: Clear TreeNode payload/draft
- **Search**: Search TreeNodes by nodeType `resolver` with name filtering
- **Duplicate**: Copy an existing Resolver configuration to a new node
- **Validate**: Check schema existence, mapping rule consistency, and detect duplicate targets
- **Compile**: Compile mapping rules into optimized functions

### Service Layer

| Service | Description |
| --- | --- |
| `MappingCompiler` | Compiles mapping rules into optimized JavaScript functions. Builds execution plans and applies optimizations including constant folding, common subexpression elimination, dead code elimination, loop fusion, and parallelization |
| `SimpleMappingCompiler` | Simple mapping compiler for testing. Supports dot-notation path value access/setting and transform function application |
| `ChainManager` | Manages chained execution of multiple Resolvers. Supports 5 execution strategies (sequential / parallel / conditional / fallback / weighted) and 5 conflict resolution modes (last-wins / first-wins / merge / error / custom) |

## Database Schema

resolver-plugin uses a Dexie database named `resolver-db`.

```typescript
// plugin-manifest.ts
database: {
  dbName: 'resolver-db',
  tableName: 'resolvers',
  version: 1,
  schema: {
    fields: [
      { name: 'id', indexed: true },
      { name: 'nodeId', indexed: true },
      { name: 'name', indexed: true },
    ],
  },
}
```

### Data Structure

Resolver entities are defined as an extension of `PeerEntity`:

```typescript
// ResolverEntity extends PeerEntity
type ResolverEntity = PeerEntity<ResolverEntityPayload>;

type ResolverEntityPayload = {
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
  mappingRules: PropertyMappingRule[];
  validationRules: ValidationRule[];
  duplicateResolution: DuplicateResolutionStrategy;
  dataTransformations: DataTransformation[];
  previewConfig?: PreviewConfig;
  isCompiled?: boolean;
  lastCompiled?: number;
  compiledFunction?: string;
  compiledMetadata?: Record<string, unknown>;
  lastValidation?: MappingValidationResult | null;
};
```

### Key Type Definitions

```typescript
interface PropertyMappingRule {
  id: string;
  sourceProperty: string;
  targetProperty: string;
  transformFunction?: string;
  isRequired: boolean;
  defaultValue?: unknown;
  description?: string;
}

interface ValidationRule {
  id: string;
  property: string;
  ruleType: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  parameters: Record<string, unknown>;
  errorMessage?: string;
}

interface DuplicateResolutionStrategy {
  strategy: 'ignore' | 'overwrite' | 'merge' | 'skip' | 'custom';
  customFunction?: string;
  mergeProperties?: string[];
}

interface SchemaInfo {
  name: string;
  properties: PropertyInfo[];
  sampleData?: Record<string, unknown>[];
}
```

## Plugin Dependencies

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

resolver-plugin inherits from folder-plugin, using its container functionality as a foundation.

## Configuration

### Capabilities

```typescript
capabilities: {
  relationalData: true,
}
```

### Tags

```typescript
tags: ['mapping', 'schema']
```

### Visibility

```typescript
visibility: {
  hidden: true,  // tree menu from direct creation is hidden
}
```

### i18n

| Field | Value |
| --- | --- |
| namespace | `resolver-plugin` |
| Locales | `en`, `ja` |

## Usage Examples

### Referencing the PluginManifest

```typescript
import { ResolverPluginManifest } from '@hierarchidb/resolver-plugin';

console.log(ResolverPluginManifest.nodeType); // 'resolver'
console.log(ResolverPluginManifest.extends);  // 'folder'
```

### Using ResolverPluginIcon

```tsx
import { ResolverPluginIcon } from '@hierarchidb/resolver-plugin/icon';

<ResolverPluginIcon />
```

### CRUD with ResolverEntityService

```typescript
import { ResolverEntityService } from '@hierarchidb/resolver-plugin/worker';
import type { NodeId } from '@hierarchidb/core-types';

const service = new ResolverEntityService();

// Create a resolver entity
const entity = await service.createEntity(nodeId, {
  name: 'CSV to Styler Mapper',
  description: 'Map CSV properties to Styler schema',
  sourceSchema: csvSchema,
  targetSchema: stylerSchema,
  mappingRules: [
    {
      id: 'rule-1',
      sourceProperty: 'prefecture_name',
      targetProperty: 'name',
      isRequired: true,
    },
  ],
  duplicateResolution: { strategy: 'skip' },
});

// Validate mapping configuration
const validation = await service.validateMapping(nodeId);
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
}
```

### Chained Execution with ChainManager

```typescript
import { ChainManager } from '@hierarchidb/resolver-plugin';

const chainManager = new ChainManager();

// Create a sequential chain
const chain = await chainManager.createChain({
  name: 'Multi-source Pipeline',
  strategy: 'sequential',
  conflictResolution: 'last-wins',
  resolvers: [
    { resolverId: csvNormalizerId, order: 1, enabled: true },
    { resolverId: geoEnhancerId, order: 2, enabled: true },
  ],
});

// Execute the chain
const result = await chainManager.executeChain(chain.id, sourceData);
console.log('Success:', result.success);
console.log('Processed:', result.statistics.recordsProcessed);
```

## Directory Structure

```text
src/
├── index.ts                  # Root entry point (types + manifest + lazy loaders)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── entities/
│   │   └── ResolverEntity.ts # Entity types and payload definitions
│   ├── i18n/
│   │   └── index.ts          # i18n stub (registration in ui/i18n.ts)
│   └── types/
│       └── index.ts          # Re-exports from entities
├── icon/
│   └── index.ts              # ResolverPluginIcon (re-export of MUI Extension)
├── services/
│   ├── ChainManager.ts       # Multi-resolver chain execution manager
│   ├── MappingCompiler.ts    # Optimizing mapping compiler with execution plans
│   └── SimpleMappingCompiler.ts # Simple mapping compiler for testing
├── ui/
│   ├── i18n.ts               # i18n resource bundle registration
│   ├── index.ts              # UI entry point (step registration + i18n)
│   ├── locales/
│   │   ├── en.json           # English locale
│   │   └── ja.json           # Japanese locale
│   └── components/
│       ├── index.ts           # Component exports + lazy loaders
│       ├── ResolverPanel.tsx  # Main resolver panel (overview + actions)
│       ├── useResolverPanel.ts # Panel hook (compilation, statistics)
│       ├── steps-provider.tsx # PluginStepRegistry registration (6 steps)
│       └── steps/
│           ├── SchemaSelectionStep.tsx
│           ├── PropertyMappingStep.tsx
│           ├── ValidationConfigStep.tsx
│           ├── ValidationConfigStepViewElements.tsx
│           ├── DuplicateResolutionStep.tsx
│           ├── ResolverBuildStep.tsx
│           ├── PreviewTestStep.tsx
│           └── hooks/         # Step-specific hooks
└── worker/
    └── ResolverEntityService.ts # CRUD + validation + compilation service
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/resolver-plugin` | Type definitions, PluginManifest, lazy loaders |
| `@hierarchidb/resolver-plugin/ui` | UI components (step registration, i18n) |
| `@hierarchidb/resolver-plugin/icon` | ResolverPluginIcon |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../packages/core-types/) — Shared type definitions (NodeId, NodeType, etc.)
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode, TreeNodeUpdaterPayload type definitions
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — CoreDB access (Worker layer)
- [`@hierarchidb/plugin-service-api`](../packages/plugin-service-api/) — Plugin service API
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — Plugin UI SDK
- [`@hierarchidb/ui-dialog`](../packages/ui/dialog/) — Dialog base (DialogSafeMenu)
- [`@hierarchidb/ui-plugin-basic-info`](../packages/ui/plugin-basic-info/) — Plugin basic info step
- [`@hierarchidb/ui-i18n`](../packages/ui/i18n/) — Internationalization base
- [`@hierarchidb/ui-worker-provider`](../packages/ui/worker-provider/) — Worker provider
- [`@hierarchidb/util`](../packages/util/) — Utilities

### Parent Plugin

- [`folder-plugin`](../plugins/folder-plugin/) — Base container plugin

### Related Plugins

- [`spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — CSV/TSV/Excel source management (mapping source data)
- [`styler-plugin`](../plugins/styler-plugin/) — Style definitions and map style application (mapping target integration)
- [`shape-plugin`](../plugins/shape-plugin/) — Shape data (mapping target data)

## License

MIT
