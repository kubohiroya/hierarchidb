# Working Copy システム改善提案

## 概要

eria-cartographの実装分析により、Working Copyシステムに以下の改善が必要と判明しました。

## 現在の課題

### 1. Draft概念の欠如
現在の仕様では新規作成と既存ノード編集が区別されていません。

### 2. Working Copy管理の複雑性
単一のWorkingCopyインターフェースでは、異なるライフサイクルを持つ用途を適切に表現できません。

## 改善提案

### 1. Draft/Working Copyの分離

```typescript
// 新規作成用のDraft
export interface DraftProperties {
  isDraft?: boolean; // 新規作成中のノードを示す
}

// 既存ノード編集用のWorking Copy
export interface WorkingCopyProperties {
  workingCopyOf?: TreeNodeId; // 編集対象の元ノードID
  copiedAt?: Timestamp; // コピー作成時刻
}

// TreeNodeの基本構造に両方を含める
export interface TreeNodeBase {
  // ... 既存プロパティ
}

export type TreeNode = TreeNodeBase & 
  Partial<WorkingCopyProperties> & 
  Partial<DraftProperties> &
  Partial<TrashItemProperties>;
```

### 2. Working Copy操作の拡張

#### API拡張提案

```typescript
// 新規作成用Draft操作
export interface CreateWorkingCopyForCreatePayload {
  workingCopyId: UUID;
  parentTreeNodeId: TreeNodeId;
  treeNodeType: TreeNodeType; // 追加：ノードタイプ指定
  name: string;
  description?: string;
}

// Draft→本体への変換操作
export interface CommitWorkingCopyForCreatePayload {
  workingCopyId: UUID;
  isDraft: boolean; // 追加：Draft状態の制御
  onNameConflict?: OnNameConflict;
}
```

### 3. Descendant情報の管理改善

#### 現在の問題
- `hasChild: boolean`のみで、パフォーマンス最適化が困難
- 子ノード数の管理ができない

#### 改善提案

```typescript
export interface DescendantProperties {
  hasChildren?: boolean;      // 子ノードの有無
  descendantCount?: number;   // 直接の子ノード数
  isEstimated?: boolean;      // 推定値かどうか（大量データ時の最適化）
}

export interface TreeNodeWithChildren extends TreeNode {
  children?: TreeNodeId[];
  // DescendantPropertiesを含める
  hasChildren?: boolean;
  descendantCount?: number;
  isEstimated?: boolean;
}
```

## API設計の改善

### 1. 直接操作APIの追加

現在のCommand Envelopeパターンに加えて、直接操作APIも提供：

```typescript
export interface TreeMutationServiceDirect {
  // Working Copy直接操作
  createNewDraftWorkingCopy(
    parentTreeNodeId: TreeNodeId,
    treeNodeType: TreeNodeType,
    baseName: string,
  ): Promise<TreeNodeId>;

  createWorkingCopy(treeNode: TreeNode): Promise<TreeNodeId>;

  commitWorkingCopy(
    workingCopyNodeId: TreeNodeId,
    isDraft: boolean,
  ): Promise<void>;

  discardWorkingCopy(workingCopyNodeId: TreeNodeId): Promise<void>;

  // 基本操作
  update(
    treeNodeId: TreeNodeId,
    updates: Partial<TreeNode>,
  ): Promise<void>;

  move(
    targetTreeNodeId: TreeNodeId,
    moveToParentTreeNodeId: TreeNodeId,
  ): Promise<void>;

  duplicate(ids: TreeNodeId[]): Promise<void>;

  // 高度な操作
  groupDescendants(ids: TreeNodeId[]): Promise<TreeNode[]>;
  getAllDescendants(nodeId: TreeNodeId): Promise<TreeNodeId[]>;
  getPathToRoot(nodeId: TreeNodeId): Promise<TreeNode[]>;
}
```

### 2. プラグインアーキテクチャの統合

```typescript
export interface WorkerAPIPlugin<T> {
  name: string;
  instance: T;
  getProxy(): T & ProxyMarked;
  getSingleton(): Promise<WorkerAPIPlugin<T>>;
}

export class WorkerFacade {
  facade: Record<string, WorkerAPIPlugin<unknown>>;

  async initialize(): Promise<WorkerFacade>;
  getProxy<T>(name: string): T & ProxyMarked;
}
```

## 実装優先順位

### Phase 1: 基本Working Copy改善 (1週間)
- [ ] DraftProperties/WorkingCopyPropertiesの分離
- [ ] TreeNodeBase型の拡張
- [ ] Working Copy操作の基本実装

### Phase 2: Descendant管理改善 (1週間)  
- [ ] DescendantPropertiesの導入
- [ ] TreeNodeWithChildrenの拡張
- [ ] パフォーマンス最適化実装

### Phase 3: API統合 (1週間)
- [ ] 直接操作APIの実装
- [ ] Command EnvelopeとDirect APIの統合
- [ ] プラグインアーキテクチャの導入

## 互換性への配慮

### 既存API保持
現在のCommand EnvelopeベースのAPIは保持し、新しいDirect APIを追加する形で段階的移行を可能にします。

### 型の後方互換性
既存の型定義は非推奨（deprecated）マークをつけつつ維持し、新しい型への移行パスを提供します。

## まとめ

この改善により、以下が実現されます：

1. **明確な責任分離**: Draft作成と既存ノード編集の明確な分離
2. **パフォーマンス向上**: Descendant情報の効率的管理
3. **開発体験向上**: 直接的で理解しやすいAPI
4. **拡張性**: プラグインベースの柔軟な拡張

eria-cartographでの実証済みパターンを活用することで、実装リスクを最小化しながら品質向上を図れます。