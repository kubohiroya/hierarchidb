# Plugin Architecture - UI/Worker 3-Layer Structure

## はじめに

この章では、HierarchiDBの3層プラグインアーキテクチャの設計思想と実装方法について詳細に説明します。本章は以下のような方を対象としています：

**読むべき人**: プラグイン開発者、システムアーキテクト、UI/Worker間通信を設計する開発者、BaseMap・StyleMap・Shape・Spreadsheet・Projectなどの高度なプラグインを実装する方

**前提知識**: TypeScript、React、Web Worker、Comlink（Worker通信）、データベース設計、非同期プログラミング、CopyOnWriteパターンの基本理解

**読むタイミング**: 新規プラグイン開発を開始する前の必読事項として、または既存プラグインの構造を理解・拡張する際に参照してください。特にバッチ処理機能やワーキングコピー管理を含む複雑なプラグインを実装する場合は、本章のCopyOnWriteパターンとEphemeralデータライフサイクルを十分に理解することが重要です。

本アーキテクチャは、UI・Worker・共通層の明確な分離により、メンテナビリティとパフォーマンスを両立させており、Spreadsheetプラグインのような表データ処理や、Shapeプラグインのような大量地理データ処理にも対応可能な設計となっています。

## Overview

HierarchiDBのプラグインシステムは、UI層とWorker層の密結合・同一ライフサイクルという特性を活かした3層アーキテクチャを採用しています。

```
UI Layer (React Components, Hooks, DOM APIs)
    ↕ Comlink RPC (API interfaces)
Worker Layer (Entity Handlers, Database Access, IndexedDB)
    ↕ Shared Layer (Types, Metadata, Constants)
```

## API Definition Structure

### Communication Interface

UI層とWorker層の通信は、既存の**PluginRegistryAPI**システムを使用してシンプルに行われます：

```typescript
// UI側でのプラグインAPI取得
const pluginRegistry = await workerAPI.getPluginRegistryAPI();
const projectAPI = await pluginRegistry.getExtension('project');

// プラグインAPIの使用
const entity = await projectAPI.createEntity(nodeId, data);
```typescript
// src/shared/api.ts - UI-Worker通信APIの定義
export interface ProjectAPI {
  // EntityHandler methods exposed via RPC
  createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity>;
  updateEntity(nodeId: NodeId, updates: Partial<ProjectEntity>): Promise<ProjectEntity>;
  deleteEntity(nodeId: NodeId): Promise<void>;
  getEntity(nodeId: NodeId): Promise<ProjectEntity | null>;
  
  // Plugin-specific business logic
  aggregateLayerData(nodeId: NodeId): Promise<AggregationResult>;
  getAggregationStatus(nodeId: NodeId): Promise<AggregationStatus>;
  // ... other domain-specific methods
}
```

### Worker Layer Implementation

Worker側では、この**API interface**を実装します：

```typescript
// src/worker/plugin.ts
export class ProjectWorkerAPI implements ProjectAPI {
  private entityHandler = new ProjectEntityHandler();
  
  async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    return await this.entityHandler.createEntity(nodeId, data);
  }
  
  async updateEntity(nodeId: NodeId, updates: Partial<ProjectEntity>): Promise<ProjectEntity> {
    return await this.entityHandler.updateEntity(nodeId, updates);
  }
  
  async aggregateLayerData(nodeId: NodeId): Promise<AggregationResult> {
    // Business logic implementation
    const entity = await this.entityHandler.getEntity(nodeId);
    const layers = await this.processLayerAggregation(entity);
    return { layers, status: 'completed' };
  }
  
  // ... other API method implementations
}

export const ProjectWorkerPlugin: WorkerPlugin<ProjectEntity> = {
  metadata: ProjectMetadata,
  api: new ProjectWorkerAPI(), // <- Comlink exposes this API
  entityHandler: new ProjectEntityHandler(),
  // ...
};
```

### UI Layer Usage

UI側では、Comlink経由でWorker APIを呼び出します：

```typescript
// src/ui/hooks/useProjectAPI.ts
import { useWorkerAPI } from '@hierarchidb/ui-client';
import type { ProjectAPI } from '../shared/api';

