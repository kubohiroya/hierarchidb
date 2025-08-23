# 型安全性とバリデーション戦略

## はじめに

この章では、HierarchiDBにおける型安全性強化とバリデーション戦略について詳細に説明します。本章は以下のような方を対象としています：

**読むべき人**: TypeScript開発者、品質担保を重視する開発者、プラグイン開発者、システムアーキテクト、コードレビューを行う方、BaseMap・StyleMap・Shape・Spreadsheet・Projectプラグインなどの型安全性が重要なプラグインを実装する方

**前提知識**: TypeScript の高度な型システム（ブランデッド型、Conditional Types、Mapped Types）、バリデーションライブラリ（Zod等）、Lint設定、テスト駆動開発（TDD）

**読むタイミング**: プラグイン開発を開始する前、または既存コードの型安全性を強化する際に参照してください。特に複雑なデータ構造を扱うSpreadsheetプラグインや、大量の地理データを処理するShapeプラグインなどでは、本章で説明する型安全性戦略により、ランタイムエラーを大幅に削減できます。

型安全性の向上は、開発効率の向上とバグの早期発見に直結し、長期的なメンテナビリティを大幅に改善します。

## 概要

HierarchiDBの3層プラグインアーキテクチャにおける型安全性強化とバリデーション戦略について説明します。

## 1. 型安全性強化のアプローチ

### 1.1 Branded Types（ブランデッド型）

**目的**: 同じ基底型（string）を持つ異なるIDの混同を防ぐ

```typescript
// Before: すべてstring型で混同しやすい
function updateProject(nodeId: string, entityId: string, layerId: string) {
  // updateProject(layerId, nodeId, entityId) のような間違いが検出されない
}

// After: ブランデッド型で型安全
type NodeId = string & { readonly __brand: 'NodeId' };
type EntityId = string & { readonly __brand: 'EntityId' };
type LayerId = string & { readonly __brand: 'LayerId' };

function updateProject(nodeId: NodeId, entityId: EntityId, layerId: LayerId) {
  // コンパイル時に引数の順序間違いが検出される
}
```

### 1.2 Strict Type Guards（厳密な型ガード）

**目的**: ランタイムでの型安全性確保とunknown型からの安全な変換

```typescript
// Type guard with comprehensive validation
export function isProjectEntity(value: unknown): value is ProjectEntity {
  if (typeof value !== 'object' || value === null) return false;
  
  const entity = value as any;
  
  return isEntityId(entity.id) &&
    isNodeId(entity.nodeId) &&
    typeof entity.name === 'string' &&
    entity.name.length > 0 &&
    // ... 他のフィールドの厳密なチェック
}

// Usage: 外部データを安全に処理
function processExternalData(data: unknown) {
  if (isProjectEntity(data)) {
    // この時点でdataはProjectEntity型として扱える
    console.log(data.name); // 型安全
  }
}
```

### 1.3 Schema Validation System（スキーマバリデーション）

**目的**: 宣言的で再利用可能なバリデーションルール

```typescript
// Builder pattern for validation rules
const validateCreateProjectData = new ValidationBuilder<CreateProjectData>()
  .field('name')
    .required('Project name is required')
    .string()
    .custom((value) => {
      if (typeof value === 'string' && value.trim().length === 0) {
        return { field: 'name', message: 'Project name cannot be empty', severity: 'error' };
      }
      return null;
    })
  .field('description')
    .string()
    .custom((value) => {
      if (typeof value === 'string' && value.length > 1000) {
        return { field: 'description', message: 'Description too long', severity: 'warning' };
      }
      return null;
    })
  .build();
```

## 2. バリデーション戦略

### 2.1 多層バリデーション

#### Layer 1: TypeScript コンパイル時チェック
- ブランデッド型による間違い防止
- 厳密な型定義によるプロパティ漏れ検出
- 型ガードによる安全な型変換

#### Layer 2: ランタイム構造バリデーション  
- Type guardsによるデータ構造検証
- スキーマバリデーションによるビジネスルール適用
- エラーの詳細情報とフィールド特定

#### Layer 3: 非同期業務ルールバリデーション
- データベース制約チェック（重複チェックなど）
- 外部リソースの存在確認
- 複雑な業務ルール適用

### 2.2 UI・Worker層での使い分け

```typescript
// UI層: 即座フィードバック用の軽量バリデーション
export const ProjectUIPlugin = {
  validation: {
    validateForm: (data: CreateProjectData) => {
      // 同期バリデーションのみ（UX重視）
      return validateCreateProjectData(data);
    }
  }
};

// Worker層: 完全バリデーション
export class ProjectEntityHandler {
  async createEntity(nodeId: NodeId, data: CreateProjectData) {
    // 1. 同期バリデーション
    const syncResult = validateCreateProjectData(data);
    if (!syncResult.isValid) {
      throw new ProjectDataValidationError('Invalid data', 'data', syncResult.errors);
    }

    // 2. 非同期バリデーション（DB制約など）
    const asyncValidator = new ProjectAsyncValidator(
      this.checkProjectNameExists.bind(this),
      this.validateResourceReferences.bind(this)
    );
    const asyncResult = await asyncValidator.validate(data);
    
    if (!asyncResult.isValid) {
      throw new ProjectDataValidationError('Validation failed', 'data', asyncResult.errors);
    }

    // 3. エンティティ作成
    return this.createEntityInternal(nodeId, data);
  }
}
```

## 3. エラーハンドリング戦略

