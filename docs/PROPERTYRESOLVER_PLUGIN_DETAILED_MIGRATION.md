# propertyresolver-plugin移行計画書

## 現状分析結果

### 現在のエラー状況（15件）

**カテゴリ別エラー分布**:
1. **型定義問題**: 6件（PluginDefinition generics、parameter types）
2. **未使用変数**: 5件（未使用import、未使用変数）
3. **undefined対策**: 4件（undefined可能性）

### プラグインの実装状況

**✅ propertyresolver-pluginは高度なデータ変換プラグイン**:
- **プロパティマッピング**: 異なるデータスキーマ間の変換
- **チェーン管理**: 複数の変換処理を連結
- **コンパイラ機能**: マッピングルールのコンパイル・最適化
- **キャッシュシステム**: 変換結果のキャッシュ管理

### 重要な発見
propertyresolver-pluginは**データ統合・変換**の専門プラグインです。異なるデータソース間のプロパティマッピングを自動化し、データ変換パイプラインを構築します。

## 実装済み機能の確認

### Core機能
```typescript
// PropertyResolver機能
export interface PropertyMappingRule {
  sourceProperty: string;
  targetProperty: string;
  transformation?: TransformationFunction;
  validation?: ValidationRule;
}

export interface ResolverChain {
  id: string;
  rules: PropertyMappingRule[];
  priority: number;
}
```

### 変換エンジン（完成済み）
- **ChainManager**: 変換チェーンの管理・実行
- **MappingCompiler**: マッピングルールのコンパイル・最適化
- **CacheManager**: 変換結果のキャッシュ管理
- **ValidationEngine**: データ検証機能

### UI Components（基本実装済み）
- **PropertyMappingStep**: プロパティマッピング設定
- **ChainConfigStep**: 変換チェーン設定
- **ValidationStep**: データ検証設定

## 具体的修正計画

### Phase 1: 型定義修正（30分）

#### 1.1 PluginDefinition generic修正
```typescript
// src/definitions/PropertyResolverDefinition.ts
// 修正前
export const PropertyResolverDefinition: PluginDefinition = {  // ← generic不足

// 修正後（generic引数追加）
export const PropertyResolverDefinition: PluginDefinition<PropertyResolverEntity> = {
  nodeType: 'propertyresolver',
  name: 'Property Resolver',
  displayName: 'プロパティリゾルバ',
  // ... 既存実装
};
```

#### 1.2 Parameter types修正
```typescript
// src/definitions/PropertyResolverDefinition.ts
// 修正前（implicit any types）
showInCreateMenu: (node, context) => {
  return true;
},
showInPluginList: (node, context) => {
  return true;
},

// 修正後（明示的型指定）
showInCreateMenu: (node: TreeNode, context: PluginContext) => {
  return true;
},
showInPluginList: (node: TreeNode, context: PluginContext) => {
  return true;
},
```

### Phase 2: 未使用変数クリーンアップ（20分）

#### 2.1 未使用import削除
```typescript
// src/definitions/PropertyResolverDefinition.ts
// 修正前
import type { NodeId } from '@hierarchidb/common-type';  // 未使用

// 修正後（未使用import削除）
// import type { NodeId } from '@hierarchidb/_obsolate_common-type';
```

#### 2.2 未使用変数削除
```typescript
// src/services/ChainManager.ts
// 修正前
const resolverCache = new Map();  // 未使用変数
function someMethod(options: any) {  // 未使用parameter
  // implementation
}

// 修正後
// const resolverCache = new Map();  // 削除
function someMethod(_options: any) {  // _ prefix for unused param
  // implementation
}
```

### Phase 3: undefined対策（25分）

#### 3.1 undefined可能性の安全な処理
```typescript
// src/services/ChainManager.ts
// 修正前
const result = someMethod();
const value = result.property;  // result がundefinedの可能性

// 修正後
const result = someMethod();
const value = result?.property || defaultValue;

// または
if (!result) {
  throw new Error('Result is undefined');
}
const value = result.property;
```

#### 3.2 MappingCompiler undefined対策
```typescript
// src/services/MappingCompiler.ts
// 修正前
const parallelThreshold = config.parallel;  // 未使用 + undefined可能性

// 修正後（使用する場合）
const parallelThreshold = config.parallel ?? 10;
if (data.length > parallelThreshold) {
  // parallel processing
}

// または削除（未使用の場合）
// const parallelThreshold = config.parallel;
```

## 作業順序と検証

### 推奨作業順序
1. **Phase 1**: 型定義修正（6件エラー解決）
2. **Phase 2**: 未使用変数クリーンアップ（5件警告解決）
3. **Phase 3**: undefined対策（4件エラー解決）

### 検証方法
```bash
# 各Phase後にエラー数確認
pnpm --filter @hierarchidb/propertyresolver-plugin typecheck

# 期待される改善:
# Phase 1完了後: 15件 → 9件（型定義修正）
# Phase 2完了後: 9件 → 4件（未使用変数クリーンアップ）
# Phase 3完了後: 4件 → 0件（undefined対策）

# 最終確認
pnpm --filter @hierarchidb/propertyresolver-plugin stage
```

## 依存関係と注意点

### 独立性
propertyresolver-pluginは**他プラグインに依存しない**独立プラグイン：
- ✅ 他プラグイン修正完了を待つ必要なし
- ✅ 即座に修正作業開始可能

### 既存機能の保持
- ✅ **プロパティマッピング機能**（スキーマ変換）
- ✅ **チェーン管理**（変換パイプライン）
- ✅ **コンパイラ機能**（ルール最適化）
- ✅ **キャッシュシステム**（性能最適化）

### 作業見積もり
- **Phase 1-3合計**: **1.25時間**
- **作業の性質**: 型定義修正とクリーンアップ
- **新機能実装**: **不要**（完成済み）

## 重要な確認

### 高度なデータ変換プラグイン
propertyresolver-pluginは**高度なデータ統合機能**を持つプラグインです：
- **自動スキーマ変換**: 異なるデータ形式間の自動変換
- **ルールエンジン**: 複雑なマッピングルールの実行
- **性能最適化**: コンパイル・キャッシュによる高速処理
- **拡張性**: カスタム変換関数の追加対応

### 修正の本質
必要な修正は**型定義の明確化とコードクリーンアップのみ**で、既存の高度なデータ変換機能はすべて保持されます。

この計画により、propertyresolver-pluginの15件のエラーを**1.25時間で**解決し、完成されたデータ変換機能を活用できるようになります。