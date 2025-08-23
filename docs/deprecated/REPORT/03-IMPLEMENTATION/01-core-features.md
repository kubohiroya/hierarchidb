# 3.1 コア機能実装

## 基本CRUD操作

### CREATE（作成）
```typescript
// ノード作成の実装
class CreateNodeCommand extends Command {
  constructor(
    private payload: CreateNodePayload,
    private db: CoreDB
  ) {}
  
  async execute(): Promise<NodeId> {
    const nodeId = generateNodeId() as NodeId;
    const node: TreeNode = {
      id: nodeId,
      parentNodeId: this.payload.parentNodeId,
      nodeType: this.payload.nodeType,
      name: this.payload.name,
      description: this.payload.description,
      hasChild: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await this.db.nodes.add(node);
    return nodeId;
  }
}
```

### READ（読み取り）
```typescript
// 効率的なノード取得
class TreeQueryService {
  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    return await this.db.nodes.get(nodeId);
  }
  
  async getChildren(parentId: NodeId): Promise<TreeNode[]> {
    return await this.db.nodes
      .where('parentNodeId')
      .equals(parentId)
      .sortBy('name');
  }
  
  async getDescendants(
    nodeId: NodeId, 
    maxDepth = Infinity
  ): Promise<TreeNode[]> {
    const result: TreeNode[] = [];
    const queue: { node: TreeNode; depth: number }[] = [];
    
    const root = await this.getNode(nodeId);
    if (!root) return result;
    
    queue.push({ node: root, depth: 0 });
    
    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      result.push(node);
      
      if (depth < maxDepth) {
        const children = await this.getChildren(node.id);
        for (const child of children) {
          queue.push({ node: child, depth: depth + 1 });
        }
      }
    }
    
    return result;
  }
}
```

### UPDATE（更新）
```typescript
// 楽観的ロック付き更新
class UpdateNodeCommand extends Command {
  async execute(): Promise<void> {
    await this.db.transaction('rw', async () => {
      const node = await this.db.nodes.get(this.nodeId);
      if (!node) throw new Error('Node not found');
      
      // バージョンチェック
      if (node.version !== this.expectedVersion) {
        throw new Error('Concurrent modification detected');
      }
      
      // 更新実行
      await this.db.nodes.update(this.nodeId, {
        ...this.updates,
        updatedAt: Date.now(),
        version: node.version + 1
      });
    });
  }
}
```

### DELETE（削除）
```typescript
// カスケード削除
class DeleteNodeCommand extends Command {
  async execute(): Promise<void> {
    await this.deleteRecursive(this.nodeId);
  }
  
  private async deleteRecursive(nodeId: NodeId): Promise<void> {
    // 子ノードを先に削除
    const children = await this.db.nodes
      .where('parentNodeId')
      .equals(nodeId)
      .toArray();
    
    for (const child of children) {
      await this.deleteRecursive(child.id);
    }
    
    // 関連エンティティ削除
    await this.deleteRelatedEntities(nodeId);
    
    // ノード削除
    await this.db.nodes.delete(nodeId);
  }
}
```

## Undo/Redo機能

### コマンド履歴管理
```typescript
class CommandHistory {
  private history: Command[] = [];
  private currentIndex = -1;
  
  async execute(command: Command): Promise<any> {
    // 現在位置以降の履歴を削除
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // 実行と履歴追加
    const result = await command.execute();
    this.history.push(command);
    this.currentIndex++;
    
    return result;
  }
  
  async undo(): Promise<void> {
    if (this.currentIndex < 0) return;
    
    const command = this.history[this.currentIndex];
    await command.undo();
    this.currentIndex--;
  }
  
  async redo(): Promise<void> {
    if (this.currentIndex >= this.history.length - 1) return;
    
    this.currentIndex++;
    const command = this.history[this.currentIndex];
    await command.redo();
  }
}
```

### メモリ効率的な実装
```typescript
// Ring Buffer実装で無制限履歴
class RingBufferHistory {
  private buffer: Command[];
  private head = 0;
  private tail = 0;
  private size = 0;
  private readonly capacity = 10000;
  
  push(command: Command): void {
    this.buffer[this.tail] = command;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }
}
```

## ゴミ箱機能

### ソフト削除
```typescript
class MoveToTrashCommand extends Command {
  async execute(): Promise<void> {
    const node = await this.db.nodes.get(this.nodeId);
    if (!node) throw new Error('Node not found');
    
    // ゴミ箱に移動
    await this.db.nodes.update(this.nodeId, {
      originalParentNodeId: node.parentNodeId,
      originalName: node.name,
      parentNodeId: this.trashRootNodeId,
      name: `${node.name}_${Date.now()}`, // 重複回避
      removedAt: Date.now()
    });
  }
}
```

