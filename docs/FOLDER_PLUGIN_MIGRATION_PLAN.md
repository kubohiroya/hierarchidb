# folder-plugin移行計画書（修正版）

## 🚨 重要な発見

**Working Copy APIは既に完成実装が存在**していました。私の初期分析は間違っており、実際に必要な作業は**既存実装の移動と型調整のみ**です。

## 現状分析結果（修正版）

### 現在のエラー状況（109件）

**正しいカテゴリ別エラー分布**:
1. **Working Copy API参照**: 29件（.old.ts実装が参照されていない）
2. **型不整合**: 28件（FolderEntityExtended vs FolderEntity）
3. **Import/Export問題**: 22件（共通plugin-baseパッケージ、型の未exportなど）
4. **NodeId/EntityId変換**: 15件（branded typeの不一致）
5. **UIコンポーネント**: 15件（i18next、tagsフィールドなど）

## アーキテクチャ変更の影響分析

### 廃止されたもの
1. **@hierarchidb/common-plugin-base**: 完全削除済み
2. **MetadataEntityHandler**: 削除済み
3. **tags・metadataフィールド**: 新アーキテクチャから除外

### 新規導入されたもの
1. **@hierarchidb/base-plugin**: 新しい基底クラス群
   - `BaseEntityHandler<TEntity, TDraft, TCreateData, TSearchCriteria>`
   - `HierarchicalEntityHandler<TEntity, TDraft, TCreateData, TSearchCriteria>`
2. **HierarchicalEntity interface**: nodeId必須フィールド追加

### 既存実装の発見
1. **FolderEntityHandler.old.ts**: Working Copy API完全実装済み
2. **完成されたテストケース**: 統合テスト・単体テスト実装済み
3. **Manager実装**: 適切な委譲パターン実装済み

### 変更されたもの
1. **PluginMetadata型**: `description`フィールド削除
2. **DialogStepDefinition型**: `stepNumber`フィールド必須化
3. **タグ管理**: UIレベルでの実装から削除

## 具体的エラー分析と修正計画

### Phase 1: 既存Working Copy実装の復元（最優先）

**🚨 重要な発見**: Working Copy APIの実装は既にfolder-pluginに完成された形で存在していました。

**既存実装の場所**:
- `src/handlers/FolderEntityHandler.old.ts` - 完全実装済み
- `src/handlers/FolderEntityManager.ts` - Managerからの呼び出し実装済み
- `src/__tests__/FolderEntityHandler.test.ts` - テストケース実装済み

**修正作業**: 既存実装の移動と型調整のみ

#### 1.1 Working Copy実装の移動
```typescript
// FolderEntityHandler.old.ts から FolderEntityHandler.ts へ移動

async createDraft(nodeId: NodeId): Promise<FolderEntityDraft> {
  // 既に完成された実装が存在 - .old.tsから移動
  const entity = await this.getEntity(nodeId);
  const draftId = crypto.randomUUID() as EntityId;
  const now = Date.now();

  const draft: FolderEntityDraft = entity ? {
    id: draftId,
    nodeId,
    name: entity.name,
    description: entity.description,
    category: entity.category,
    settings: entity.settings || this.getDefaultSettings(),
    createdAt: now,
    updatedAt: now,
    version: entity.version,
    copiedAt: now,
    originalNodeId: nodeId,
    originalVersion: entity.version,
  } : {
    // 新規作成時のデフォルト実装
    id: draftId,
    nodeId,
    name: 'New Folder',
    description: '',
    settings: this.getDefaultSettings(),
    createdAt: now,
    updatedAt: now,
    version: 1,
    copiedAt: now,
  };

  await this.folderDB.workingCopies.add(draft);
  return draft;
}

async updateDraft(draftId: EntityId, updates: Partial<FolderEntityDraft>): Promise<FolderEntityDraft> {
  // 既存実装を移動・型調整
}

async commitDraft(nodeId: NodeId, draft: FolderEntityDraft): Promise<void> {
  // 既存実装を移動
}

async discardDraft(nodeId: NodeId): Promise<void> {
  // 既存実装を移動
}
```