export function useProjectAPI(): ProjectAPI {
  return useWorkerAPI<ProjectAPI>('project'); // Comlink proxy
}

// src/ui/components/ProjectDialog.tsx
const projectAPI = useProjectAPI();

const handleSubmit = async (data: CreateProjectData) => {
  try {
    // Comlink RPC call to Worker layer
    const entity = await projectAPI.createEntity(nodeId, data);
    onSuccess(entity);
  } catch (error) {
    onError(error);
  }
};
```

### Comlink Bridge Configuration

```typescript
// packages/worker/src/WorkerAPIImpl.ts
export class WorkerAPIImpl implements WorkerAPI {
  private pluginAPIs = new Map<TreeNodeType, any>();
  
  registerPlugin<T>(nodeType: TreeNodeType, plugin: WorkerPlugin<T>): void {
    this.pluginAPIs.set(nodeType, plugin.api); // Register API implementation
  }
  
  // Expose plugin APIs via unified interface
  getPluginAPI<T = any>(nodeType: TreeNodeType): T {
    const api = this.pluginAPIs.get(nodeType);
    if (!api) {
      throw new Error(`Plugin API not found for node type: ${nodeType}`);
    }
    return api as T;
  }
}

// UI側でのComlink proxy取得
// packages/ui-client/src/hooks/useWorkerAPI.ts
export function useWorkerAPI<T>(nodeType: TreeNodeType): T {
  const worker = useWorker();
  const pluginAPI = worker.getPluginAPI<T>(nodeType);
  return pluginAPI; // Comlink automatically proxies async calls
}
```

## 3-Layer Architecture

## API Flow Architecture

### Complete Communication Flow

1. **UI Component** → `useProjectAPI()` hook
2. **Hook** → Comlink proxy (`useWorkerAPI<ProjectAPI>('project')`)
3. **Comlink** → Worker's `ProjectWorkerAPI` instance
4. **Worker API** → `ProjectEntityHandler` for database operations
5. **Result** ← propagated back through same chain

```typescript
// Concrete example of full flow:

// 1. UI Component calls API
const result = await projectAPI.createEntity(nodeId, formData);

// 2. Comlink serializes call and sends to Worker
// (automatic via Comlink proxy)

// 3. Worker receives call and executes
class ProjectWorkerAPI implements ProjectAPI {
  async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    // 4. Delegates to EntityHandler for database work
    return await this.entityHandler.createEntity(nodeId, data);
  }
}

// 5. Result serialized and returned to UI
// (automatic via Comlink)
```

### Key API Definitions Location

| Layer | API Definition Location | Purpose |
|-------|------------------------|----------|
| **Shared** | `src/shared/api.ts` | Interface contracts (TypeScript interfaces) |
| **Worker** | `src/worker/api.ts` | Implementation classes (implements shared interfaces) |
| **UI** | `src/ui/hooks/` | Comlink proxy consumption (uses shared interfaces) |

### 1. **Shared Layer** (`src/shared/`)

UI・Worker両方で安全に使用できる共通コード

**含むもの:**
- **API interface定義** (`ProjectAPI` - UI-Worker通信契約)
- 型定義 (`ProjectEntity`, `CreateProjectData`等)
- プラグインメタデータ (`PluginMetadata`)
- 定数定義 (`DEFAULT_CONFIG`等)
- 純粋関数ユーティリティ

**制約:**
- React依存 ❌
- DOM API使用 ❌ 
- データベースアクセス ❌
- 副作用のない純粋なコード (APIは interface のみ)

```typescript
// src/shared/api.ts - 🔑 CRITICAL: UI-Worker通信契約
export interface ProjectAPI {
  // EntityHandler methods exposed via RPC
  createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity>;
  updateEntity(nodeId: NodeId, updates: Partial<ProjectEntity>): Promise<ProjectEntity>;
  deleteEntity(nodeId: NodeId): Promise<void>;
  getEntity(nodeId: NodeId): Promise<ProjectEntity | null>;
  
  // Plugin-specific business logic
  aggregateLayerData(nodeId: NodeId): Promise<AggregationResult>;
  getAggregationStatus(nodeId: NodeId): Promise<AggregationStatus>;
}

