# プラグインテスト開発ガイド

## 概要

HierarchiDBの3層プラグインアーキテクチャに対応したテスト開発の実践ガイドです。型安全性を維持しながら効率的にテストを作成・実行する方法を説明します。

## テスト環境のセットアップ

### 1. 依存関係の確認

```json
// package.json - テスト関連依存関係
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0", 
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "fake-indexeddb": "^4.0.0",
    "happy-dom": "^12.0.0"
  }
}
```

### 2. テスト設定ファイル

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      thresholds: {
        'src/shared/**': { lines: 95 },
        'src/worker/**': { lines: 85 },
        'src/ui/**': { lines: 80 }
      }
    }
  }
});
```

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Global mocks
import { vi } from 'vitest';

// Mock Comlink
vi.mock('comlink', () => ({
  wrap: vi.fn(),
  proxy: vi.fn(),
  expose: vi.fn()
}));

// Mock @hierarchidb/ui-client
vi.mock('@hierarchidb/ui-client', () => ({
  useWorkerAPIClient: vi.fn()
}));
```

## 3層別テスト作成指針

### Shared Layer テスト

**対象**: 純粋関数、バリデーション、ユーティリティ

#### テンプレート

```typescript
// src/shared/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest';
import { 
  validateCreateProjectData,
  isProjectEntity,
  LayerId 
} from '../validation';

describe('Project Validation System', () => {
  describe('validateCreateProjectData', () => {
    // 正常系テスト
    it('should accept valid project data', () => {
      const validData = {
        name: 'Valid Project',
        description: 'Valid description'
      };
      
      const result = validateCreateProjectData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // 異常系テスト（複数パターン）
    const invalidCases = [
      {
        name: 'empty name',
        data: { name: '', description: 'Valid' },
        expectedError: { field: 'name', severity: 'error' }
      },
      {
        name: 'long description',
        data: { name: 'Valid', description: 'x'.repeat(1001) },
        expectedError: { field: 'description', severity: 'warning' }
      }
    ];

    invalidCases.forEach(({ name, data, expectedError }) => {
      it(`should reject ${name}`, () => {
        const result = validateCreateProjectData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      });
    });
  });

  describe('Type Guards', () => {
    it('should validate entity structure comprehensively', () => {
      const validEntity = createMockProjectEntity();
      expect(isProjectEntity(validEntity)).toBe(true);
      
      // Edge cases
      expect(isProjectEntity(null)).toBe(false);
      expect(isProjectEntity({})).toBe(false);
      expect(isProjectEntity({ name: 'Project' })).toBe(false); // Missing fields
    });
  });

  describe('Branded Types', () => {
    it('should create and validate LayerId correctly', () => {
      const layerId = LayerId.create('layer-123');
      expect(LayerId.isValid(layerId)).toBe(true);
      expect(LayerId.isValid('')).toBe(false);
    });
  });
});
```

#### ポイント
- **純粋関数重視**: 副作用なしでテストしやすい
- **エッジケース網羅**: null, undefined, 空文字などの境界値
- **テーブル駆動テスト**: 複数パターンの効率的テスト

### Worker Layer テスト

**対象**: EntityHandler、API実装、データベース操作

#### テンプレート

