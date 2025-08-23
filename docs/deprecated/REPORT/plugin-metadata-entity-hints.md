# PluginMetadata Entity Reference Hints

## 現状の問題

現在のPluginMetadataには、3x2エンティティライフサイクル管理における以下の参照情報が不足している：

1. **PeerEntity/GroupEntity参照ヒント**: どのnodeTypeから特定エンティティを取得できるか
2. **RelationalEntity参照ヒント**: 共有データへのアクセス方法
3. **エンティティ間の依存関係**: プラグイン間でのデータ共有関係

## 必要な拡張設計

### 1. PluginMetadataの拡張（統一されたネーミング規則）

```typescript
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  nodeType: TreeNodeType;
  status: 'active' | 'inactive' | 'error';
  capabilities?: PluginCapabilities;
  tags?: string[];
  dependencies?: string[];
  
  // 新規追加: エンティティ参照ヒント
  entityHints?: EntityReferenceHints;
}

export interface EntityReferenceHints {
  // PeerEntity/GroupEntity: TreeNodeを参照するプロパティ名
  // デフォルト: 'nodeId'
  nodeRefField?: string;
  
  // RelationalEntity: RelationalEntityを参照するプロパティ名  
  // デフォルト: 'relRef'
  relRefField?: string;
  
  // 注意: refCountFieldは不要 - PeerEntityの数が自然に参照カウントとなる
}
```

### 2. プラグイン実装例

#### A. plugin-spreadsheet（基盤プラグイン）

```typescript
export const SpreadsheetMetadata: PluginMetadata = {
  id: 'com.hierarchidb.spreadsheet',
  name: 'Spreadsheet',
  nodeType: 'spreadsheet',
  version: '1.0.0',
  description: 'Universal table data processing with Excel/CSV support',
  
  entityHints: {
    // SpreadsheetRefEntity.metadataId でRelationalEntityを参照
    relRefField: 'metadataId'
    // nodeRefField: 'nodeId' (デフォルト)
    // refCountFieldは不要 - 自然な参照カウント
  }
};

// PeerEntityの構造例
interface SpreadsheetRefEntity {
  nodeId: NodeId;           // nodeRefField (デフォルト)
  metadataId: string;       // relRefField (カスタマイズ)
  // refCountフィールドは不要 - PeerEntityの数が自然に参照カウント
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

#### B. plugin-stylemap（拡張プラグイン）

```typescript
export const StyleMapMetadata: PluginMetadata = {
  id: 'com.hierarchidb.stylemap',
  name: 'Style Map',
  nodeType: 'stylemap',
  version: '1.0.0',
  description: 'Map visualization with data-driven styling',
  dependencies: ['com.hierarchidb.spreadsheet'],
  
  entityHints: {
    // StyleMapEntity.spreadsheetMetadataId でRelationalEntityを参照
    relRefField: 'spreadsheetMetadataId'
    // nodeRefField: 'nodeId' (デフォルト)
    // refCountFieldは不要 - 自然な参照カウント
  }
};

// PeerEntityの構造例
interface StyleMapEntity {
  nodeId: NodeId;                    // nodeRefField (デフォルト)
  spreadsheetMetadataId: string;     // relRefField (カスタマイズ)
  // refCountフィールドは不要 - PeerEntityの数が自然に参照カウント
  keyColumn: string;
  colorRules: StyleMapColorRule[];
  defaultStyle: StyleMapStyle;
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### 3. Worker内での活用

#### A. 単純な参照フィールド名の取得

```typescript
class NodeLifecycleManager {
  async deleteNode(nodeId: NodeId) {
    const nodeType = await this.getNodeType(nodeId);
    const plugin = this.registry.getPlugin(nodeType);
    const handler = this.registry.getHandler(nodeType);
    
    if (handler) {
      // プラグイン側で全ての削除ロジック（参照カウント管理含む）を処理
      await handler.deleteEntity(nodeId);
    }
    
    // TreeNode自体を削除
    await this.treeDB.nodes.delete(nodeId);
  }
}
```

#### B. プラグイン側でのRelationalEntity管理

```typescript
class SpreadsheetEntityHandler {
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // RelationalEntityの管理はプラグイン側の責務
    const ref = await this.getSpreadsheetRef(nodeId);
    if (!ref) return;

    // PeerEntity削除
    await this.deleteSpreadsheetRef(nodeId);

    // 参照カウント減算（プラグイン側で実装）
    const newCount = await this.decrementReferenceCount(ref.metadataId);

    // カウントが0になった場合はRelationalEntity削除（プラグイン側で実装）
    if (newCount === 0) {
      await this.deleteSpreadsheetMetadata(ref.metadataId);
      await this.deleteSpreadsheetChunks(ref.metadataId);
    }
  }
  
  private async findByContentHash(contentHash: string): Promise<SpreadsheetMetadata | null> {
    // contentHash管理もプラグイン側の責務
    return await this.db.spreadsheetMetadata
      .where('contentHash')
      .equals(contentHash)
      .first() || null;
  }
}

### 4. 開発ツールサポート

#### A. プラグイン依存関係の視覚化

```typescript
class PluginDependencyAnalyzer {
  generateDependencyReport(): PluginDependencyReport {
    return {
      plugins: this.registry.getAllPlugins().map(plugin => ({
        id: plugin.id,
        name: plugin.name,
        provides: plugin.entityHints?.relationalEntities || [],
        consumes: plugin.entityHints?.entityDependencies || [],
        peerEntities: plugin.entityHints?.peerEntity ? [plugin.entityHints.peerEntity] : [],
        groupEntities: plugin.entityHints?.groupEntities || []
      })),
      
      dependencyGraph: this.buildDependencyGraph(),
      circularDependencies: this.detectCircularDependencies(),
      orphanedEntities: this.findOrphanedEntities()
    };
  }
}
```

## 自然な参照カウント管理の利点

### 1. シンプルな設計
- refCountプロパティが不要
- PeerEntityの数が自然に参照カウントとなる
- データの一貫性が保たれる

### 2. 実装例

```typescript
// LifecycleManager側
async handleNodeDeletion(nodeId: NodeId, nodeType: TreeNodeType): Promise<void> {
  // 1. PeerEntity取得
  const peerEntity = await handler.getPeerEntity(nodeId);
  const relRef = peerEntity?.relRefField;
  
  // 2. PeerEntity削除
  await handler.deletePeerEntity(nodeId);
  
  // 3. 残りのPeerEntity数をカウント
  const remainingCount = await handler.countPeerEntitiesByRelRef(relRef);
  
  // 4. 0になったらRelationalEntity削除
  if (remainingCount === 0) {
    await handler.deleteRelationalEntity(relRef);
  }
}

// プラグイン側
async countPeerEntitiesByRelRef(metadataId: SpreadsheetMetadataId): Promise<number> {
  // SELECT COUNT(*) FROM spreadsheet_refs WHERE metadataId = ?
  return await this.db.spreadsheetRefs.where('metadataId').equals(metadataId).count();
}
```

## 実装の優先順位

1. **Phase 1**: `EntityReferenceHints`インターフェースの簡素化と既存プラグインへの適用
2. **Phase 2**: 自然な参照カウント管理の実装とWorker統合
3. **Phase 3**: 開発ツールとデバッグ支援機能の実装

この設計により、プラグイン間のエンティティ依存関係がより自然で保守しやすい形で管理されます。