// src/shared/metadata.ts
export const ProjectMetadata: PluginMetadata = {
  nodeType: 'project',
  name: 'Project',
  displayName: 'Map Project',
  icon: { name: 'map', emoji: '🗺️' },
  // ...
};

// src/shared/types.ts
export interface ProjectEntity {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  // ...
}
```

### 2. **UI Layer** (`src/ui/`)

ブラウザメインスレッド専用のUI関連コード

**含むもの:**
- Reactコンポーネント
- React hooks
- UI専用バリデーション (即座実行可能)
- UI専用ライフサイクルハンドラー
- 通知・確認ダイアログ等のUX処理

```typescript
// src/ui/plugin.ts
export const ProjectUIPlugin: UIPlugin = {
  metadata: ProjectMetadata,
  
  components: {
    DialogComponent: ProjectDialog,
    PanelComponent: ProjectPanel,
    IconComponent: ProjectIcon,
  },
  
  validation: {
    validateForm: (data: CreateProjectData) => {
      // 即座に実行可能なフォームバリデーション
    }
  },
  
  lifecycle: {
    afterCreate: async (entity: ProjectEntity) => {
      showSuccessNotification(`Project "${entity.name}" created`);
    }
  },
};
```

### 3. **Worker Layer** (`src/worker/`)

WebWorker環境専用のデータ処理・永続化コード

**含むもの:**
- **API implementation** (`ProjectWorkerAPI` - shared interfaceの実装)
- EntityHandler (データベースCRUD)
- データベーススキーマ・マイグレーション
- Worker専用バリデーション (DB制約チェック等)
- Worker専用ライフサイクルハンドラー
- リソース管理・クリーンアップ処理

```typescript
// src/worker/api.ts - 🔑 CRITICAL: API interface implementation
export class ProjectWorkerAPI implements ProjectAPI {
  private entityHandler = new ProjectEntityHandler();
  
  // Implement ALL methods from shared ProjectAPI interface
  async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    return await this.entityHandler.createEntity(nodeId, data);
  }
  
  async updateEntity(nodeId: NodeId, updates: Partial<ProjectEntity>): Promise<ProjectEntity> {
    return await this.entityHandler.updateEntity(nodeId, updates);
  }
  
  async aggregateLayerData(nodeId: NodeId): Promise<AggregationResult> {
    const entity = await this.entityHandler.getEntity(nodeId);
    // Complex business logic implementation
    return await this.processLayerAggregation(entity);
  }
  
  // ... implement all other ProjectAPI methods
}

// src/worker/plugin.ts
export const ProjectWorkerPlugin: WorkerPlugin<ProjectEntity> = {
  metadata: ProjectMetadata,
  
  api: new ProjectWorkerAPI(), // 🔑 This gets exposed via Comlink
  entityHandler: new ProjectEntityHandler(),
  
  database: {
    tableName: 'projects',
    schema: '&id, nodeId, name, description, createdAt, updatedAt',
    version: 1
  },
  
  validation: {
    validateEntity: async (entity: ProjectEntity) => {
      // データベースアクセス可能な深いバリデーション
      const exists = await checkProjectNameExists(entity.name);
      if (exists) {
        return { isValid: false, errors: [...] };
      }
    }
  },
  
  lifecycle: {
    afterCreate: async (nodeId: NodeId, entity: ProjectEntity) => {
      await initializeProjectResources(nodeId, entity);
    }
  },
};
```

## Directory Structure

```
packages/plugins/project/
├── src/
│   ├── shared/                     # 共通層
│   │   ├── openstreetmap-type.ts                # 共通エクスポート
│   │   ├── api.ts                  # 🔑 API interface定義
│   │   ├── metadata.ts             # プラグインメタデータ
│   │   ├── types.ts                # 型定義
│   │   ├── constants.ts            # 定数
│   │   └── utils.ts                # 純粋関数
│   │
│   ├── ui/                         # UI層
│   │   ├── openstreetmap-type.ts                # UI専用エクスポート
│   │   ├── plugin.ts               # UIPlugin定義
│   │   ├── components/             # Reactコンポーネント
│   │   │   ├── ProjectDialog/
│   │   │   ├── ProjectPanel/
│   │   │   └── ProjectIcon/
│   │   ├── hooks/                  # React hooks
│   │   │   ├── useProjectAPI.ts    # 🔑 Comlink API hook
│   │   │   └── useProjectData.ts   # データ取得hook
│   │   ├── validation/             # UI側バリデーション
│   │   ├── lifecycle/              # UI側ライフサイクル
│   │   └── utils/                  # UI専用ユーティリティ
│   │
│   └── worker/                     # Worker層
│       ├── openstreetmap-type.ts                # Worker専用エクスポート
│       ├── api.ts                  # 🔑 API implementation
│       ├── plugin.ts               # WorkerPlugin定義
│       ├── handlers/               # EntityHandler
│       ├── database/               # データベース関連
│       ├── validation/             # Worker側バリデーション
│       ├── lifecycle/              # Worker側ライフサイクル
│       └── utils/                  # Worker専用ユーティリティ
│
├── package.json                    # マルチエントリポイント設定
└── tsup.config.ts                  # ビルド設定
```

## Plugin Registration

### UI側レジストリ

```typescript
// packages/ui-client/src/plugins/UIPluginRegistry.ts
export class UIPluginRegistry {
  private plugins = new Map<TreeNodeType, UIPlugin>();
  