```typescript
// src/worker/__tests__/ProjectEntityHandler.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';
import { TestIds, createMockProjectEntity } from '../../__test-utils__/factories';

// Mock BaseEntityHandler
vi.mock('@hierarchidb/worker', () => ({
  BaseEntityHandler: class MockBaseEntityHandler {
    protected table = {
      add: vi.fn().mockResolvedValue(undefined),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(),
          modify: vi.fn(),
          delete: vi.fn()
        }))
      }))
    };
  }
}));

describe('ProjectEntityHandler', () => {
  let handler: ProjectEntityHandler;
  let mockTable: any;

  beforeEach(() => {
    handler = new ProjectEntityHandler();
    mockTable = handler.table;
    vi.clearAllMocks();
  });

  describe('createEntity', () => {
    it('should create project with merged configurations', async () => {
      const nodeId = TestIds.nodeId();
      const createData = {
        name: 'Test Project',
        mapConfig: { zoom: 15 }, // Override default
        layerConfigurations: {
          'resource-1': createMockLayerConfig()
        }
      };

      const result = await handler.createEntity(nodeId, createData);

      // Verify merged configuration
      expect(result.mapConfig.zoom).toBe(15);
      expect(result.mapConfig.center).toEqual(DEFAULT_MAP_CONFIG.center);
      
      // Verify database interaction
      expect(mockTable.add).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId,
          name: 'Test Project',
          version: 1
        })
      );
    });

    // Error handling test
    it('should throw validation error for invalid data', async () => {
      const nodeId = TestIds.nodeId();
      const invalidData = { name: '' }; // Invalid empty name

      await expect(handler.createEntity(nodeId, invalidData))
        .rejects.toThrow('Project name is required');
      
      expect(mockTable.add).not.toHaveBeenCalled();
    });
  });

  describe('updateEntity', () => {
    it('should update existing entity', async () => {
      const nodeId = TestIds.nodeId();
      const existingEntity = createMockProjectEntity({ 
        nodeId, 
        version: 1 
      });

      mockTable.where().equals().first.mockResolvedValue(existingEntity);

      const updateData = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      await handler.updateEntity(nodeId, updateData);

      expect(mockTable.where().equals().modify).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updateData,
          updatedAt: expect.any(Number),
          version: 2 // Incremented
        })
      );
    });

    it('should handle entity not found', async () => {
      const nodeId = TestIds.nodeId();
      mockTable.where().equals().first.mockResolvedValue(undefined);

      await expect(handler.updateEntity(nodeId, { name: 'New Name' }))
        .rejects.toThrow(`Project not found: ${nodeId}`);
    });
  });

  describe('layer configuration management', () => {
    it('should add layer configuration correctly', async () => {
      const nodeId = TestIds.nodeId();
      const resourceNodeId = TestIds.nodeId('resource');
      const existingEntity = createMockProjectEntity({ 
        nodeId, 
        layerConfigurations: {} 
      });

      mockTable.where().equals().first.mockResolvedValue(existingEntity);

      const layerConfig = createMockLayerConfig({
        layerId: 'layer-123',
        isVisible: true
      });

      await handler.configureLayer(nodeId, resourceNodeId, layerConfig);

      expect(mockTable.where().equals().modify).toHaveBeenCalledWith({
        layerConfigurations: {
          [resourceNodeId]: layerConfig
        },
        updatedAt: expect.any(Number),
        version: expect.any(Number)
      });
    });
  });
});
```

#### ポイント
- **モックの適切な使用**: Dexieのような外部依存をモック
- **状態変化の検証**: バージョン管理、タイムスタンプ更新
- **エラーハンドリング**: 例外発生パターンのテスト

### UI Layer テスト

**対象**: React hooks、コンポーネント、ユーザーインタラクション

#### テンプレート

