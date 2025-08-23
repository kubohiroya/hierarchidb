# 5.1 テスト戦略と実装

## テスト戦略概要

### テストピラミッド
```
        /\        E2Eテスト（10%）
       /  \       重要なユーザーフロー
      /    \      
     /------\     
    /        \    統合テスト（30%）
   /          \   Worker API層テスト
  /            \  
 /--------------\ 
/                \ 単体テスト（60%）
/________________\ 個別関数/クラステスト
```

## テストフレームワーク

### 使用ツール
| ツール | 用途 | 設定 |
|--------|------|------|
| **Vitest** | 単体/統合テスト | vitest.config.ts |
| **Playwright** | E2Eテスト | playwright.config.ts |
| **React Testing Library** | UIテスト | setupTests.ts |
| **fake-indexeddb** | DBモック | vitest.setup.ts |

### Vitest設定
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      threshold: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
```

## 単体テスト（Unit Tests）

### テスト対象
- 純粋関数
- ユーティリティ関数
- 型ガード
- バリデーション

### 実装例
```typescript
// ID生成のテスト
describe('NodeIdGenerator', () => {
  it('should generate valid NodeId', () => {
    const nodeId = generateNodeId();
    expect(nodeId).toMatch(/^node_[a-z0-9]+$/);
    expect(nodeId.length).toBeGreaterThan(10);
  });
  
  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateNodeId());
    }
    expect(ids.size).toBe(1000);
  });
});
```

### ブランデッド型のテスト
```typescript
describe('Branded Types', () => {
  it('should handle NodeId type casting', () => {
    const rawId = 'node_123';
    const nodeId = rawId as NodeId;
    
    // 型システムのテスト
    const acceptNodeId = (id: NodeId) => id;
    expect(acceptNodeId(nodeId)).toBe(rawId);
  });
  
  it('should filter valid NodeIds', () => {
    const mixed = ['node1', '', null, 'node2'];
    const valid: NodeId[] = mixed
      .filter((id): id is string => 
        typeof id === 'string' && id.length > 0
      ) as NodeId[];
    
    expect(valid).toEqual(['node1', 'node2']);
  });
});
```

## 統合テスト（Integration Tests）

### Worker API層テスト
```typescript
describe('WorkerAPI Integration', () => {
  let worker: WorkerAPIImpl;
  let db: CoreDB;
  
  beforeEach(async () => {
    worker = new WorkerAPIImpl();
    await worker.initialize();
    db = worker.getCoreDB();
  });
  
  afterEach(async () => {
    await db.delete();
  });
  
  it('should create and retrieve node', async () => {
    const createResult = await worker.createNode({
      parentNodeId: 'root' as NodeId,
      nodeType: 'folder',
      name: 'Test Folder'
    });
    
    expect(createResult.success).toBe(true);
    
    const node = await worker.getNode(createResult.nodeId);
    expect(node?.name).toBe('Test Folder');
  });
});
```

### データベーストランザクションテスト
```typescript
describe('Database Transactions', () => {
  it('should rollback on error', async () => {
    const db = new CoreDB();
    
    try {
      await db.transaction('rw', db.nodes, async () => {
        await db.nodes.add(validNode);
        throw new Error('Intentional error');
      });
    } catch (e) {
      // エラーは期待通り
    }
    
    // ロールバックされていることを確認
    const count = await db.nodes.count();
    expect(count).toBe(0);
  });
});
```

## コンポーネントテスト

### React Testing Library使用
```typescript
describe('TreeConsolePanel', () => {
  it('should render tree structure', () => {
    const { getByText, queryByText } = render(
      <TreeConsolePanel
        data={mockTreeData}
        onNodeClick={vi.fn()}
      />
    );
    
    expect(getByText('Root')).toBeInTheDocument();
    expect(getByText('Folder1')).toBeInTheDocument();
    expect(queryByText('Hidden')).not.toBeInTheDocument();
  });
  
  it('should handle node expansion', async () => {
    const onExpand = vi.fn();
    const { getByRole } = render(
      <TreeConsolePanel
        data={mockTreeData}
        onNodeExpand={onExpand}
      />
    );
    
    const expandButton = getByRole('button', { name: /expand/i });
    await userEvent.click(expandButton);
    
    expect(onExpand).toHaveBeenCalledWith('folder1', true);
  });
});
```

## E2Eテスト

### Playwright実装
```typescript
// e2e/treeconsole.spec.ts
import { test, expect } from '@playwright/test';