  register(plugin: UIPlugin): void {
    this.plugins.set(plugin.metadata.nodeType, plugin);
  }
  
  getPlugin(nodeType: TreeNodeType): UIPlugin | undefined {
    return this.plugins.get(nodeType);
  }
}

// 使用例
const registry = UIPluginRegistry.getInstance();
registry.register(ProjectUIPlugin);
```

### Worker側レジストリ

```typescript
// packages/worker/src/plugins/WorkerPluginRegistry.ts
export class WorkerPluginRegistry {
  private plugins = new Map<TreeNodeType, WorkerPlugin>();
  
  register(plugin: WorkerPlugin): void {
    this.plugins.set(plugin.metadata.nodeType, plugin);
  }
  
  getPlugin(nodeType: TreeNodeType): WorkerPlugin | undefined {
    return this.plugins.get(nodeType);
  }
}

// 使用例
const registry = WorkerPluginRegistry.getInstance();
registry.register(ProjectWorkerPlugin);
```

## Package Configuration

### Multi-entry exports

```json
{
  "name": "@hierarchidb/plugin-project",
  "exports": {
    ".": "./dist/index.js",
    "./shared": "./dist/shared/index.js",
    "./ui": "./dist/ui/index.js",
    "./worker": "./dist/worker/index.js"
  },
  "sideEffects": false
}
```

### Usage patterns

```typescript
// 🔑 API interface (shared contract)
import type { ProjectAPI, ProjectEntity } from '@hierarchidb/plugin-project/shared';

// UI側: API消費 (Comlink proxy経由)
import { useProjectAPI } from '@hierarchidb/plugin-project/ui';
const projectAPI = useProjectAPI(); // Returns ProjectAPI proxy
const entity = await projectAPI.createEntity(nodeId, data);

// Worker側: API実装
import { ProjectWorkerAPI } from '@hierarchidb/plugin-project/worker';
const api = new ProjectWorkerAPI(); // Implements ProjectAPI

// 統合時: 両方のプラグイン定義
import { ProjectUIPlugin } from '@hierarchidb/plugin-project/ui';
import { ProjectWorkerPlugin } from '@hierarchidb/plugin-project/worker';

// Registry registration
uiRegistry.register(ProjectUIPlugin);
workerRegistry.register(ProjectWorkerPlugin);
```

### API Communication Example

```typescript
// Complete flow from UI to Worker and back

// 1. UI Component
function ProjectDialog({ nodeId }: { nodeId: NodeId }) {
  const projectAPI = useProjectAPI(); // Gets Comlink proxy
  
  const handleSubmit = async (formData: CreateProjectData) => {
    try {
      // 2. Comlink RPC call (serializes automatically)
      const entity = await projectAPI.createEntity(nodeId, formData);
      
      // 3. Success handling
      showNotification(`Project "${entity.name}" created successfully`);
    } catch (error) {
      showErrorNotification('Failed to create project');
    }
  };
}