```typescript
// src/ui/__tests__/hooks/useProjectAPI.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectAPI } from '../../hooks/useProjectAPI';

// Mock dependencies
const mockWorkerAPIClient = { getAPI: vi.fn() };
const mockWorkerAPI = { getPluginRegistryAPI: vi.fn() };
const mockPluginRegistry = { getExtension: vi.fn() };
const mockProjectAPI = { 
  createEntity: vi.fn(),
  getEntity: vi.fn()
  // ... other methods
};

vi.mock('@hierarchidb/ui-client', () => ({
  useWorkerAPIClient: () => mockWorkerAPIClient
}));

describe('useProjectAPI Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerAPIClient.getAPI.mockReturnValue(mockWorkerAPI);
    mockWorkerAPI.getPluginRegistryAPI.mockResolvedValue(mockPluginRegistry);
    mockPluginRegistry.getExtension.mockResolvedValue(mockProjectAPI);
  });

  it('should return ProjectAPI through plugin registry', async () => {
    const { result } = renderHook(() => useProjectAPI());
    
    // Hook returns Promise
    expect(result.current).toBeInstanceOf(Promise);
    
    // Resolve and verify
    const api = await result.current;
    expect(api).toBe(mockProjectAPI);
    
    // Verify call chain
    expect(mockWorkerAPIClient.getAPI).toHaveBeenCalled();
    expect(mockWorkerAPI.getPluginRegistryAPI).toHaveBeenCalled();
    expect(mockPluginRegistry.getExtension).toHaveBeenCalledWith('project');
  });

  it('should handle API access errors gracefully', async () => {
    const error = new Error('Plugin not found');
    mockPluginRegistry.getExtension.mockRejectedValue(error);

    const { result } = renderHook(() => useProjectAPI());
    await expect(result.current).rejects.toThrow('Plugin not found');
  });

  it('should memoize API promise', () => {
    const { result, rerender } = renderHook(() => useProjectAPI());
    
    const promise1 = result.current;
    rerender();
    const promise2 = result.current;
    
    // Should be same instance (memoized)
    expect(promise1).toBe(promise2);
  });
});
```

#### コンポーネントテストテンプレート

```typescript
// src/ui/__tests__/components/ProjectDialog.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectDialog, ProjectDialogProps } from '../../components/ProjectDialog';

// Mock the useProjectAPI hook
vi.mock('../../hooks/useProjectAPI', () => ({
  useProjectAPIGetter: () => () => Promise.resolve({
    createEntity: vi.fn().mockResolvedValue({ id: 'created-entity' })
  })
}));

describe('ProjectDialog Component', () => {
  const defaultProps: ProjectDialogProps = {
    open: true,
    onClose: vi.fn(),
    mode: 'create',
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn()
  };

  it('should render create dialog correctly', () => {
    render(<ProjectDialog {...defaultProps} />);
    
    expect(screen.getByText('Create Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    render(<ProjectDialog {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /create project/i });
    
    // Try to submit without name
    await user.click(submitButton);
    
    // Should show validation error
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('should submit valid form data', async () => {
    const user = userEvent.setup();
    render(<ProjectDialog {...defaultProps} />);
    
    // Fill form
    const nameInput = screen.getByLabelText(/project name/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    
    await user.type(nameInput, 'Test Project');
    await user.type(descriptionInput, 'Test Description');
    
    // Navigate through steps and submit
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton); // Go to next step
    
    // ... navigate to final step
    
    const createButton = screen.getByRole('button', { name: /create project/i });
    await user.click(createButton);
    
    expect(defaultProps.onSave).toHaveBeenCalledWith({
      name: 'Test Project',
      description: 'Test Description'
    });
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('API Error'));
    
    render(<ProjectDialog {...defaultProps} onSave={onSave} />);
    
    // Fill and submit form
    await user.type(screen.getByLabelText(/project name/i), 'Test Project');
    await user.click(screen.getByRole('button', { name: /create project/i }));
    
    // Should show error state
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
  });
});
```

## テストユーティリティ

### テストデータファクトリ

```typescript
// src/__test-utils__/factories.ts
import { ProjectEntity, LayerConfiguration } from '../shared';
import { NodeId, EntityId } from '@hierarchidb/core';

export const TestIds = {
  nodeId: (id = 'test-node') => id as NodeId,
  entityId: (id = 'test-entity') => id as EntityId,
  layerId: (id = 'test-layer') => id as LayerId,
};

export const createMockProjectEntity = (
  overrides: Partial<ProjectEntity> = {}
): ProjectEntity => ({
  id: TestIds.entityId(),
  nodeId: TestIds.nodeId(),
  name: 'Test Project',
  description: 'Test Description',
  mapConfig: DEFAULT_MAP_CONFIG,
  renderConfig: DEFAULT_RENDER_CONFIG,
  layerConfigurations: {},
  exportConfigurations: [],
  aggregationMetadata: DEFAULT_AGGREGATION_METADATA,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
  ...overrides
});

export const createMockLayerConfig = (
  overrides: Partial<LayerConfiguration> = {}
): LayerConfiguration => ({
  layerId: TestIds.layerId(),
  layerType: 'vector',
  layerOrder: 1,
  isVisible: true,
  opacity: 1,
  styleConfig: {
    source: { type: 'vector', url: 'test://source' }
  },
  interactionConfig: {
    clickable: true,
    hoverable: true
  },
  ...overrides
});
```

