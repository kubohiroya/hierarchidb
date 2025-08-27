# Folderプラグイン拡張APIリファレンス

## 概要

このドキュメントは、Folderプラグインを拡張する際に使用可能なAPI、インターフェース、メソッドの完全なリファレンスです。

## 目次

1. [基底クラス・インターフェース](#基底クラスインターフェース)
2. [拡張可能なメソッド](#拡張可能なメソッド)
3. [ライフサイクルフック](#ライフサイクルフック)
4. [ユーティリティ関数](#ユーティリティ関数)
5. [型定義](#型定義)

## 基底クラス・インターフェース

### FolderEntity

基底エンティティ型。全ての拡張プラグインはこの型を継承します。

```typescript
interface FolderEntity {
  id: EntityId;           // エンティティの一意識別子
  nodeId: NodeId;         // 関連するツリーノードID
  name: string;           // フォルダ名
  description: string;    // フォルダの説明
  settings: FolderSettings; // フォルダ設定
  metadata: Record<string, any>; // 汎用メタデータ
  createdAt: number;      // 作成日時（Unix timestamp）
  updatedAt: number;      // 更新日時（Unix timestamp）
  version: number;        // バージョン番号
}

interface FolderSettings {
  allowNestedFolders: boolean; // ネストを許可するか
  maxDepth: number;            // 最大階層深度
  sortOrder: 'name' | 'date' | 'type' | 'size'; // ソート順
}
```

### FolderEntityHandler

基底ハンドラークラス。データ操作の基本実装を提供。

```typescript
class FolderEntityHandler {
  // データベースインスタンス
  protected folderDB: FolderDatabase;
  
  // 基本CRUD操作
  async createEntity(nodeId: NodeId, data?: Partial<FolderEntity>): Promise<FolderEntity>;
  async getEntity(nodeId: NodeId): Promise<FolderEntity | undefined>;
  async updateEntity(nodeId: NodeId, data: Partial<FolderEntity>): Promise<void>;
  async deleteEntity(nodeId: NodeId): Promise<void>;
  
  // Working Copyパターン
  async createWorkingCopy(nodeId: NodeId): Promise<FolderEntityWorkingCopy>;
  async commitWorkingCopy(nodeId: NodeId, workingCopy: FolderEntityWorkingCopy): Promise<void>;
  async discardWorkingCopy(nodeId: NodeId): Promise<void>;
  async updateWorkingCopy(workingCopyId: EntityId, updates: Partial<FolderEntityWorkingCopy>): Promise<FolderEntityWorkingCopy>;
  
  // 追加機能
  async cleanup(nodeId: NodeId): Promise<void>;
  async searchFolders(query: string): Promise<FolderEntity[]>;
}
```

### FolderCreateDialog

基底ダイアログコンポーネント。

```typescript
interface FolderCreateDialogProps {
  parentId: NodeId;              // 親ノードID
  onSubmit: (data: FolderCreateData) => Promise<void>; // 送信ハンドラ
  onCancel: () => void;          // キャンセルハンドラ
  open?: boolean;                // ダイアログ開閉状態
}

interface FolderCreateData {
  name: string;         // フォルダ名
  description?: string; // 説明（オプション）
}
```

## 拡張可能なメソッド

### createEntity (オーバーライド可能)

新規エンティティ作成時の処理をカスタマイズ。

```typescript
class ExtendedHandler extends FolderEntityHandler {
  async createEntity(nodeId: NodeId, data?: Partial<ExtendedEntity>): Promise<ExtendedEntity> {
    // 基底の処理を実行
    const baseEntity = await super.createEntity(nodeId, data);
    
    // 拡張フィールドの初期化
    const extendedEntity: ExtendedEntity = {
      ...baseEntity,
      customField: data?.customField || 'default',
      additionalData: {}
    };
    
    // 拡張データの保存
    await this.saveExtendedData(nodeId, extendedEntity);
    
    return extendedEntity;
  }
}
```

### updateEntity (オーバーライド可能)

エンティティ更新時の処理をカスタマイズ。

```typescript
async updateEntity(nodeId: NodeId, data: Partial<ExtendedEntity>): Promise<void> {
  // バリデーション追加
  if (data.customField && !this.isValidCustomField(data.customField)) {
    throw new Error('Invalid custom field value');
  }
  
  // 基底の更新処理
  await super.updateEntity(nodeId, data);
  
  // 追加の処理（キャッシュ更新など）
  await this.updateRelatedData(nodeId, data);
}
```

### createWorkingCopy (オーバーライド可能)

作業コピー作成時の処理をカスタマイズ。

```typescript
async createWorkingCopy(nodeId: NodeId): Promise<ExtendedWorkingCopy> {
  const baseWorkingCopy = await super.createWorkingCopy(nodeId);
  
  // 拡張データを作業コピーに含める
  const extendedData = await this.getExtendedData(nodeId);
  
  return {
    ...baseWorkingCopy,
    ...extendedData,
    isDraft: true
  };
}
```

## ライフサイクルフック

### beforeCreate

エンティティ作成前に実行されるフック。

```typescript
export const ExtendedDefinition = {
  lifecycle: {
    beforeCreate: async (nodeId: NodeId, data: any) => {
      // 事前検証
      await validateData(data);
      
      // リソースの準備
      await prepareResources(nodeId);
      
      console.log(`Creating entity for node: ${nodeId}`);
    }
  }
};
```

### afterCreate

エンティティ作成後に実行されるフック。

```typescript
afterCreate: async (nodeId: NodeId, entity: ExtendedEntity) => {
  // 関連データの作成
  await createRelatedData(nodeId, entity);
  
  // 通知の送信
  await notifyCreation(entity);
  
  // インデックスの更新
  await updateSearchIndex(entity);
}
```

### beforeUpdate

エンティティ更新前に実行されるフック。

```typescript
beforeUpdate: async (nodeId: NodeId, oldData: ExtendedEntity, newData: Partial<ExtendedEntity>) => {
  // 変更の検証
  await validateChanges(oldData, newData);
  
  // 履歴の記録
  await recordHistory(nodeId, oldData);
}
```

### afterUpdate

エンティティ更新後に実行されるフック。

```typescript
afterUpdate: async (nodeId: NodeId, entity: ExtendedEntity, changes: Partial<ExtendedEntity>) => {
  // キャッシュの無効化
  await invalidateCache(nodeId);
  
  // 依存データの更新
  await updateDependencies(nodeId, changes);
}
```

### beforeDelete

エンティティ削除前に実行されるフック。

```typescript
beforeDelete: async (nodeId: NodeId, entity: ExtendedEntity) => {
  // 削除可能性の確認
  if (await hasActiveReferences(nodeId)) {
    throw new Error('Cannot delete: entity has active references');
  }
  
  // バックアップの作成
  await createBackup(entity);
}
```

### afterDelete

エンティティ削除後に実行されるフック。

```typescript
afterDelete: async (nodeId: NodeId) => {
  // 関連データのクリーンアップ
  await cleanupRelatedData(nodeId);
  
  // インデックスからの削除
  await removeFromSearchIndex(nodeId);
}
```

## ユーティリティ関数

### validateFolderName

フォルダ名の検証。

```typescript
function validateFolderName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Name is required' };
  }
  
  if (name.length > 255) {
    return { isValid: false, error: 'Name is too long (max 255 characters)' };
  }
  
  if (!/^[^<>:"/\\|?*]+$/.test(name)) {
    return { isValid: false, error: 'Invalid characters in name' };
  }
  
  return { isValid: true };
}
```

### mergeSettings

設定のマージ。

```typescript
function mergeSettings(
  base: FolderSettings, 
  extended: Partial<ExtendedSettings>
): ExtendedSettings {
  return {
    ...base,
    ...extended,
    // 配列の場合は結合
    permissions: [...(base.permissions || []), ...(extended.permissions || [])],
    // ネストされたオブジェクトの場合は深いマージ
    advanced: {
      ...base.advanced,
      ...extended.advanced
    }
  };
}
```

### generateEntityId

エンティティID生成。

```typescript
function generateEntityId(): EntityId {
  return crypto.randomUUID() as EntityId;
}
```

### getCurrentTimestamp

現在のタイムスタンプ取得。

```typescript
function getCurrentTimestamp(): number {
  return Date.now();
}
```

## 型定義

### 拡張用の型パラメータ

```typescript
// 基底と拡張の関係を型で表現
type ExtendedEntity<TBase = FolderEntity> = TBase & {
  // 追加フィールド
  [key: string]: any;
};

// ジェネリックを使った型安全な拡張
interface ExtensionConfig<TBase, TExtended extends TBase> {
  baseType: TBase;
  extendedType: TExtended;
  converter: (base: TBase) => TExtended;
}
```

### バリデーション型

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

type Validator<T> = (value: T) => ValidationResult | Promise<ValidationResult>;

interface ValidationChain<T> {
  validators: Validator<T>[];
  mode: 'all' | 'stopOnFirst';
}
```

### ステップ定義型

```typescript
interface StepDefinition {
  stepNumber: number;
  title: string;
  component: React.ComponentType<StepProps>;
  validation?: Validator<any>;
  dependsOn?: number[];
  isOptional?: boolean;
  canSkip?: boolean;
}

interface StepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  onSkip?: () => void;
  errors?: string[];
  isLoading?: boolean;
}
```

### データベース拡張型

```typescript
interface DatabaseExtension {
  extends: string;              // 基底テーブル名
  additionalColumns: {          // 追加カラム定義
    [columnName: string]: string | {
      type: string;
      index?: boolean;
      unique?: boolean;
      nullable?: boolean;
    };
  };
  additionalIndexes?: string[]; // 追加インデックス
  version?: number;             // スキーマバージョン
}
```

## 使用例

### 完全な拡張実装例

```typescript
// 1. エンティティ定義
interface TaskEntity extends FolderEntity {
  priority: 'low' | 'medium' | 'high';
  dueDate?: number;
  assignee?: string;
  status: 'todo' | 'in_progress' | 'done';
  tags: string[];
}

// 2. ハンドラー実装
class TaskEntityHandler extends FolderEntityHandler {
  async createEntity(nodeId: NodeId, data?: Partial<TaskEntity>): Promise<TaskEntity> {
    const baseEntity = await super.createEntity(nodeId, data);
    
    const taskEntity: TaskEntity = {
      ...baseEntity,
      priority: data?.priority || 'medium',
      status: data?.status || 'todo',
      tags: data?.tags || [],
      dueDate: data?.dueDate
    };
    
    await this.folderDB.tasks.add(taskEntity);
    return taskEntity;
  }
  
  async getTasksByStatus(status: TaskEntity['status']): Promise<TaskEntity[]> {
    return await this.folderDB.tasks
      .where('status')
      .equals(status)
      .toArray();
  }
  
  async updateTaskStatus(
    nodeId: NodeId, 
    status: TaskEntity['status']
  ): Promise<void> {
    await this.updateEntity(nodeId, { status, updatedAt: Date.now() });
    
    // ステータス変更時の追加処理
    if (status === 'done') {
      await this.onTaskComplete(nodeId);
    }
  }
  
  private async onTaskComplete(nodeId: NodeId): Promise<void> {
    // 完了時の処理
    console.log(`Task ${nodeId} completed`);
  }
}

// 3. プラグイン定義
export const TaskPluginDefinition: ExtendableNodeTypeDefinition<FolderEntity, TaskEntity, any> = {
  extends: 'folder',
  nodeType: 'task',
  name: 'Task',
  displayName: 'Task Manager',
  
  extendedSteps: [
    {
      stepNumber: 2,
      title: 'Task Details',
      component: TaskDetailsStep,
      validation: {
        validate: async (data) => {
          if (!data.priority) {
            return { isValid: false, errors: ['Priority is required'] };
          }
          return { isValid: true, errors: [] };
        }
      }
    }
  ],
  
  extendedFields: [
    {
      name: 'priority',
      type: 'enum',
      required: true,
      label: 'Priority',
      validation: {
        pattern: /^(low|medium|high)$/
      }
    },
    {
      name: 'dueDate',
      type: 'date',
      required: false,
      label: 'Due Date'
    }
  ],
  
  lifecycle: {
    afterCreate: async (nodeId: NodeId, entity: TaskEntity) => {
      console.log(`Task created: ${entity.name} with priority ${entity.priority}`);
    }
  }
};
```

## 関連ドキュメント

- [拡張ガイド](./EXTENDING_FOLDER_PLUGIN.md)
- [型定義](../src/types/index.ts)
- [実装例](../src/handlers/FolderEntityHandler.ts)