// 4. Worker receives call (automatically deserialized)
class ProjectWorkerAPI implements ProjectAPI {
  async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    // 5. Database operation
    const entity = await this.entityHandler.createEntity(nodeId, data);
    
    // 6. Business logic
    await this.initializeProjectResources(entity);
    
    // 7. Return result (will be serialized automatically)
    return entity;
  }
}
```

## Build Optimization

### Tree-shaking

現代のバンドラー（Vite、Webpack、Rollup）のtree-shakingにより、各環境で必要な部分のみがバンドルに含まれます:

**UI側バンドル:**
- ✅ React components
- ✅ UI hooks & validation
- ✅ Shared metadata & types
- ❌ EntityHandler (除外)
- ❌ Database code (除外)

**Worker側バンドル:**
- ✅ EntityHandler  
- ✅ Database access code
- ✅ Shared metadata & types
- ❌ React components (除外)
- ❌ DOM APIs (除外)

### tsup configuration

```typescript
// tsup.config.ts
export default defineConfig([
  { entry: ['src/shared/openstreetmap-type.ts'], outDir: 'dist/shared' },
  { entry: ['src/ui/openstreetmap-type.ts'], outDir: 'dist/ui', external: ['react'] },
  { entry: ['src/worker/openstreetmap-type.ts'], outDir: 'dist/worker', external: ['@hierarchidb/worker'] },
]);
```

## Plugin Development Workflow

1. **共通定義作成** (`src/shared/`)
   - 型定義、メタデータ、定数の定義

2. **UI層実装** (`src/ui/`)
   - Reactコンポーネント作成
   - フォームバリデーション実装
   - UI専用ライフサイクル実装

3. **Worker層実装** (`src/worker/`)
   - EntityHandler実装
   - データベーススキーマ定義
   - Worker専用バリデーション実装

4. **統合テスト**
   - UI-Worker間の連携テスト
   - プラグイン全体のライフサイクルテスト

## Testing Strategy

### 3-Layer Test Architecture

新しいプラグインアーキテクチャに対応した包括的なテスト戦略を採用しています：

#### Shared Layer Tests (`src/shared/__tests__/`)

**純粋関数・ユーティリティのテスト**
```
src/shared/__tests__/
├── utils.test.ts           # バリデーション、ユーティリティ関数
├── validation.test.ts      # 型ガード、スキーマバリデーション
└── constants.test.ts       # 定数値の整合性テスト
```

**特徴:**
- 副作用なしの純粋関数テスト
- ブランデッド型の動作検証
- バリデーションロジックの網羅テスト

```typescript
// 例: Shared layer validation test
describe('validateMapConfiguration', () => {
  it('should validate correct map configuration', () => {
    const config = {
      center: [139.6917, 35.6895] as [number, number],
      zoom: 10,
      bearing: 0,
      pitch: 0
    };
    const result = validateMapConfiguration(config);
    expect(result.isValid).toBe(true);
  });
});
```

#### Worker Layer Tests (`src/worker/__tests__/`)

**API実装・データベース操作のテスト**
```
src/worker/__tests__/
├── ProjectEntityHandler.test.ts  # Entity CRUD操作
├── api.test.ts                   # Plugin API実装
├── database.test.ts              # スキーマ・マイグレーション
└── integration/                  # 統合テスト
    ├── full-workflow.test.ts     # エンドツーエンドワークフロー
    └── plugin-registration.test.ts # プラグイン登録テスト
```

**特徴:**
- モッキング戦略でDexie/IndexedDBを抽象化
- 非同期処理とエラーハンドリングのテスト
- ビジネスロジックの検証

```typescript
// 例: Worker API test with mocking
vi.mock('@hierarchidb/worker', () => ({
  BaseEntityHandler: class MockBaseEntityHandler {
    protected table = { add: vi.fn(), where: vi.fn() };
  }
}));