#### 1.2 型調整（tagsとmetadata除去）
```typescript
// .old.ts の実装から tags, metadata フィールドを除去
// FolderEntityDraft 型に合わせて調整
```

### Phase 2: 型整合性修正

#### 2.1 FolderEntityExtended の統合
**問題**: `FolderEntity` と `HierarchicalEntity` の統合が不完全

**修正**: `src/handlers/FolderEntityHandler.ts`
```typescript
// 現在の型定義を修正
export interface FolderEntityExtended extends FolderEntity, HierarchicalEntity {
  // FolderEntityの全フィールドを含む
  name: string;
  description?: string;
  category?: string;
  settings?: FolderSettings;
  
  // HierarchicalEntityから
  nodeId: NodeId;  // 既に含まれているが明示
  parentId?: NodeId;
  depth?: number;
  path?: string;
  childCount?: number;
}
```

#### 2.2 buildEntity メソッド修正
```typescript
// FolderEntityHandler.ts
protected buildEntity(
  nodeId: NodeId,
  entityId: EntityId,
  data: Partial<FolderEntity>
): FolderEntityExtended {
  const now = Date.now();

  return {
    // BaseEntity fields
    id: entityId,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    version: data.version || 1,
    
    // HierarchicalEntity fields
    nodeId,
    parentId: data.parentId,
    depth: data.depth || 0,
    path: data.path || `/${nodeId}`,
    childCount: 0,
    
    // FolderEntity fields
    name: data.name || 'New Folder',
    description: data.description,
    category: data.category,
    settings: data.settings || this.getDefaultSettings(),
    statistics: data.statistics
  } as FolderEntityExtended;
}

private getDefaultSettings(): FolderSettings {
  return {
    allowNestedFolders: true,
    maxDepth: 10,
    sortOrder: 'name',
    displayOptions: {
      iconColor: '#1976d2',
      iconType: 'default',
      sortDirection: 'asc',
      viewMode: 'list',
    },
    permissions: {
      isPublic: false,
      isReadOnly: false,
      allowedUsers: [],
      deniedUsers: [],
    }
  };
}
```

### Phase 3: Import/Export 修正

#### 3.1 types/RuntimeWorkerService.ts の修正
**問題**: 型が正しくexportされていない

```typescript
// src/types/RuntimeWorkerService.ts - 完全な書き直し
export type {
  FolderEntity,
  FolderBookmark,
  FolderTemplate,
  FolderDraft,
  FolderOperationResult,
  FolderSearchQuery,
  FolderStatsSummary,
  FolderStructureNode,
  FolderSettings
} from '../entities/FolderEntity';

// Working Copy types（現在不足）
export interface FolderEntityDraft extends FolderEntity {
  draftId: string;
  draftOf: NodeId;
  copiedAt: Timestamp;
  isDirty: boolean;
  expiresAt?: Timestamp;
}

// Search criteria
export interface FolderSearchCriteria extends HierarchicalSearchCriteria {
  category?: string;
  hasBookmarks?: boolean;
  hasTemplates?: boolean;
}

// Tag types（UIレベル使用）
export type { TagId } from '@hierarchidb/common-type';
```

#### 3.2 shared/RuntimeWorkerService.ts の修正
**問題**: API クラスと型がexportされていない

```typescript
// src/shared/RuntimeWorkerService.ts
export class FolderAPI {
  // 実装が必要
}

export interface CreateFolderData {
  name: string;
  description?: string;
  category?: string;
  settings?: Partial<FolderSettings>;
}

export interface UpdateFolderData extends Partial<CreateFolderData> {}

export interface FolderStatistics {
  totalFolders: number;
  totalFiles: number;
  maxDepth: number;
  averageChildrenPerFolder: number;
}

export * from './utils';
export * from './metadata';
```

