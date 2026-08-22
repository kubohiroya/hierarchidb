# @hierarchidb/plugin-base

Last updated: 2026-04-05

Base package for the HierarchiDB plugin system. Provides plugin manifest type definitions, step registry, dialog orchestration, lifecycle hooks, and common interfaces. All plugins depend on this package.

## Key Features

- `PluginManifest` — Type defining plugin metadata, capabilities, schema, and Worker configuration
- `PluginStepRegistry` — Singleton registry for multi-step dialog step registration and retrieval
- `HostProfileRegistry` — Host profile (dialog host environment) registration
- `composeStepConfigs` — Step config composition utility
- `draftAtoms` — Jotai-based draft state management atoms
- Lifecycle hook types (`EntityLifecycleHooks`)
- Search criteria types (`BaseSearchCriteria`)
- `dependencyGraphJsonSchema` — Permissive public dependency graph artifact schema

## Installation

```jsonc
// package.json (pnpm workspace)
"peerDependencies": {
  "@hierarchidb/plugin-base": "workspace:*"
}
```

## Public API

### PluginManifest

The central type defining all plugin configuration:

```typescript
interface PluginManifest {
  id?: string;
  name?: string;
  displayName?: string;
  nodeType?: NodeType;
  version?: string;
  extends?: string;
  dependencies?: string[];
  icon?: PluginIconConfig;
  category?: PluginCategoryConfig;
  capabilities?: PluginCapabilities;
  schema?: PluginManifestSchema;
  worker?: { preload?: string[] } | null;
  database?: PluginManifestDatabaseConfig | null;
  // ... and more
}
```

### Dependency Graph Schema

The dependency graph schema validates the required public artifact envelope with Ajv strict
mode and no coercion, defaults, or additional-property removal. It intentionally keeps
`additionalProperties: true` for graph, node, edge, metadata, and group extension fields.

### PluginStepRegistry

Singleton for registering and retrieving multi-step dialog steps:

```typescript
import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import type { PluginStepConfig, PluginStepProps } from '@hierarchidb/plugin-base';

const registry = PluginStepRegistry.getInstance();

// Register steps for a nodeType
registry.registerConfigProvider({
  nodeType: 'my-plugin' as NodeType,
  getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<MyDraft>> {
    return [
      {
        id: 'step-1',
        label: 'Step 1',
        componentFactory: (props: PluginStepProps<MyDraft>) => <MyStep {...props} />,
        validate: (data) => Boolean(data?.name),
      },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
```

### PluginCapabilities

```typescript
interface PluginCapabilities {
  canHaveChildren?: boolean;
  canBeRoot?: boolean;
  canBeDeleted?: boolean;
  canBeRenamed?: boolean;
  canBeMoved?: boolean;
  canBeCopied?: boolean;
  supportsBuildProcessing?: boolean;
  draft?: boolean;
  [key: string]: boolean | undefined;
}
```

## Dependencies

| Package | Type | Purpose |
| --- | --- | --- |
| `@hierarchidb/core-types` | peer | ID types (NodeType, etc.) |
| `@hierarchidb/ui-dialog` | peer | Dialog base types |
| `jotai` | peer | Draft atoms |
| `react` | peer | Component factories |

## Directory Structure

```text
src/
├── index.ts                          # Public API exports
├── atoms/
│   └── draftAtoms.ts                 # Jotai draft state atoms
├── registry/
│   ├── DialogStepLocalizationRegistry.ts  # Step label i18n registry
│   ├── HostProfileRegistry.ts        # Host profile registry
│   └── PluginStepRegistry.ts         # Step config registry (singleton)
├── services/
│   └── composeStepConfigs.ts         # Step config composition utility
└── types/
    ├── api-types.ts                  # API type definitions
    ├── BaseSearchCriteria.ts         # Search criteria base type
    ├── EntityLifecycleHooks.ts       # Entity lifecycle hook types
    ├── plugin-definition.ts          # Plugin definition types
    ├── plugin-manifest.ts            # PluginManifest, PluginCapabilities, etc.
    ├── plugin-metadata.ts            # Plugin metadata types
    ├── PluginDBQueryAPI.ts           # DB query API types
    ├── PluginExtensionAPI.ts         # Extension API types
    ├── PluginLifecycleAPI.ts         # Lifecycle API types
    ├── PluginTreeAPI.ts              # Tree API types
    └── registry.ts                   # Registry types
```

## Related Packages

- [`@hierarchidb/core-types`](../core-types/) — Shared type definitions (NodeType, etc.)
- [`@hierarchidb/ui-dialog`](../ui/dialog/) — Dialog base
- [`@hierarchidb/plugin-registry`](../plugin-registry/) — Plugin registration and resolution
- [`@hierarchidb/plugin-ui-sdk`](../plugin-ui-sdk/) — Plugin UI SDK
- All plugins depend on this package

## License

MIT
