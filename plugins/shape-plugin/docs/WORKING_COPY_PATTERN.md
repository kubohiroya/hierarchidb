# Working Copy Pattern - Shape Plugin

## 概要

Shape Pluginにおける**Working Copy Pattern**は、HierarchiDBのデータ整合性を保ちながら、安全でロールバック可能な編集機能を提供する中核的な設計パターンです。このドキュメントでは、Shape Pluginでの実装方法と利用方法について詳細に説明します。

## 目次

- [アーキテクチャ](#アーキテクチャ)
- [データフロー](#データフロー)
- [実装詳細](#実装詳細)
- [API リファレンス](#api-リファレンス)
- [利用シナリオ](#利用シナリオ)
- [ベストプラクティス](#ベストプラクティス)
- [トラブルシューティング](#トラブルシューティング)

## アーキテクチャ

### データベース層の分離

Working Copy Patternは、HierarchiDBの**デュアルデータベース戦略**に基づいています：

```
┌─────────────────────────────────────────┐
│              UI Layer                   │
│         (React Components)              │
└────────────────┬────────────────────────┘
                 │ Comlink RPC
┌────────────────▼────────────────────────┐
│            Worker Layer                 │
│       (EntityHandler API)               │
└────────┬────────────────┬───────────────┘
         │                │
┌────────▼──────┐ ┌──────▼──────────────┐
│    CoreDB     │ │    EphemeralDB      │
│ (永続データ)   │ │   (一時データ)       │
│               │ │                     │
│ ShapeEntity   │ │ ShapeWorkingCopy    │
└───────────────┘ └─────────────────────┘
```

### 主要コンポーネント

#### 1. ShapeEntity (CoreDB)
永続化される実際のShapeデータ：

```typescript
interface ShapeEntity {
  id: EntityId;                    // エンティティの一意識別子
  nodeId: NodeId;                   // ツリーノードへの参照
  dataSourceName: DataSourceName;  // データソース識別子
  selectedCountries: string[];     // 選択された国コード
  selectedAdminLevels: number[];   // 管理レベル
  licenseAgreement: boolean;       // ライセンス同意状態
  batchConfig?: BatchConfig;       // バッチ処理設定
  createdAt: number;               // 作成タイムスタンプ
  updatedAt: number;               // 更新タイムスタンプ
  version: number;                 // バージョン番号
}
```

#### 2. ShapeWorkingCopy (EphemeralDB)
編集中の一時データ：

```typescript
interface ShapeWorkingCopy {
  nodeId: NodeId;                  // 元のノードID（新規の場合は空）
  baseVersion: number;             // ベースバージョン
  isModified: boolean;             // 変更フラグ
  isDraft?: boolean;               // 新規作成フラグ
  changes: Partial<ShapeEntity>;  // 変更内容
}
```

## データフロー

### 1. 編集開始フロー

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Worker
    participant CoreDB
    participant EphemeralDB
    
    User->>UI: 編集ボタンクリック
    UI->>Worker: createWorkingCopy(nodeId)
    Worker->>CoreDB: getEntity(nodeId)
    CoreDB-->>Worker: ShapeEntity
    Worker->>Worker: クローン作成
    Worker->>EphemeralDB: save(workingCopy)
    Worker-->>UI: workingCopyId
    UI->>UI: 編集フォーム表示
```

### 2. 編集中フロー

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Worker
    participant EphemeralDB
    
    User->>UI: フィールド変更
    UI->>Worker: updateWorkingCopy(id, changes)
    Worker->>EphemeralDB: get(id)
    EphemeralDB-->>Worker: workingCopy
    Worker->>Worker: マージ処理
    Worker->>EphemeralDB: save(updated)
    Worker-->>UI: 更新完了
```

### 3. コミットフロー

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Worker
    participant CoreDB
    participant EphemeralDB
    
    User->>UI: 保存ボタンクリック
    UI->>Worker: commitWorkingCopy(id)
    Worker->>EphemeralDB: get(id)
    EphemeralDB-->>Worker: workingCopy
    
    alt 新規作成の場合
        Worker->>Worker: 新規NodeId生成
        Worker->>CoreDB: createEntity()
    else 既存更新の場合
        Worker->>CoreDB: updateEntity()
    end
    
    Worker->>EphemeralDB: delete(id)
    Worker-->>UI: nodeId
    UI->>UI: 成功通知表示
```

## 実装詳細

### ShapeEntityHandler の実装

```typescript
// packages/plugin-loader/shape-plugin/src/worker/handlers/ShapeEntityHandler.ts

export class ShapeEntityHandler {
  private coreDB: any;      // CoreDB接続
  private ephemeralDB: any; // EphemeralDB接続

  /**
   * 既存エンティティからWorking Copyを作成
   */
  async createWorkingCopy(entity: ShapeEntity): Promise<ShapeWorkingCopy> {
    const workingCopy: ShapeWorkingCopy = {
      id: entity.id,
      nodeId: entity.nodeId,
      name: entity.name,
      description: entity.description,
      dataSourceName: entity.dataSourceName,
      licenseAgreement: false, // セキュリティのため再同意を要求
      processingConfig: { ...entity.processingConfig },
      selectedCountries: [...entity.selectedCountries],
      adminLevels: [...entity.adminLevels],
      isDraft: false,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };

    // EphemeralDBに保存
    await this.ephemeralDB.workingCopies.put(workingCopy);
    
    console.log(`Created working copy for entity: ${entity.id}`);
    return workingCopy;
  }

  /**
   * 新規ドラフトWorking Copyを作成
   */
  async createNewDraftWorkingCopy(parentId: NodeId): Promise<ShapeWorkingCopy> {
    const workingCopyId = generateEntityId() as EntityId;

    const workingCopy: ShapeWorkingCopy = {
      id: workingCopyId,
      nodeId: '' as NodeId, // コミット時に設定
      name: '',
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: DEFAULT_PROCESSING_CONFIG,
      selectedCountries: [],
      adminLevels: [],
      isDraft: true, // 新規作成フラグ
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await this.ephemeralDB.workingCopies.put(workingCopy);
    
    console.log(`Created new draft working copy: ${workingCopyId}`);
    return workingCopy;
  }

  /**
   * Working Copyを更新
   */
  async updateWorkingCopy(
    workingCopyId: EntityId, 
    changes: Partial<ShapeEntity>
  ): Promise<ShapeWorkingCopy> {
    const existing = await this.ephemeralDB.workingCopies.get(workingCopyId);
    if (!existing) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    const updated: ShapeWorkingCopy = {
      ...existing,
      ...changes,
      isModified: true,
      updatedAt: Date.now(),
    };

    await this.ephemeralDB.workingCopies.put(updated);
    return updated;
  }

  /**
   * Working CopyをCoreDBにコミット
   */
  async commitWorkingCopy(workingCopyId: EntityId): Promise<NodeId> {
    // 1. EphemeralDBからWorking Copyを取得
    const workingCopy = await this.ephemeralDB.workingCopies.get(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    let nodeId: NodeId;
    
    // 2. 新規か既存かで処理を分岐
    if (workingCopy.isDraft) {
      // 新規エンティティの作成
      nodeId = generateNodeId() as NodeId;
      const entity: ShapeEntity = {
        ...workingCopy,
        id: generateEntityId() as EntityId,
        nodeId: nodeId,
        isDraft: undefined, // ドラフトフラグを削除
      };
      
      await this.coreDB.shapes.add(entity);
      console.log(`Created new entity from draft: ${entity.id}`);
      
    } else {
      // 既存エンティティの更新
      nodeId = workingCopy.nodeId;
      const entity = await this.coreDB.shapes.get(workingCopy.id);
      
      if (!entity) {
        throw new Error(`Original entity not found: ${workingCopy.id}`);
      }
      
      // バージョンチェック（楽観的ロック）
      if (entity.version !== workingCopy.version) {
        throw new Error('Version conflict detected. Please refresh and retry.');
      }
      
      const updated: ShapeEntity = {
        ...entity,
        ...workingCopy,
        version: entity.version + 1,
        updatedAt: Date.now(),
      };
      
      await this.coreDB.shapes.put(updated);
      console.log(`Updated entity: ${entity.id}`);
    }

    // 3. Working CopyをEphemeralDBから削除
    await this.ephemeralDB.workingCopies.delete(workingCopyId);
    console.log(`Committed and cleaned up working copy: ${workingCopyId}`);
    
    return nodeId;
  }

  /**
   * Working Copyを破棄
   */
  async discardWorkingCopy(workingCopyId: EntityId): Promise<void> {
    await this.ephemeralDB.workingCopies.delete(workingCopyId);
    console.log(`Discarded working copy: ${workingCopyId}`);
  }
}
```

### React Hook の実装

```typescript
// packages/plugin-loader/shape-plugin/src/ui/hooks/useShapeWorkingCopy.ts

export function useShapeWorkingCopy(
  nodeId: NodeId | null,
  mode: 'create' | 'edit'
) {
  const [workingCopy, setWorkingCopy] = useState<ShapeWorkingCopy | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const api = useShapeAPI();

  // Working Copyの初期化
  useEffect(() => {
    if (!nodeId && mode === 'edit') return;
    
    const initWorkingCopy = async () => {
      setIsLoading(true);
      try {
        let wc: ShapeWorkingCopy;
        
        if (mode === 'create') {
          // 新規作成
          wc = await api.createNewDraftWorkingCopy(nodeId || ('' as NodeId));
        } else {
          // 既存編集
          const entity = await api.getEntity(nodeId!);
          wc = await api.createWorkingCopy(entity);
        }
        
        setWorkingCopy(wc);
        setIsDirty(false);
      } catch (error) {
        console.error('Failed to initialize working copy:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initWorkingCopy();
  }, [nodeId, mode]);

  // Working Copyの更新
  const updateWorkingCopy = useCallback(
    async (changes: Partial<ShapeWorkingCopy>) => {
      if (!workingCopy) return;
      
      try {
        const updated = await api.updateWorkingCopy(workingCopy.id, changes);
        setWorkingCopy(updated);
        setIsDirty(true);
      } catch (error) {
        console.error('Failed to update working copy:', error);
        throw error;
      }
    },
    [workingCopy, api]
  );

  // コミット処理
  const commit = useCallback(async () => {
    if (!workingCopy) return;
    
    setIsLoading(true);
    try {
      const nodeId = await api.commitWorkingCopy(workingCopy.id);
      setIsDirty(false);
      return nodeId;
    } catch (error) {
      console.error('Failed to commit working copy:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [workingCopy, api]);

  // 破棄処理
  const discard = useCallback(async () => {
    if (!workingCopy) return;
    
    try {
      await api.discardWorkingCopy(workingCopy.id);
      setWorkingCopy(null);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to discard working copy:', error);
    }
  }, [workingCopy, api]);

  return {
    workingCopy,
    isDirty,
    isLoading,
    updateWorkingCopy,
    commit,
    discard,
  };
}
```

## API リファレンス

### EntityHandler API

| メソッド | 説明 | パラメータ | 戻り値 |
|---------|------|-----------|--------|
| `createWorkingCopy` | 既存エンティティからWorking Copyを作成 | `entity: ShapeEntity` | `Promise<ShapeWorkingCopy>` |
| `createNewDraftWorkingCopy` | 新規ドラフトWorking Copyを作成 | `parentId: NodeId` | `Promise<ShapeWorkingCopy>` |
| `getWorkingCopy` | Working Copyを取得 | `id: EntityId` | `Promise<ShapeWorkingCopy \| undefined>` |
| `updateWorkingCopy` | Working Copyを更新 | `id: EntityId, changes: Partial<ShapeEntity>` | `Promise<ShapeWorkingCopy>` |
| `commitWorkingCopy` | Working CopyをCoreDBにコミット | `id: EntityId` | `Promise<NodeId>` |
| `discardWorkingCopy` | Working Copyを破棄 | `id: EntityId` | `Promise<void>` |

### React Hooks

| Hook | 説明 | パラメータ | 戻り値 |
|------|------|-----------|--------|
| `useShapeWorkingCopy` | Shape編集用のWorking Copy管理 | `nodeId: NodeId \| null, mode: 'create' \| 'edit'` | Working Copy状態と操作関数 |

## 利用シナリオ

### シナリオ 1: 既存Shapeの編集

```typescript
// ShapeEditDialog.tsx

function ShapeEditDialog({ nodeId, onClose }: Props) {
  const {
    workingCopy,
    isDirty,
    isLoading,
    updateWorkingCopy,
    commit,
    discard,
  } = useShapeWorkingCopy(nodeId, 'edit');

  const handleCountryChange = async (countries: string[]) => {
    await updateWorkingCopy({
      selectedCountries: countries,
    });
  };

  const handleSave = async () => {
    try {
      await commit();
      toast.success('Shape updated successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to save changes');
    }
  };

  const handleCancel = async () => {
    if (isDirty) {
      const confirmed = await confirm('Discard unsaved changes?');
      if (!confirmed) return;
    }
    await discard();
    onClose();
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <Dialog open onClose={handleCancel}>
      <DialogTitle>Edit Shape</DialogTitle>
      <DialogContent>
        <CountrySelector
          value={workingCopy?.selectedCountries || []}
          onChange={handleCountryChange}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={!isDirty}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### シナリオ 2: 新規Shapeの作成

```typescript
// ShapeCreateDialog.tsx

function ShapeCreateDialog({ parentNodeId, onClose }: Props) {
  const {
    workingCopy,
    isDirty,
    updateWorkingCopy,
    commit,
    discard,
  } = useShapeWorkingCopy(null, 'create');

  const [step, setStep] = useState(0);

  const handleStepComplete = async (stepData: any) => {
    await updateWorkingCopy(stepData);
    setStep(step + 1);
  };

  const handleCreate = async () => {
    try {
      // 最終バリデーション
      if (!workingCopy?.name) {
        throw new Error('Name is required');
      }
      if (!workingCopy?.licenseAgreement) {
        throw new Error('License agreement is required');
      }

      const nodeId = await commit();
      toast.success(`Shape created: ${nodeId}`);
      onClose(nodeId);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <StepperDialog
      steps={[
        <BasicInfoStep onComplete={handleStepComplete} />,
        <DataSourceStep onComplete={handleStepComplete} />,
        <LicenseStep onComplete={handleStepComplete} />,
        <CountrySelectionStep onComplete={handleStepComplete} />,
        <ProcessingConfigStep onComplete={handleStepComplete} />,
      ]}
      currentStep={step}
      onFinish={handleCreate}
      onCancel={async () => {
        await discard();
        onClose();
      }}
    />
  );
}
```

### シナリオ 3: バッチ処理との統合

```typescript
// BatchProcessingDialog.tsx

function BatchProcessingDialog({ workingCopyId }: Props) {
  const [batchSession, setBatchSession] = useState<BatchSession | null>(null);
  const api = useShapeAPI();

  const startBatchProcessing = async () => {
    try {
      // Working Copyをコミット
      const nodeId = await api.commitWorkingCopy(workingCopyId);
      
      // バッチセッションを開始
      const session = await api.startBatchSession(nodeId, {
        downloadWorkers: 4,
        simplifyWorkers: 2,
        tileWorkers: 2,
      });
      
      setBatchSession(session);
    } catch (error) {
      console.error('Failed to start batch processing:', error);
    }
  };

  return (
    <Dialog>
      {/* バッチ処理UI */}
    </Dialog>
  );
}
```

## ベストプラクティス

### 1. エラーハンドリング

```typescript
// 常にtry-catchでエラーをハンドリング
try {
  await commitWorkingCopy(workingCopyId);
} catch (error) {
  if (error.message.includes('Version conflict')) {
    // バージョンコンフリクトの処理
    await refreshAndRetry();
  } else {
    // その他のエラー
    showErrorNotification(error);
  }
}
```

### 2. 変更の自動保存

```typescript
// デバウンスを使用した自動保存
const debouncedUpdate = useMemo(
  () => debounce(async (changes) => {
    await updateWorkingCopy(changes);
  }, 1000),
  [updateWorkingCopy]
);
```

### 3. 離脱防止

```typescript
// ページ離脱前の確認
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDirty]);
```

### 4. メモリリーク防止

```typescript
// コンポーネントのアンマウント時にWorking Copyを破棄
useEffect(() => {
  return () => {
    if (workingCopy && isDirty) {
      // 非同期でクリーンアップ
      api.discardWorkingCopy(workingCopy.id).catch(console.error);
    }
  };
}, []);
```

### 5. 楽観的更新

```typescript
// UIを即座に更新し、バックグラウンドで永続化
const handleChange = async (field: string, value: any) => {
  // 楽観的にUIを更新
  setLocalState({ ...localState, [field]: value });
  
  // バックグラウンドでWorking Copyを更新
  try {
    await updateWorkingCopy({ [field]: value });
  } catch (error) {
    // エラー時はUIを元に戻す
    setLocalState(prevState);
    showError('Failed to save changes');
  }
};
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Working Copyが見つからない

**エラー**: `Working copy not found: [id]`

**原因**: 
- EphemeralDBがクリアされた
- セッションタイムアウト
- ブラウザのリロード

**解決方法**:
```typescript
// Working Copyの再作成
const recoverWorkingCopy = async () => {
  const entity = await api.getEntity(nodeId);
  const newWorkingCopy = await api.createWorkingCopy(entity);
  setWorkingCopy(newWorkingCopy);
};
```

#### 2. バージョンコンフリクト

**エラー**: `Version conflict detected`

**原因**: 他のユーザーが同じエンティティを更新

**解決方法**:
```typescript
// 最新データを取得してマージ
const resolveConflict = async () => {
  const latest = await api.getEntity(nodeId);
  const merged = mergeChanges(workingCopy.changes, latest);
  await updateWorkingCopy(merged);
};
```

#### 3. メモリリーク

**症状**: Working Copyが蓄積される

**原因**: コンポーネントのアンマウント時にクリーンアップされない

**解決方法**:
```typescript
// 適切なクリーンアップの実装
useEffect(() => {
  const cleanup = async () => {
    if (workingCopyRef.current) {
      await api.discardWorkingCopy(workingCopyRef.current.id);
    }
  };

  return () => {
    cleanup();
  };
}, []);
```

#### 4. 保存の失敗

**エラー**: `Failed to commit working copy`

**原因**: 
- ネットワークエラー
- バリデーションエラー
- 権限不足

**解決方法**:
```typescript
// リトライメカニズムの実装
const commitWithRetry = async (maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await api.commitWorkingCopy(workingCopyId);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
};
```

## パフォーマンス最適化

### 1. 差分更新

```typescript
// 変更があったフィールドのみ送信
const updateOnlyChangedFields = async (newData: Partial<ShapeEntity>) => {
  const changes = diff(workingCopy, newData);
  if (Object.keys(changes).length > 0) {
    await updateWorkingCopy(changes);
  }
};
```

### 2. バッチ更新

```typescript
// 複数の変更をまとめて送信
const batchUpdates = useMemo(() => {
  const pending: Partial<ShapeEntity>[] = [];
  
  return {
    add: (changes: Partial<ShapeEntity>) => {
      pending.push(changes);
    },
    flush: async () => {
      if (pending.length === 0) return;
      const merged = pending.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      await updateWorkingCopy(merged);
      pending.length = 0;
    },
  };
}, [updateWorkingCopy]);
```

### 3. キャッシング

```typescript
// Working Copyのキャッシュ
const workingCopyCache = new Map<EntityId, ShapeWorkingCopy>();

const getCachedWorkingCopy = async (id: EntityId) => {
  if (workingCopyCache.has(id)) {
    return workingCopyCache.get(id);
  }
  
  const wc = await api.getWorkingCopy(id);
  if (wc) {
    workingCopyCache.set(id, wc);
  }
  return wc;
};
```

## まとめ

Working Copy Patternは、Shape Pluginにおいて以下の利点を提供します：

1. **データ整合性**: CoreDBは常に一貫した状態を維持
2. **安全な編集**: いつでもロールバック可能
3. **パフォーマンス**: EphemeralDBでの高速な編集操作
4. **ユーザビリティ**: 直感的な編集体験
5. **並行性**: 複数のWorking Copyを同時に管理可能

このパターンを正しく実装することで、堅牢で使いやすいShape編集機能を提供できます。

## 関連ドキュメント

- [HierarchiDB Architecture](../../../docs/ARCHITECTURE.md)
- [Entity Handler Pattern](../../../docs/ENTITY_HANDLER.md)
- [Batch Processing](./BATCH_PROCESSING_NOTIFICATION.md)
- [Dialog Flow](./DIALOG_FLOW_AND_STATE_TRANSITIONS.md)