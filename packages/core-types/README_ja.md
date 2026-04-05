# @hierarchidb/core-types

最終更新: 2026-04-05

HierarchiDB モノレポ全体で共有されるコア型定義パッケージ。Branded Types による型安全な ID 体系、エンティティ基底型、データソース型、バリデーション型を提供する。

## 主要な機能

- Branded Types による型安全な ID（`NodeId`, `TreeId`, `NodeType` 等）
- エンティティ基底型（`BaseEntity`, `PeerEntity`, `GroupEntity`, `RelationalEntity`）
- 地理データソース共通型（`ISO2`, `ISO3`, `DataSourceName`, `LocationType`, `RouteType`）
- バリデーション型（`ValidationResult`, `ValidationFunction`, `ValidationErrors`）
- ID 変換ユーティリティ（`toNodeId`, `toNodeType`）

## インストール

```jsonc
// package.json (pnpm workspace)
"dependencies": {
  "@hierarchidb/core-types": "workspace:*"
}
```

## 公開 API

### ID 型（Branded Types）

```typescript
type NodeId = string & { readonly __brand: 'NodeId' };
type TreeId = string & { readonly __brand: 'TreeId' };
type NodeType = string & { readonly __brand: 'NodeType' };
type DraftId = NodeId;       // Working copy ID (alias)
type EntityId = NodeId;      // Plugin entity record ID (alias)
type TreeNodeId = string & { readonly __brand: 'TreeNodeId' };
```

### ID ユーティリティ

```typescript
import { toNodeId, toNodeType } from '@hierarchidb/core-types';

const id = toNodeId('abc-123');     // NodeId
const type = toNodeType('folder');  // NodeType
```

### エンティティ基底型

| 型 | 関係 | 用途 |
| --- | --- | --- |
| `BaseEntity` | — | 全エンティティの基底（id, createdAt, updatedAt, version） |
| `PeerEntity<TData>` | TreeNode : 1:1 | 1つの TreeNode に対応するエンティティ（例: StylerEntity, BaseMapEntity） |
| `GroupEntity` | TreeNode : 1:N | 1つの TreeNode に複数紐づくエンティティ（例: GeoJSON Feature） |
| `RelationalEntity<ID>` | TreeNode : N:N | 複数 TreeNode から参照されるエンティティ（例: TableMetadata） |

### プリミティブ型

```typescript
type Timestamp = number;  // Unix timestamp (ms)
```

### データソース型

```typescript
type ISO2 = string;
type ISO3 = string;
type CountryCode = ISO2 | ISO3;
type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
type LocationType = 'administrative_center' | 'airport' | 'port' | 'railway_station' | 'highway_interchange';
type RouteType = 'airway' | 'seaway' | 'road' | 'railway' | 'high_speed_rail';
```

### バリデーション型

```typescript
type ValidationErrors<T> = { [K in keyof T]?: string };
type ValidationResult = { valid: true } | { valid: false; message: string };
type ValidationFunction<T> = (data: T) => Promise<ValidationResult> | ValidationResult;
type StepValidation = () => boolean | Promise<boolean>;
```

## 依存関係

外部依存なし。本パッケージは純粋な型定義とごく少数のユーティリティ関数のみを含む。

## ディレクトリ構成

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

## 関連パッケージ

- [`@hierarchidb/tree-api`](../tree-api/) — TreeNode 型定義（core-types の ID 型を使用）
- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginManifest（NodeType を使用）
- 全プラグイン・パッケージが本パッケージに依存

## ライセンス

MIT