describe('ProjectEntityHandler', () => {
  it('should create project entity with required fields', async () => {
    const result = await handler.createEntity(mockNodeId, createData);
    expect(result).toMatchObject({
      id: 'mock-entity-id',
      nodeId: mockNodeId,
      name: 'Test Project'
    });
  });
});
```

#### UI Layer Tests (`src/ui/__tests__/`)

**React Components・Hooksのテスト**
```
src/ui/__tests__/
├── hooks/
│   ├── useProjectAPI.test.tsx    # API アクセスフック
│   └── useProjectData.test.tsx   # データ管理フック
├── components/
│   ├── ProjectDialog.test.tsx    # ダイアログコンポーネント
│   ├── ProjectPanel.test.tsx     # パネルコンポーネント
│   └── steps/                    # ステップコンポーネント群
└── integration/
    └── plugin-ui-flow.test.tsx   # UI統合フロー
```

**特徴:**
- `@testing-library/react` による実際のUI動作テスト
- Comlink APIアクセスのモッキング
- ユーザーインタラクションのシミュレーション

```typescript
// 例: UI hook test with async API
describe('useProjectAPI', () => {
  it('should return ProjectAPI instance', async () => {
    const { result } = renderHook(() => useProjectAPI());
    const api = await result.current;
    expect(api).toBe(mockProjectAPI);
    expect(mockPluginRegistry.getExtension).toHaveBeenCalledWith('project');
  });
});
```

### Test Configuration

#### Package-level Test Setup
```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run", 
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

#### Vitest Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom', // UI tests
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['**/__tests__/**', '**/*.test.*']
    }
  }
});
```

#### Mock Strategy
```typescript
// vitest.setup.ts - Global test setup
import 'fake-indexeddb/auto'; // Worker layer database mocking

// Mock Comlink for UI-Worker communication
vi.mock('comlink', () => ({
  wrap: vi.fn(),
  proxy: vi.fn(),
  expose: vi.fn()
}));
```

### Test Execution Patterns

#### Development Workflow
```bash
# Layer-specific testing
pnpm test src/shared       # Shared layer only
pnpm test src/worker       # Worker layer only  
pnpm test src/ui          # UI layer only

# Comprehensive testing
pnpm test:run             # All tests once
pnpm test:coverage        # With coverage report
pnpm test:ui             # Interactive test UI
```

#### CI/CD Integration
```yaml
# .github/workflows/test.yml
- name: Test Shared Layer
  run: pnpm test src/shared --run
  
- name: Test Worker Layer  
  run: pnpm test src/worker --run
  
- name: Test UI Layer
  run: pnpm test src/ui --run
  
- name: Integration Tests
  run: pnpm test src/**/*.integration.test.ts --run
```

### Quality Gates

#### Coverage Requirements
- **Shared Layer**: 95%+ (純粋関数は高カバレッジが容易)
- **Worker Layer**: 85%+ (データベース操作、ビジネスロジック)
- **UI Layer**: 80%+ (視覚的要素、ユーザーインタラクション)

#### Test Categories
- **Unit Tests**: 各層内の個別機能テスト
- **Integration Tests**: 層間連携テスト  
- **E2E Tests**: 完全なユーザーワークフローテスト
- **Performance Tests**: 大量データでの性能検証

## Best Practices

### Layer Separation

- **共通コード**: 副作用なし、環境非依存
- **UI層**: React特化、即座実行可能
- **Worker層**: データ処理特化、非同期・永続化

### Type Safety

```typescript
// 共通型を基盤とした型安全性
interface UIPlugin {
  metadata: PluginMetadata;  // 共通メタデータを参照
  // UI固有の機能...
}

interface WorkerPlugin<T> {
  metadata: PluginMetadata;  // 同じメタデータを参照
  entityHandler: EntityHandler<T>;
  // Worker固有の機能...
}
```

### Error Handling

```typescript
// UI側: ユーザーフレンドリーなエラー処理
lifecycle: {
  beforeCreate: async (data) => {
    try {
      await validateFormData(data);
    } catch (error) {
      showErrorNotification('入力データに問題があります');
      throw error;
    }
  }
}

