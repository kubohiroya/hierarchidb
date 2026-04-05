# @hierarchidb/core-types

Last updated: 2026-04-05

Core shared type definitions for the HierarchiDB monorepo. Provides type-safe IDs via Branded Types, entity base types, data source types, and validation types.

## Key Features

- Type-safe IDs via Branded Types (`NodeId`, `TreeId`, `NodeType`, etc.)
- Entity base types (`BaseEntity`, `PeerEntity`, `GroupEntity`, `RelationalEntity`)
- Geographic data source common types (`ISO2`, `ISO3`, `DataSourceName`, `LocationType`, `RouteType`)
- Validation types (`ValidationResult`, `ValidationFunction`, `ValidationErrors`)
- ID conversion utilities (`toNodeId`, `toNodeType`)

## Installation

```jsonc
// package.json (pnpm workspace)
"dependencies": {
  "@hierarchidb/core-types": "workspace:*"
}
```

## Public API

### ID Types (Branded Types)

```typescript
type NodeId = string & { readonly __brand: 'NodeId' };
type TreeId = string & { readonly __brand: 'TreeId' };
type NodeType = string & { readonly __brand: 'NodeType' };
type DraftId = NodeId;       // Working copy ID (alias)
type EntityId = NodeId;      // Plugin entity record ID (alias)
type TreeNodeId = string & { readonly __brand: 'TreeNodeId' };
```

### ID Utilities

```typescript
import { toNodeId, toNodeType } from '@hierarchidb/core-types';

const id = toNodeId('abc-123');     // NodeId
const type = toNodeType('folder');  // NodeType
```

### Entity Base Types

| Type | Relationship | Usage |
| --- | --- | --- |
| `BaseEntity` | — | Base for all entities (id, createdAt, updatedAt, version) |
| `PeerEntity<TData>` | TreeNode : 1:1 | Entity corresponding to a single TreeNode (e.g., StylerEntity, BaseMapEntity) |
| `GroupEntity` | TreeNode : 1:N | Multiple entities per TreeNode (e.g., GeoJSON Feature) |
| `RelationalEntity<ID>` | TreeNode : N:N | Entity referenced by multiple TreeNodes (e.g., TableMetadata) |

### Primitive Types

```typescript
type Timestamp = number;  // Unix timestamp (ms)
```

### Data Source Types

```typescript
type ISO2 = string;
type ISO3 = string;
type CountryCode = ISO2 | ISO3;
type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
type LocationType = 'administrative_center' | 'airport' | 'port' | 'railway_station' | 'highway_interchange';
type RouteType = 'airway' | 'seaway' | 'road' | 'railway' | 'high_speed_rail';
```

### Validation Types

```typescript
type ValidationErrors<T> = { [K in keyof T]?: string };
type ValidationResult = { valid: true } | { valid: false; message: string };
type ValidationFunction<T> = (data: T) => Promise<ValidationResult> | ValidationResult;
type StepValidation = () => boolean | Promise<boolean>;
```

## Dependencies

No external dependencies. This package contains only pure type definitions and a few utility functions.

## Directory Structure

```text
src/
├── index.ts             # Re-exports all modules
├── id-types.ts          # Branded ID types (NodeId, TreeId, NodeType, etc.)
├── id-util.ts           # ID conversion utilities (toNodeId, toNodeType)
├── primitive-types.ts   # Primitive types (Timestamp)
├── entity-types.ts      # Entity base types (BaseEntity, PeerEntity, GroupEntity, RelationalEntity)
├── datasource.ts        # Geographic data source types (ISO2, DataSourceName, LocationType, RouteType)
└── validation-types.ts  # Validation types (ValidationResult, ValidationFunction, ValidationErrors)
```

## Related Packages

- [`@hierarchidb/tree-api`](../tree-api/) — TreeNode type definitions (uses core-types ID types)
- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginManifest (uses NodeType)
- All plugins and packages depend on this package

## License

MIT
