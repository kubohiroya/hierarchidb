# タグ管理システム仕様書

## 概要

HierarchiDBにおけるタグ管理システムは、ツリーノード全体で共有される統一的なタグ付けメカニズムを提供します。このシステムは`RelationalEntity`として実装され、複数のノードタイプ間で一貫性のあるタグ管理を実現します。

## アーキテクチャ

### エンティティ構造

#### TagEntity（RelationalEntity）
```typescript
interface TagEntity extends RelationalEntity {
  // 基本属性
  name: string;           // タグ名（表示名）
  color: string;          // 16進数カラーコード
  description?: string;   // タグの説明
  category: 'system' | 'user' | 'auto';  // タグカテゴリ
  usageCount: number;     // 使用頻度
  
  // RelationalEntityから継承
  nodeIds: NodeId[];      // 参照しているノードID一覧
  referenceCount: number; // 参照カウント
  lastAccessedAt: Timestamp; // 最終アクセス日時
}
```

#### NodeTagAssociation（中間テーブル）
```typescript
interface NodeTagAssociation {
  id: EntityId;          // 一意ID（将来的に専用型に切替予定）
  nodeId: NodeId;         // ノードID
  tagId: TagId;           // タグID
  assignedAt: Timestamp;  // 割り当て日時
  assignedBy?: string;    // 割り当て者（オプション）
}
```

### ライフサイクル管理

1. **作成**: 新しいタグを作成時、`referenceCount = 0`で初期化
2. **参照追加**: ノードにタグを割り当て時、`referenceCount`をインクリメント
3. **参照削除**: ノードからタグを削除時、`referenceCount`をデクリメント
4. **自動削除**: `referenceCount = 0`かつ`category = 'auto'`の場合、自動削除

## データベーススキーマ

### TagDatabase（Dexie）
```typescript
// テーブル定義
tags: '&id, name, category, usageCount, *nodeIds, referenceCount'
nodeTagAssociations: '&id, nodeId, tagId, assignedAt, [nodeId+tagId]'
```

### インデックス設計
- **tags**テーブル:
  - プライマリキー: `id` (TagId)
  - セカンダリインデックス: `name`, `category`, `usageCount`
  - 複合インデックス: `nodeIds`（マルチエントリ）

- **nodeTagAssociations**テーブル:
  - プライマリキー: `id` (EntityId)  // 将来 `AssociationId` に置換可能
  - ユニーク複合インデックス: `[nodeId+tagId]`
  - 外部キーインデックス: `nodeId`, `tagId`

## API仕様

### TagService メソッド

#### タグCRUD操作
```typescript
// 作成
createTag(request: CreateTagRequest): Promise<TagEntity>

// 更新
updateTag(tagId: TagId, request: UpdateTagRequest): Promise<TagEntity>

// 削除
deleteTag(tagId: TagId): Promise<void>

// 検索
searchTags(options: TagSearchOptions): Promise<TagSuggestion[]>

// 全取得
getAllTags(): Promise<TagEntity[]>
```

#### ノード-タグ関連付け
```typescript
// タグ追加
addTagToNode(nodeId: NodeId, tagId: TagId): Promise<void>

// タグ削除
removeTagFromNode(nodeId: NodeId, tagId: TagId): Promise<void>

// ノードのタグ取得
getTagsForNode(nodeId: NodeId): Promise<TagEntity[]>
```

### Comlink API（UI-Worker間通信）
```typescript
interface TagWorkerAPI {
  // タグ管理
  createTag(request: CreateTagRequest): Promise<TagEntity>;
  updateTag(tagId: TagId, request: UpdateTagRequest): Promise<TagEntity>;
  deleteTag(tagId: TagId): Promise<void>;
  
  // 検索・取得
  searchTags(options: TagSearchOptions): Promise<TagSuggestion[]>;
  getAllTags(): Promise<TagEntity[]>;
  
  // ノード関連付け
  addTagToNode(nodeId: NodeId, tagId: TagId): Promise<void>;
  removeTagFromNode(nodeId: NodeId, tagId: TagId): Promise<void>;
  getTagsForNode(nodeId: NodeId): Promise<TagEntity[]>;
}
```

## UIコンポーネント仕様

### TagInput コンポーネント
```typescript
interface TagInputProps {
  value: TagId[];                    // 選択済みタグのID配列
  onChange: (tags: TagId[]) => void; // タグ変更コールバック
  placeholder?: string;              // プレースホルダーテキスト
  maxTags?: number;                 // 最大タグ数
  allowCreate?: boolean;            // 新規タグ作成許可
  filterCategories?: ('system' | 'user' | 'auto')[]; // フィルタ対象カテゴリ
  disabled?: boolean;               // 無効化フラグ
}
```

#### 機能仕様
1. **オートコンプリート**: 入力時に既存タグを候補表示
2. **新規作成**: 存在しないタグの即座作成
3. **視覚的表示**: タグごとの色分け表示
4. **削除機能**: ×ボタンでタグ削除
5. **キーボード操作**: Enter、Backspace、Escapeキー対応

### CategorySelector コンポーネント
```typescript
interface CategorySelectorProps<T extends string> {
  value: T | null;                  // 選択済みカテゴリ
  onChange: (category: T) => void;  // カテゴリ変更コールバック
  options: CategoryOption<T>[];     // 選択肢定義
  placeholder?: string;             // プレースホルダー
  required?: boolean;               // 必須フィールド
  disabled?: boolean;               // 無効化フラグ
}

interface CategoryOption<T extends string> {
  value: T;                         // 内部値（ブランド型）
  label: string;                    // 表示名
  description?: string;             // 説明
  icon?: React.ReactNode;           // アイコン
  color?: string;                   // 色
}
```