### 3.1 型付きエラークラス

```typescript
// 階層化されたエラー型
export abstract class ProjectValidationError extends Error {
  abstract readonly code: string;
  abstract readonly field?: string;
}

export class ProjectNameValidationError extends ProjectValidationError {
  readonly code = 'PROJECT_NAME_INVALID';
  readonly field = 'name';
}

export class ProjectDataValidationError extends ProjectValidationError {
  readonly code = 'PROJECT_DATA_INVALID';
  
  constructor(
    message: string,
    public readonly field: string,
    public readonly validationErrors: ValidationError[]
  ) {
    super(message);
  }
}
```

### 3.2 エラーハンドリングパターン

```typescript
// UI側での型安全なエラーハンドリング
const handleSubmit = async (data: CreateProjectData) => {
  try {
    const projectAPI = await getProjectAPI();
    await projectAPI.createEntity(nodeId, data);
    
    showSuccess('Project created successfully');
  } catch (error) {
    if (error instanceof ProjectNameValidationError) {
      setFieldError('name', error.message);
    } else if (error instanceof ProjectDataValidationError) {
      // 複数フィールドエラーの表示
      error.validationErrors.forEach(err => {
        setFieldError(err.field, err.message);
      });
    } else {
      showError('Unexpected error occurred');
    }
  }
};
```

## 4. パフォーマンス考慮

### 4.1 バリデーション最適化

```typescript
// メモ化による重複バリデーション回避
const memoizedValidator = useMemo(() => {
  return validateCreateProjectData;
}, []); // バリデーター自体は不変

// デバウンス付きバリデーション（リアルタイムフォーム用）
const debouncedValidation = useMemo(() => {
  return debounce((data: CreateProjectData) => {
    const result = validateCreateProjectData(data);
    setValidationErrors(result.errors);
  }, 300);
}, []);
```

### 4.2 段階的バリデーション

```typescript
// Step-by-step validation for large forms
const validateStep = (stepIndex: number, data: Partial<CreateProjectData>) => {
  switch (stepIndex) {
    case 0: // Basic information
      return validateCreateProjectData({ 
        name: data.name || '', 
        description: data.description || '' 
      });
    case 1: // Map configuration
      return data.mapConfig ? validateMapConfigurationStrict(data.mapConfig) : { isValid: true, errors: [] };
    // ... other steps
  }
};
```

## 5. 包括的テストスイート

### 5.1 3層アーキテクチャ対応テスト戦略

新しいプラグインアーキテクチャに完全対応したテストスイートを実装しました：

#### テストファイル構造
```
packages/plugins/project/src/
├── shared/__tests__/
│   ├── utils.test.ts           # バリデーション関数群
│   ├── validation.test.ts      # 型安全性システム
│   └── constants.test.ts       # 定数整合性
├── worker/__tests__/
│   ├── ProjectEntityHandler.test.ts  # データベース操作
│   ├── api.test.ts                   # プラグインAPI実装
│   └── integration/
│       └── full-workflow.test.ts     # エンドツーエンド
└── ui/__tests__/
    ├── hooks/
    │   └── useProjectAPI.test.tsx     # API アクセスフック
    └── components/
        ├── ProjectDialog.test.tsx     # ダイアログコンポーネント
        └── ProjectPanel.test.tsx      # パネルコンポーネント
```

### 5.2 型安全なテストデータファクトリ

```typescript
// Test data factory with type safety
const createMockProjectEntity = (overrides: Partial<ProjectEntity> = {}): ProjectEntity => {
  return {
    id: 'test-entity-id' as EntityId,
    nodeId: 'test-node-id' as NodeId,
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
    ...overrides // 型安全なオーバーライド
  };
};
```

### 5.2 バリデーション テストパターン

```typescript
describe('Project Validation', () => {
  it('should validate correct project data', () => {
    const validData: CreateProjectData = {
      name: 'Valid Project',
      description: 'Valid description'
    };

    const result = validateCreateProjectData(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid project name', () => {
    const invalidData: CreateProjectData = {
      name: '', // Invalid empty name
      description: 'Valid description'
    };

    const result = validateCreateProjectData(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        field: 'name',
        message: 'Project name cannot be empty',
        severity: 'error'
      })
    ]);
  });
});
```

## 6. 実装優先順位

### Phase 1: 基礎型安全性（すでに実装済み）
- [x] Branded types for IDs
- [x] Basic type guards  
- [x] Schema validation system

### Phase 2: 高度なバリデーション
- [ ] 非同期バリデーションシステム
- [ ] 型付きエラークラス階層
- [ ] UI層でのリアルタイムバリデーション

### Phase 3: パフォーマンス最適化
- [ ] バリデーション結果のメモ化
- [ ] 段階的バリデーション
- [ ] バックグラウンドバリデーション

### Phase 4: 開発者体験向上
- [ ] バリデーションエラーの詳細表示
- [ ] IDE統合（TSエラー表示の改善）
- [ ] 自動テスト生成

## 7. まとめ

この戦略により以下の効果が期待されます：

1. **コンパイル時安全性**: ブランデッド型による間違い防止
2. **ランタイム安全性**: 型ガードによる安全なデータ処理  
3. **開発効率**: 宣言的バリデーションによる保守性向上
4. **ユーザー体験**: 段階的バリデーションによる適切なフィードバック
5. **デバッグ効率**: 型付きエラーによる問題特定の高速化

これらの仕組みにより、大規模なプラグインエコシステムでも型安全性を維持しながら開発できます。