### Phase 4: NodeId/EntityId 変換修正

#### 4.1 FolderEntityManager.ts の修正
**問題**: NodeId を EntityId として使用

```typescript
// src/handlers/FolderEntityManager.ts
export class FolderEntityManager {
  
  // NodeId -> EntityId 変換の実装
  private async getEntityIdByNodeId(nodeId: NodeId): Promise<EntityId | undefined> {
    const entity = await this.handler.getEntityByNodeId(nodeId);
    return entity?.id;
  }

  async getFolderByNodeId(nodeId: NodeId): Promise<FolderEntity | undefined> {
    const entity = await this.handler.getEntityByNodeId(nodeId);
    return entity || undefined; // null -> undefined 変換
  }

  async createDraft(nodeId: NodeId): Promise<FolderEntityDraft> {
    // 正しいWorking Copy作成
    return await this.handler.createDraft(nodeId);
  }

  async addBookmark(
    nodeId: NodeId,
    bookmarkData: Omit<FolderBookmark, 'id' | 'folderId'>
  ): Promise<FolderBookmark> {
    const entityId = await this.getEntityIdByNodeId(nodeId);
    if (!entityId) {
      throw new Error(`Entity not found for nodeId: ${nodeId}`);
    }
    
    // 正しい実装（戻り値を返す）
    return await this.handler.addBookmark(entityId, bookmarkData);
  }
}
```

### Phase 5: UI コンポーネント修正

#### 5.1 FolderBasicInfoStep.tsx の修正
**問題**: provider-i18next、tagsフィールド

```typescript
// src/ui/components/FolderBasicInfoStep.tsx
// import 修正
import { useTranslation } from 'react-i18next';  // provider-i18next -> react-i18next

// Tags フィールドは削除（UIレベルでは使用しない）
const handleUpdate = (updates: Partial<FolderEntityDraft>) => {
  // tags フィールドを除去
  const { tags, ...validUpdates } = updates;
  onUpdate(validUpdates);
};
```

#### 5.2 ui/RuntimeWorkerService.ts の修正
```typescript
// src/ui/RuntimeWorkerService.ts
export type {
  FolderEntity,
  FolderEntityDraft,
  FolderSettings,
  FolderBookmark,
  FolderTemplate,
  FolderSearchCriteria
} from '../types';

export { FolderDialog, FolderPanel } from './components';
export * from './hooks';
```

### Phase 6: Metadata とUtils修正

#### 6.1 shared/metadata.ts の修正
**問題**: PluginMetadata型に`description`フィールドが存在しない

```typescript
// src/shared/metadata.ts
export const FolderMetadata: PluginMetadata = {
  id: 'com.hierarchidb.folder-plugin',
  name: 'Folder Plugin',
  nodeType: 'folder' as NodeType,
  version: '1.0.0',
  author: 'HierarchiDB Team',
  status: 'active',
  tags: ['core', 'folder', 'hierarchy'],
  // description フィールドを削除
  
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: true,
    supportedOperations: ['create', 'read', 'update', 'delete', 'copy', 'move']
  },
  dependencies: []
};
```

#### 6.2 shared/fetchSaveMetadata.ts の修正
**問題**: FolderEntityにtagsプロパティが存在しない

```typescript
// src/shared/fetchSaveMetadata.ts
export function createDefaultFolderEntity(data: Partial<FolderEntity>): FolderEntity {
  return {
    id: crypto.randomUUID() as EntityId,
    nodeId: data.nodeId!,
    name: data.name || 'New Folder',
    description: data.description,
    category: data.category,
    // tags フィールドを削除
    settings: data.settings || getDefaultFolderSettings(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };
}

// tags 関連のユーティリティを削除
// export function getFolderTags(folder: FolderEntity): TagId[] {
//   return folder.tags || [];  // このメソッドを削除
// }
```

### Phase 7: テスト修正

#### 7.1 FolderEntityHandler.test.ts の修正
**問題**: 多数のAPIとプロパティの不一致

