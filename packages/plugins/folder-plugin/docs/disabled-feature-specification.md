# Disabled Feature Specification

## 概要

HierarchiDBのすべてのノードタイプ（フォルダを含む）において、ノードの表示・検索からの除外機能を提供します。この機能により、プレビュー画面での表示や仮想プロパティ検索での利用から特定のノードを除外できます。

## 仕様詳細

### データ構造

#### PeerEntity Interface
```typescript
interface PeerEntity extends BaseEntity {
  // ... 既存のプロパティ
  
  /**
   * ノードの表示・検索からの除外設定（オプション）
   * 
   * @default undefined - 有効（表示・検索対象）
   * @description
   * - undefined: デフォルト（有効）
   * - true: このノードを除外（フォルダの場合は子孫も含む）
   * - false: 明示的に有効（親が無効でも強制有効にはならない）
   */
  disabled?: boolean;
}
```

### 階層的な無効化ロジック

#### 実効値の算出
実際に適用される無効化状態は、ツリー構造の**最上位から現在ノードまでの`disabled`値の論理和**で決定されます。

```typescript
/**
 * 指定されたノードの実効的なdisabled状態を計算
 * @param nodeId 対象ノードID
 * @returns true: 無効, false: 有効
 */
function computeEffectiveDisabledState(nodeId: NodeId): boolean {
  const ancestorPath = getAncestorPath(nodeId); // root → ... → current
  
  return ancestorPath.some(ancestorNodeId => {
    const entity = getEntityByNodeId(ancestorNodeId);
    return entity?.disabled === true;
  });
}
```

#### 例: 階層構造での適用

```
Project Root (disabled: undefined)
├── Folder A (disabled: true)        ← 無効設定
│   ├── Shape 1 (disabled: undefined) ← 親により無効
│   └── Shape 2 (disabled: false)     ← 親により無効（falseでも強制有効にならない）
├── Folder B (disabled: undefined)
│   ├── Shape 3 (disabled: true)      ← 直接無効設定
│   └── Shape 4 (disabled: undefined) ← 有効
└── Shape 5 (disabled: undefined)     ← 有効
```

**結果:**
- Shape 1, 2: 無効（Folder Aが無効のため）
- Shape 3: 無効（直接設定）
- Shape 4, 5: 有効

### UI実装

#### Step 1でのトグル設定
すべてのノードタイプのダイアログの**Step 1**（基本情報入力ステップ）において、スイッチ型UIコンポーネントを配置します。

```tsx
// FolderBasicInfoStep.tsx の実装例
export const FolderBasicInfoStep: React.FC<Props> = ({ data, onUpdate }) => {
  return (
    <Box>
      {/* 既存のフィールド... */}
      
      <FormControlLabel
        control={
          <Switch
            checked={data.disabled === true}
            onChange={(event) => onUpdate({ 
              disabled: event.target.checked ? true : undefined 
            })}
          />
        }
        label="表示・検索から除外"
        sx={{ mt: 2 }}
      />
      
      <Typography variant="caption" color="text.secondary">
        有効にすると、このノード（フォルダの場合は子孫も含む）が
        プレビュー画面や検索結果から除外されます
      </Typography>
    </Box>
  );
};
```

#### 視覚的表現
ツリー表示において、実効的な無効化状態に応じてアイコンを表示します。

```tsx
// ツリーノード表示コンポーネントでの実装例
const TreeNodeIcon: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const isEffectivelyDisabled = useEffectiveDisabledState(nodeId);
  
  return (
    <>
      <NodeTypeIcon nodeId={nodeId} />
      {isEffectivelyDisabled ? (
        <VisibilityOffIcon fontSize="small" color="disabled" />
      ) : (
        <VisibilityIcon fontSize="small" color="action" />
      )}
    </>
  );
};
```

### 機能への影響

#### 1. プレビュー画面での表示除外
- 地図プレビュー、リスト表示等で実効的に無効なノードは表示されない
- レンダリング処理でフィルタリング適用

#### 2. 仮想プロパティ検索での除外
- PropertyResolverによる仮想プロパティ検索時に無効なノードを除外
- インデックス構築時に実効disabled状態を考慮

```typescript
// 検索時のフィルタリング例
class VirtualPropertySearchService {
  async searchWithDisabledFilter(
    keyword: string, 
    includeDisabled: boolean = false
  ): Promise<SearchResult[]> {
    const rawResults = await this.searchByKeyword(keyword);
    
    if (includeDisabled) {
      return rawResults;
    }
    
    return rawResults.filter(result => 
      !this.computeEffectiveDisabledState(result.nodeId)
    );
  }
}
```

#### 3. 集約検索での適用
プロジェクト配下のshape, location, routeの串刺し検索においても、無効化されたノードは結果から除外されます。

### 実装上の注意点

#### パフォーマンス考慮
- 実効disabled状態の計算はコストが高いため、キャッシュ機構を実装
- ツリー構造変更時にキャッシュを無効化

```typescript
class DisabledStateCache {
  private cache = new Map<NodeId, boolean>();
  
  getEffectiveDisabledState(nodeId: NodeId): boolean {
    if (!this.cache.has(nodeId)) {
      const state = this.computeEffectiveDisabledState(nodeId);
      this.cache.set(nodeId, state);
    }
    return this.cache.get(nodeId)!;
  }
  
  invalidateSubtree(nodeId: NodeId): void {
    // 指定ノード以下のキャッシュを無効化
    const descendants = getDescendants(nodeId);
    descendants.forEach(id => this.cache.delete(id));
  }
}
```

#### データ移行
既存のエンティティにおいて`disabled`プロパティは`undefined`がデフォルトとなり、後方互換性を保持します。

## 利用シーン

### 1. 開発中データの一時除外
開発中・テスト中のデータを本番プレビューから除外

### 2. 段階的データ公開
プロジェクトの一部のみを段階的に公開する際の制御

### 3. 大容量データの選択的表示
パフォーマンス向上のため、不要な大容量データを一時的に除外

### 4. 多言語対応での地域別除外
特定の地域・言語向けデータの選択的表示制御

## 関連機能

- **PropertyResolver**: 仮想プロパティ検索での除外フィルタリング
- **Project Plugin**: プロジェクト配下ノードの集約検索での適用
- **Preview System**: 地図・リスト表示での除外処理
- **Tree UI**: ツリー表示での視覚的状態表現