test.describe('TreeConsole E2E', () => {
  test('should create and delete node', async ({ page }) => {
    await page.goto('/treeconsole-simple');
    
    // SpeedDialでフォルダ作成
    await page.click('[aria-label="SpeedDial"]');
    await page.click('text=Create Folder');
    
    // ダイアログで名前入力
    await page.fill('input[name="name"]', 'Test Folder');
    await page.click('button:has-text("Create")');
    
    // 作成確認
    await expect(page.locator('text=Test Folder')).toBeVisible();
    
    // 削除
    await page.click('text=Test Folder', { button: 'right' });
    await page.click('text=Delete');
    await page.click('button:has-text("Confirm")');
    
    // 削除確認
    await expect(page.locator('text=Test Folder')).not.toBeVisible();
  });
});
```

## モックとスタブ

### Worker APIモック
```typescript
// __mocks__/WorkerAPI.ts
export class MockWorkerAPI {
  private nodes = new Map<NodeId, TreeNode>();
  
  async createNode(payload: CreateNodePayload): Promise<CreateResult> {
    const nodeId = 'mock_' + Date.now() as NodeId;
    const node: TreeNode = {
      id: nodeId,
      ...payload,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    this.nodes.set(nodeId, node);
    return { success: true, nodeId };
  }
  
  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    return this.nodes.get(nodeId);
  }
}
```

### Comlinkモック
```typescript
// __mocks__/comlink.ts
export const wrap = vi.fn((worker) => {
  return new MockWorkerAPI();
});

export const expose = vi.fn();
export const proxy = vi.fn((obj) => obj);
```

## テストデータ

### フィクスチャ
```typescript
// fixtures/treeData.ts
export const createMockTree = (): Tree => ({
  id: 'tree_test' as TreeId,
  rootNodeId: 'root_test' as NodeId,
  trashRootNodeId: 'trash_test' as NodeId,
  superRootNodeId: 'super_test' as NodeId,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

export const createMockNode = (
  overrides: Partial<TreeNode> = {}
): TreeNode => ({
  id: generateNodeId(),
  parentNodeId: 'root' as NodeId,
  nodeType: 'folder',
  name: 'Test Node',
  hasChild: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
  ...overrides
});
```

## カバレッジ目標

### パッケージ別目標
| パッケージ | ライン | ブランチ | 関数 |
|-----------|--------|----------|------|
| @hierarchidb/core | 95% | 90% | 95% |
| @hierarchidb/api | 90% | 85% | 90% |
| @hierarchidb/worker | 85% | 80% | 85% |
| @hierarchidb/ui-* | 80% | 75% | 80% |
| plugins/* | 75% | 70% | 75% |

### 測定コマンド
```bash
# 全体のカバレッジ
pnpm test:coverage

# 特定パッケージ
pnpm --filter @hierarchidb/core test:coverage

# HTMLレポート生成
pnpm test:coverage --reporter=html
```

## CI/CDでのテスト

### GitHub Actions設定
```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:run
      - run: pnpm test:coverage
      
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## テストのベストプラクティス

### 1. AAA パターン
```typescript
it('should update node name', async () => {
  // Arrange
  const node = createMockNode({ name: 'Old Name' });
  await db.nodes.add(node);
  
  // Act
  await updateNodeName(node.id, 'New Name');
  
  // Assert
  const updated = await db.nodes.get(node.id);
  expect(updated?.name).toBe('New Name');
});
```

### 2. 独立性の確保
- 各テストは独立して実行可能
- 共有状態を避ける
- beforeEach/afterEachでクリーンアップ

### 3. 意味のあるテスト名
```typescript
// ❌ Bad
it('should work', () => {});

// ✅ Good
it('should return empty array when no children exist', () => {});
```

### 4. エッジケースのテスト
```typescript
describe('getChildren', () => {
  it('should handle node with no children', () => {});
  it('should handle deleted parent node', () => {});
  it('should handle circular references', () => {});
  it('should handle maximum depth', () => {});
});
```