### カスタムマッチャー

```typescript
// src/__test-utils__/matchers.ts
import { expect } from 'vitest';

expect.extend({
  toBeValidProjectEntity(received) {
    const pass = isProjectEntity(received);
    
    return {
      pass,
      message: () => pass 
        ? `Expected ${received} not to be a valid ProjectEntity`
        : `Expected ${received} to be a valid ProjectEntity`
    };
  },

  toHaveValidationError(received, field, severity = 'error') {
    const hasError = received.errors?.some(
      (err: ValidationError) => err.field === field && err.severity === severity
    );
    
    return {
      pass: hasError,
      message: () => `Expected validation result to have ${severity} for field "${field}"`
    };
  }
});

// 型定義
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidProjectEntity(): T;
    toHaveValidationError(field: string, severity?: 'error' | 'warning'): T;
  }
}
```

## 実行コマンド

### 開発時

```bash
# 各層別テスト実行
pnpm test src/shared         # 共通層のみ
pnpm test src/worker         # Worker層のみ
pnpm test src/ui            # UI層のみ

# ファイル指定
pnpm test ProjectDialog      # 特定コンポーネント
pnpm test validation        # バリデーション系

# ウォッチモード
pnpm test --watch           # ファイル変更検知
pnpm test --ui             # ブラウザUI

# カバレッジ
pnpm test:coverage         # カバレッジレポート
pnpm test:coverage --open  # ブラウザで開く
```

### CI/CD

```bash
# 全テスト実行（CI用）
pnpm test:run

# カバレッジ付き実行
pnpm test:coverage --run

# レポート生成
pnpm test:coverage --reporter=json-summary
```

## デバッグ手法

### テスト失敗時

```typescript
// デバッグ用コンソール出力
it('should debug test issue', () => {
  const result = validateCreateProjectData(testData);
  
  // デバッグ出力
  console.log('Test data:', JSON.stringify(testData, null, 2));
  console.log('Validation result:', result);
  console.log('Errors:', result.errors);
  
  expect(result.isValid).toBe(true);
});

// スナップショットテスト
it('should match expected structure', () => {
  const entity = createMockProjectEntity();
  expect(entity).toMatchSnapshot();
});
```

### モック確認

```typescript
// モック呼び出し確認
expect(mockHandler.createEntity).toHaveBeenCalledWith(
  expect.any(String), // NodeId
  expect.objectContaining({
    name: 'Test Project'
  })
);

// モック実装の詳細確認
expect(mockHandler.createEntity).toHaveBeenCalledTimes(1);
expect(mockHandler.createEntity.mock.calls[0][0]).toBe(nodeId);
```

## ベストプラクティス

### 1. テスト構造
- **AAA パターン**: Arrange, Act, Assert を明確に分離
- **1テスト1検証**: 各テストは1つの動作に集中
- **わかりやすい命名**: テスト名でテスト内容がわかる

### 2. モック戦略
- **最小限のモック**: 必要な部分のみモック化
- **現実的な挙動**: 実際の動作に近いモック
- **エラーケース**: 失敗パターンも適切にモック

### 3. 保守性
- **テストユーティリティ**: 共通処理を関数化
- **ファクトリパターン**: テストデータの一元管理
- **型安全性**: テストコードでも型安全性を維持

このガイドに従って開発することで、型安全で保守性の高いテストコードが作成できます。