// Worker側: システム的なエラー処理
lifecycle: {
  afterCreate: async (nodeId, entity) => {
    try {
      await initializeResources(nodeId, entity);
    } catch (error) {
      console.error('Resource initialization failed:', error);
      await rollbackEntity(nodeId);
      throw error;
    }
  }
}
```

## CopyOnWrite Pattern and Working Copy Lifecycle

### CopyOnWrite原則の実装

HierarchiDBでは、**CopyOnWrite**原則に従い、編集中のEntityは必ずWorkingCopyとして管理されます。

#### WorkingCopy作成タイミング

**Step 2時点での作成**：ダイアログでデータソース選択など、実質的な編集が開始される時点

```typescript
// UI Layer - Dialog Implementation
export function ShapeDialog({ mode, nodeId, parentNodeId, open, onClose }: ShapeDialogProps) {
  const [workingCopy, setWorkingCopy] = useState<ShapeWorkingCopy | null>(null);
  
  // Step 1 → Step 2 遷移時にWorkingCopy作成
  const handleMoveToStep2 = useCallback(async () => {
    if (!workingCopy) {
      const api = await getShapeAPI();
      
      if (mode === 'edit' && nodeId) {
        // ✅ 既存エンティティの編集：CopyOnWrite
        const workingCopyId = await api.createWorkingCopy(nodeId);
        const copy = await api.getWorkingCopy(workingCopyId);
        setWorkingCopy(copy);
      } else if (mode === 'create' && parentNodeId) {
        // ✅ 新規作成：Draft WorkingCopy
        const workingCopyId = await api.createNewDraftWorkingCopy(parentNodeId);
        const copy = await api.getWorkingCopy(workingCopyId);
        setWorkingCopy(copy);
      }
    }
    setActiveStep(2);
  }, [mode, nodeId, parentNodeId, workingCopy]);
}
```

#### WorkingCopy-based API Design

**すべてのバッチ処理APIはWorkingCopyベース**

```typescript
// Shared Layer - API Interface
export interface ShapeAPI {
  // ✅ WorkingCopy management
  createWorkingCopy(nodeId: NodeId): Promise<EntityId>;
  createNewDraftWorkingCopy(parentNodeId: NodeId): Promise<EntityId>;
  getWorkingCopy(workingCopyId: EntityId): Promise<ShapeWorkingCopy | undefined>;
  updateWorkingCopy(workingCopyId: EntityId, data: Partial<ShapeWorkingCopy>): Promise<void>;
  commitWorkingCopy(workingCopyId: EntityId): Promise<void>;
  discardWorkingCopy(workingCopyId: EntityId): Promise<void>;

  // ✅ Batch processing - Always WorkingCopy-based
  startBatchProcessing(
    workingCopyId: EntityId,  // ← NodeIdではなくWorkingCopyId
    config: ProcessingConfig, 
    urlMetadata: UrlMetadata[]
  ): Promise<string>;
  
  pauseBatchProcessing(workingCopyId: EntityId): Promise<void>;
  resumeBatchProcessing(workingCopyId: EntityId): Promise<void>;
  cancelBatchProcessing(workingCopyId: EntityId): Promise<void>;
  getBatchProgress(workingCopyId: EntityId): Promise<ProgressInfo>;
}
```

### Ephemeral Data Lifecycle and Recovery

#### EphemeralDBでのデータ管理

**生存期間とクリーンアップ戦略**

```typescript
// Worker Layer - Data Lifecycle Management
interface EphemeralDataLifecycle {
  // ダイアログ内：明示的管理
  dialogControlled: {
    creation: "Step 2時点でWorkingCopy作成";
    updates: "ダイアログ内でのリアルタイム更新";
    cleanup: "Cancel/Save/Discard時の明示的削除";
  };
  
  // ダイアログ外：システム管理  
  systemControlled: {
    persistence: "ブラウザセッション中は永続（24時間）";
    autoCleanup: "24時間後自動削除";
    crashRecovery: "ブラウザクラッシュ後も残存";
    directLinkAccess: "ダイレクトリンクからの中断処理再開";
  };
}
```

#### バッチ処理の中断・再開メカニズム

**中断されたセッションの検索・復旧**

```typescript
// Shared Layer - Batch Session Recovery API
export interface ShapeAPI {
  // ✅ 中断セッション検索（ダイレクトリンク対応）
  findPendingBatchSessions(nodeId: NodeId): Promise<BatchSession[]>;
  getBatchSessionStatus(sessionId: string): Promise<{
    exists: boolean;
    canResume: boolean;
    lastActivity: number;
    expiresAt: number;
  }>;
}