```typescript
// src/__tests__/FolderEntityHandler.test.ts
describe('FolderEntityHandler', () => {
  // Working Copy メソッドのテスト修正
  it('should create working copy', async () => {
    const draft = await handler.createDraft(nodeId);
    expect(draft).toBeDefined();
    expect(draft.draftId).toBeDefined();
    expect(draft.nodeId).toBe(nodeId);
  });

  // プロパティアクセステスト修正
  it('should have correct properties', async () => {
    const entity = await handler.createEntity(nodeId, { name: 'Test Folder' });
    expect(entity.name).toBe('Test Folder');
    expect(entity.description).toBeUndefined();
    expect(entity.settings).toBeDefined();
  });

  // EntityId/NodeId 変換テスト修正
  it('should handle ID conversion', async () => {
    const entity = await handler.createEntity(nodeId, { name: 'Test' });
    const foundEntity = await handler.getEntityByNodeId(nodeId);
    expect(foundEntity?.id).toBe(entity.id);
  });
});
```

## 作業順序と依存関係

### 依存関係分析
1. **Phase 1** → **Phase 2**: Working Copy API実装後に型整合性修正
2. **Phase 2** → **Phase 3**: 型確定後にexport修正
3. **Phase 3** → **Phase 4,5,6**: Import/Export修正後に個別修正
4. **Phase 7**: 全修正完了後にテスト修正

### 推奨作業順序
1. **Phase 1**: Working Copy API実装（base-pluginへの追加実装）
2. **Phase 2**: FolderEntityExtended型の統合
3. **Phase 3**: Import/Export の修正
4. **Phase 4**: NodeId/EntityId変換の修正
5. **Phase 5**: UIコンポーネント修正
6. **Phase 6**: Metadata・Utils修正
7. **Phase 7**: テスト修正

## 検証計画

### 各Phase完了後の確認
```bash
# エラー数の段階的減少を確認
pnpm --filter @hierarchidb/plugin-loader-folder-plugin typecheck

# 期待される改善:
# Phase 1完了後: 109件 → 80件以下（Working Copy API解決）
# Phase 2完了後: 80件 → 60件以下（型統合解決）
# Phase 3完了後: 60件 → 30件以下（Import/Export解決）
# Phase 4-6完了後: 30件 → 5件以下（個別問題解決）
# Phase 7完了後: 5件 → 0件（テスト修正）
```

### 最終確認
```bash
# ビルド成功確認
pnpm --filter @hierarchidb/plugin-loader-folder-plugin stage

# テスト実行確認
pnpm --filter @hierarchidb/plugin-loader-folder-plugin test
```

## 重要な作業注意点

### ✅ Phase 1の修正認識
**Working Copy API**は既にfolder-pluginに完全実装済みです。`FolderEntityHandler.old.ts`からの移動と型調整のみが必要です。

### 型の一貫性維持
`FolderEntityExtended`型は、`FolderEntity`と`HierarchicalEntity`の**すべてのフィールド**を含む必要があります。

### tags・metadata フィールドの完全削除
既存実装の`tags`と`metadata`フィールドを完全に削除し、新アーキテクチャに合わせます。

### ID変換の重要性
NodeId/EntityId の変換は、全てのAPIで一貫して行う必要があります。

## 修正された作業見積もり

### 実際の作業時間
- **Phase 1**: Working Copy実装移動（1時間）
- **Phase 2-3**: 型・Import修正（1-2時間）  
- **Phase 4-6**: 個別修正（1-2時間）
- **Phase 7**: テスト修正（30分）
- **合計**: **3-5時間**（以前の誤った見積もり: 数日間）

### 作業の本質
- ❌ 新機能実装
- ❌ 大規模なアーキテクチャ変更
- ✅ **既存完成コードの移動と型調整**

この計画により、folder-pluginの109件のエラーを**数時間で**段階的かつ確実に解決できます。