### 復元機能
```typescript
class RestoreFromTrashCommand extends Command {
  async execute(): Promise<void> {
    const node = await this.db.nodes.get(this.nodeId);
    if (!node || !node.originalParentNodeId) {
      throw new Error('Cannot restore node');
    }
    
    // 元の場所に復元
    await this.db.nodes.update(this.nodeId, {
      parentNodeId: node.originalParentNodeId,
      name: node.originalName,
      originalParentNodeId: undefined,
      originalName: undefined,
      removedAt: undefined
    });
  }
}
```

### 自動クリーンアップ
```typescript
class TrashCleanupService {
  private readonly RETENTION_DAYS = 30;
  
  async cleanupOldItems(): Promise<void> {
    const threshold = Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    const oldItems = await this.db.nodes
      .where('removedAt')
      .below(threshold)
      .toArray();
    
    for (const item of oldItems) {
      await new DeleteNodeCommand(item.id, this.db).execute();
    }
  }
}
```

## コピー・ペースト機能

### ノードのコピー
```typescript
class CopyNodeCommand extends Command {
  async execute(): Promise<NodeId> {
    const source = await this.db.nodes.get(this.sourceNodeId);
    if (!source) throw new Error('Source node not found');
    
    // 深いコピーの作成
    return await this.copyRecursive(source, this.targetParentId);
  }
  
  private async copyRecursive(
    source: TreeNode, 
    parentId: NodeId
  ): Promise<NodeId> {
    // 新しいノード作成
    const newNodeId = generateNodeId() as NodeId;
    const newNode: TreeNode = {
      ...source,
      id: newNodeId,
      parentNodeId: parentId,
      name: this.generateUniqueName(source.name, parentId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await this.db.nodes.add(newNode);
    
    // 子ノードも再帰的にコピー
    const children = await this.db.nodes
      .where('parentNodeId')
      .equals(source.id)
      .toArray();
    
    for (const child of children) {
      await this.copyRecursive(child, newNodeId);
    }
    
    // エンティティのコピー
    await this.copyEntities(source.id, newNodeId);
    
    return newNodeId;
  }
}
```

## 検索機能

### 全文検索
```typescript
class SearchService {
  async searchNodes(
    query: string,
    options: SearchOptions = {}
  ): Promise<TreeNode[]> {
    const {
      rootNodeId,
      maxDepth = Infinity,
      caseSensitive = false,
      searchInDescription = true,
      maxResults = 100
    } = options;
    
    // 検索対象ノードの取得
    const nodes = rootNodeId
      ? await this.getDescendants(rootNodeId, maxDepth)
      : await this.db.nodes.toArray();
    
    // フィルタリング
    const normalizedQuery = caseSensitive 
      ? query 
      : query.toLowerCase();
    
    const results = nodes.filter(node => {
      const nameMatch = caseSensitive
        ? node.name.includes(query)
        : node.name.toLowerCase().includes(normalizedQuery);
      
      const descMatch = searchInDescription && node.description
        ? caseSensitive
          ? node.description.includes(query)
          : node.description.toLowerCase().includes(normalizedQuery)
        : false;
      
      return nameMatch || descMatch;
    });
    
    return results.slice(0, maxResults);
  }
}
```

### インデックス検索
```typescript
// 高速検索用インデックス
class SearchIndex {
  private index = new Map<string, Set<NodeId>>();
  
  async buildIndex(): Promise<void> {
    const nodes = await this.db.nodes.toArray();
    
    for (const node of nodes) {
      // トークン化
      const tokens = this.tokenize(node.name);
      
      for (const token of tokens) {
        if (!this.index.has(token)) {
          this.index.set(token, new Set());
        }
        this.index.get(token)!.add(node.id);
      }
    }
  }
  
  search(query: string): NodeId[] {
    const tokens = this.tokenize(query);
    const results = new Set<NodeId>();
    
    for (const token of tokens) {
      const matches = this.index.get(token);
      if (matches) {
        for (const nodeId of matches) {
          results.add(nodeId);
        }
      }
    }
    
    return Array.from(results);
  }
  
  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/);
  }
}
```

## Observable パターン

### リアルタイム更新
```typescript
class TreeObservableService {
  private subscriptions = new Map<string, {
    nodeId: NodeId;
    callback: (event: TreeChangeEvent) => void;
    unsubscribe: () => void;
  }>();
  
  subscribeNode(
    nodeId: NodeId,
    callback: (event: TreeChangeEvent) => void
  ): SubscriptionId {
    const id = generateSubscriptionId();
    
    // Dexie.Observable利用
    const subscription = this.db.nodes
      .where('id')
      .equals(nodeId)
      .subscribe(changes => {
        callback({
          type: 'node-updated',
          nodeId,
          changes
        });
      });
    
    this.subscriptions.set(id, {
      nodeId,
      callback,
      unsubscribe: subscription.unsubscribe
    });
    
    return id;
  }
  
  unsubscribe(id: SubscriptionId): void {
    const sub = this.subscriptions.get(id);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(id);
    }
  }
}
```