## プラグイン拡張仕様

### 基本情報フォームの構成
各プラグインのStep1は以下の構成で統一：

```typescript
interface BasicInfoFormProps {
  workingCopy: T;                   // プラグイン固有のWorkingCopy型
  onUpdate: (updates: Partial<T>) => void;
  disabled?: boolean;
}
```

#### レイアウト順序
1. **名前入力** (TextField - 必須)
2. **説明入力** (TextField - 任意、複数行)
3. **タグ入力** (TagInput - 任意)
4. **プラグイン固有フィールド** (カテゴリ選択等)

### プラグイン固有フィールドの追加方法

#### 1. 型定義の拡張
```typescript
// packages/plugins/[plugin]/src/types/index.ts
export interface LocationEntity extends PeerEntity {
  name: string;
  description?: string;
  tags: TagId[];                    // 追加
  category: LocationCategory;       // 追加
  // ... その他の固有フィールド
}
```

#### 2. カテゴリ型の定義
```typescript
// ブランド型として定義
export type LocationCategory = 
  | 'transportation' 
  | 'administrative' 
  | 'infrastructure';

export const LOCATION_CATEGORIES: CategoryOption<LocationCategory>[] = [
  {
    value: 'transportation',
    label: '交通機関',
    description: '空港、駅、港湾などの交通関連施設',
    icon: <TransportationIcon />,
    color: '#2196f3'
  },
  // ... 他のカテゴリ
];
```

#### 3. Step1コンポーネントの実装
```typescript
export const LocationBasicInfoStep: React.FC<BasicInfoFormProps<LocationWorkingCopy>> = ({
  workingCopy,
  onUpdate,
  disabled
}) => {
  return (
    <Stack spacing={3}>
      {/* 共通フィールド */}
      <TextField
        label="名前"
        value={workingCopy.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        required
        disabled={disabled}
      />
      
      <TextField
        label="説明"
        value={workingCopy.description || ''}
        onChange={(e) => onUpdate({ description: e.target.value })}
        multiline
        rows={3}
        disabled={disabled}
      />
      
      <TagInput
        value={workingCopy.tags}
        onChange={(tags) => onUpdate({ tags })}
        disabled={disabled}
      />
      
      {/* プラグイン固有フィールド */}
      <CategorySelector
        value={workingCopy.category}
        onChange={(category) => onUpdate({ category })}
        options={LOCATION_CATEGORIES}
        placeholder="カテゴリを選択"
        required
        disabled={disabled}
      />
    </Stack>
  );
};
```

## データ永続化仕様

### WorkingCopy への保存
Step1からStep2への遷移時、フォーム値をWorkingCopyに保存：

```typescript
const handleNextStep = () => {
  // バリデーション
  if (!workingCopy.name) {
    throw new Error('名前は必須です');
  }
  
  // WorkingCopyに保存
  updateWorkingCopy({
    name: workingCopy.name,
    description: workingCopy.description,
    tags: workingCopy.tags,
    category: workingCopy.category,
    updatedAt: Date.now(),
    version: workingCopy.version + 1
  });
  
  setActiveStep(1); // Step2へ遷移
};
```

### データベースへのコミット
最終的にcommitChanges()実行時、TagServiceを使用してノード-タグ関連付けを作成：

```typescript
const handleCommit = async () => {
  // 1. PeerEntityを保存
  const entity = await entityHandler.commitWorkingCopy(nodeId);
  
  // 2. タグ関連付けを保存
  for (const tagId of workingCopy.tags) {
    await tagService.addTagToNode(nodeId, tagId);
  }
  
  onClose();
};
```

## パフォーマンス考慮事項

### キャッシュ戦略
1. **タグ候補キャッシュ**: 頻繁に使用されるタグ候補をメモリキャッシュ
2. **検索結果キャッシュ**: 検索クエリの結果を一定時間キャッシュ
3. **使用統計の遅延更新**: 使用回数更新を非同期で実行

### インデックス最適化
1. **複合インデックス**: `[nodeId+tagId]`で一意制約と高速検索を両立
2. **部分インデックス**: よく使用されるタグのみインデックス作成
3. **フルテキスト検索**: タグ名・説明の高速検索

## セキュリティ仕様

### アクセス制御
1. **システムタグ保護**: `category: 'system'`タグは削除・変更不可
2. **一括操作制限**: 大量のタグ操作にレート制限
3. **入力値検証**: タグ名の長さ・文字種制限

### データ整合性
1. **トランザクション**: 関連付け操作は原子的に実行
2. **制約チェック**: 外部キー制約の手動実装
3. **定期整合性チェック**: 孤立レコードの検出・清理

## テスト仕様

### 単体テスト
- TagServiceの全メソッド
- データベース操作の整合性
- エラーハンドリング

### 統合テスト
- UI-Worker間通信
- タグ作成から削除までのフルフロー
- 複数ノードでのタグ共有

### パフォーマンステスト
- 大量タグでの検索性能
- 同時多数操作の処理性能
- メモリ使用量の測定

## 制限事項

1. **最大タグ数**: 1ノードあたり最大50タグ
2. **タグ名長**: 最大100文字
3. **検索結果**: 最大200件まで返却
4. **色数制限**: 定義済み16色から選択（カスタム色未対応）
5. **階層構造**: タグの階層化は未対応

## 今後の拡張計画

1. **階層タグ**: カテゴリ・サブカテゴリによる階層構造
2. **スマートタグ**: ルールベースの自動タグ付け
3. **タグ統計**: 使用傾向の可視化ダッシュボード
4. **インポート/エクスポート**: 他システムとのタグ連携
5. **全文検索**: タグ内容に基づく高度な検索機能