// Worker Layer - Implementation
findPendingBatchSessions: async (nodeId: NodeId): Promise<BatchSession[]> => {
  const sessions = await ephemeralDB.batchSessions
    .where('nodeId').equals(nodeId)
    .and(session => 
      session.status === 'paused' && 
      Date.now() - session.updatedAt < 24 * 60 * 60 * 1000 // 24時間以内
    )
    .toArray();
    
  return sessions;
}
```

#### ダイレクトリンク対応の実装

**ページアクセス時の中断処理検出**

```typescript
// App Layer - Route Component
export default function TreeNodePage() {
  const { treeId, pageNodeId } = useParams();
  
  useEffect(() => {
    const checkPendingBatches = async () => {
      const shapeAPI = await getShapeAPI();
      const pendingBatches = await shapeAPI.findPendingBatchSessions(pageNodeId);
      
      if (pendingBatches.length > 0) {
        // ✅ 中断処理再開オプション表示
        showBatchRecoveryDialog({
          sessions: pendingBatches,
          onResume: (sessionId) => resumeBatchFromDirectLink(sessionId),
          onDiscard: (sessionId) => discardBatchSession(sessionId)
        });
      }
    };
    
    if (pageNodeId) {
      checkPendingBatches();
    }
  }, [pageNodeId]);
}
```

#### 自動クリーンアップシステム

**24時間経過データの自動削除**

```typescript
// Worker Layer - Cleanup Service
export class EphemeralDataCleanupService {
  async cleanupExpiredData(): Promise<void> {
    const expiredThreshold = Date.now() - (24 * 60 * 60 * 1000);
    
    await ephemeralDB.transaction('rw', [
      ephemeralDB.workingCopies,
      ephemeralDB.batchSessions,
      ephemeralDB.batchTasks,
      ephemeralDB.processedResults
    ], async () => {
      // WorkingCopies cleanup
      const expiredCopies = await ephemeralDB.workingCopies
        .where('updatedAt').below(expiredThreshold)
        .toArray();
        
      // Batch data cleanup
      await ephemeralDB.batchSessions
        .where('updatedAt').below(expiredThreshold)
        .delete();
        
      // Associated task cleanup
      await ephemeralDB.batchTasks
        .where('createdAt').below(expiredThreshold)
        .delete();
        
      console.log(`Cleaned up ${expiredCopies.length} expired working copies`);
    });
  }
}

// 定期実行設定
setInterval(() => {
  new EphemeralDataCleanupService().cleanupExpiredData();
}, 60 * 60 * 1000); // 1時間間隔で実行
```

### バッチ処理のデータフロー

#### 完全なライフサイクル

```typescript
// 1. WorkingCopy作成（Step 2）
const workingCopyId = await shapeAPI.createWorkingCopy(nodeId);

// 2. バッチ処理開始
const sessionId = await shapeAPI.startBatchProcessing(
  workingCopyId,
  processingConfig,
  urlMetadata
);

// 3. 中断・再開（オプション）
await shapeAPI.pauseBatchProcessing(workingCopyId);
await shapeAPI.resumeBatchProcessing(workingCopyId);  // 中断地点から継続

// 4. 最終保存（EphemeralDB → CoreDB）
await shapeAPI.commitWorkingCopy(workingCopyId);  // 永続化
// または
await shapeAPI.discardWorkingCopy(workingCopyId); // 破棄
```

### WorkingCopy統一処理の利点

1. **新規・編集の区別なし**：すべてWorkingCopyベースで統一
2. **中断・再開の一貫性**：処理状態の完全な保持
3. **ダイレクトリンク対応**：URL経由での作業再開
4. **自動クリーンアップ**：ゴミデータの確実な削除
5. **トランザクショナル**：Commit/Rollbackの明確な境界

## Migration Guide

既存プラグインを新しい3層構造に移行する手順は [Plugin Migration Guide](./migration/plugin-migration.md) を参照してください。